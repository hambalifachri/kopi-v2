import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const configPath = join(root, ".env.tomoro-sync");
const fallbackKopkenConfigPath = join(root, ".env.kopken-sync");
const logDir = join(here, "logs");
mkdirSync(logDir, { recursive: true });

function loadEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).flatMap((line) => {
    const value = line.trim();
    if (!value || value.startsWith("#") || !value.includes("=")) return [];
    const index = value.indexOf("=");
    return [[value.slice(0, index).trim(), value.slice(index + 1).trim()]];
  }));
}

const env = {
  ...process.env,
  ...loadEnv(fallbackKopkenConfigPath),
  ...loadEnv(configPath),
};

const adb = env.ADB_PATH || "C:\\Users\\fachr\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";
const adbSerial = env.TOMORO_ADB_SERIAL || env.ADB_SERIAL || env.VSPHONE_ADB_TARGET || "localhost:65193";
const mcpCommand = env.HTTP_TOOLKIT_MCP || "C:\\Users\\fachr\\AppData\\Local\\Programs\\HTTP Toolkit\\resources\\httptoolkit-mcp.cmd";
const supabaseUrl = String(env.SUPABASE_URL || "")
  .replace(/\/rest\/v1\/?$/i, "")
  .replace(/\/$/, "");
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
const durationMs = Number(process.argv.find((arg) => arg.startsWith("--seconds="))?.split("=")[1] || 90) * 1000;
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function fail(message) {
  console.error(`\nGAGAL: ${message}`);
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey || supabaseKey.includes("ISI_")) {
  fail("Lengkapi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.tomoro-sync.");
}

function runAdb(args, timeout = 10000) {
  const result = spawnSync(adb, ["-s", adbSerial, ...args], { encoding: "utf8", windowsHide: true, timeout });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || result.stdout?.trim() || "ADB gagal.");
  return result.stdout || "";
}

class McpClient {
  constructor(command) {
    this.command = command;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";
  }

  async start() {
    this.proc = spawn(`"${this.command}"`, [], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, shell: true });
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk) => this.read(chunk));
    this.proc.on("exit", () => {
      for (const item of this.pending.values()) item.reject(new Error("HTTP Toolkit MCP berhenti."));
      this.pending.clear();
    });
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "tomoro-menu-sync", version: "1.0.0" },
    });
    this.notify("notifications/initialized", {});
  }

  read(chunk) {
    this.buffer += chunk;
    while (this.buffer.includes("\n")) {
      const index = this.buffer.indexOf("\n");
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line.startsWith("{")) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    }
  }

  send(message) { this.proc.stdin.write(`${JSON.stringify(message)}\n`); }

  request(method, params) {
    const id = this.nextId++;
    this.send({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout HTTP Toolkit: ${method}`));
      }, 60000);
      this.pending.set(id, {
        resolve: (result) => { clearTimeout(timer); resolvePromise(result); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
    });
  }

  notify(method, params) { this.send({ jsonrpc: "2.0", method, params }); }

  async call(name, args) {
    const result = await this.request("tools/call", { name, arguments: args });
    const text = (result.content || []).find((item) => item.type === "text")?.text;
    if (!text) throw new Error(`Respons kosong dari ${name}`);
    const parsed = JSON.parse(text);
    if (parsed.success === false) throw new Error(parsed.error || `${name} gagal`);
    return parsed.data;
  }

  close() { this.proc?.kill(); }
}

function textValue(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeStore(store) {
  const code = textValue(store.storeCode || store.code || store.store_code);
  return {
    store_code: code,
    store_name: textValue(store.storeName || store.name || store.store_name || code),
    store_address: textValue(store.storeAddress || store.address || store.store_address),
    city: textValue(store.city || store.cityName || store.areaName),
    latitude: numberValue(store.latitude || store.lat),
    longitude: numberValue(store.longitude || store.lng || store.lon),
    raw_store: store,
    source: "tomoro-httptoolkit-sync",
    updated_at: new Date().toISOString(),
  };
}

async function upsertStores(stores) {
  if (!stores.length) return [];
  const response = await fetch(`${supabaseUrl}/rest/v1/tomoro_outlets_catalog?on_conflict=store_code`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(stores),
  });
  if (!response.ok) throw new Error(`Supabase menolak outlet Tomoro: ${await response.text()}`);
  return response.json();
}

async function patchMenu(storeCode, menu) {
  const response = await fetch(`${supabaseUrl}/rest/v1/tomoro_outlets_catalog?store_code=eq.${encodeURIComponent(storeCode)}`, {
    method: "PATCH",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      menu,
      source: "tomoro-httptoolkit-sync",
      menu_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Supabase menolak menu Tomoro: ${await response.text()}`);
  return response.json();
}

async function responseBody(mcp, event) {
  const response = await mcp.call("events_get-response-body", { id: event.id, offset: 0, maxLength: 2000000 });
  return JSON.parse(String(response.body || "{}"));
}

function storeCodeFromUrl(url) {
  try {
    return new URL(url).searchParams.get("storeCode") || "";
  } catch {
    return "";
  }
}

async function processEvents(mcp, seenIds) {
  const filter = "hostname=api-service.tomoro-coffee.id status=200";
  const summary = await mcp.call("events_list", { filter, limit: 1 });
  if (!summary.total) return { outlets: 0, menus: 0 };
  const listed = await mcp.call("events_list", {
    filter,
    offset: Math.max(0, summary.total - 30),
    limit: 30,
  });
  let outlets = 0;
  let menus = 0;
  for (const event of listed.events || []) {
    if (seenIds.has(event.id)) continue;
    seenIds.add(event.id);
    const url = String(event.url || event.request?.url || "");
    if (!/getStoreList\/v3|getMenuList/.test(url)) continue;
    const body = await responseBody(mcp, event);
    if (/getStoreList\/v3/.test(url)) {
      const records = Array.isArray(body?.data?.records) ? body.data.records : [];
      const saved = await upsertStores(records.map(normalizeStore).filter((store) => store.store_code));
      outlets += saved.length;
      writeFileSync(join(logDir, "last-captured-outlets.json"), JSON.stringify(saved, null, 2));
    }
    if (/getMenuList/.test(url)) {
      const storeCode = storeCodeFromUrl(url);
      if (!storeCode) continue;
      await patchMenu(storeCode, body);
      menus++;
      writeFileSync(join(logDir, `last-captured-menu-${storeCode}.json`), JSON.stringify(body, null, 2));
    }
  }
  return { outlets, menus };
}

const mcp = new McpClient(mcpCommand);
try {
  spawnSync(adb, ["disconnect", adbSerial], { encoding: "utf8", windowsHide: true });
  spawnSync(adb, ["connect", adbSerial], { encoding: "utf8", windowsHide: true });
  runAdb(["shell", "am", "start", "-n", "com.tomoro.indonesia.android/com.tomoro.indonesia.module_main.SplashActivityDefault"]);
  await mcp.start();
  const seenIds = new Set();
  const endAt = Date.now() + durationMs;
  let outletTotal = 0;
  let menuTotal = 0;
  console.log("Tomoro capture aktif. Buka/cari outlet/menu di app Tomoro bila perlu.");
  while (Date.now() < endAt) {
    const result = await processEvents(mcp, seenIds);
    outletTotal += result.outlets;
    menuTotal += result.menus;
    await sleep(1500);
  }
  console.log(`Capture selesai. Outlet tersimpan: ${outletTotal}. Menu tersimpan: ${menuTotal}.`);
} catch (error) {
  fail(error.message);
} finally {
  mcp.close();
}

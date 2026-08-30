import { spawnSync } from "node:child_process";
import { connect } from "node:net";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const logDir = join(here, "logs");
const checkpointPath = join(logDir, "discover-outlets-progress.json");
const scrollCheckpointPath = join(logDir, "discover-outlets-scroll-progress.json");
const envPath = join(root, ".env.kopken-sync");
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

const env = { ...process.env, ...loadEnv(envPath) };
const adb = env.ADB_PATH || "C:\\Users\\fachr\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";
const adbSerial = env.ADB_SERIAL || env.VSPHONE_ADB_TARGET || "";
const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
const brokerPort = Number(env.KOPKEN_MCP_BROKER_PORT || 47831);
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

if (!adbSerial || !supabaseUrl || !supabaseKey) throw new Error("Konfigurasi ADB menu atau Supabase belum lengkap.");

function runAdb(args) {
  const result = spawnSync(adb, ["-s", adbSerial, ...args], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || result.stdout?.trim() || "ADB gagal.");
  return result.stdout || "";
}

class BrokerClient {
  constructor() { this.nextId = 1; this.pending = new Map(); this.buffer = ""; }
  async start() {
    await new Promise((resolvePromise, reject) => {
      this.socket = connect(brokerPort, "127.0.0.1", resolvePromise);
      this.socket.setEncoding("utf8");
      this.socket.once("error", reject);
    });
    this.socket.on("data", (chunk) => this.read(chunk));
  }
  read(chunk) {
    this.buffer += chunk;
    while (this.buffer.includes("\n")) {
      const split = this.buffer.indexOf("\n");
      const line = this.buffer.slice(0, split).trim();
      this.buffer = this.buffer.slice(split + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error)) : pending.resolve(message.result);
    }
  }
  request(method, params) {
    const id = this.nextId++;
    this.socket.write(`${JSON.stringify({ id, method, params })}\n`);
    return new Promise((resolvePromise, reject) => this.pending.set(id, { resolve: resolvePromise, reject }));
  }
  async call(name, args) {
    const result = await this.request("tools/call", { name, arguments: args });
    const text = (result.content || []).find((item) => item.type === "text")?.text;
    if (!text) throw new Error(`Respons kosong dari ${name}`);
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error(text.slice(0, 300)); }
    if (!parsed.success) throw new Error(parsed.error || `${name} gagal`);
    return parsed.data;
  }
  close() { this.socket?.destroy(); }
}

const eventFilter = "hostname=apps.kopikenangan.com method=POST path$=query_pageable_store status=200";

async function latestEventTimestamp(mcp) {
  const summary = await mcp.call("events_list", { filter: eventFilter, limit: 1 });
  if (!summary.total) return 0;
  const latest = await mcp.call("events_list", { filter: eventFilter, offset: summary.total - 1, limit: 1 });
  return Number(latest.events[0]?.timestamp || 0);
}

async function captureOutletResponse(mcp, afterTimestamp) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const summary = await mcp.call("events_list", { filter: eventFilter, limit: 1 });
    const listed = await mcp.call("events_list", {
      filter: eventFilter, offset: Math.max(0, summary.total - 5), limit: 5,
    });
    const event = listed.events.filter((item) => item.timestamp > afterTimestamp).at(-1);
    if (event) {
      const response = await mcp.call("events_get-response-body", { id: event.id, offset: 0, maxLength: 100000 });
      return JSON.parse(String(response.body || "{}"));
    }
    await sleep(200);
  }
  throw new Error("Respons pencarian outlet baru tidak ditemukan.");
}

function encodeAdbText(value) {
  return String(value).replace(/\s/g, "%s").replace(/([()])/g, "\\$1")
    .replace(/'/g, "\\'").replace(/[^\w%@.,'\\()\-/]/g, "");
}

async function searchOutlet(query, firstSearch) {
  runAdb(["shell", "svc", "power", "stayon", "true"]);
  runAdb(["shell", "input", "keyevent", "224"]);
  runAdb(["shell", "wm", "dismiss-keyguard"]);
  runAdb(["shell", "am", "start", "-n", "com.kopikenangan/.heart"]);
  await sleep(firstSearch ? 650 : 100);
  runAdb(["shell", "input", "tap", "965", "187"]);
  await sleep(80);
  runAdb(["shell", "input", "tap", "420", "270"]);
  runAdb(["shell", "input", "keyevent", "123"]);
  runAdb(["shell", "input", "keyevent", ...Array(80).fill("67")]);
  runAdb(["shell", "input", "text", encodeAdbText(query)]);
  runAdb(["shell", "input", "keyevent", "66"]);
  runAdb(["shell", "input", "keyevent", "111"]);
  await sleep(900);
}

async function loadCatalog() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${supabaseUrl}/rest/v1/kopken_outlets_catalog?select=outlet_code&order=outlet_code.asc&offset=${offset}&limit=1000`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    if (!response.ok) throw new Error(`Gagal membaca katalog Supabase: ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

function isKopiKenangan(store) {
  return Array.isArray(store?.brand_and_image)
    ? store.brand_and_image.some((brand) => Number(brand.brand_code) === 1)
    : /kopi kenangan/i.test(store?.brand_name || store?.brand || "Kopi Kenangan");
}

async function insertNewStores(stores, knownCodes) {
  const unique = new Map();
  for (const store of stores) {
    const code = String(store?.code || "").trim();
    if (!code || !store?.name || knownCodes.has(code) || !isKopiKenangan(store)) continue;
    unique.set(code, {
      outlet_code: code,
      outlet_name: String(store.name).replace(/^Kopi Kenangan\s*-\s*/i, "").trim(),
      outlet_address: store.address || "",
      category: store.category || "",
    });
  }
  const rows = [...unique.values()];
  if (!rows.length) return [];
  const response = await fetch(`${supabaseUrl}/rest/v1/kopken_outlets_catalog`, {
    method: "POST",
    headers: {
      apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`Supabase menolak outlet baru: ${await response.text()}`);
  for (const row of rows) knownCodes.add(row.outlet_code);
  return rows;
}

async function prepareScrollableOutletList(resuming) {
  runAdb(["shell", "svc", "power", "stayon", "true"]);
  runAdb(["shell", "input", "keyevent", "224"]);
  runAdb(["shell", "wm", "dismiss-keyguard"]);
  runAdb(["shell", "am", "start", "-n", "com.kopikenangan/.heart"]);
  await sleep(500);
  runAdb(["shell", "input", "keyevent", "111"]);
  if (resuming) return;

  // Buka pemilih outlet jika aplikasi masih berada di halaman menu.
  runAdb(["shell", "input", "tap", "965", "187"]);
  await sleep(500);
  runAdb(["shell", "input", "keyevent", "111"]);
  // Pastikan daftar dimulai dari atas, lalu pilih filter Kopi Kenangan.
  for (let index = 0; index < 6; index++) {
    runAdb(["shell", "input", "swipe", "540", "650", "540", "1650", "180"]);
    await sleep(80);
  }
  runAdb(["shell", "input", "tap", "840", "480"]);
  await sleep(1000);
}

function tapLoadMoreOutletsIfVisible() {
  const dumpPath = "/sdcard/kopken-discover-outlets.xml";
  try {
    runAdb(["shell", "uiautomator", "dump", dumpPath]);
    const hierarchy = runAdb(["shell", "cat", dumpPath]);
    const nodes = hierarchy.match(/<node\b[^>]*>/g) || [];
    const loadMore = nodes.find((node) => /(?:text|content-desc)="Lihat outlet lainnya"/i.test(node));
    const bounds = loadMore?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!bounds) return false;
    const x = Math.round((Number(bounds[1]) + Number(bounds[3])) / 2);
    const y = Math.round((Number(bounds[2]) + Number(bounds[4])) / 2);
    runAdb(["shell", "input", "tap", String(x), String(y)]);
    return true;
  } catch {
    return false;
  }
}

async function readNewOutletResponses(mcp, afterTimestamp, seenEventIds) {
  const summary = await mcp.call("events_list", { filter: eventFilter, limit: 1 });
  if (!summary.total) return [];
  const listed = await mcp.call("events_list", {
    filter: eventFilter,
    offset: Math.max(0, summary.total - 20),
    limit: 20,
  });
  const events = listed.events.filter((event) =>
    event.timestamp > afterTimestamp && !seenEventIds.has(event.id)
  );
  const responses = [];
  for (const event of events) {
    const response = await mcp.call("events_get-response-body", { id: event.id, offset: 0, maxLength: 100000 });
    seenEventIds.add(event.id);
    responses.push(JSON.parse(String(response.body || "{}")));
  }
  return responses;
}

async function scrollDiscoveryMain() {
  const catalog = await loadCatalog();
  const knownCodes = new Set(catalog.map((row) => row.outlet_code));
  let state = { started: false, pagesProcessed: 0, totalPages: 0 };
  if (existsSync(scrollCheckpointPath)) {
    try { state = JSON.parse(readFileSync(scrollCheckpointPath, "utf8")); } catch { /* mulai dari atas */ }
  }

  const mcp = new BrokerClient();
  await mcp.start();
  const seenEventIds = new Set();
  const discovered = [];
  let sessionLimited = false;
  let emptySwipes = 0;
  let afterTimestamp = await latestEventTimestamp(mcp);

  console.log(state.started
    ? `Melanjutkan scroll daftar outlet dari ${state.pagesProcessed} halaman sebelumnya.\n`
    : "Membuka daftar outlet dari paling atas dan mulai scroll sampai paling bawah.\n");

  try {
    await prepareScrollableOutletList(state.started);
    state.started = true;
    writeFileSync(scrollCheckpointPath, JSON.stringify(state, null, 2));

    for (let swipe = 0; swipe < 2500 && emptySwipes < 20; swipe++) {
      if (swipe > 0 || state.pagesProcessed > 0) {
        runAdb(["shell", "input", "swipe", "540", "1500", "540", "620", "240"]);
        await sleep(650);
      }
      try {
        const responses = await readNewOutletResponses(mcp, afterTimestamp, seenEventIds);
        if (!responses.length) {
          if (tapLoadMoreOutletsIfVisible()) {
            emptySwipes = 0;
            console.log("Tombol 'Lihat outlet lainnya' diklik, menunggu halaman berikutnya...");
            await sleep(900);
            continue;
          }
          emptySwipes++;
          console.log(`Tidak ada halaman baru (${emptySwipes}/20), lanjut scroll...`);
          continue;
        }
        emptySwipes = 0;
        for (const raw of responses) {
          const stores = Array.isArray(raw?.data?.store) ? raw.data.store : [];
          const inserted = await insertNewStores(stores, knownCodes);
          discovered.push(...inserted);
          state.pagesProcessed++;
          state.totalPages = Math.max(state.totalPages || 0, Number(raw?.data?.pages || 0));
          const pageLabel = state.totalPages ? `${state.pagesProcessed}/${state.totalPages}` : String(state.pagesProcessed);
          console.log(inserted.length
            ? `[halaman ${pageLabel}] BARU: ${inserted.map((row) => row.outlet_name).join(", ")}`
            : `[halaman ${pageLabel}] Tidak ada outlet baru.`);
          writeFileSync(scrollCheckpointPath, JSON.stringify(state, null, 2));
        }
        afterTimestamp = Math.max(afterTimestamp, ...responses.map(() => Date.now()));
      } catch (error) {
        if (/limited to 100 calls per session|Cannot connect to the HTTP Toolkit control socket/i.test(error.message)) {
          sessionLimited = true;
          console.log("Batas sesi HTTP Toolkit tercapai. Scroll dilanjutkan otomatis di sesi baru.\n");
          break;
        }
        throw error;
      }
    }
  } finally {
    mcp.close();
  }

  const reportPath = join(logDir, "outlet-baru-terakhir.json");
  writeFileSync(reportPath, JSON.stringify(discovered, null, 2));
  console.log(`Sesi selesai: ${discovered.length} outlet baru. Laporan: ${reportPath}`);
  if (sessionLimited) process.exitCode = 75;
  else {
    rmSync(scrollCheckpointPath, { force: true });
    console.log("Bagian paling bawah daftar tercapai. Pemeriksaan outlet selesai.");
  }
}

async function main() {
  const catalog = await loadCatalog();
  const knownCodes = new Set(catalog.map((row) => row.outlet_code));
  if (!existsSync(searchTermsPath)) throw new Error("outlet-discovery-terms.txt tidak ditemukan.");
  const queries = [...new Set(readFileSync(searchTermsPath, "utf8").split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line.length >= 3 && !line.startsWith("#")))];
  const completed = existsSync(checkpointPath)
    ? new Set(JSON.parse(readFileSync(checkpointPath, "utf8"))) : new Set();
  const mcp = new BrokerClient();
  await mcp.start();
  const discovered = [];
  let sessionLimited = false;
  let firstSearch = true;

  const completedQueries = queries.filter((query) => completed.has(query)).length;
  console.log(`Memeriksa outlet baru dari ${queries.length} pencarian (${completedQueries} sudah selesai).\n`);
  try {
    for (let index = 0; index < queries.length; index++) {
      const query = queries[index];
      if (completed.has(query)) continue;
      console.log(`[${index + 1}/${queries.length}] ${query}`);
      try {
        const timestamp = await latestEventTimestamp(mcp);
        await searchOutlet(query, firstSearch);
        firstSearch = false;
        const raw = await captureOutletResponse(mcp, timestamp);
        const stores = Array.isArray(raw?.data?.store) ? raw.data.store : [];
        const inserted = await insertNewStores(stores, knownCodes);
        discovered.push(...inserted);
        console.log(inserted.length ? `  BARU: ${inserted.map((row) => row.outlet_name).join(", ")}\n` : "  Tidak ada outlet baru.\n");
        completed.add(query);
        writeFileSync(checkpointPath, JSON.stringify([...completed], null, 2));
      } catch (error) {
        if (/limited to 100 calls per session|Cannot connect to the HTTP Toolkit control socket/i.test(error.message)) {
          sessionLimited = true;
          console.log("  Batas sesi HTTP Toolkit tercapai. Melanjutkan otomatis di sesi baru.\n");
          break;
        }
        console.log(`  GAGAL: ${error.message}\n`);
        completed.add(query);
        writeFileSync(checkpointPath, JSON.stringify([...completed], null, 2));
      }
    }
  } finally {
    mcp.close();
  }

  const reportPath = join(logDir, "outlet-baru-terakhir.json");
  writeFileSync(reportPath, JSON.stringify(discovered, null, 2));
  console.log(`Sesi selesai: ${discovered.length} outlet baru. Laporan: ${reportPath}`);
  if (sessionLimited) process.exitCode = 75;
  else {
    rmSync(checkpointPath, { force: true });
    console.log("Pemeriksaan seluruh outlet selesai.");
  }
}

scrollDiscoveryMain().catch((error) => {
  console.error(`GAGAL: ${error.message}`);
  process.exitCode = 1;
});

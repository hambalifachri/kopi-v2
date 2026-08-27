import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const configPath = join(root, ".env.kopken-sync");
const logDir = join(here, "logs");
const progressPath = join(logDir, "progress.json");
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

const env = { ...process.env, ...loadEnv(configPath) };
const adb = env.ADB_PATH || "C:\\Users\\fachr\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";
const mcpCommand = env.HTTP_TOOLKIT_MCP || "C:\\Users\\fachr\\AppData\\Local\\Programs\\HTTP Toolkit\\resources\\httptoolkit-mcp.cmd";
const supabaseUrl = (env.SUPABASE_URL || "")
  .replace(/\/rest\/v1\/?$/i, "")
  .replace(/\/$/, "");
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
const testMode = process.argv.includes("--test");
const repeatMode = process.argv.includes("--ulang");
const outlets = readFileSync(join(here, "outlets.txt"), "utf8").split(/\r?\n/)
  .map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function loadCompletedOutlets() {
  if (repeatMode) return new Set();
  if (existsSync(progressPath)) {
    try { return new Set(JSON.parse(readFileSync(progressPath, "utf8"))); } catch { /* lanjut ke laporan */ }
  }
  const completed = new Set();
  for (const file of readdirSync(logDir).filter((name) => name.endsWith(".json") && name !== "progress.json")) {
    try {
      for (const item of JSON.parse(readFileSync(join(logDir, file), "utf8"))) {
        if (item.status === "berhasil") completed.add(item.outletName);
      }
    } catch { /* abaikan laporan rusak */ }
  }
  return completed;
}

function fail(message) {
  console.error(`\nGAGAL: ${message}`);
  process.exit(1);
}

if (!testMode && !existsSync(configPath)) fail("Buat .env.kopken-sync dari tools/kopken-menu-sync/.env.example.");
if (!testMode && (!supabaseUrl || !supabaseKey || supabaseKey.includes("ISI_"))) fail("Lengkapi kunci Supabase di .env.kopken-sync.");
if (!outlets.length) fail("outlets.txt masih kosong.");

function runAdb(args) {
  const result = spawnSync(adb, args, { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `ADB gagal: ${args.join(" ")}`);
  return result.stdout || "";
}

class McpClient {
  constructor(command) {
    this.command = command;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";
    this.stderr = "";
  }

  async start() {
    this.proc = spawn(`\"${this.command}\"`, [], {
      stdio: ["pipe", "pipe", "pipe"], windowsHide: true, shell: true
    });
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk) => this.read(chunk));
    this.proc.stderr.on("data", (chunk) => { this.stderr += chunk.toString(); });
    this.proc.on("exit", () => {
      const detail = this.stderr.trim();
      for (const item of this.pending.values()) item.reject(new Error(`HTTP Toolkit MCP berhenti.${detail ? ` ${detail}` : ""}`));
      this.pending.clear();
    });
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "kopken-menu-sync", version: "1.0.0" }
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
        reject: (error) => { clearTimeout(timer); reject(error); }
      });
    });
  }

  notify(method, params) { this.send({ jsonrpc: "2.0", method, params }); }

  async call(name, args) {
    const result = await this.request("tools/call", { name, arguments: args });
    const text = (result.content || []).find((item) => item.type === "text")?.text;
    if (!text) throw new Error(`Respons kosong dari ${name}`);
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error(text.slice(0, 300)); }
    if (!parsed.success) throw new Error(parsed.error || `${name} gagal`);
    return parsed.data;
  }

  close() { this.proc?.kill(); }
}

async function expectedCode(outletName) {
  const query = `select=outlet_code,outlet_name&outlet_name=ilike.*${encodeURIComponent(outletName)}*&limit=5`;
  const response = await fetch(`${supabaseUrl}/rest/v1/kopken_outlets_catalog?${query}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  if (!response.ok) throw new Error(`Gagal membaca Supabase: ${await response.text()}`);
  const rows = await response.json();
  if (rows.length !== 1) throw new Error(`Outlet di Supabase ${rows.length ? "tidak unik" : "tidak ditemukan"}: ${outletName}`);
  return rows[0].outlet_code;
}

async function captureMenu(mcp, wantedCode) {
  let lastError = "";
  for (let attempt = 0; attempt < 15; attempt++) {
    const filter = `hostname=apps.kopikenangan.com method=POST path$=query_product_menu status=200 body*=${wantedCode}`;
    const summary = await mcp.call("events_list", {
      filter,
      limit: 1
    });
    const listed = await mcp.call("events_list", {
      filter,
      limit: 5,
      offset: Math.max(0, summary.total - 5)
    });
    for (const event of listed.events.reverse()) {
      try {
        const response = await mcp.call("events_get-response-body", { id: event.id, maxLength: 100000 });
        const menu = JSON.parse(response.body);
        if (menu?.data?.menu_groups?.length) return { menu, storeCode: wantedCode };
      } catch (error) {
        // Respons HTTP Toolkit dapat belum siap beberapa saat setelah request muncul.
        lastError = error.message;
        continue;
      }
    }
    await sleep(1000);
  }
  throw new Error(`Request menu untuk kode ${wantedCode || "outlet"} tidak ditemukan.${lastError ? ` Terakhir: ${lastError}` : ""}`);
}

async function saveMenu(storeCode, menu) {
  const response = await fetch(`${supabaseUrl}/rest/v1/kopken_outlets_catalog?outlet_code=eq.${encodeURIComponent(storeCode)}`, {
    method: "PATCH",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({ menu, updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error(`Supabase menolak data: ${await response.text()}`);
  if (!(await response.json()).length) throw new Error(`Kode ${storeCode} tidak ditemukan di Supabase.`);
}

async function openOutlet(outletName) {
  const text = outletName.replace(/\s/g, "%s").replace(/[^\w%.-]/g, "");
  runAdb(["shell", "svc", "power", "stayon", "true"]);
  runAdb(["shell", "input", "keyevent", "224"]);
  runAdb(["shell", "wm", "dismiss-keyguard"]);
  runAdb(["shell", "monkey", "-p", "com.kopikenangan", "-c", "android.intent.category.LAUNCHER", "1"]);
  await sleep(2500);
  runAdb(["shell", "input", "tap", "965", "187"]);
  await sleep(1200);
  runAdb(["shell", "input", "tap", "420", "270"]);
  runAdb(["shell", "input", "keyevent", "123"]);
  runAdb(["shell", "input", "keyevent", "67"]);
  runAdb(["shell", "input", "text", text]);
  runAdb(["shell", "input", "keyevent", "66"]);
  await sleep(2500);
  runAdb(["shell", "input", "tap", "450", "850"]);
}

async function main() {
  const devices = runAdb(["devices"]).split(/\r?\n/).filter((line) => /\tdevice$/.test(line));
  if (devices.length !== 1) fail(`Harus ada tepat 1 HP ADB. Terdeteksi ${devices.length}.`);

  const mcp = new McpClient(mcpCommand);
  await mcp.start();
  if (testMode) {
    const available = await mcp.request("tools/list", {});
    const listed = await mcp.call("events_list", {
      filter: "hostname=apps.kopikenangan.com method=POST path$=query_product_menu",
      limit: 1
    });
    const bodyTools = (available.tools || []).filter((tool) => /body/i.test(tool.name)).map((tool) => tool.name);
    mcp.close();
    console.log(`TES BERHASIL: HP dan HTTP Toolkit siap (${listed.total || 0} request menu terbaca).`);
    console.log(`Operasi body tersedia: ${bodyTools.join(", ") || "tidak ada"}`);
    return;
  }
  console.log(`HP dan HTTP Toolkit siap. Memproses ${outlets.length} outlet.\n`);
  const results = [];
  const completedOutlets = loadCompletedOutlets();
  try {
    for (let index = 0; index < outlets.length; index++) {
      const outletName = outlets[index];
      console.log(`[${index + 1}/${outlets.length}] ${outletName}`);
      if (completedOutlets.has(outletName)) {
        console.log("  LEWATI: sudah berhasil pada proses sebelumnya.\n");
        results.push({ outletName, status: "dilewati" });
        continue;
      }
      try {
        const wantedCode = await expectedCode(outletName);
        await openOutlet(outletName);
        const captured = await captureMenu(mcp, wantedCode);
        await saveMenu(captured.storeCode, captured.menu);
        const count = captured.menu.data.menu_groups.reduce((sum, group) => sum + (group.menu_products?.length || 0), 0);
        console.log(`  OK ${captured.storeCode}: ${count} produk\n`);
        results.push({ outletName, status: "berhasil", storeCode: captured.storeCode, products: count });
        completedOutlets.add(outletName);
        writeFileSync(progressPath, JSON.stringify([...completedOutlets], null, 2));
      } catch (error) {
        console.error(`  GAGAL: ${error.message}\n`);
        results.push({ outletName, status: "gagal", error: error.message });
      }
    }
  } finally {
    mcp.close();
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const report = join(logDir, `${stamp}.json`);
  writeFileSync(report, JSON.stringify(results, null, 2));
  const success = results.filter((item) => item.status === "berhasil").length;
  const skipped = results.filter((item) => item.status === "dilewati").length;
  const failed = results.filter((item) => item.status === "gagal").length;
  console.log(`Selesai: ${success} berhasil, ${skipped} dilewati, ${failed} gagal.`);
  console.log(`Laporan: ${report}`);
  if (failed) process.exitCode = 2;
}

main().catch((error) => fail(error.message));

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const configPath = join(root, ".env.kopken-sync");
const logDir = join(here, "logs");
const progressPath = join(logDir, "progress.json");
const refreshProgressPath = join(logDir, "refresh-progress.json");
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
const adbSerial = env.ADB_SERIAL || "";
const mcpCommand = env.HTTP_TOOLKIT_MCP || "C:\\Users\\fachr\\AppData\\Local\\Programs\\HTTP Toolkit\\resources\\httptoolkit-mcp.cmd";
const supabaseUrl = (env.SUPABASE_URL || "")
  .replace(/\/rest\/v1\/?$/i, "")
  .replace(/\/$/, "");
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
const testMode = process.argv.includes("--test");
const repeatMode = process.argv.includes("--ulang");
const outletArg = process.argv.find((arg) => arg.startsWith("--outlet="))?.slice("--outlet=".length).trim();
const freeSessionCallLimit = Number(env.HTTP_TOOLKIT_SESSION_CALL_LIMIT || 80);
const outlets = readFileSync(join(here, "outlets.txt"), "utf8").split(/\r?\n/)
  .map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
if (outletArg) outlets.splice(0, outlets.length, outletArg);
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
const outletSearchAliases = new Map([
  ["ahmad yani banjarmasin", "Ahmad Yani Banj"],
  ["burangrang bandung", "Burangrang"],
  ["sentosa depok", "Sentosa"],
]);

function loadSuccessfulOutlets() {
  if (existsSync(progressPath)) {
    try { return [...new Set(JSON.parse(readFileSync(progressPath, "utf8")))]; } catch { /* lanjut ke laporan */ }
  }
  const completed = new Set();
  for (const file of readdirSync(logDir).filter((name) => name.endsWith(".json") && name !== "progress.json")) {
    try {
      for (const item of JSON.parse(readFileSync(join(logDir, file), "utf8"))) {
        if (item.status === "berhasil") completed.add(item.outletName);
      }
    } catch { /* abaikan laporan rusak */ }
  }
  return [...completed];
}

function loadCompletedOutlets() {
  if (repeatMode) {
    if (!existsSync(refreshProgressPath)) return new Set();
    try { return new Set(JSON.parse(readFileSync(refreshProgressPath, "utf8"))); } catch { return new Set(); }
  }
  return new Set(loadSuccessfulOutlets());
}

async function loadSyncedOutletsFromSupabase() {
  const response = await fetch(`${supabaseUrl}/rest/v1/kopken_outlets_catalog?select=outlet_name&menu=not.is.null&order=outlet_name.asc&limit=2000`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  if (!response.ok) throw new Error(`Gagal membaca daftar menu Supabase: ${await response.text()}`);
  const rows = await response.json();
  return [...new Set(rows.map((row) => String(row.outlet_name || "").trim()).filter(Boolean))];
}

function fail(message) {
  console.error(`\nGAGAL: ${message}`);
  process.exit(1);
}

if (!testMode && !existsSync(configPath)) fail("Buat .env.kopken-sync dari tools/kopken-menu-sync/.env.example.");
if (!testMode && (!supabaseUrl || !supabaseKey || supabaseKey.includes("ISI_"))) fail("Lengkapi kunci Supabase di .env.kopken-sync.");
if (!outlets.length) fail(repeatMode
  ? "Belum ada outlet berhasil untuk disinkron ulang. Jalankan Mulai Sinkron Menu terlebih dahulu."
  : "outlets.txt masih kosong.");

function runAdb(args) {
  const scopedArgs = adbSerial && args[0] !== "devices" ? ["-s", adbSerial, ...args] : args;
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = spawnSync(adb, scopedArgs, { encoding: "utf8", windowsHide: true });
    if (result.status === 0) return result.stdout || "";
    lastError = result.stderr?.trim() || result.stdout?.trim() || `ADB gagal: ${args.join(" ")}`;
    if (!/not_ready|device offline|device not found|closed/i.test(lastError) || !adbSerial) break;
    spawnSync(adb, ["disconnect", adbSerial], { encoding: "utf8", windowsHide: true });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    spawnSync(adb, ["connect", adbSerial], { encoding: "utf8", windowsHide: true });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700);
  }
  throw new Error(lastError);
}

function isDeviceNotReadyError(error) {
  return /not_ready|device offline|device not found|connection.*closed|koneksi adb/i.test(error?.message || "");
}

class McpClient {
  constructor(command) {
    this.command = command;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";
    this.stderr = "";
    this.toolCalls = 0;
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
    if (this.toolCalls >= freeSessionCallLimit) {
      const error = new Error(`Batas aman sesi HTTP Toolkit tercapai (${this.toolCalls} panggilan).`);
      error.code = "HTTP_TOOLKIT_SESSION_LIMIT";
      throw error;
    }
    this.toolCalls++;
    let result;
    try {
      result = await this.request("tools/call", { name, arguments: args });
    } catch (error) {
      if (/limited to 100 calls per session/i.test(error.message)) error.code = "HTTP_TOOLKIT_SESSION_LIMIT";
      throw error;
    }
    const text = (result.content || []).find((item) => item.type === "text")?.text;
    if (!text) throw new Error(`Respons kosong dari ${name}`);
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error(text.slice(0, 300)); }
    if (!parsed.success) {
      const error = new Error(parsed.error || `${name} gagal`);
      if (/limited to 100 calls per session/i.test(error.message)) error.code = "HTTP_TOOLKIT_SESSION_LIMIT";
      throw error;
    }
    return parsed.data;
  }

  close() { this.proc?.kill(); }
}

function isSessionLimitError(error) {
  return error?.code === "HTTP_TOOLKIT_SESSION_LIMIT"
    || /limited to 100 calls per session|batas aman sesi HTTP Toolkit/i.test(error?.message || "");
}

function normalizeOutletName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function expectedOutlet(outletName) {
  const namePattern = outletName.trim().split(/\s+/).map(encodeURIComponent).join("*");
  const exactQuery = `select=outlet_code,outlet_name&outlet_name=ilike.*${namePattern}*&limit=10`;
  const response = await fetch(`${supabaseUrl}/rest/v1/kopken_outlets_catalog?${exactQuery}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  if (!response.ok) throw new Error(`Gagal membaca Supabase: ${await response.text()}`);
  const rows = await response.json();
  const exactRows = rows.filter((row) => normalizeOutletName(row.outlet_name) === normalizeOutletName(outletName));
  if (exactRows.length !== 1) throw new Error(`Outlet di Supabase ${exactRows.length ? "tidak unik" : "tidak ditemukan"}: ${outletName}`);

  const broadQuery = `select=outlet_code&outlet_name=ilike.*${encodeURIComponent(outletName)}*&limit=2`;
  const broadResponse = await fetch(`${supabaseUrl}/rest/v1/kopken_outlets_catalog?${broadQuery}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  const broadRows = broadResponse.ok ? await broadResponse.json() : [];
  return { code: exactRows[0].outlet_code, preciseClick: broadRows.length > 1 };
}

function menuEventFilter(wantedCode) {
  return `hostname=apps.kopikenangan.com method=POST path$=query_product_menu status=200 body*=${wantedCode}`;
}

async function latestMenuTimestamp(mcp, wantedCode) {
  const summary = await mcp.call("events_list", { filter: menuEventFilter(wantedCode), limit: 1 });
  if (!summary.total) return 0;
  const latest = await mcp.call("events_list", {
    filter: menuEventFilter(wantedCode),
    limit: 1,
    offset: summary.total - 1,
  });
  return Number(latest.events[0]?.timestamp || 0);
}

async function captureMenu(mcp, wantedCode, afterTimestamp) {
  let lastError = "";
  for (let attempt = 0; attempt < 7; attempt++) {
    const filter = menuEventFilter(wantedCode);
    const summary = await mcp.call("events_list", {
      filter,
      limit: 1
    });
    const listed = await mcp.call("events_list", {
      filter,
      limit: 5,
      offset: Math.max(0, summary.total - 5)
    });
    for (const event of listed.events.filter((item) => item.timestamp > afterTimestamp).reverse()) {
      try {
        const menu = JSON.parse(await readFullResponseBody(mcp, event.id));
        if (menu?.data?.menu_groups?.length) return { menu, storeCode: wantedCode };
      } catch (error) {
        // Respons HTTP Toolkit dapat belum siap beberapa saat setelah request muncul.
        lastError = error.message;
        continue;
      }
    }
    await sleep(150);
  }
  const fallbackSummary = await mcp.call("events_list", {
    filter: menuEventFilter(wantedCode),
    limit: 1
  });
  if (fallbackSummary.total) {
    const fallback = await mcp.call("events_list", {
      filter: menuEventFilter(wantedCode),
      limit: 1,
      offset: fallbackSummary.total - 1
    });
    const event = fallback.events[0];
    if (event) {
      try {
        const menu = JSON.parse(await readFullResponseBody(mcp, event.id));
        if (menu?.data?.menu_groups?.length) return { menu, storeCode: wantedCode };
      } catch (error) {
        lastError = error.message;
      }
    }
  }
  throw new Error(`Request menu untuk kode ${wantedCode || "outlet"} tidak ditemukan.${lastError ? ` Terakhir: ${lastError}` : ""}`);
}

async function readFullResponseBody(mcp, eventId) {
  const chunkSize = 100000;
  let offset = 0;
  let body = "";
  let totalSize = 0;
  do {
    const chunk = await mcp.call("events_get-response-body", { id: eventId, offset, maxLength: chunkSize });
    const text = String(chunk.body || "");
    body += text;
    totalSize = Number(chunk.totalSize || body.length);
    if (!text.length) break;
    offset += text.length;
  } while (offset < totalSize);
  return body;
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

function dismissUnavailableOutletPopup() {
  let hierarchy = "";
  const dumpPath = "/sdcard/kopken-sync-window.xml";
  try {
    runAdb(["shell", "uiautomator", "dump", dumpPath]);
    hierarchy = runAdb(["shell", "cat", dumpPath]);
  } catch { return false; }

  const nodes = hierarchy.match(/<node\b[^>]*>/g) || [];
  const closeNode = nodes.find((node) => /(?:text|content-desc)="(?:Pilih Outlet Lainnya|Outlet Lainnya|OK|Oke|Mengerti|Tutup|Kembali|Close)"/i.test(node));
  const hasUnavailableMessage = /(pemeliharaan|maintenance|jam operasional|aplikasi ditutup|outlet.{0,30}tutup|sedang tutup|tidak tersedia)/i.test(hierarchy);
  if (!closeNode && !hasUnavailableMessage) return false;
  const bounds = closeNode?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (bounds) {
    const x = Math.round((Number(bounds[1]) + Number(bounds[3])) / 2);
    const y = Math.round((Number(bounds[2]) + Number(bounds[4])) / 2);
    runAdb(["shell", "input", "tap", String(x), String(y)]);
  } else {
    runAdb(["shell", "input", "keyevent", "4"]);
  }
  return true;
}

async function tapOutletResultByName(outletName) {
  const dumpPath = "/sdcard/kopken-sync-results.xml";
  const needles = [outletName, outletName.replace(/\s*\([^)]*\)\s*/g, " ").trim()]
    .map((value) => value.toLowerCase())
    .filter(Boolean);

  for (let attempt = 0; attempt < 14; attempt++) {
    let hierarchy = "";
    try {
      runAdb(["shell", "uiautomator", "dump", dumpPath]);
      hierarchy = runAdb(["shell", "cat", dumpPath]);
    } catch { return false; }

    const nodes = hierarchy.match(/<node\b[^>]*>/g) || [];
    const resultNode = nodes.find((node) => {
      if (!/clickable="true"/.test(node) || /class="android\.widget\.EditText"/.test(node)) return false;
      const label = node.match(/content-desc="([^"]+)"/)?.[1] || "";
      const parts = label.split(/&#10;|\n/i).map(normalizeOutletName).filter(Boolean);
      return needles.some((needle) => parts.includes(normalizeOutletName(needle)));
    });
    const bounds = resultNode?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (bounds) {
      const x = Math.round((Number(bounds[1]) + Number(bounds[3])) / 2);
      const y = Math.round((Number(bounds[2]) + Number(bounds[4])) / 2);
      runAdb(["shell", "input", "tap", String(x), String(y)]);
      return true;
    }

    const moreNode = nodes.find((node) =>
      /clickable="true"/.test(node) && /content-desc="Lihat outlet lainnya"/i.test(node)
    );
    const moreBounds = moreNode?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (moreBounds) {
      const x = Math.round((Number(moreBounds[1]) + Number(moreBounds[3])) / 2);
      const y = Math.round((Number(moreBounds[2]) + Number(moreBounds[4])) / 2);
      runAdb(["shell", "input", "tap", String(x), String(y)]);
      await sleep(180);
      continue;
    }
    runAdb(["shell", "input", "swipe", "540", "1400", "540", "760", "220"]);
    await sleep(80);
  }
  return false;
}

async function openOutlet(outletName, firstOutlet = false, preciseClick = false) {
  const searchName = (outletSearchAliases.get(normalizeOutletName(outletName)) || outletName)
    .replace(/\s+/g, " ")
    .trim();
  const text = searchName
    .replace(/\s/g, "%s")
    .replace(/([()])/g, "\\$1")
    .replace(/'/g, "\\'")
    .replace(/[^\w%@.,'\\()\-/]/g, "");
  runAdb(["shell", "svc", "power", "stayon", "true"]);
  runAdb(["shell", "input", "keyevent", "224"]);
  runAdb(["shell", "wm", "dismiss-keyguard"]);
  runAdb(["shell", "am", "start", "-n", "com.kopikenangan/.heart"]);
  await sleep(firstOutlet ? 650 : 100);
  if (dismissUnavailableOutletPopup()) await sleep(100);
  runAdb(["shell", "input", "tap", "965", "187"]);
  await sleep(80);
  runAdb(["shell", "input", "tap", "420", "270"]);
  runAdb(["shell", "input", "keyevent", "123"]);
  runAdb(["shell", "input", "keyevent", ...Array(80).fill("67")]);
  runAdb(["shell", "input", "text", text]);
  runAdb(["shell", "input", "keyevent", "66"]);
  runAdb(["shell", "input", "keyevent", "111"]);
  await sleep(220);
  runAdb(["shell", "input", "swipe", "540", "760", "540", "1400", "180"]);
  await sleep(80);
  if (!(await tapOutletResultByName(outletName))) {
    runAdb(["shell", "input", "tap", "540", "1020"]);
  }
  await sleep(100);
}

async function main() {
  const devices = runAdb(["devices"]).split(/\r?\n/).filter((line) => /\tdevice$/.test(line));
  if (adbSerial) {
    if (!devices.some((line) => line.startsWith(`${adbSerial}\t`))) fail(`VSPhone ADB tidak terhubung: ${adbSerial}`);
  } else if (devices.length !== 1) {
    fail(`Harus ada tepat 1 HP ADB. Terdeteksi ${devices.length}.`);
  }

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
  if (repeatMode && !outletArg) {
    const syncedOutlets = await loadSyncedOutletsFromSupabase();
    if (!syncedOutlets.length) throw new Error("Belum ada menu outlet yang tersimpan di Supabase.");
    outlets.splice(0, outlets.length, ...syncedOutlets);
  }
  console.log(`HP dan HTTP Toolkit siap. Memproses ${outlets.length} outlet.\n`);
  const results = [];
  let sessionPaused = false;
  let devicePaused = false;
  const completedNames = repeatMode
    ? [...loadCompletedOutlets()]
    : await loadSyncedOutletsFromSupabase();
  const completedOutlets = new Set(completedNames.map(normalizeOutletName));
  if (repeatMode && completedOutlets.size) {
    console.log(`Melanjutkan sinkron ulang: ${completedOutlets.size} outlet sudah selesai sebelumnya.\n`);
  }
  try {
    for (let index = 0; index < outlets.length; index++) {
      const outletName = outlets[index];
      console.log(`[${index + 1}/${outlets.length}] ${outletName}`);
      if (!outletArg && completedOutlets.has(normalizeOutletName(outletName))) {
        console.log("  LEWATI: sudah berhasil pada proses sebelumnya.\n");
        results.push({ outletName, status: "dilewati" });
        continue;
      }
      try {
        const expected = await expectedOutlet(outletName);
        const wantedCode = expected.code;
        const previousTimestamp = await latestMenuTimestamp(mcp, wantedCode);
        await openOutlet(outletName, index === 0, expected.preciseClick);
        await sleep(180);
        if (dismissUnavailableOutletPopup()) {
          throw new Error("Outlet sedang tutup atau dalam pemeliharaan; popup ditutup dan outlet dilewati.");
        }
        let captured;
        try {
          captured = await captureMenu(mcp, wantedCode, previousTimestamp);
        } catch (captureError) {
          if (isSessionLimitError(captureError)) throw captureError;
          if (dismissUnavailableOutletPopup()) {
            await sleep(100);
            throw new Error("Outlet sedang tutup atau dalam pemeliharaan; popup ditutup dan outlet dilewati.");
          }
          if (!(await tapOutletResultByName(outletName))) throw captureError;
          await sleep(150);
          try {
            captured = await captureMenu(mcp, wantedCode, previousTimestamp);
          } catch (retryError) {
            if (isSessionLimitError(retryError)) throw retryError;
            if (dismissUnavailableOutletPopup()) {
              await sleep(100);
              throw new Error("Outlet sedang tutup atau dalam pemeliharaan; popup ditutup dan outlet dilewati.");
            }
            throw retryError;
          }
        }
        await saveMenu(captured.storeCode, captured.menu);
        const count = captured.menu.data.menu_groups.reduce((sum, group) => sum + (group.menu_products?.length || 0), 0);
        console.log(`  OK ${captured.storeCode}: ${count} produk\n`);
        results.push({ outletName, status: "berhasil", storeCode: captured.storeCode, products: count });
        completedOutlets.add(normalizeOutletName(outletName));
        writeFileSync(repeatMode ? refreshProgressPath : progressPath, JSON.stringify([...completedOutlets], null, 2));
      } catch (error) {
        if (isDeviceNotReadyError(error)) {
          devicePaused = true;
          console.log("  JEDA VSPHONE: perangkat belum siap setelah dicoba sambung ulang.");
          console.log("  Jalankan BAT yang sama lagi; outlet yang sudah sukses tetap dilewati.\n");
          break;
        }
        if (isSessionLimitError(error)) {
          sessionPaused = true;
          console.log(`  JEDA SESI: ${error.message}`);
          console.log("  Restart HTTP Toolkit, lalu jalankan BAT yang sama untuk melanjutkan.\n");
          break;
        }
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
  const failedItems = results.filter((item) => item.status === "gagal");
  const failed = failedItems.length;
  const failedReport = join(logDir, "outlet-gagal-terakhir.txt");
  const failedLines = failedItems.length
    ? failedItems.map((item, index) => `${index + 1}. ${item.outletName}\n   Alasan: ${item.error}`)
    : ["Tidak ada outlet yang gagal."];
  writeFileSync(failedReport, [
    "DAFTAR OUTLET GAGAL - SINKRON MENU KOPI KENANGAN",
    `Waktu: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`,
    `Total: ${failed}`,
    "",
    ...failedLines,
    "",
  ].join("\n"));
  console.log(`Selesai sesi: ${success} berhasil, ${skipped} dilewati, ${failed} gagal (${mcp.toolCalls} panggilan HTTP Toolkit).`);
  console.log(`Laporan: ${report}`);
  console.log(`Outlet gagal: ${failedReport}`);
  if (repeatMode && !sessionPaused && !devicePaused && !failed && existsSync(refreshProgressPath)) {
    rmSync(refreshProgressPath);
    console.log("Sinkron ulang selesai seluruhnya. Checkpoint sudah dibersihkan.");
  }
  if (devicePaused) process.exitCode = 76;
  else if (failed) process.exitCode = 2;
}

main().catch((error) => fail(error.message));

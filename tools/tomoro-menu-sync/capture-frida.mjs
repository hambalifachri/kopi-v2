import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const configPath = join(root, ".env.tomoro-sync");
const fallbackKopkenConfigPath = join(root, ".env.kopken-sync");
const hookPath = join(here, "tomoro-frida-capture.js");
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

const env = { ...process.env, ...loadEnv(fallbackKopkenConfigPath), ...loadEnv(configPath) };
const adb = env.ADB_PATH || "C:\\Users\\fachr\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";
const adbSerial = env.TOMORO_ADB_SERIAL || env.ADB_SERIAL || env.VSPHONE_ADB_TARGET || "localhost:65193";
const frida = env.FRIDA_EXE || "C:\\Users\\fachr\\AppData\\Local\\Packages\\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0\\LocalCache\\local-packages\\Python311\\Scripts\\frida.exe";
const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
const durationMs = Number(process.argv.find((arg) => arg.startsWith("--seconds="))?.split("=")[1] || 120) * 1000;
const keyword = process.argv.find((arg) => arg.startsWith("--keyword="))?.slice("--keyword=".length).trim()
  || env.TOMORO_DEFAULT_KEYWORD
  || "bogor";
const noAuto = process.argv.includes("--manual");

function fail(message) {
  console.error(`\nGAGAL: ${message}`);
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey || supabaseKey.includes("ISI_")) fail("Lengkapi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.");

function runAdb(args, timeout = 10000) {
  return spawnSync(adb, ["-s", adbSerial, ...args], { encoding: "utf8", windowsHide: true, timeout });
}

function ensureFridaServer() {
  spawnSync(adb, ["connect", adbSerial], { encoding: "utf8", windowsHide: true });
  runAdb(["shell", "am", "force-stop", "tech.httptoolkit.android.v1"]);
  runAdb(["shell", "settings", "put", "global", "http_proxy", ":0"]);
  runAdb(["shell", "settings", "delete", "global", "global_http_proxy_host"]);
  runAdb(["shell", "settings", "delete", "global", "global_http_proxy_port"]);
  runAdb(["shell", "settings", "delete", "global", "http_proxy"]);
  runAdb(["shell", "su", "-c", "pkill -f frida-server || true"]);
  runAdb(["shell", "su", "-c", "setsid /data/local/tmp/frida-server-17.17.0 >/data/local/tmp/frida-server.log 2>&1 < /dev/null &"]);
}

function parseFridaPayload(line) {
  const marker = "payload': '";
  const start = line.indexOf(marker);
  let pythonString = "";
  if (start >= 0) {
    const rest = line.slice(start + marker.length);
    const end = rest.lastIndexOf("'} data:");
    if (end < 0) return null;
    pythonString = rest.slice(0, end);
  } else {
    const jsonStart = line.indexOf('{"kind"');
    if (jsonStart < 0) return null;
    pythonString = line.slice(jsonStart);
  }
  const jsonText = pythonString
    .replaceAll("\\\\", "\\")
    .replaceAll("\\'", "'")
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r")
    .replaceAll("\\t", "\t");
  return JSON.parse(jsonText);
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
    source: "tomoro-frida-sync",
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
      source: "tomoro-frida-sync",
      menu_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Supabase menolak menu Tomoro: ${await response.text()}`);
  return response.json();
}

function storeCodeFromUrl(url) {
  try { return new URL(url).searchParams.get("storeCode") || ""; } catch { return ""; }
}

function encodeAdbText(value) {
  return String(value).replace(/\s/g, "%s").replace(/([()])/g, "\\$&")
    .replace(/'/g, "\\'").replace(/[^\w%@.,'\\()\-/]/g, "");
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function boundsCenter(bounds) {
  const match = String(bounds || "").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) return null;
  const [, left, top, right, bottom] = match.map(Number);
  return [Math.round((left + right) / 2), Math.round((top + bottom) / 2)];
}

function dumpUi() {
  runAdb(["shell", "uiautomator", "dump", "/sdcard/window_dump.xml"], 15000);
  const result = runAdb(["shell", "cat", "/sdcard/window_dump.xml"], 15000);
  return String(result.stdout || "");
}

function findNodeBounds(xml, predicate) {
  const nodes = String(xml || "").match(/<node\b[^>]*>/g) || [];
  for (const node of nodes) {
    const resourceId = decodeXml(node.match(/\bresource-id="([^"]*)"/)?.[1]);
    const text = decodeXml(node.match(/\btext="([^"]*)"/)?.[1]);
    const contentDesc = decodeXml(node.match(/\bcontent-desc="([^"]*)"/)?.[1]);
    const bounds = node.match(/\bbounds="([^"]*)"/)?.[1] || "";
    if (predicate({ node, resourceId, text, contentDesc, bounds })) return bounds;
  }
  return "";
}

function tapBounds(bounds) {
  const center = boundsCenter(bounds);
  if (!center) return false;
  runAdb(["shell", "input", "tap", String(center[0]), String(center[1])]);
  return true;
}

function tapResource(xml, idSuffix) {
  const bounds = findNodeBounds(xml, ({ resourceId }) => resourceId.endsWith(idSuffix));
  return tapBounds(bounds);
}

function hasStoreList(xml) {
  return Boolean(findNodeBounds(xml, ({ text, resourceId }) =>
    text === "Store List" || resourceId.endsWith("/tvSearchInput")));
}

function slugStoreCode(name) {
  return `ui-${String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)}`;
}

function extractVisibleStoresFromUi(xml) {
  const nodes = String(xml || "").match(/<node\b[^>]*>/g) || [];
  const stores = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const resourceId = decodeXml(node.match(/\bresource-id="([^"]*)"/)?.[1]);
    const text = decodeXml(node.match(/\btext="([^"]*)"/)?.[1]);
    if (!resourceId.endsWith("/tvStoreName") || !text) continue;

    let description = "";
    let status = "";
    for (let lookahead = index + 1; lookahead < Math.min(index + 8, nodes.length); lookahead += 1) {
      const nextNode = nodes[lookahead];
      const nextResourceId = decodeXml(nextNode.match(/\bresource-id="([^"]*)"/)?.[1]);
      const nextText = decodeXml(nextNode.match(/\btext="([^"]*)"/)?.[1]);
      if (nextResourceId.endsWith("/tvStoreName")) break;
      if (nextResourceId.endsWith("/tvStoreType") && nextText) status = nextText;
      if (nextResourceId.endsWith("/tvStoreDes") && nextText) description = nextText;
    }

    stores.push({
      store_code: slugStoreCode(text),
      store_name: text,
      store_address: description.replace(/^\d+(?:[.,]\d+)?km\s*-\s*/i, "").trim(),
      city: "",
      raw_store: {
        storeName: text,
        description,
        status,
        capturedFrom: "android-ui",
        keyword,
      },
      source: "tomoro-ui-sync",
      updated_at: new Date().toISOString(),
    });
  }
  return Array.from(new Map(stores.filter((store) => store.store_code !== "ui-").map((store) => [store.store_code, store])).values());
}

async function waitForUi(predicate, timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const xml = dumpUi();
    if (predicate(xml)) return xml;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  return dumpUi();
}

async function triggerOutletSearch() {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
  let xml = dumpUi();
  if (!hasStoreList(xml)) {
    if (!tapResource(xml, "/tvStoreName")) {
      runAdb(["shell", "input", "keyevent", "111"]);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 700));
      xml = dumpUi();
      tapResource(xml, "/tvStoreName");
    }
    xml = await waitForUi(hasStoreList, 5000);
  }
  if (!hasStoreList(xml)) {
    console.log("Auto search belum bisa buka Store List. Buka Store List manual lalu jalankan capture lagi.");
    return;
  }
  if (!tapResource(xml, "/tvSearchInput")) {
    console.log("Auto search belum menemukan kolom Search outlet.");
    return;
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  xml = dumpUi();
  tapResource(xml, "/etSearchInput");
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  runAdb(["shell", "input", "keyevent", "123"]);
  runAdb(["shell", "input", "keyevent", ...Array(60).fill("67")]);
  runAdb(["shell", "input", "text", encodeAdbText(keyword)]);
  runAdb(["shell", "input", "keyevent", "66"]);
  console.log(`Search outlet Tomoro dipicu: ${keyword}`);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2500));
  const visibleStores = extractVisibleStoresFromUi(dumpUi());
  if (visibleStores.length) {
    const saved = await upsertStores(visibleStores);
    writeFileSync(join(logDir, "last-ui-outlets.json"), JSON.stringify(saved, null, 2));
    console.log(`Outlet Tomoro dari UI tersimpan: ${saved.length}`);
  }
}

async function handlePayload(payload) {
  if (payload.kind === "ready") {
    console.log(`Hook siap: ${payload.hook}`);
    return { outlets: 0, menus: 0 };
  }
  if (payload.kind === "hook-error" || payload.kind === "capture-error") {
    console.log(`${payload.kind}: ${payload.error}`);
    return { outlets: 0, menus: 0 };
  }
  if (payload.kind === "api-url") {
    try {
      const url = new URL(payload.url);
      console.log(`Tomoro API: ${url.pathname} HTTP ${payload.status}`);
    } catch {
      console.log(`Tomoro API HTTP ${payload.status}`);
    }
    return { outlets: 0, menus: 0 };
  }
  if (payload.kind !== "response" || Number(payload.status) !== 200) return { outlets: 0, menus: 0 };

  const body = JSON.parse(payload.body || "{}");
  if (/getStoreList\/v3/.test(payload.url)) {
    const records = Array.isArray(body?.data?.records) ? body.data.records : [];
    const saved = await upsertStores(records.map(normalizeStore).filter((store) => store.store_code));
    writeFileSync(join(logDir, "last-frida-outlets.json"), JSON.stringify(saved, null, 2));
    console.log(`Outlet Tomoro tersimpan: ${saved.length}`);
    return { outlets: saved.length, menus: 0 };
  }
  if (/getMenuList/.test(payload.url)) {
    const storeCode = storeCodeFromUrl(payload.url);
    if (!storeCode) return { outlets: 0, menus: 0 };
    await patchMenu(storeCode, body);
    writeFileSync(join(logDir, `last-frida-menu-${storeCode}.json`), JSON.stringify(body, null, 2));
    console.log(`Menu Tomoro tersimpan: ${storeCode}`);
    return { outlets: 0, menus: 1 };
  }
  return { outlets: 0, menus: 0 };
}

ensureFridaServer();
runAdb(["shell", "am", "start", "-n", "com.tomoro.indonesia.android/com.tomoro.indonesia.module_main.SplashActivityDefault"]);
await new Promise((resolvePromise, reject) => setTimeout(resolvePromise, 1500));

const pidResult = runAdb(["shell", "pidof", "com.tomoro.indonesia.android"]);
const pid = String(pidResult.stdout || "").trim().split(/\s+/)[0];
if (!pid) fail("Proses Tomoro belum jalan.");

const child = spawn(frida, ["-D", adbSerial, "-p", pid, "-l", hookPath, "-q"], {
  cwd: root,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});

let outlets = 0;
let menus = 0;
let buffer = "";

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  while (buffer.includes("\n")) {
    const index = buffer.indexOf("\n");
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    console.log(`[frida] ${line}`);
    Promise.resolve()
      .then(() => parseFridaPayload(line))
      .then((payload) => payload && handlePayload(payload))
      .then((result) => {
        if (!result) return;
        outlets += result.outlets;
        menus += result.menus;
      })
      .catch((error) => console.log(`Capture parse error: ${error.message}`));
  }
});
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  const text = chunk.trim();
  if (text) console.log(`[frida:err] ${text}`);
});
console.log(`Tomoro Frida capture aktif. PID ${pid}. Buka/cari outlet/menu di app Tomoro.`);
if (!noAuto) triggerOutletSearch().catch((error) => console.log(`Auto search gagal: ${error.message}`));
await new Promise((resolvePromise) => setTimeout(resolvePromise, durationMs));
child.kill();
console.log(`Capture selesai. Outlet tersimpan: ${outlets}. Menu tersimpan: ${menus}.`);

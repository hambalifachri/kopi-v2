import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const configPath = join(root, ".env.tomoro-sync");
const fallbackKopkenConfigPath = join(root, ".env.kopken-sync");
const hookPath = join(here, "tomoro-frida-capture.js");
const askpassPath = join(here, "vsphone-askpass.cmd");
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
const vsphoneSshCommand = env.TOMORO_VSPHONE_SSH_COMMAND || env.VSPHONE_SSH_COMMAND || "";
const vsphoneConnectionKey = env.TOMORO_VSPHONE_CONNECTION_KEY || env.VSPHONE_CONNECTION_KEY || "";
const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
const durationMs = Number(process.argv.find((arg) => arg.startsWith("--seconds="))?.split("=")[1] || 120) * 1000;
const allOutlets = process.argv.includes("--all-outlets") || process.argv.includes("--all");
const citySweep = process.argv.includes("--city-sweep") || process.argv.includes("--national");
const menuSweep = process.argv.includes("--menu-sweep") || process.argv.includes("--menus");
const menuLimit = Math.max(1, Number(process.argv.find((arg) => arg.startsWith("--menu-limit="))?.split("=")[1] || 50));
const menuMaxScrolls = Math.max(1, Number(process.argv.find((arg) => arg.startsWith("--menu-max-scrolls="))?.split("=")[1] || 30));
const setupOnly = process.argv.includes("--setup-only");
const explicitKeyword = process.argv.find((arg) => arg.startsWith("--keyword="))?.slice("--keyword=".length).trim();
const keyword = explicitKeyword
  || env.TOMORO_DEFAULT_KEYWORD
  || "bogor";
const maxScrolls = Math.max(1, Number(process.argv.find((arg) => arg.startsWith("--max-scrolls="))?.split("=")[1] || 80));
const keywordFilePath = join(here, "tomoro-city-keywords.txt");
const keywordList = Array.from(new Set((process.argv.find((arg) => arg.startsWith("--keywords="))?.slice("--keywords=".length)
  || env.TOMORO_CITY_KEYWORDS
  || (existsSync(keywordFilePath) ? readFileSync(keywordFilePath, "utf8") : "jakarta,bogor,bandung,surabaya,medan"))
  .split(/[\r\n,]+/)
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)));
const noAuto = process.argv.includes("--manual");

function fail(message) {
  console.error(`\nGAGAL: ${message}`);
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey || supabaseKey.includes("ISI_")) fail("Lengkapi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.");

function runAdb(args, timeout = 10000) {
  return spawnSync(adb, ["-s", adbSerial, ...args], { encoding: "utf8", windowsHide: true, timeout });
}

function adbDevicesText() {
  return spawnSync(adb, ["devices"], { encoding: "utf8", windowsHide: true, timeout: 10000 }).stdout || "";
}

function parseVsphoneSsh(command) {
  const match = String(command || "").match(/ssh\s+.*?([^\s]+@[^\s]+)\s+-p\s+(\d+)\s+-L\s+([^\s]+)\s+-Nf/i);
  if (!match) return null;
  return { host: match[1], port: match[2], localForward: match[3], localPort: match[3].split(":")[0] };
}

async function ensureVsphoneTunnel() {
  if (!vsphoneSshCommand || !vsphoneConnectionKey || adbDevicesText().includes(`${adbSerial}\tdevice`)) return;
  const parsed = parseVsphoneSsh(vsphoneSshCommand);
  if (!parsed) {
    console.log("Format SSH VSPhone tidak dikenali, lanjut adb connect langsung.");
    return;
  }
  if (!existsSync(askpassPath)) writeFileSync(askpassPath, "@echo off\r\necho %VSPHONE_CONNECTION_KEY%\r\n");
  spawnSync(adb, ["disconnect", adbSerial], { encoding: "utf8", windowsHide: true, timeout: 5000 });
  const cleanup = `$port='${parsed.localPort}'; Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'ssh.exe' -and $_.CommandLine -match ('-L\\s+' + $port + ':') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
  spawnSync("powershell.exe", ["-NoProfile", "-Command", cleanup], { encoding: "utf8", windowsHide: true, timeout: 10000 });
  const tunnel = spawn("ssh", [
    "-oHostKeyAlgorithms=+ssh-rsa",
    "-o", "StrictHostKeyChecking=accept-new",
    parsed.host,
    "-p", parsed.port,
    "-L", parsed.localForward,
    "-N",
  ], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      VSPHONE_CONNECTION_KEY: vsphoneConnectionKey,
      SSH_ASKPASS: askpassPath,
      SSH_ASKPASS_REQUIRE: "force",
      DISPLAY: "vsphone",
    },
  });
  tunnel.unref();
  console.log(`Tunnel VSPhone disiapkan: ${adbSerial}`);
}

async function ensureFridaServer() {
  await ensureVsphoneTunnel();
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

async function upsertMenu(storeCode, menu, outlet = {}) {
  if (!storeCode) return [];
  const response = await fetch(`${supabaseUrl}/rest/v1/tomoro_outlets_catalog?on_conflict=store_code`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      store_code: storeCode,
      store_name: textValue(outlet.store_name || outlet.storeName || storeCode),
      store_address: textValue(outlet.store_address || outlet.storeAddress),
      city: textValue(outlet.city),
      raw_store: outlet.raw_store || outlet,
      menu,
      source: "tomoro-frida-sync",
      menu_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Supabase menolak upsert menu Tomoro: ${await response.text()}`);
  return response.json();
}

async function fetchCachedTomoroOutlets(limit = menuLimit) {
  const response = await fetch(`${supabaseUrl}/rest/v1/tomoro_outlets_catalog?select=store_code,store_name,store_address,city,raw_store,menu_updated_at&menu=is.null&limit=500`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  if (!response.ok) throw new Error(`Gagal ambil daftar outlet Tomoro dari Supabase: ${await response.text()}`);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => textValue(row.store_name))
    .sort((a, b) => {
      const aOpen = textValue(a.raw_store?.status).toLowerCase() === "open" ? 0 : 1;
      const bOpen = textValue(b.raw_store?.status).toLowerCase() === "open" ? 0 : 1;
      return aOpen - bOpen || textValue(a.store_name).localeCompare(textValue(b.store_name), "id-ID");
    })
    .slice(0, limit);
}

function storeCodeFromUrl(url) {
  try {
    const params = new URL(url).searchParams;
    return params.get("storeCode") || params.get("store_code") || params.get("store") || params.get("storeId") || "";
  } catch { return ""; }
}

function countTomoroProducts(value) {
  if (Array.isArray(value)) return value.reduce((total, entry) => total + countTomoroProducts(entry), 0);
  if (!value || typeof value !== "object") return 0;
  const name = value.productName || value.menuName || value.goodsName || value.name || value.spuName;
  const price = value.price || value.salePrice || value.originPrice || value.originalPrice || value.discountPrice;
  let count = name && price ? 1 : 0;
  for (const entry of Object.values(value)) count += countTomoroProducts(entry);
  return count;
}

function looksLikeTomoroMenu(url, body) {
  return /getMenuList|menu|product|goods|catalog/i.test(url) && countTomoroProducts(body) >= 3;
}

function parseRupiah(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
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

function tapText(xml, exactText) {
  const target = textValue(exactText).toLocaleLowerCase("id-ID");
  const bounds = findNodeBounds(xml, ({ text }) => textValue(text).toLocaleLowerCase("id-ID") === target);
  return tapBounds(bounds);
}

function tapTextContains(xml, needle) {
  const target = textValue(needle).toLocaleLowerCase("id-ID");
  const bounds = findNodeBounds(xml, ({ text }) => textValue(text).toLocaleLowerCase("id-ID").includes(target));
  return tapBounds(bounds);
}

function tapStoreName(xml, outletName) {
  const target = textValue(outletName).toLocaleLowerCase("id-ID");
  const bounds = findNodeBounds(xml, ({ resourceId, text }) =>
    resourceId.endsWith("/tvStoreName") && textValue(text).toLocaleLowerCase("id-ID") === target);
  if (bounds) return tapBounds(bounds);
  const fuzzyBounds = findNodeBounds(xml, ({ resourceId, text }) => {
    const value = textValue(text).toLocaleLowerCase("id-ID");
    return resourceId.endsWith("/tvStoreName") && (value.includes(target) || target.includes(value));
  });
  return tapBounds(fuzzyBounds);
}

function hasStoreList(xml) {
  return Boolean(findNodeBounds(xml, ({ text, resourceId }) =>
    text === "Store List" || resourceId.endsWith("/tvSearchInput")));
}

function hasMenuScreen(xml) {
  return Boolean(findNodeBounds(xml, ({ resourceId, text }) =>
    resourceId.endsWith("/rightMenu") || resourceId.endsWith("/right_dish_item") || resourceId.endsWith("/rvProduct") || resourceId.endsWith("/rvMenu") || resourceId.endsWith("/rvCategory")
    || textValue(text).toLocaleLowerCase("id-ID") === "menu"));
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

function extractVisibleStoresFromUi(xml, activeKeyword = keyword) {
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
        keyword: activeKeyword,
      },
      source: "tomoro-ui-sync",
      updated_at: new Date().toISOString(),
    });
  }
  return Array.from(new Map(stores.filter((store) => store.store_code !== "ui-").map((store) => [store.store_code, store])).values());
}

function extractVisibleMenuProductsFromUi(xml) {
  const nodes = String(xml || "").match(/<node\b[^>]*>/g) || [];
  const products = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const resourceId = decodeXml(node.match(/\bresource-id="([^"]*)"/)?.[1]);
    const text = decodeXml(node.match(/\btext="([^"]*)"/)?.[1]);
    if (!resourceId.endsWith("/tvName") || !text || text === "Home") continue;

    let priceText = "";
    for (let lookahead = index + 1; lookahead < Math.min(index + 8, nodes.length); lookahead += 1) {
      const nextNode = nodes[lookahead];
      const nextResourceId = decodeXml(nextNode.match(/\bresource-id="([^"]*)"/)?.[1]);
      const nextText = decodeXml(nextNode.match(/\btext="([^"]*)"/)?.[1]);
      if (nextResourceId.endsWith("/tvName")) break;
      if (nextResourceId.endsWith("/tvPrice") && /^Rp\s*/i.test(nextText)) {
        priceText = nextText;
        break;
      }
    }

    const price = parseRupiah(priceText);
    if (!price) continue;
    products.push({
      productName: text,
      name: text,
      price,
      salePrice: price,
      originPrice: price,
      priceText,
      capturedFrom: "android-ui-menu",
    });
  }
  return Array.from(new Map(products.map((product) => [product.productName.toLocaleLowerCase("id-ID"), product])).values());
}

async function saveMenuFromUi(outlet) {
  const uiStoreCode = textValue(outlet?.store_code);
  if (!uiStoreCode) return 0;
  const productsByName = new Map();
  let staleRounds = 0;

  for (let round = 1; round <= menuMaxScrolls && staleRounds < 4; round += 1) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 900));
    const products = extractVisibleMenuProductsFromUi(dumpUi());
    let fresh = 0;
    for (const product of products) {
      const key = product.productName.toLocaleLowerCase("id-ID");
      if (!productsByName.has(key)) {
        productsByName.set(key, product);
        fresh += 1;
      }
    }
    console.log(`Menu UI Tomoro terbaca (${textValue(outlet.store_name)} scroll ${round}): baru ${fresh}, total ${productsByName.size}`);
    staleRounds = fresh === 0 ? staleRounds + 1 : 0;
    runAdb(["shell", "input", "swipe", "780", "1700", "780", "760", "650"]);
  }

  const products = [...productsByName.values()];
  if (!products.length) return 0;
  await patchMenu(uiStoreCode, {
    source: "tomoro-ui-menu",
    capturedAt: new Date().toISOString(),
    storeCode: uiStoreCode,
    storeName: textValue(outlet.store_name),
    data: { products },
  });
  writeFileSync(join(logDir, `last-ui-menu-${uiStoreCode}.json`), JSON.stringify(products, null, 2));
  menus += 1;
  console.log(`Menu Tomoro dari UI tersimpan: ${uiStoreCode} (${products.length} produk)`);
  return products.length;
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

async function openStoreList() {
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
  return xml;
}

async function saveVisibleUiOutlets(label, activeKeyword = keyword) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2500));
  const visibleStores = extractVisibleStoresFromUi(dumpUi(), activeKeyword);
  if (visibleStores.length) {
    const saved = await upsertStores(visibleStores);
    writeFileSync(join(logDir, "last-ui-outlets.json"), JSON.stringify(saved, null, 2));
    let fresh = 0;
    for (const store of visibleStores) {
      if (!uiStoreCodes.has(store.store_code)) {
        uiStoreCodes.add(store.store_code);
        fresh += 1;
      }
    }
    uiOutlets = uiStoreCodes.size;
    console.log(`Outlet Tomoro dari UI tersimpan${label ? ` (${label})` : ""}: ${saved.length}, baru: ${fresh}, unik total: ${uiOutlets}`);
  }
  return visibleStores;
}

async function triggerAllOutletSweep() {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
  let xml = await openStoreList();
  if (!hasStoreList(xml)) {
    console.log("Auto sweep belum bisa buka Store List. Buka Store List manual lalu jalankan capture lagi.");
    return;
  }

  console.log("Sweep semua outlet Tomoro dimulai dari Store List.");
  let staleRounds = 0;
  for (let round = 1; round <= maxScrolls && staleRounds < 4; round += 1) {
    const stores = await saveVisibleUiOutlets(`scroll ${round}`);
    let fresh = 0;
    for (const store of stores) {
      if (!sweepSeenStoreCodes.has(store.store_code)) {
        sweepSeenStoreCodes.add(store.store_code);
        fresh += 1;
      }
    }
    staleRounds = fresh === 0 ? staleRounds + 1 : 0;
    runAdb(["shell", "input", "swipe", "540", "1700", "540", "850", "700"]);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1200));
  }
  console.log(`Sweep semua outlet selesai. Outlet unik terlihat: ${sweepSeenStoreCodes.size}`);
}

async function searchAndSaveKeyword(activeKeyword) {
  let xml = await openStoreList();
  if (!hasStoreList(xml)) {
    console.log("Auto search belum bisa buka Store List. Buka Store List manual lalu jalankan capture lagi.");
    return [];
  }
  if (tapResource(xml, "/etSearchInput")) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  } else if (tapResource(xml, "/tvSearchInput")) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
    xml = dumpUi();
    tapResource(xml, "/etSearchInput");
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  } else {
    console.log("Auto search belum menemukan kolom Search outlet.");
    return [];
  }
  runAdb(["shell", "input", "keyevent", "123"]);
  runAdb(["shell", "input", "keyevent", ...Array(60).fill("67")]);
  runAdb(["shell", "input", "text", encodeAdbText(activeKeyword)]);
  runAdb(["shell", "input", "keyevent", "66"]);
  console.log(`Search outlet Tomoro dipicu: ${activeKeyword}`);
  return saveVisibleUiOutlets(activeKeyword, activeKeyword);
}

async function openOutletMenu(outlet) {
  const outletName = textValue(outlet.store_name || outlet.storeName);
  if (!outletName) return false;
  if (textValue(outlet.raw_store?.status).toLowerCase() === "closed") {
    console.log(`Lewati outlet closed: ${outletName}`);
    return false;
  }
  await searchAndSaveKeyword(outletName);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 800));
  let xml = dumpUi();
  if (!tapStoreName(xml, outletName)) {
    console.log(`Outlet tidak terlihat setelah search: ${outletName}`);
    return false;
  }
  pendingMenuOutlet = outlet;
  console.log(`Outlet Tomoro dipilih untuk menu: ${outletName}`);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
  xml = dumpUi();
  if (!tapResource(xml, "/ivBeginOrder") && !tapText(xml, "Start Order") && !tapTextContains(xml, "Start")) {
    console.log(`Tombol Start Order tidak terlihat: ${outletName}`);
    return false;
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 7000));
  xml = dumpUi();
  const opened = hasMenuScreen(xml);
  if (opened) await saveMenuFromUi(outlet);
  return opened;
}

async function triggerMenuSweep() {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
  const outletsToProcess = await fetchCachedTomoroOutlets(menuLimit);
  if (!outletsToProcess.length) {
    console.log("Belum ada outlet Tomoro di Supabase. Jalankan capture outlet dulu.");
    return;
  }
  console.log(`Sweep menu Tomoro dimulai. Target outlet: ${outletsToProcess.length}`);
  for (const outlet of outletsToProcess) {
    const outletName = textValue(outlet.store_name);
    try {
      const opened = await openOutletMenu(outlet);
      if (!opened) console.log(`Menu belum terbuka: ${outletName}`);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 2500));
      runAdb(["shell", "input", "keyevent", "111"]);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
    } catch (error) {
      console.log(`Gagal proses menu ${outletName}: ${error.message}`);
    }
  }
  console.log("Sweep menu Tomoro selesai.");
}

async function triggerCitySweep() {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
  const xml = await openStoreList();
  if (!hasStoreList(xml)) {
    console.log("City sweep belum bisa buka Store List. Buka Store List manual lalu jalankan capture lagi.");
    return;
  }
  console.log(`Sweep outlet nasional Tomoro dimulai. Keyword: ${keywordList.length}`);
  let emptyRounds = 0;
  for (const cityKeyword of keywordList) {
    const stores = await searchAndSaveKeyword(cityKeyword);
    emptyRounds = stores.length ? 0 : emptyRounds + 1;
    if (emptyRounds >= 8) console.log("Beberapa keyword terakhir kosong; tetap lanjut karena kota berikutnya bisa ada outlet.");
  }
  console.log(`Sweep outlet nasional selesai. Outlet unik UI tersimpan: ${uiOutlets}`);
}

async function triggerOutletSearch() {
  if (menuSweep) {
    await triggerMenuSweep();
    return;
  }
  if (citySweep) {
    await triggerCitySweep();
    return;
  }
  if (allOutlets) {
    await triggerAllOutletSweep();
    return;
  }

  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
  await searchAndSaveKeyword(keyword);
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
  if (looksLikeTomoroMenu(payload.url, body)) {
    const storeCode = storeCodeFromUrl(payload.url);
    const uiStoreCode = textValue(pendingMenuOutlet?.store_code);
    if (storeCode) await upsertMenu(storeCode, body, pendingMenuOutlet || {});
    if (!storeCode && !uiStoreCode) return { outlets: 0, menus: 0 };
    if (uiStoreCode && uiStoreCode !== storeCode) await patchMenu(uiStoreCode, body);
    const logCode = storeCode || uiStoreCode;
    writeFileSync(join(logDir, `last-frida-menu-${logCode}.json`), JSON.stringify(body, null, 2));
    console.log(`Menu Tomoro tersimpan: ${storeCode || "(tanpa storeCode)"}${uiStoreCode && uiStoreCode !== storeCode ? ` + ${uiStoreCode}` : ""} (${countTomoroProducts(body)} produk terdeteksi)`);
    return { outlets: 0, menus: 1 };
  }
  return { outlets: 0, menus: 0 };
}

await ensureFridaServer();
if (setupOnly) {
  const devices = adbDevicesText();
  if (!devices.includes(`${adbSerial}\tdevice`)) fail(`VSPhone ADB belum terhubung: ${adbSerial}`);
  console.log(`SETUP BERHASIL: VSPhone Tomoro tersambung (${adbSerial}) dan Frida siap.`);
  process.exit(0);
}

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
let uiOutlets = 0;
const uiStoreCodes = new Set();
const sweepSeenStoreCodes = new Set();
let pendingMenuOutlet = null;
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
console.log(`Tomoro Frida capture aktif. PID ${pid}. ${menuSweep ? "Sweep menu dari outlet Supabase." : citySweep ? "Sweep outlet nasional per keyword." : allOutlets ? "Sweep outlet dari Store List." : "Buka/cari outlet/menu di app Tomoro."}`);
const autoTask = noAuto
  ? Promise.resolve()
  : triggerOutletSearch().catch((error) => console.log(`Auto search gagal: ${error.message}`));
if ((allOutlets || citySweep || menuSweep) && !noAuto) {
  await autoTask;
} else {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, durationMs));
}
child.kill();
console.log(`Capture selesai. Outlet API tersimpan: ${outlets}. Outlet UI tersimpan: ${uiOutlets}. Menu tersimpan: ${menus}.`);

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const configPath = join(root, ".env.tomoro-sync");
const fallbackKopkenConfigPath = join(root, ".env.kopken-sync");
const logDir = join(here, "logs");
mkdirSync(logDir, { recursive: true });

const TOMORO_API_BASE = "https://api-service.tomoro-coffee.id";
const DEFAULT_HEADERS = {
  revision: "3.5.3",
  countryCode: "id",
  appChannel: "google play",
  appLanguage: "en",
  timeZone: "Asia/Jakarta",
  ucde: "t698",
  "User-Agent": "okhttp/5.1.0",
};

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

const supabaseUrl = String(env.SUPABASE_URL || "")
  .replace(/\/rest\/v1\/?$/i, "")
  .replace(/\/$/, "");
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
const keywordArg = process.argv.find((arg) => arg.startsWith("--keyword="))?.slice("--keyword=".length).trim();
const storeArg = process.argv.find((arg) => arg.startsWith("--store="))?.slice("--store=".length).trim();
const keyword = keywordArg || env.TOMORO_DEFAULT_KEYWORD || "bogor";

function fail(message) {
  console.error(`\nGAGAL: ${message}`);
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey || supabaseKey.includes("ISI_")) {
  fail("Lengkapi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.tomoro-sync.");
}

function textValue(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function headerValue(headers, name) {
  const matchedKey = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return matchedKey ? textValue(headers[matchedKey]) : "";
}

async function getPrivateEdgeSecret(secretName) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_edge_secret`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ secret_name: secretName }),
  });
  const value = await response.json().catch(() => "");
  if (!response.ok || typeof value !== "string" || !value) {
    throw new Error(`Secret ${secretName} belum tersedia.`);
  }
  return value;
}

async function getTomoroRuntimeHeaders() {
  const raw = env.TOMORO_RUNTIME_HEADERS || await getPrivateEdgeSecret("tomoro_runtime_headers");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("TOMORO_RUNTIME_HEADERS tidak valid JSON.");
  }

  const token = headerValue(parsed, "token");
  const wToken = headerValue(parsed, "wToken");
  const deviceCode = headerValue(parsed, "deviceCode");
  if (!token || !wToken || !deviceCode) throw new Error("Header runtime Tomoro belum lengkap.");

  return {
    "Content-Type": "application/json",
    token,
    wToken,
    deviceCode,
    revision: headerValue(parsed, "revision") || DEFAULT_HEADERS.revision,
    countryCode: headerValue(parsed, "countryCode") || DEFAULT_HEADERS.countryCode,
    appChannel: headerValue(parsed, "appChannel") || DEFAULT_HEADERS.appChannel,
    appLanguage: headerValue(parsed, "appLanguage") || DEFAULT_HEADERS.appLanguage,
    timeZone: headerValue(parsed, "timeZone") || DEFAULT_HEADERS.timeZone,
    ucde: headerValue(parsed, "ucde") || DEFAULT_HEADERS.ucde,
    "User-Agent": DEFAULT_HEADERS["User-Agent"],
  };
}

async function tomoroFetch(path) {
  const response = await fetch(`${TOMORO_API_BASE}${path}`, {
    method: "GET",
    headers: await getTomoroRuntimeHeaders(),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false || body?.code && String(body.code) !== "200") {
    throw new Error(body?.message || body?.msg || `Tomoro HTTP ${response.status}`);
  }
  return body;
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
    source: "tomoro-official-sync",
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

async function updateStoreMenu(storeCode, menu) {
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
      source: "tomoro-official-sync",
      menu_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Supabase menolak menu Tomoro: ${await response.text()}`);
  return response.json();
}

async function syncOutlets(searchKeyword) {
  const query = new URLSearchParams({ pageNo: "1", pageSize: "15", storeName: searchKeyword });
  const data = await tomoroFetch(`/portal/app/basic/storeInfo/getStoreList/v3?${query}`);
  const records = Array.isArray(data?.data?.records) ? data.data.records : [];
  const stores = records.map(normalizeStore).filter((store) => store.store_code);
  const saved = await upsertStores(stores);
  writeFileSync(join(logDir, "last-outlets.json"), JSON.stringify(saved, null, 2));
  console.log(`Outlet Tomoro tersimpan: ${saved.length}`);
  return saved;
}

async function syncMenu(storeCode) {
  const query = new URLSearchParams({ storeCode, mainMenuType: "1" });
  const data = await tomoroFetch(`/portal/app/basic/menu/getMenuList?${query}`);
  const saved = await updateStoreMenu(storeCode, data);
  writeFileSync(join(logDir, `last-menu-${storeCode}.json`), JSON.stringify(data, null, 2));
  console.log(`Menu Tomoro tersimpan: ${saved[0]?.store_name || storeCode}`);
  return saved;
}

try {
  if (storeArg) {
    await syncMenu(storeArg);
  } else {
    const stores = await syncOutlets(keyword);
    const firstStoreCode = stores[0]?.store_code;
    if (firstStoreCode) await syncMenu(firstStoreCode);
  }
} catch (error) {
  fail(error.message);
}

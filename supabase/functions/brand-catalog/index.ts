import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const UPSTREAM_BASE = "https://www.nufsfood.shop/api";
const FORE_API_BASE = "https://api.fore.coffee";
const FORE_IMAGE_BASE = "https://static.fore.coffee/";
const TOMORO_API_BASE = "https://api-service.tomoro-coffee.id";
const FORE_APP_VERSION = Deno.env.get("FORE_APP_VERSION") || "5.3.0";
const FORE_ACCESS_TOKEN_ENV = Deno.env.get("FORE_ACCESS_TOKEN") || "";
const TOMORO_RUNTIME_HEADERS_ENV = Deno.env.get("TOMORO_RUNTIME_HEADERS") || "";
const JSON_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=60, s-maxage=300",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function cleanKeyword(value: string | null) {
  return String(value || "").trim().slice(0, 80);
}

function cleanOutletCode(value: string | null) {
  const code = String(value || "").trim();
  return /^[a-zA-Z0-9._-]{1,80}$/.test(code) ? code : "";
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.status === "error") {
    const apiError = body?.payload?.errors?.[0];
    throw new Error(body?.error || apiError?.id || apiError?.en || apiError?.code || `Upstream HTTP ${response.status}`);
  }
  return body;
}

async function foreLive(path: string) {
  return fetchJson(`${UPSTREAM_BASE}/fore-live?path=${encodeURIComponent(path)}`);
}

async function getPrivateEdgeSecret(secretName: string) {
  const configuredSupabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseUrl = configuredSupabaseUrl.replace(/\/rest\/v1\/?$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Secret Edge Function belum tersedia");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_edge_secret`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ secret_name: secretName }),
  });
  const value = await response.json().catch(() => "");
  if (!response.ok || typeof value !== "string" || !value) throw new Error("Secret Edge Function belum tersedia");
  return value;
}

let foreAccessTokenCache: { expiresAt: number; value: string } | null = null;

async function getForeAccessToken() {
  if (FORE_ACCESS_TOKEN_ENV) return FORE_ACCESS_TOKEN_ENV;
  if (foreAccessTokenCache && foreAccessTokenCache.expiresAt > Date.now()) return foreAccessTokenCache.value;
  const value = await getPrivateEdgeSecret("fore_access_token");
  foreAccessTokenCache = { expiresAt: Date.now() + 5 * 60 * 1000, value };
  return value;
}

async function foreOfficial(path: string) {
  const accessToken = await getForeAccessToken();
  return fetchJson(`${FORE_API_BASE}${path}`, {
    headers: {
      "access-token": accessToken,
      "app-version": FORE_APP_VERSION,
    },
  });
}

type TomoroHeaders = Record<string, string>;

let tomoroHeadersCache: { expiresAt: number; value: TomoroHeaders } | null = null;

function headerValue(headers: Record<string, unknown>, name: string) {
  const matchedKey = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return matchedKey ? textValue(headers[matchedKey]) : "";
}

async function getTomoroRuntimeHeaders() {
  if (tomoroHeadersCache && tomoroHeadersCache.expiresAt > Date.now()) return tomoroHeadersCache.value;
  const raw = TOMORO_RUNTIME_HEADERS_ENV || await getPrivateEdgeSecret("tomoro_runtime_headers");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    throw new Error("Konfigurasi header Tomoro tidak valid");
  }

  const token = headerValue(parsed, "token");
  const wToken = headerValue(parsed, "wToken");
  const deviceCode = headerValue(parsed, "deviceCode");
  if (!token || !wToken || !deviceCode) throw new Error("Header runtime Tomoro belum tersedia");

  const headers: TomoroHeaders = {
    "Content-Type": "application/json",
    token,
    wToken,
    deviceCode,
    revision: headerValue(parsed, "revision") || "3.5.3",
    countryCode: headerValue(parsed, "countryCode") || "id",
    appChannel: headerValue(parsed, "appChannel") || "google play",
    appLanguage: headerValue(parsed, "appLanguage") || "en",
    timeZone: headerValue(parsed, "timeZone") || "Asia/Jakarta",
    ucde: headerValue(parsed, "ucde") || "t698",
    "User-Agent": "okhttp/5.1.0",
  };
  tomoroHeadersCache = { expiresAt: Date.now() + 5 * 60 * 1000, value: headers };
  return headers;
}

async function tomoroOfficial(path: string) {
  return fetchJson(`${TOMORO_API_BASE}${path}`, { headers: await getTomoroRuntimeHeaders() });
}

async function supabaseRest(path: string) {
  const configuredSupabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseUrl = configuredSupabaseUrl.replace(/\/rest\/v1\/?$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase cache belum tersedia");
  return fetchJson(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
}

type ForeOutlet = Record<string, unknown>;
type TomoroOutletCacheRow = Record<string, unknown>;

let foreOutletCache: { expiresAt: number; outlets: ForeOutlet[] } | null = null;

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function foreImageUrl(value: unknown) {
  const path = textValue(value);
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${FORE_IMAGE_BASE}${path.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

async function getOfficialForeOutlets() {
  if (foreOutletCache && foreOutletCache.expiresAt > Date.now()) return foreOutletCache.outlets;
  const data = await foreOfficial("/store/all?lat=-6.200000&long=106.816666&country_id=1&company_code=fki");
  const outlets: ForeOutlet[] = Array.isArray(data?.payload) ? data.payload : [];
  foreOutletCache = { expiresAt: Date.now() + 2 * 60 * 1000, outlets };
  return outlets;
}

function normalizeOfficialForeOutlet(outlet: ForeOutlet) {
  const isOpen = outlet.is_open === true;
  return {
    code: textValue(outlet.st_id),
    name: textValue(outlet.st_name || outlet.st_code),
    city: textValue(outlet.st_address),
    is_open: isOpen,
    open_status: isOpen ? "open" : "closed",
  };
}

function normalizeOfficialForeMenu(products: ForeOutlet[]) {
  const usable = products.filter((product) => textValue(product.pd_code) && textValue(product.pd_name));
  const master = usable.map((product) => {
    const regularPrice = numberValue(product.pd_final_price_ori, product.pd_final_price);
    return {
      id: product.pd_id,
      categories: [textValue(product.cat_name)].filter(Boolean),
      name: textValue(product.pd_name),
      image_url: foreImageUrl(product.pd_img),
      regular_price: regularPrice,
      large_price: 0,
      regular_discount_price: numberValue(product.pd_final_price),
      large_discount_price: 0,
      badge: "",
      customizations: [],
      addons: [],
      product_code: textValue(product.pd_code),
      small_price: 0,
      is_small_available: false,
      is_regular_available: true,
      is_large_available: false,
    };
  });
  const storeMenu = usable.map((product) => ({
    product_code: textValue(product.pd_code),
    is_sold_out: textValue(product.pd_status) !== "active" || textValue(product.stpd_status) !== "active",
    small_price: 0,
    regular_price: numberValue(product.pd_final_price_ori, product.pd_final_price),
    large_price: 0,
  }));
  return { master, storeMenu };
}

function normalizeCachedTomoroOutlet(row: TomoroOutletCacheRow) {
  const raw = typeof row.raw_store === "object" && row.raw_store ? row.raw_store as Record<string, unknown> : {};
  return {
    ...raw,
    storeCode: textValue(row.store_code || raw.storeCode),
    storeName: textValue(row.store_name || raw.storeName),
    storeAddress: textValue(row.store_address || raw.storeAddress),
    city: textValue(row.city || raw.city),
  };
}

async function getCachedTomoroOutlets(keyword: string) {
  const filter = `store_name.ilike.*${keyword}*,store_address.ilike.*${keyword}*`;
  const path = `tomoro_outlets_catalog?select=store_code,store_name,store_address,city,raw_store,updated_at&or=(${encodeURIComponent(filter)})&order=store_name.asc&limit=15`;
  const rows = await supabaseRest(path);
  return Array.isArray(rows) ? rows.map(normalizeCachedTomoroOutlet) : [];
}

async function getCachedTomoroMenu(storeCode: string) {
  const path = `tomoro_outlets_catalog?select=menu&store_code=eq.${encodeURIComponent(storeCode)}&limit=1`;
  const rows = await supabaseRest(path);
  const menu = Array.isArray(rows) ? rows[0]?.menu : null;
  if (!menu) throw new Error("Cache menu Tomoro belum tersedia");
  return menu;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: JSON_HEADERS });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const keyword = cleanKeyword(url.searchParams.get("keyword"));
  const outletCode = cleanOutletCode(url.searchParams.get("outletCode"));

  try {
    if (action === "fore-outlets") {
      if (keyword.length < 3) return json({ error: "Keyword minimal 3 karakter" }, 400);
      try {
        const needle = keyword.toLocaleLowerCase("id-ID");
        const outlets = (await getOfficialForeOutlets())
          .map(normalizeOfficialForeOutlet)
          .filter((outlet) => `${outlet.name} ${outlet.city}`.toLocaleLowerCase("id-ID").includes(needle))
          .slice(0, 15);
        return json({ outlets, source: "fore-official" });
      } catch (officialError) {
        console.warn("Fore official outlet fallback", officialError);
        const path = `outlets?select=code,name,city,is_open,open_status&brand=eq.fore&is_active=eq.true&name=ilike.*${encodeURIComponent(keyword)}*&limit=15`;
        const outlets = await foreLive(path);
        return json({ outlets: Array.isArray(outlets) ? outlets : [], source: "nufs-fallback" });
      }
    }

    if (action === "fore-menu") {
      if (!outletCode) return json({ error: "Kode outlet tidak valid" }, 400);
      try {
        if (!/^\d{1,10}$/.test(outletCode)) throw new Error("Kode outlet bukan ID Fore resmi");
        const data = await foreOfficial(`/product/v2?store=${outletCode}&company_code=fki`);
        const products = Array.isArray(data?.payload) ? data.payload : [];
        return json({ ...normalizeOfficialForeMenu(products), source: "fore-official" });
      } catch (officialError) {
        console.warn("Fore official menu fallback", officialError);
        const masterPath = "menu_items?select=id,categories,name,image_url,regular_price,large_price,regular_discount_price,large_discount_price,badge,customizations,addons,product_code,small_price,is_small_available,is_regular_available,is_large_available&brand=eq.fore&is_available=eq.true&product_code=not.is.null&order=category_sort.asc,id.asc";
        const storePath = `store_menus?select=product_code,is_sold_out,small_price,regular_price,large_price&store_code=eq.${outletCode}`;
        const [master, storeMenu] = await Promise.all([foreLive(masterPath), foreLive(storePath)]);
        return json({ master: Array.isArray(master) ? master : [], storeMenu: Array.isArray(storeMenu) ? storeMenu : [], source: "nufs-fallback" });
      }
    }

    if (action === "tomoro-outlets") {
      if (keyword.length < 3) return json({ error: "Keyword minimal 3 karakter" }, 400);
      try {
        const query = new URLSearchParams({ pageNo: "1", pageSize: "15", storeName: keyword });
        const data = await tomoroOfficial(`/portal/app/basic/storeInfo/getStoreList/v3?${query}`);
        return json({ outlets: Array.isArray(data?.data?.records) ? data.data.records : [], source: "tomoro-official" });
      } catch (officialError) {
        console.warn("Tomoro official outlet fallback", officialError);
        return json({ outlets: await getCachedTomoroOutlets(keyword), source: "tomoro-cache" });
      }
    }

    if (action === "tomoro-menu") {
      if (!outletCode) return json({ error: "Kode outlet tidak valid" }, 400);
      try {
        const cached = await getCachedTomoroMenu(outletCode).catch(() => null);
        if (cached) return json({ ...cached, source: "tomoro-cache" });
        const query = new URLSearchParams({ storeCode: outletCode, mainMenuType: "1" });
        const data = await tomoroOfficial(`/portal/app/basic/menu/getMenuList?${query}`);
        return json({ ...data, source: "tomoro-official" });
      } catch (officialError) {
        console.warn("Tomoro official menu fallback", officialError);
        const data = await getCachedTomoroMenu(outletCode);
        return json({ ...data, source: "tomoro-cache" });
      }
    }

    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (error) {
    console.error("brand-catalog upstream error", action, error);
    return json({ error: error instanceof Error ? error.message : "Sumber menu tidak tersedia" }, 502);
  }
});

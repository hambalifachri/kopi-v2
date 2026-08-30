import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const UPSTREAM_BASE = "https://www.nufsfood.shop/api";
const FORE_API_BASE = "https://api.fore.coffee";
const FORE_IMAGE_BASE = "https://static.fore.coffee/";
const FORE_APP_VERSION = Deno.env.get("FORE_APP_VERSION") || "5.3.0";
const FORE_ACCESS_TOKEN_ENV = Deno.env.get("FORE_ACCESS_TOKEN") || "";
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

let foreAccessTokenCache: { expiresAt: number; value: string } | null = null;

async function getForeAccessToken() {
  if (FORE_ACCESS_TOKEN_ENV) return FORE_ACCESS_TOKEN_ENV;
  if (foreAccessTokenCache && foreAccessTokenCache.expiresAt > Date.now()) return foreAccessTokenCache.value;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Fore access token belum tersedia");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_edge_secret`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ secret_name: "fore_access_token" }),
  });
  const value = await response.json().catch(() => "");
  if (!response.ok || typeof value !== "string" || !value) throw new Error("Fore access token belum tersedia");
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

type ForeOutlet = Record<string, unknown>;

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
      const data = await fetchJson(`${UPSTREAM_BASE}/tomoro-store-list`, {
        method: "POST",
        body: JSON.stringify({ keyword, pageNo: 1, pageSize: 15 }),
      });
      return json({ outlets: data?.data?.records || [], source: data?.source || "live" });
    }

    if (action === "tomoro-menu") {
      if (!outletCode) return json({ error: "Kode outlet tidak valid" }, 400);
      const data = await fetchJson(`${UPSTREAM_BASE}/tomoro-menu`, {
        method: "POST",
        body: JSON.stringify({ storeCode: outletCode }),
      });
      return json(data);
    }

    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (error) {
    console.error("brand-catalog upstream error", action, error);
    return json({ error: error instanceof Error ? error.message : "Sumber menu tidak tersedia" }, 502);
  }
});

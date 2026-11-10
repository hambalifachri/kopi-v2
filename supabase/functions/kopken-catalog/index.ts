import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function cleanOutletCode(value: string | null) {
  const code = String(value || "").trim();
  return /^[a-zA-Z0-9._-]{3,80}$/.test(code) ? code : "";
}

function cleanKeyword(value: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

async function fetchOfficialStores(keyword: string, page: number, pageSize: number) {
  // Reference coordinates are only used for the official search.
  const response = await fetch("https://apps.kopikenangan.com/kk-api-kopikenangan/api/store/query_pageable_store", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      fuzzy_name: keyword, lat: -6.419, lng: 107.452, deliverable: 0,
      order_type: [], page: { page_index: page, page_size: pageSize }, brand_codes: [],
      disable_delivery_distance_limit: true,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`official-outlets-http-${response.status}`);
  const result = await response.json();
  if (result?.error_code !== 0 || !Array.isArray(result?.data?.store)) {
    throw new Error("official-outlets-invalid-response");
  }
  return result.data;
}

async function catalogRows(params: URLSearchParams) {
  const base = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!base || !anonKey) throw new Error("catalog-unconfigured");

  const response = await fetch(`${base}/rest/v1/kopken_outlets_catalog?${params}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`catalog-http-${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("catalog-invalid-response");
  return rows;
}

async function searchOutlets(url: URL) {
  const keyword = cleanKeyword(url.searchParams.get("keyword"));
  if (keyword.length < 3) return json({ outlets: [], page: 1, hasMore: false, source: "kopken-official" });
  const page = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const result = await fetchOfficialStores(keyword, page, 20);
  const outlets = new Map();
  for (const store of result.store) {
    const code = cleanOutletCode(store?.code ?? store?.store_code);
    const name = cleanKeyword(store?.name);
    if (!code || !name || outlets.has(code)) continue;
    if (Array.isArray(store.brand_and_image) && !store.brand_and_image.some(
      (brand: { brand_code?: number | string }) => Number(brand?.brand_code) === 1,
    )) continue;
    const openStatus = typeof store.open_status === "string" ? store.open_status.trim().slice(0, 120) : "";
    outlets.set(code, {
      code, name,
      address: typeof store.address === "string" ? store.address.trim() : "",
      category: typeof store.category === "string" ? store.category : "",
      isOpen: /pesan di outlet/i.test(openStatus) ? false : typeof store.is_open === "boolean" ? store.is_open : null,
      openStatus,
    });
  }
  return json({
    outlets: [...outlets.values()],
    page,
    hasMore: page < Number(result.pages),
    source: "kopken-official",
  });
}

async function loadMenu(url: URL) {
  const outletCode = cleanOutletCode(url.searchParams.get("outletCode"));
  if (!outletCode) return json({ error: "Kode outlet tidak valid" }, 400);
  const params = new URLSearchParams({
    select: "outlet_code,outlet_name,category,menu,updated_at",
    outlet_code: `eq.${outletCode}`,
    limit: "1",
  });
  const [row] = await catalogRows(params);
  if (!row) return json({ error: "Outlet tidak ditemukan" }, 404);
  const hasMenu = Array.isArray(row.menu)
    ? row.menu.length > 0
    : Array.isArray(row.menu?.data?.menu_groups) && row.menu.data.menu_groups.length > 0;
  if (!hasMenu) return json({ error: "Menu outlet belum tersinkron" }, 404);
  return json({
    outletCode: row.outlet_code,
    outletName: row.outlet_name,
    category: row.category || "",
    updatedAt: row.updated_at || "",
    payload: row.menu,
    source: "vsphone-sync",
  });
}

async function loadLiveMenu(url: URL) {
  const outletCode = cleanOutletCode(url.searchParams.get("outletCode"));
  if (!outletCode) return json({ error: "Kode outlet tidak valid" }, 400);
  const response = await fetch("https://apps.kopikenangan.com/kk-api-kopikenangan/api/product/query_product_menu", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      store_code: outletCode, voucher_code: null, product_without_promo: true,
      display_combo_v2: true, for_shipping: false, display_merchandise_product: true,
      display_mix_match_optional: true, support_discount_percentage: true,
    }),
    signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) throw new Error(`live-menu-http-${response.status}`);
  const payload = await response.json();
  const groups = payload?.data?.menu_groups;
  if (payload?.error_code !== 0 || !Array.isArray(groups) ||
      !groups.some(group => Array.isArray(group?.menu_products) && group.menu_products.length)) {
    return json({ error: "Menu langsung belum tersedia. Coba lagi." }, 503);
  }
  return json({ outletCode, payload, source: "kopken-official", checkedAt: new Date().toISOString() });
}

async function loadOutletStatus(url: URL) {
  const outletCode = cleanOutletCode(url.searchParams.get("outletCode"));
  if (!outletCode) return json({ error: "Kode outlet tidak valid" }, 400);
  let fuzzyName = cleanKeyword(url.searchParams.get("outletName"));
  if (!fuzzyName) {
    // Older web clients only send the outlet code.
    const [outlet] = await catalogRows(new URLSearchParams({
      select: "outlet_name", outlet_code: `eq.${outletCode}`, limit: "1",
    }));
    fuzzyName = cleanKeyword(outlet?.outlet_name);
  }
  if (!fuzzyName) return json({ error: "Nama outlet belum tersedia" }, 503);
  const { store: stores } = await fetchOfficialStores(fuzzyName, 1, 10);
  const match = stores.find((store: { code?: string; store_code?: string }) =>
    String(store?.code ?? store?.store_code ?? "") === outletCode
  );
  const message = typeof match?.open_status === "string" ? match.open_status.trim().slice(0, 120) : "";
  const status = /pesan di outlet/i.test(message) ? "onsite_only"
    : match?.is_open === true ? "open"
    : match?.is_open === false ? "closed" : "unknown";
  return json({ outletCode, status, message, checkedAt: new Date().toISOString(), source: "kopken-official" });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (request.method !== "GET") return json({ error: "Method tidak didukung" }, 405);
  try {
    const url = new URL(request.url);
    switch (url.searchParams.get("action")) {
      case "outlets": return await searchOutlets(url);
      case "menu": return await loadMenu(url);
      case "live-menu": return await loadLiveMenu(url);
      case "status": return await loadOutletStatus(url);
      default: return json({ error: "Action tidak dikenal" }, 400);
    }
  } catch (error) {
    console.error("Kopken catalog read failed", error);
    return json({ error: "Katalog sementara tidak tersedia" }, 503);
  }
});

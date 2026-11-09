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
  return String(value || "").replace(/[,()*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
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
  if (keyword.length < 3) return json({ outlets: [], page: 1, hasMore: false, source: "vsphone-sync" });
  const page = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const params = new URLSearchParams({
    select: "outlet_code,outlet_name,outlet_address,category,updated_at",
    or: `(outlet_name.ilike.*${keyword}*,outlet_address.ilike.*${keyword}*)`,
    order: "outlet_name.asc",
    limit: "20",
    offset: String((page - 1) * 20),
  });
  const rows = await catalogRows(params);
  return json({
    outlets: rows.map(row => ({
      code: row.outlet_code,
      name: row.outlet_name,
      address: row.outlet_address || "",
      category: row.category || "",
      updatedAt: row.updated_at || "",
      isOpen: null,
      openStatus: "Status realtime belum tersedia",
    })),
    page,
    hasMore: rows.length === 20,
    source: "vsphone-sync",
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

async function loadOutletStatus(url: URL) {
  const outletCode = cleanOutletCode(url.searchParams.get("outletCode"));
  if (!outletCode) return json({ error: "Kode outlet tidak valid" }, 400);
  const [outlet] = await catalogRows(new URLSearchParams({
    select: "outlet_name,outlet_code", outlet_code: `eq.${outletCode}`, limit: "1",
  }));
  if (!outlet) return json({ error: "Outlet tidak ditemukan" }, 404);
  // The upstream name is sent as JSON, not a PostgREST filter. Keep
  // punctuation: the official search distinguishes "(FCK)" from "FCK".
  const fuzzyName = String(outlet.outlet_name || "").trim();
  if (!fuzzyName) return json({ error: "Nama outlet belum tersedia" }, 503);
  // Reference coordinates are not customer location. This is a store search,
  // with the distance limit disabled, and results must match the exact code.
  const response = await fetch("https://apps.kopikenangan.com/kk-api-kopikenangan/api/store/query_pageable_store", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      fuzzy_name: fuzzyName, lat: -6.419, lng: 107.452, deliverable: 0,
      order_type: [], page: { page_index: 1, page_size: 10 }, brand_codes: [],
      disable_delivery_distance_limit: true,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`outlet-status-http-${response.status}`);
  const result = await response.json();
  const stores = result?.data?.store;
  const match = result?.error_code === 0 && Array.isArray(stores)
    ? stores.find(store => String(store?.code ?? store?.store_code ?? "") === outletCode)
    : null;
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
      case "status": return await loadOutletStatus(url);
      default: return json({ error: "Action tidak dikenal" }, 400);
    }
  } catch (error) {
    console.error("Kopken catalog read failed", error);
    return json({ error: "Katalog sementara tidak tersedia" }, 503);
  }
});

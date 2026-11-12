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

function cleanCatalogSearchTerm(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

async function searchOutlets(url: URL) {
  const keyword = cleanCatalogSearchTerm(cleanKeyword(url.searchParams.get("keyword")));
  if (keyword.length < 3) return json({ outlets: [], page: 1, hasMore: false, source: "supabase-catalog" });
  const page = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const pageSize = 20;
  const terms = [...new Set([
    keyword,
    ...keyword.split(" ").filter(word => word.length >= 3).sort((a, b) => b.length - a.length),
  ])];
  let rows: Array<Record<string, unknown>> = [];
  let matchedTerm = keyword;
  for (const term of terms) {
    const params = new URLSearchParams({
      select: "outlet_code,outlet_name,outlet_address,category,updated_at",
      or: `(outlet_name.ilike.*${term}*,outlet_address.ilike.*${term}*)`,
      menu: "not.is.null",
      order: "outlet_name.asc",
      limit: String(pageSize + 1),
      offset: String((page - 1) * pageSize),
    });
    rows = await catalogRows(params);
    if (rows.length) {
      matchedTerm = term;
      break;
    }
  }
  const tokens = keyword.toLowerCase().split(" ").filter(Boolean);
  const score = (row: Record<string, unknown>) => {
    const text = `${row.outlet_name || ""} ${row.outlet_address || ""}`.toLowerCase();
    return tokens.reduce((total, token) => total + (text.includes(token) ? 1 : 0), 0);
  };
  rows.sort((a, b) => score(b) - score(a));
  const outlets = rows.slice(0, pageSize).flatMap(row => {
    const code = cleanOutletCode(String(row.outlet_code || ""));
    const name = cleanKeyword(String(row.outlet_name || ""));
    if (!code || !name) return [];
    return [{
      code, name,
      address: typeof row.outlet_address === "string" ? row.outlet_address : "",
      category: typeof row.category === "string" ? row.category : "",
      isOpen: null,
      updatedAt: row.updated_at || null,
    }];
  });
  return json({
    outlets,
    page,
    hasMore: rows.length > pageSize,
    source: "supabase-catalog",
    matchedTerm,
  });
}

async function cachedMenu(outletCode: string, source: string) {
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
    source,
  });
}

async function loadMenu(url: URL) {
  return await cachedMenu(cleanOutletCode(url.searchParams.get("outletCode")), "vsphone-sync");
}

async function loadLiveMenu(url: URL) {
  const outletCode = cleanOutletCode(url.searchParams.get("outletCode"));
  if (!outletCode) return json({ error: "Kode outlet tidak valid" }, 400);
  return await cachedMenu(outletCode, "supabase-cache");
}

async function loadOutletStatus(url: URL) {
  const outletCode = cleanOutletCode(url.searchParams.get("outletCode"));
  if (!outletCode) return json({ error: "Kode outlet tidak valid" }, 400);
  const [outlet] = await catalogRows(new URLSearchParams({
    select: "outlet_name,updated_at", outlet_code: `eq.${outletCode}`, limit: "1",
  }));
  if (!outlet) return json({ error: "Outlet tidak ditemukan di katalog Supabase" }, 404);
  return json({
    outletCode,
    status: "unknown",
    message: "Status buka/tutup live sementara tidak tersedia.",
    updatedAt: outlet.updated_at || "",
    checkedAt: new Date().toISOString(),
    source: "supabase-cache",
  });
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

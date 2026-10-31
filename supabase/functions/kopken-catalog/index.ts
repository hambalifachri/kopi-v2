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

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (request.method !== "GET") return json({ error: "Method tidak didukung" }, 405);
  try {
    const url = new URL(request.url);
    switch (url.searchParams.get("action")) {
      case "outlets": return await searchOutlets(url);
      case "menu": return await loadMenu(url);
      default: return json({ error: "Action tidak dikenal" }, 400);
    }
  } catch (error) {
    console.error("Kopken catalog read failed", error);
    return json({ error: "Katalog sementara tidak tersedia" }, 503);
  }
});

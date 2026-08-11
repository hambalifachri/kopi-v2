import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const UPSTREAM_BASE = "https://www.nufsfood.shop/api";
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
  if (!response.ok) throw new Error(body?.error || `Upstream HTTP ${response.status}`);
  return body;
}

async function foreLive(path: string) {
  return fetchJson(`${UPSTREAM_BASE}/fore-live?path=${encodeURIComponent(path)}`);
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
      const path = `outlets?select=code,name,city,is_open,open_status&brand=eq.fore&is_active=eq.true&name=ilike.*${encodeURIComponent(keyword)}*&limit=15`;
      const outlets = await foreLive(path);
      return json({ outlets: Array.isArray(outlets) ? outlets : [] });
    }

    if (action === "fore-menu") {
      if (!outletCode) return json({ error: "Kode outlet tidak valid" }, 400);
      const masterPath = "menu_items?select=id,categories,name,image_url,regular_price,large_price,regular_discount_price,large_discount_price,badge,customizations,addons,product_code,small_price,is_small_available,is_regular_available,is_large_available&brand=eq.fore&is_available=eq.true&product_code=not.is.null&order=category_sort.asc,id.asc";
      const storePath = `store_menus?select=product_code,is_sold_out,small_price,regular_price,large_price&store_code=eq.${outletCode}`;
      const [master, storeMenu] = await Promise.all([foreLive(masterPath), foreLive(storePath)]);
      return json({ master: Array.isArray(master) ? master : [], storeMenu: Array.isArray(storeMenu) ? storeMenu : [] });
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

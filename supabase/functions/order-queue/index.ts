import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=15, s-maxage=15",
};

export function summarizeQueue(rows) {
  let orders = 0;
  let batches = 0;
  for (const row of rows) {
    if (row.brand !== "Kopi Kenangan" || !["new", "processing"].includes(row.status)) continue;
    let stored = row.batches;
    if (typeof stored === "string") {
      try { stored = JSON.parse(stored); } catch { stored = null; }
    }
    const remaining = Array.isArray(stored) && stored.length
      ? stored.filter(batch => !["completed", "paid", "cancelled"].includes(batch?.status)).length
      : 1;
    if (remaining > 0) { orders++; batches += remaining; }
  }
  return {
    orders, batches, minMinutes: batches * 2, maxMinutes: batches * 4,
    minutesPerBatch: { min: 2, max: 4 }, mode: "sequential",
    checkedAt: new Date().toISOString(),
  };
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers });
  try {
    const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!base || !key) throw new Error("Configuration unavailable");
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const query = new URLSearchParams({
        select: "brand,status,batches", brand: "eq.Kopi Kenangan", status: "in.(new,processing)",
        order: "id.asc", offset: String(offset), limit: "1000",
      });
      const result = await fetch(`${base}/rest/v1/orders?${query}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(4000),
      });
      if (!result.ok) throw new Error("Queue unavailable");
      const page = await result.json();
      if (!Array.isArray(page)) throw new Error("Invalid queue response");
      rows.push(...page);
      if (page.length < 1000) break;
    }
    return new Response(JSON.stringify(summarizeQueue(rows)), { headers });
  } catch {
    return new Response(JSON.stringify({ error: "Info antrean sementara belum tersedia" }), {
      status: 503, headers: { ...headers, "Cache-Control": "no-store" },
    });
  }
});

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { stripTypeScriptTypes } = require("node:module");
const { join } = require("node:path");
const vm = require("node:vm");

const source = readFileSync(join(__dirname, "..", "supabase", "functions", "kopken-catalog", "index.ts"), "utf8")
  .replace(/^import .*\r?\n/, "");
const row = {
  outlet_code: "JKT.CRPALMERAH",
  outlet_name: "Dapur Kitchen Palmerah (FCK)",
  outlet_address: "Palmerah",
  category: "Cloud Kitchen",
  updated_at: "2026-10-31T10:00:00Z",
  menu: { data: { menu_groups: [{ group_name: "Coffee", menu_products: [{ name: "Mantan" }] }] } },
};
let handler;
const upstreamUrls = [];
let liveStore = { code: row.outlet_code, is_open: true, open_status: "" };
const context = {
  Deno: {
    env: { get: name => ({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "test" })[name] },
    serve: fn => { handler = fn; },
  },
  fetch: async (url, options) => {
    upstreamUrls.push(String(url));
    if (String(url).includes("query_pageable_store")) {
      assert.equal(options.method, "POST");
      assert.equal(JSON.parse(options.body).fuzzy_name, row.outlet_name);
      assert.equal(Object.hasOwn(options.headers, "Authorization"), false);
      return { ok: true, json: async () => ({ error_code: 0, data: { store: [liveStore] } }) };
    }
    return { ok: true, json: async () => [row] };
  },
  Response, URL, URLSearchParams, AbortSignal, console,
};
vm.runInNewContext(stripTypeScriptTypes(source), context);

(async () => {
  const base = "https://example.supabase.co/functions/v1/kopken-catalog";
  const outlets = await handler(new Request(`${base}?action=outlets&keyword=Palmerah`));
  assert.equal(outlets.status, 200);
  const outletBody = await outlets.json();
  assert.equal(outletBody.outlets[0].code, "JKT.CRPALMERAH");
  assert.equal(outletBody.outlets[0].isOpen, null, "Do not claim a live status from menu sync");
  assert.match(upstreamUrls[0], /kopken_outlets_catalog/);

  const menu = await handler(new Request(`${base}?action=menu&outletCode=JKT.CRPALMERAH`));
  assert.equal(menu.status, 200);
  assert.equal((await menu.json()).source, "vsphone-sync");
  const statusUrl = `${base}?action=status&outletCode=${row.outlet_code}`;
  assert.equal((await (await handler(new Request(statusUrl))).json()).status, "open");
  liveStore = { ...liveStore, is_open: false, open_status: "BUKA BESOK JAM 08:15" };
  assert.equal((await (await handler(new Request(statusUrl))).json()).status, "closed");
  liveStore.open_status = "PESAN DI OUTLET";
  assert.equal((await (await handler(new Request(statusUrl))).json()).status, "onsite_only");
  liveStore.code = "DIFFERENT.OUTLET";
  assert.equal((await (await handler(new Request(statusUrl))).json()).status, "unknown");
  const invalid = await handler(new Request(`${base}?action=menu&outletCode=bad%2Cquery`));
  assert.equal(invalid.status, 400);
  const preflight = await handler(new Request(base, { method: "OPTIONS" }));
  assert.equal(preflight.status, 200);
  console.log("Own Kopken catalog API search, menu, validation and CORS passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });

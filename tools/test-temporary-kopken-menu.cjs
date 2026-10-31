const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

const source = readFileSync(join(__dirname, "..", "assets", "js", "api.js"), "utf8");
const synced = { category: "Mall", menu: { data: { menu_groups: [{
  group_name: "Kenangan Toast",
  menu_products: [{ id: 5917, product_code: "9341610000", name: "Wahyu Sapi Toast", brand: "Kopi Kenangan", price: 19000, orig_price: 19000 }],
}] } } };
const live = { success: true, storeCode: "KK.CBN.RKTLN", categories: [
  { categoryName: "Kenangan Toast", items: [
    { id: 5917, name: "Wahyu Sapi Toast", originalPrice: 20000, price: 10000 },
    { id: 9999, name: "Produk Baru", originalPrice: 24000, price: 12000 },
  ] },
  { categoryName: "Paket Kombo Bintang Store", items: [{ id: "bintang_combo_1", name: "Paket", originalPrice: 50000 }] },
] };
let failLive = false;
const response = data => ({ ok: true, json: async () => data });
const context = {
  window: { addEventListener() {}, kopiKenanganOutletState: {}, KOPI_SUPABASE_CONFIG: { url: "https://example.supabase.co", anonKey: "test" } },
  document: { addEventListener() {} },
  AbortSignal,
  console,
  fetch: async url => {
    if (url.includes("/rest/v1/")) return response([synced]);
    if (url.includes("temporary-kopken-outlet-ids")) return response({ "KK.CBN.RKTLN": 4061 });
    if (failLive) throw new Error("API unavailable");
    return response(live);
  },
};
vm.runInNewContext(`${source}\nglobalThis.testApi = { loadKopkenMenuWithFallback, buildDynamicKopiKenanganItems, buildDynamicKopiKenanganBundles };`, context);

(async () => {
  const result = await context.testApi.loadKopkenMenuWithFallback("KK.CBN.RKTLN");
  assert.equal(result.source, "temporary-api");
  const items = context.testApi.buildDynamicKopiKenanganItems(result.payload, new Map());
  assert.equal(items.length, 2, "Exclude third-party promotional bundles");
  assert.equal(items[0].id, "9341610000", "Keep synced product identity");
  assert.equal(items[0].oldPrice, 20000, "Use official price, not third-party selling price");
  assert.equal(items[0].syncPending, false);
  assert.equal(items[1].syncPending, true);
  assert.equal(context.testApi.buildDynamicKopiKenanganBundles(items).length, 0);

  failLive = true;
  const fallback = await context.testApi.loadKopkenMenuWithFallback("KK.CBN.RKTLN");
  assert.equal(fallback.source, "supabase");
  assert.equal(fallback.payload.data.menu_groups[0].menu_products[0].name, "Wahyu Sapi Toast");
  console.log("Temporary Kopken menu and Supabase fallback passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

const source = readFileSync(join(__dirname, "..", "assets", "js", "api.js"), "utf8");
const original = ["Matcha Latte", "Caffe Latte", "Caramel Macchiato", "Chocolate"]
  .map((name, index) => ({ id: `tomoro-${index}`, brand: "tomoro", name, price: 18000, oldPrice: 24000, options: [{ key: "cupSize", options: [{ value: "Small" }] }] }));
const live = { success: true, categories: [{ category: "Promo Satuan Small", products: [
  { id: "1", name: "Matcha Latte", originalPrice: 27000, price: 18500, image: "https://example.com/matcha.jpg" },
  { id: "2", name: "Caffe Latte", originalPrice: 26000, price: 17000, isSoldOut: true },
  { id: "3", name: "Caramel Macchiato", originalPrice: 28000, price: 19000 },
  { id: "4", name: "Sea Salt Cloud Caramel Macchiato", originalPrice: 30000, price: 20000 },
  { id: "5", name: "Pristine", originalPrice: 7000, price: 5000 },
  { id: "combo", name: "B1G1 Matcha Latte (2 Cup)", originalPrice: 54000, isCombo: true },
] }] };
let fail = false;
let fallbackSearches = 0;
const results = { children: [], appendChild(child) { this.children.push(child); }, set innerHTML(value) { this.children = []; } };
const hint = { textContent: "" };
const context = {
  window: { addEventListener() {}, brandOutletStates: { tomoro: {}, fore: {} } },
  document: {
    addEventListener() {},
    getElementById(id) { return ({ manualBrandOutletResults: results, manualBrandOutletHint: hint })[id] || null; },
    createElement(tag) { return { tag, children: [], appendChild(child) { this.children.push(child); }, addEventListener() {} }; },
  },
  localStorage: { setItem() {} },
  menuItems: [...original],
  activeBrandId: "tomoro",
  renderMenu() {},
  AbortSignal,
  console: { error() {}, warn() {} },
  fetch: async (url) => {
    if (String(url).includes("/tomoro/menu")) {
      if (fail) throw new Error("API unavailable");
      return { ok: true, json: async () => live };
    }
    if (String(url).includes("/tomoro/outlets")) {
      if (fail) throw new Error("API unavailable");
      return { ok: true, json: async () => ({ success: true, outlets: [
        { code: "CLOSED", name: "Closed outlet", isOpen: false },
        { code: "OPEN", name: "Open outlet", isOpen: true },
      ] }) };
    }
    fallbackSearches++;
    return { ok: true, json: async () => ({ outlets: [{ storeCode: "BACKUP", storeName: "Backup outlet" }] }) };
  },
};
vm.runInNewContext(`${source}\nglobalThis.testApi = { buildBintangTomoroMenu, loadLiveBrandMenu };`, context);

(async () => {
  await context.testApi.loadLiveBrandMenu("tomoro", "PKB08A");
  assert.equal(context.window.brandOutletStates.tomoro.source, "live");
  assert.equal(context.menuItems.length, 4, "Only supported drinks appear; skip water and synthetic combos");
  assert.equal(context.menuItems[0].price, 18000, "Keep synced selling price");
  assert.equal(context.menuItems[0].oldPrice, 24000, "Keep synced official price");
  assert.equal(context.menuItems[0].options[0].key, "cupSize", "Keep synced customization options");
  assert.equal(context.menuItems[1].isSoldOut, true);
  assert.equal(context.menuItems[3].syncPending, true, "Unknown customization stays preview-only");
  await context.window.searchLiveBrandOutlets("tomoro", "Gobah");
  assert.equal(results.children[0].disabled, false, "Open outlet sorted first");
  assert.equal(results.children[1].disabled, true, "Closed outlet cannot be selected");
  assert.equal(fallbackSearches, 0);
  fail = true;
  await context.testApi.loadLiveBrandMenu("tomoro", "PKB08A");
  assert.equal(context.window.brandOutletStates.tomoro.source, "fallback");
  assert.equal(context.menuItems.length, original.length, "Restore local menu on failure");
  await context.window.searchLiveBrandOutlets("tomoro", "Gobah");
  assert.equal(fallbackSearches, 1, "Outlet search falls back to own catalog");
  assert.equal(results.children[0].disabled, false);
  console.log("Temporary Tomoro menu, outlet status, and fallback passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });

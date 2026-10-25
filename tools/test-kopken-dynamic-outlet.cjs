const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

const source = readFileSync(join(__dirname, "..", "assets", "js", "api.js"), "utf8");
const context = {
  window: { addEventListener() {}, kopiKenanganOutletState: {} },
  document: { addEventListener() {} },
  console,
};
vm.runInNewContext(`${source}\nglobalThis.buildItemsForTest = buildDynamicKopiKenanganItems;`, context);

const localMenu = new Map([["wahyu sapi toast", {
  name: "Wahyu Sapi Toast",
  kind: "toast",
  outletCodes: ["KWG.RKJNDCKMPK"],
  price: 12500,
  oldPrice: 19000,
}]]);
const payload = { data: { menu_groups: [{
  group_name: "Kenangan Toast",
  menu_products: [{
    name: "Wahyu Sapi Toast",
    brand: "Kopi Kenangan",
    product_code: "9341610000",
    type_code: 4005,
    is_sold_out: false,
    orig_price: 19000,
  }],
}] } };

const [item] = context.buildItemsForTest(payload, localMenu);
assert.ok(item, "Product from the selected outlet should be available");
assert.equal(item.id, "9341610000");
assert.equal(item.kind, "toast");
assert.equal(item.outletCodes.length, 0, "Local-only outlet restrictions must not hide live products");
console.log("Dynamic outlet menu does not inherit local outlet restrictions.");

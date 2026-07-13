// Ganti baris paling atas api.js Anda menjadi seperti ini:
const NUFS_API_BASE = "https://www.nufsfood.shop/api";
const CF_API_BASE = "https://api-kopken.novelveno65.workers.dev"; // URL Cloudflare Anda
const SELECTED_OUTLET_STORAGE_KEY = "kopiFachrindahSelectedOutlet";
let outletSearchTimer = null;
let originalKopiKenanganMenu = null;

const KOPI_KENANGAN_ALLOWED_API_BRANDS = new Set([
  "kopi-kenangan",
  "cerita-roti",
  "kenangan-manis",
]);

const KOPI_KENANGAN_EXCLUDED_API_GROUPS = new Set([
  "promo-api",
  "manual-brew",
  "kenangan-at-home",
  "special-merchandise",
]);

const KOPI_KENANGAN_EXCLUDED_NAME_PATTERNS = [
  /\bseliter\b/i,
  /\bliteran\b/i,
];

const API_GROUP_ALIASES = {
  "baru": "baru",
  "coffee": "coffee",
  "kopi": "coffee",
  "non-coffee": "non-coffee",
  "non-kopi": "non-coffee",
  "oatside": "oatside-series",
  "oatside-series": "oatside-series",
  "kenangan-frappe": "kenangan-frappe",
  "chef-martin-prajas-signature-bake": "chef-martin",
  "chef-martin-praja-s-signature-bake": "chef-martin",
  "kenangan-toast": "kenangan-toast",
  "food": "food",
  "promo-and-combo": "promo-api",
  "promo-combo": "promo-api",
};

window.kopiKenanganOutletState = window.kopiKenanganOutletState || {
  selected: false,
  menuLoaded: false,
  menuLoading: false,
  outletCode: "",
  outletName: "",
};

function setKopiKenanganOutletState(patch) {
  window.kopiKenanganOutletState = {
    ...window.kopiKenanganOutletState,
    ...patch,
  };
}

function getOutletWifiPassword(outlet) {
  return outlet?.wifiPassword || outlet?.wifi_password || outlet?.wifi || outlet?.password || "";
}

function getOutletDisplayName(outlet) {
  return outlet?.name || outlet?.outletName || outlet?.title || "";
}

function getOutletCode(outlet) {
  return outlet?.code || outlet?.outletCode || outlet?.id || "";
}

function normalizeMenuName(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeApiText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return undefined;
}

function normalizeApiMenuGroup(category) {
  const normalized = normalizeApiText(category || "lainnya");
  return API_GROUP_ALIASES[normalized] || normalized;
}

function isApiComboProduct(item) {
  return Number(item?.type_code) === 4004 || Number(item?.product_type_id) === 0 || item?.is_combo_v2 === true;
}

function isApiProductExpired(item, now = Date.now()) {
  const endTimestamp = Number(item?.available_end_timestamp);
  return Number.isFinite(endTimestamp) && endTimestamp > 0 && endTimestamp < now;
}

function isSupportedKopiKenanganApiProduct(item) {
  const itemGroup = normalizeApiMenuGroup(item?._category_name || item?.category || item?.group_name);
  const itemBrand = normalizeApiText(item?.brand || "Kopi Kenangan");
  const itemName = getApiProductName(item);

  if (!KOPI_KENANGAN_ALLOWED_API_BRANDS.has(itemBrand)) return false;
  if (KOPI_KENANGAN_EXCLUDED_API_GROUPS.has(itemGroup)) return false;
  if (KOPI_KENANGAN_EXCLUDED_NAME_PATTERNS.some((pattern) => pattern.test(itemName))) return false;
  if (item?.is_restriction_customer === true) return false;
  if (item?.delivery_restriction) return false;
  if (isApiProductExpired(item)) return false;

  return !isApiComboProduct(item);
}

function getApiMenuGroups(rawResponse) {
  if (rawResponse?.data && Array.isArray(rawResponse.data.menu_groups)) {
    return rawResponse.data.menu_groups;
  }

  if (Array.isArray(rawResponse?.menu)) {
    return [{ group_name: "", menu_products: rawResponse.menu }];
  }

  return [];
}

function getApiProductPrice(item, localItem) {
  const jasdorPrice = firstNumber(item.jasdorPrice, item.jasdor_price);
  if (jasdorPrice) return jasdorPrice;

  const apiPrice = firstNumber(item.price, item.salePrice, item.sale_price, item.orig_price, item.origPrice);
  if (!apiPrice) return localItem.price || 0;

  const adjustedPrice = Math.round(apiPrice / 2) + 3000;
  const manualAdjustment = PRICE_ADJUSTMENTS[normalizeApiText(item.name)] || 0;
  return adjustedPrice + manualAdjustment;
}

function getApiProductOldPrice(item, localItem) {
  return firstNumber(item.orig_price, item.origPrice, item.oldPrice, item.price, item.salePrice, item.sale_price) || localItem.oldPrice;
}

function isLocalPromoMenuItem(item) {
  const groups = Array.isArray(item?.group) ? item.group : [item?.group].filter(Boolean);
  return groups.some((group) => normalizeApiText(group).includes("promo")) || Boolean(item?.bundleImages?.length);
}

function shouldKeepLocalKopiKenanganItem(item) {
  return isLocalPromoMenuItem(item);
}

function mergeMenuGroups(...groups) {
  const merged = [];
  groups.flat().filter(Boolean).forEach((group) => {
    if (!merged.includes(group)) merged.push(group);
  });
  return merged.length === 1 ? merged[0] : merged;
}

function getApiProductId(item) {
  return String(item.product_code || item.code || item.product_id || item.id || item.name || "");
}

function getApiProductName(item) {
  return String(item.name || "").trim() || "Menu Tanpa Nama";
}

function toKopiKenanganMenuItem(item, localMenuByName) {
  const itemName = getApiProductName(item);
  const localItem = localMenuByName.get(normalizeMenuName(itemName)) || {};
  const apiGroup = normalizeApiMenuGroup(item._category_name || item.category || item.group_name);
  const finalGroup = apiGroup || localItem.group || "food";
  const isSoldOut = item.is_sold_out === true || item.isSoldOut === true || localItem.isSoldOut === true;
  const image = item.image || item.img || localItem.image || null;

  return {
    ...localItem,
    id: getApiProductId(item),
    brand: "kopi-kenangan",
    group: finalGroup,
    name: itemName,
    desc: item.description || localItem.desc,
    price: getApiProductPrice(item, localItem),
    oldPrice: getApiProductOldPrice(item, localItem),
    image,
    isNew: localItem.isNew === true || finalGroup === "baru" || item.isNew === true,
    isSoldOut,
  };
}

function mergeDuplicateMenuItems(items) {
  const uniqueMap = new Map();

  items.forEach((item) => {
    if (!item?.name) return;

    const key = `${item.brand || ""}|${normalizeMenuName(item.name)}`;
    const existing = uniqueMap.get(key);

    if (!existing) {
      uniqueMap.set(key, item);
      return;
    }

    uniqueMap.set(key, {
      ...existing,
      ...item,
      group: mergeMenuGroups(existing.group, item.group),
      isNew: existing.isNew === true || item.isNew === true,
      isBestSeller: existing.isBestSeller === true || item.isBestSeller === true,
      isSoldOut: existing.isSoldOut === true && item.isSoldOut === true,
      image: existing.image || item.image,
      desc: existing.desc || item.desc,
    });
  });

  return Array.from(uniqueMap.values());
}

function buildDynamicKopiKenanganItems(rawResponse, localMenuByName) {
  return getApiMenuGroups(rawResponse)
    .flatMap((group) => {
      const products = Array.isArray(group.menu_products) ? group.menu_products : [];
      return products.map((product) => ({
        ...product,
        _category_name: group.group_name,
      }));
    })
    .filter(isSupportedKopiKenanganApiProduct)
    .map((item) => toKopiKenanganMenuItem(item, localMenuByName));
}

function updateOutletUi(outlet = null) {
  const name = outlet ? getOutletDisplayName(outlet) : "";
  const code = outlet ? getOutletCode(outlet) : "";
  const previousState = window.kopiKenanganOutletState || {};
  const selectedOutletName = document.getElementById("selectedOutletName");
  const outletSearch = document.getElementById("outletSearch");
  const outletHint = document.getElementById("outletSearchHint");
  const modalAddress = document.getElementById("modalCustomerAddress");
  const pageAddress = document.getElementById("customerAddress");

  setKopiKenanganOutletState({
    selected: Boolean(name),
    menuLoaded: Boolean(name) && previousState.outletCode === code ? Boolean(previousState.menuLoaded) : false,
    menuLoading: false,
    outletCode: code,
    outletName: name,
  });

  if (selectedOutletName) selectedOutletName.textContent = name || "Belum dipilih";
  if (outletSearch && name) outletSearch.value = name;
  if (outletHint) {
    outletHint.textContent = name
      ? `Outlet aktif: ${name}`
      : "Ketik minimal 3 huruf untuk mencari gerai Kopi Kenangan.";
  }
  if (typeof window.renderWifiPassword === "function") window.renderWifiPassword();
  if (modalAddress && name) modalAddress.value = name;
  if (pageAddress && name) pageAddress.value = name;
}

function saveSelectedOutlet(outlet) {
  localStorage.setItem(SELECTED_OUTLET_STORAGE_KEY, JSON.stringify(outlet));
  updateOutletUi(outlet);
}

function loadSelectedOutlet() {
  const raw = localStorage.getItem(SELECTED_OUTLET_STORAGE_KEY);
  if (!raw) {
    updateOutletUi(null);
    return;
  }

  try {
    const savedOutlet = JSON.parse(raw);
    updateOutletUi(savedOutlet);
    const outletCode = getOutletCode(savedOutlet);
    if (outletCode) window.loadDynamicMenu(outletCode);
  } catch (error) {
    localStorage.removeItem(SELECTED_OUTLET_STORAGE_KEY);
    updateOutletUi(null);
  }
}

function cacheOriginalKopiKenanganMenu() {
  if (originalKopiKenanganMenu || typeof menuItems === "undefined") return;
  originalKopiKenanganMenu = menuItems
    .filter((item) => item.brand === "kopi-kenangan")
    .map((item) => ({ ...item }));
}

function restoreLocalKopiKenanganMenu() {
  if (!originalKopiKenanganMenu || typeof menuItems === "undefined") return;
  const remainingItems = menuItems.filter((item) => item.brand !== "kopi-kenangan");
  menuItems.length = 0;
  menuItems.push(...remainingItems, ...originalKopiKenanganMenu.map((item) => ({ ...item })));
  if (typeof renderMenu === "function") renderMenu();
}

function clearSelectedOutletState() {
  localStorage.removeItem(SELECTED_OUTLET_STORAGE_KEY);
  updateOutletUi(null);
  restoreLocalKopiKenanganMenu();
}

function clearOutletResults() {
  const outletResults = document.getElementById("outletResults");
  if (!outletResults) return;
  outletResults.innerHTML = "";
  outletResults.hidden = true;
}

function renderOutletResults(outlets) {
  const outletResults = document.getElementById("outletResults");
  if (!outletResults) return;

  outletResults.innerHTML = "";
  outletResults.hidden = false;

  if (!outlets.length) {
    outletResults.innerHTML = '<p class="outlet-empty">Outlet tidak ditemukan.</p>';
    return;
  }

  outlets.forEach((outlet) => {
    const name = getOutletDisplayName(outlet);
    const code = getOutletCode(outlet);
    const address = outlet.address || outlet.city || outlet.area || "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "outlet-result";
    const nameElement = document.createElement("strong");
    nameElement.textContent = name;
    button.appendChild(nameElement);
    if (address) {
      const addressElement = document.createElement("span");
      addressElement.textContent = address;
      button.appendChild(addressElement);
    }
    button.addEventListener("click", () => {
      const selectedOutlet = { ...outlet, name, code };
      saveSelectedOutlet(selectedOutlet);
      clearOutletResults();
      if (code) window.loadDynamicMenu(code);
    });
    outletResults.appendChild(button);
  });
}

const PRICE_ADJUSTMENTS = {
  "tiramisu-latte": 500,
  "toffee-nut-latte": 500,
  "pistachio-aren-latte": 500,
  "choco-caramel": 500,
  "babyccino": 500,
  "danish-tiramisu": 500,
  "salt-bread-original": 500,
  "chocolate-croissant": 500,
  "roti-keju-manis": 500,
  "og-aren-speculoos-latte": 1000,
  "dua-shot-og-aren": 1000,
  "mocha-caramel": 1000,
  "cafe-malt-latte": 1000,
  "tiramisu-mocha-latte": 1000,
  "toffee-nut-aren-latte": 1000,
  "toffee-nut-oat-latte": 1000,
  "butterscotch-aren-latte": 1000,
  "og-aren-milky-speculoos": 1000,
  "toffee-nut-choco-macchiato": 1000,
  "butterscotch-sea-salt-macchiato": 1000,
  "milk-oreo-crumble": 1000,
  "kenangan-milk-tea": 1000,
  "milo-dinosaurus": 1000,
  "oreo-shake": 1000,
  "raspberry-hibiscus": 1000,
  "susu-grass-jelly": 1000,
  "hazelnut-choco-milk-tea": 1000,
  "avocado-caramel": 1000,
  "avocado-milk": 1000,
  "caramel-dutch-choco": 1000,
  "dutch-chocolate": 1000,
  "hazelnut-dutch-choco": 1000,
  "tiramisu-frappe": 1000,
  "matcha-kenangan-frappe": 1000,
  "roti-gulung-abon": 1000,
  "matcha-latte": 2000,
  "butterscotch-kenangan-frappe": 2000,
  "kopi-kenangan-mantan-frappe": 2000,
  "vanilla-kenangan-frappe": 2000,
  "dutch-choco-kenangan-frappe": 2000,
  "bambang-choco-cheese": 2000,
  "choco-chip-cookies": 2000,
  "join-the-dark-side-cookie": 2000,
  "friend-chip-cookie": 2000
  // Tambahkan nama menu lainnya di sinii
};

window.loadDynamicMenu = async function(outletCode = "JKT.RKMRYSN") {
  const container = document.getElementById("catalogContainer");
  if (!container) return;

  setKopiKenanganOutletState({
    selected: true,
    menuLoaded: false,
    menuLoading: true,
    outletCode,
  });

  container.innerHTML = '<p class="no-results">Sedang memuat menu outlet...</p>';

  try {
    const response = await fetch(`${CF_API_BASE}?outletCode=${encodeURIComponent(outletCode)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rawResponse = await response.json();

    cacheOriginalKopiKenanganMenu();
    const localMenuByName = new Map(
      (originalKopiKenanganMenu || []).map((item) => [normalizeMenuName(item.name), item])
    );

    const dynamicItems = buildDynamicKopiKenanganItems(rawResponse, localMenuByName);
    const nonKopiKenanganItems = menuItems.filter((item) => item && item.brand !== "kopi-kenangan");
    const localItemsToKeep = (originalKopiKenanganMenu || [])
      .filter((item) => shouldKeepLocalKopiKenanganItem(item, dynamicItems))
      .map((item) => ({ ...item }));

    menuItems.length = 0;
    menuItems.push(...mergeDuplicateMenuItems([
      ...nonKopiKenanganItems,
      ...localItemsToKeep,
      ...dynamicItems,
    ]));

    setKopiKenanganOutletState({ menuLoaded: true, menuLoading: false, outletCode });
    if (typeof renderMenu === "function") renderMenu();

  } catch (error) {
    console.error("Gagal memuat API Asli:", error);
    setKopiKenanganOutletState({ menuLoaded: false, menuLoading: false, outletCode });
    container.innerHTML = '<p class="no-results">Gagal memuat menu API. Coba outlet lain.</p>';
    restoreLocalKopiKenanganMenu();
  }
};

window.handleKopiKenanganData = function(data) {
  cacheOriginalKopiKenanganMenu();
  const localMenuByName = new Map((originalKopiKenanganMenu || []).map(i => [normalizeMenuName(i.name), i]));
  const dynamicItems = buildDynamicKopiKenanganItems(data, localMenuByName);
  const nonKopiKenanganItems = menuItems.filter(i => i.brand !== "kopi-kenangan");
  const localItemsToKeep = (originalKopiKenanganMenu || [])
    .filter((item) => shouldKeepLocalKopiKenanganItem(item, dynamicItems))
    .map((item) => ({ ...item }));

  menuItems.length = 0;
  menuItems.push(...mergeDuplicateMenuItems([
    ...nonKopiKenanganItems,
    ...localItemsToKeep,
    ...dynamicItems,
  ]));

  if (typeof renderMenu === "function") renderMenu();
};

window.searchOutlets = async function(keyword) {
  const outletHint = document.getElementById("outletSearchHint");
  try {
    if (outletHint) outletHint.textContent = "Mencari outlet...";

    // Pastikan ini tetap menggunakan NUFS_API_BASE agar pencarian outlet lancar
    const response = await fetch(`${NUFS_API_BASE}/outlets?keyword=${encodeURIComponent(keyword)}&page=1`);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const outlets = Array.isArray(data.outlets) ? data.outlets : [];
    renderOutletResults(outlets);
    if (outletHint) outletHint.textContent = `${outlets.length} outlet ditemukan.`;
  } catch (error) {
    clearOutletResults();
    if (outletHint) outletHint.textContent = "Gagal mencari outlet.";
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const outletSearch = document.getElementById("outletSearch");
  const outletClear = document.getElementById("outletClear");

  loadSelectedOutlet();

  if (outletSearch) {
    outletSearch.addEventListener("input", (event) => {
      const keyword = event.target.value.trim();
      window.clearTimeout(outletSearchTimer);
      if (keyword.length < 3) {
        clearOutletResults();
        clearSelectedOutletState();
        return;
      }
      if (localStorage.getItem(SELECTED_OUTLET_STORAGE_KEY)) {
        clearSelectedOutletState();
      }
      outletSearchTimer = window.setTimeout(() => window.searchOutlets(keyword), 280);
    });
  }

  if (outletClear) {
    outletClear.addEventListener("click", () => {
      if (outletSearch) outletSearch.value = "";
      clearOutletResults();
      clearSelectedOutletState();
    });
  }
});

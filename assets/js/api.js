// Tambahkan ini di bagian awal script Anda
window.addEventListener('load', function() {
    const lastVersion = localStorage.getItem('app_version');
    const currentVersion = '20260715'; // Samakan dengan versi file di atas

    if (lastVersion !== currentVersion) {
        localStorage.clear(); // Hapus sesi lama yang rusak
        localStorage.setItem('app_version', currentVersion);
        window.location.reload(); // Refresh paksa untuk pelanggan
    }
});

// Ganti baris paling atas api.js Anda menjadi seperti ini:
const NUFS_API_BASE = "https://www.nufsfood.shop/api";
const CF_API_BASE = "https://api-kopken.novelveno65.workers.dev"; // URL Cloudflare Anda
const SELECTED_OUTLET_STORAGE_KEY = "kopiFachrindahSelectedOutlet";
const BRAND_CATALOG_API = "https://bpkpydfvevlktyeapunf.supabase.co/functions/v1/brand-catalog";
const LIVE_BRAND_OUTLETS_KEY = "kopiFachrindahLiveBrandOutlets";
let outletSearchTimer = null;
let liveBrandOutletSearchTimer = null;
let originalKopiKenanganMenu = null;
let originalLiveBrandMenus = null;

async function loadSupabaseKopkenMenu(outletCode) {
  const config = window.KOPI_SUPABASE_CONFIG || {};
  if (!config.url || !config.anonKey) throw new Error("Konfigurasi Supabase belum tersedia");

  const endpoint = `${config.url}/rest/v1/kopken_outlets_catalog?select=outlet_code,outlet_name,category,menu,updated_at&outlet_code=eq.${encodeURIComponent(outletCode)}&limit=1`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);

  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  const hasCompactMenu = Array.isArray(row?.menu) && row.menu.length > 0;
  const hasFullMenu = Array.isArray(row?.menu?.data?.menu_groups)
    && row.menu.data.menu_groups.length > 0;
  if (!row || (!hasCompactMenu && !hasFullMenu)) {
    throw new Error("Menu outlet belum tersimpan di Supabase");
  }

  return {
    category: String(row.category || ""),
    updatedAt: row.updated_at || "",
    payload: hasFullMenu
      ? row.menu
      : {
          mergeLocalMenu: true,
          menu: row.menu.map((item, index) => ({
            ...item,
            id: item.id || item.product_code || `${outletCode}-${index}`,
            name: item.name || item.product_name || "",
            image: item.image || item.image_url || null,
            category: item.category || item.group_name || "",
          })),
        },
  };
}

window.brandOutletStates = window.brandOutletStates || {
  tomoro: { outletCode: "", outletName: "", outletAddress: "", menuLoading: false, menuLoaded: false, source: "" },
  fore: { outletCode: "", outletName: "", outletAddress: "", menuLoading: false, menuLoaded: false, source: "" },
};

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
  /\btiramisu\b/i,
  /\btoffee\b/i,
];

const KOPI_KENANGAN_API_MENU_OVERRIDES = {
  "oatside-kopi-kenangan-mantan": {
    largePrice: 20000,
    oldLargePrice: 28000,
    allowBeans: true,
    allowOatside: false,
  },
  "butterscotch-kenangan-frappe": { frappeWhippedCreamOnly: true },
  "matcha-kenangan-frappe": { frappeWhippedCreamOnly: true },
  "kopi-kenangan-mantan-frappe": { frappeWhippedCreamOnly: true },
  "vanilla-kenangan-frappe": { frappeWhippedCreamOnly: true },
  "dutch-choco-kenangan-frappe": {
    frappeWhippedCreamOnly: true,
    defaultWhippedCream: "Whipped Cream Chocolate",
  },
  "creamy-caramel-latte": {
    largePrice: 24000,
    allowBeans: true,
    noSugar: true,
    noTopping: true,
    noAddon: true,
  },
  "korean-banana-latte": {
    largePrice: 21500,
    allowBeans: true,
    noSugar: true,
  },
  "banana-americano": {
    largePrice: 19500,
    allowBeans: true,
    noSugar: true,
  },
  "banana-choco": {
    largePrice: 22000,
    allowOatside: true,
    noSugar: true,
  },
};

const KOPI_KENANGAN_BUNDLE_TARGETS = [50000, 70000];
const KOPI_KENANGAN_BUNDLE_DISCOUNT = 2000;
const KOPI_KENANGAN_FOOD_GROUPS = new Set([
  "food",
  "chef-martin",
  "kenangan-toast",
  "cerita-roti",
  "bakery",
  "snack",
]);

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
  outletCategory: "",
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

  if (item?.is_sold_out === true || item?.isSoldOut === true || item?.soldOut === true) return false;
  if (!itemName || /^\d+$/.test(itemName) || itemName === "Menu Tanpa Nama") return false;
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

  const outletCategory = String(window.kopiKenanganOutletState?.outletCategory || "").trim().toLowerCase();
  const promoMarkup = outletCategory === "airport" ? 7000 : 3000;
  const adjustedPrice = Math.round(apiPrice / 2) + promoMarkup;
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
  return false;
}

function isDynamicBundleFood(item) {
  const groups = Array.isArray(item?.group) ? item.group : [item?.group].filter(Boolean);
  const kind = normalizeApiText(item?.kind);
  return ["food", "toast", "cookie"].includes(kind)
    || groups.some((group) => KOPI_KENANGAN_FOOD_GROUPS.has(normalizeApiText(group)));
}

function getDynamicBundleDrinkDetails(index) {
  return [
    {
      key: `suhuMinuman${index}`,
      label: `Suhu Minuman ${index}`,
      options: [
        { value: "Ice", label: "Ice" },
        { value: "Hot", label: "Hot" },
      ],
    },
    {
      key: `esMinuman${index}`,
      label: `Es Minuman ${index}`,
      dependsOn: { key: `suhuMinuman${index}`, value: "Ice" },
      hiddenValue: "No Ice",
      options: [
        { value: "Normal Ice", label: "Normal Ice" },
        { value: "Less Ice", label: "Less Ice" },
        { value: "No Ice", label: "No Ice" },
      ],
    },
    {
      key: `gulaMinuman${index}`,
      label: `Gula Minuman ${index}`,
      options: [
        { value: "Normal Sugar", label: "Normal Sugar" },
        { value: "Less Sugar", label: "Less Sugar" },
        { value: "No Sugar", label: "No Sugar" },
      ],
    },
  ];
}

function buildDynamicBundleItem(drinks, foods, drinkCount, bundleMinimum) {
  let defaultCombination = null;
  const eligibleDrinkIds = new Set();
  const eligibleFoodIds = new Set();

  const considerCombination = (selectedDrinks, food) => {
    const officialTotal = selectedDrinks.reduce((total, drink) => total + drink.oldPrice, food.oldPrice);
    if (officialTotal !== bundleMinimum) return;

    const sellingTotal = selectedDrinks.reduce((total, drink) => total + drink.price, food.price)
      - KOPI_KENANGAN_BUNDLE_DISCOUNT;
    selectedDrinks.forEach((drink) => eligibleDrinkIds.add(drink.id));
    eligibleFoodIds.add(food.id);

    if (!defaultCombination || sellingTotal < defaultCombination.sellingTotal) {
      defaultCombination = { drinks: selectedDrinks, food, officialTotal, sellingTotal };
    }
  };

  drinks.forEach((drinkOne) => {
    if (drinkCount === 1) {
      foods.forEach((food) => considerCombination([drinkOne], food));
      return;
    }
    drinks.forEach((drinkTwo) => {
      foods.forEach((food) => considerCombination([drinkOne, drinkTwo], food));
    });
  });

  if (!defaultCombination) return null;

  const toBundleOption = (item) => ({
    value: item.name,
    label: item.name,
    priceDelta: item.price,
    officialPrice: item.oldPrice,
    menuId: item.id,
  });
  const orderWithDefault = (itemsToOrder, defaultItem, eligibleIds) => [
    defaultItem,
    ...itemsToOrder.filter((item) => item.id !== defaultItem.id && eligibleIds.has(item.id)),
  ];
  const options = [];

  defaultCombination.drinks.forEach((defaultDrink, index) => {
    const optionIndex = index + 1;
    options.push({
      key: `minuman${optionIndex}`,
      label: `Pilih Minuman ${optionIndex}`,
      options: orderWithDefault(drinks, defaultDrink, eligibleDrinkIds).map(toBundleOption),
    });
    options.push(...getDynamicBundleDrinkDetails(optionIndex));
  });
  options.push({
    key: "makanan",
    label: "Pilih Makanan",
    options: orderWithDefault(foods, defaultCombination.food, eligibleFoodIds).map(toBundleOption),
  });

  const bundlePriceLabel = `${bundleMinimum / 1000}K`;
  const bundleLabel = drinkCount === 1 ? "1 Minuman + 1 Makanan" : "2 Minuman + 1 Makanan";
  return {
    id: `dynamic-outlet-bundle-${bundlePriceLabel.toLowerCase()}-${drinkCount}-drink`,
    brand: "kopi-kenangan",
    group: `promo-${bundlePriceLabel.toLowerCase()}`,
    name: `Bundle ${bundlePriceLabel} - ${bundleLabel}`,
    desc: `${bundleLabel}, bebas tukar dengan total harga outlet tepat Rp${bundleMinimum.toLocaleString("id-ID")}. Diskon bundle Rp2.000.`,
    price: defaultCombination.sellingTotal,
    oldPrice: defaultCombination.officialTotal,
    image: defaultCombination.drinks[0].image || defaultCombination.food.image || null,
    bundleImageUrls: [...defaultCombination.drinks, defaultCombination.food]
      .map((item) => item.image)
      .filter(Boolean),
    dynamicOutletBundle: true,
    bundleMinimum,
    bundleDiscount: KOPI_KENANGAN_BUNDLE_DISCOUNT,
    options,
  };
}

function buildDynamicKopiKenanganBundles(items) {
  const availableItems = items.filter((item) => !item.isSoldOut && item.price > 0 && item.oldPrice > 0);
  const drinks = availableItems.filter((item) => !isDynamicBundleFood(item));
  const foods = availableItems.filter(isDynamicBundleFood);
  return KOPI_KENANGAN_BUNDLE_TARGETS.flatMap((bundleMinimum) => [
    buildDynamicBundleItem(drinks, foods, 1, bundleMinimum),
    buildDynamicBundleItem(drinks, foods, 2, bundleMinimum),
  ]).filter(Boolean);
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
  const overrideItem = KOPI_KENANGAN_API_MENU_OVERRIDES[normalizeApiText(itemName)] || {};
  const apiGroup = normalizeApiMenuGroup(item._category_name || item.category || item.group_name);
  const finalGroup = apiGroup || localItem.group || "food";
  const isSoldOut = item.is_sold_out === true || item.isSoldOut === true || localItem.isSoldOut === true;
  const image = item.image || item.img || localItem.image || null;

  return {
    ...localItem,
    ...overrideItem,
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

    const key = `${item.brand || ""}|${normalizeApiText(item.name)}`;
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
    outletCategory: String(outlet?.category || ""),
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
  if (typeof window.syncCheckoutOutletField === "function") window.syncCheckoutOutletField();
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
    if (savedOutlet?.manual) {
      localStorage.removeItem(SELECTED_OUTLET_STORAGE_KEY);
      updateOutletUi(null);
      return;
    }
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

function renderOutletNotFound() {
  const outletResults = document.getElementById("outletResults");
  if (!outletResults) return;
  outletResults.innerHTML = '<p class="outlet-empty">Outlet Kopi Kenangan tidak ditemukan.</p>';
  outletResults.hidden = false;
}

function renderOutletResults(outlets, keyword = "") {
  const outletResults = document.getElementById("outletResults");
  if (!outletResults) return;

  outletResults.innerHTML = "";
  outletResults.hidden = false;

  if (!outlets.length) {
    renderOutletNotFound();
    return;
  }

  [...outlets]
    .sort((first, second) => Number(first?.isOpen === false) - Number(second?.isOpen === false))
    .forEach((outlet) => {
      const name = getOutletDisplayName(outlet);
      const code = getOutletCode(outlet);
      const address = outlet.address || outlet.city || outlet.area || "";
      const isClosed = outlet.isOpen === false;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `outlet-result${isClosed ? " outlet-result-closed" : ""}`;
      button.disabled = isClosed;
      const nameElement = document.createElement("strong");
      nameElement.textContent = name;
      button.appendChild(nameElement);
      if (address) {
        const addressElement = document.createElement("span");
        addressElement.textContent = address;
        button.appendChild(addressElement);
      }
      if (isClosed) {
        const statusElement = document.createElement("span");
        statusElement.className = "outlet-closed-status";
        statusElement.textContent = outlet.openStatus || "Outlet sedang tutup";
        button.appendChild(statusElement);
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
    let rawResponse;
    const menuSource = "supabase";
    let outletCategory = getKopiKenanganOutletState?.().outletCategory || "";
    const cachedOutlet = await loadSupabaseKopkenMenu(outletCode);
    rawResponse = cachedOutlet.payload;
    outletCategory = cachedOutlet.category || outletCategory;

    cacheOriginalKopiKenanganMenu();
    const localMenuByName = new Map(
      (originalKopiKenanganMenu || []).map((item) => [normalizeMenuName(item.name), item])
    );

    const dynamicItems = buildDynamicKopiKenanganItems(rawResponse, localMenuByName);
    if (!dynamicItems.length) throw new Error("Menu outlet kosong");
    const dynamicBundles = buildDynamicKopiKenanganBundles(dynamicItems);
    const nonKopiKenanganItems = menuItems.filter((item) => item && item.brand !== "kopi-kenangan");
    const localItemsToKeep = rawResponse?.mergeLocalMenu
      ? (originalKopiKenanganMenu || []).map((item) => ({ ...item }))
      : (originalKopiKenanganMenu || [])
          .filter((item) => shouldKeepLocalKopiKenanganItem(item, dynamicItems))
          .map((item) => ({ ...item }));

    menuItems.length = 0;
    menuItems.push(...mergeDuplicateMenuItems([
      ...nonKopiKenanganItems,
      ...localItemsToKeep,
      ...dynamicItems,
      ...dynamicBundles,
    ]));

    setKopiKenanganOutletState({
      menuLoaded: true,
      menuLoading: false,
      outletCode,
      outletCategory,
      source: menuSource,
    });
    if (typeof renderMenu === "function") renderMenu();

  } catch (error) {
    console.error("Gagal memuat API Asli:", error);
    restoreLocalKopiKenanganMenu();
    setKopiKenanganOutletState({ menuLoaded: true, menuLoading: false, outletCode, source: "fallback" });
    if (typeof renderMenu === "function") renderMenu();
  }
};

window.handleKopiKenanganData = function(data) {
  cacheOriginalKopiKenanganMenu();
  const localMenuByName = new Map((originalKopiKenanganMenu || []).map(i => [normalizeMenuName(i.name), i]));
  const dynamicItems = buildDynamicKopiKenanganItems(data, localMenuByName);
  const dynamicBundles = buildDynamicKopiKenanganBundles(dynamicItems);
  const nonKopiKenanganItems = menuItems.filter(i => i.brand !== "kopi-kenangan");
  const localItemsToKeep = (originalKopiKenanganMenu || [])
    .filter((item) => shouldKeepLocalKopiKenanganItem(item, dynamicItems))
    .map((item) => ({ ...item }));

  menuItems.length = 0;
  menuItems.push(...mergeDuplicateMenuItems([
    ...nonKopiKenanganItems,
    ...localItemsToKeep,
    ...dynamicItems,
    ...dynamicBundles,
  ]));

  if (typeof renderMenu === "function") renderMenu();
};

window.searchOutlets = async function(keyword) {
  const outletHint = document.getElementById("outletSearchHint");
  try {
    if (outletHint) outletHint.textContent = "Mencari outlet...";

    let outlets = [];
    let liveResponse;

    try {
      liveResponse = await fetch(`${CF_API_BASE}/outlets?keyword=${encodeURIComponent(keyword)}&page=1`);
      if (liveResponse.ok) {
        const liveData = await liveResponse.json();
        outlets = Array.isArray(liveData.outlets) ? liveData.outlets : [];
      }
    } catch (liveError) {
      console.warn("Status outlet realtime tidak tersedia, memakai katalog Supabase:", liveError);
    }

    if (!outlets.length) {
      const config = window.KOPI_SUPABASE_CONFIG || {};
      const safeKeyword = String(keyword || "").replace(/[,*()]/g, " ").trim();
      if (!config.url || !config.anonKey || !safeKeyword) {
        throw new Error(`API outlet realtime gagal${liveResponse ? ` (HTTP ${liveResponse.status})` : ""}`);
      }
      const filter = `(outlet_name.ilike.*${safeKeyword}*,outlet_address.ilike.*${safeKeyword}*)`;
      const endpoint = `${config.url}/rest/v1/kopken_outlets_catalog?select=outlet_code,outlet_name,outlet_address,category&or=${encodeURIComponent(filter)}&order=outlet_name.asc&limit=20`;
      const catalogResponse = await fetch(endpoint, {
        headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
      });
      if (!catalogResponse.ok) throw new Error(`Supabase HTTP ${catalogResponse.status}`);
      const rows = await catalogResponse.json();
      outlets = (Array.isArray(rows) ? rows : []).map((row) => ({
        code: row.outlet_code,
        name: row.outlet_name,
        address: row.outlet_address,
        category: row.category,
        isOpen: null,
        openStatus: "Status buka belum dapat diperbarui",
      }));
    }

    renderOutletResults(outlets, keyword);
    if (outletHint) outletHint.textContent = outlets.length
      ? `${outlets.length} outlet ditemukan.`
      : "Outlet tidak ditemukan. Periksa kembali nama kota atau gerainya.";
  } catch (error) {
    clearOutletResults();
    if (outletHint) outletHint.textContent = "Pencarian outlet sedang bermasalah. Coba lagi beberapa saat.";
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

function cacheOriginalLiveBrandMenus() {
  if (originalLiveBrandMenus || typeof menuItems === "undefined") return;
  originalLiveBrandMenus = {
    tomoro: menuItems.filter((item) => item.brand === "tomoro").map((item) => ({ ...item })),
    fore: menuItems.filter((item) => item.brand === "fore").map((item) => ({ ...item })),
  };
}

function replaceLiveBrandMenu(brandId, items) {
  const otherItems = menuItems.filter((item) => item.brand !== brandId);
  menuItems.length = 0;
  menuItems.push(...otherItems, ...items);
}

function restoreLiveBrandMenu(brandId) {
  cacheOriginalLiveBrandMenus();
  const originals = originalLiveBrandMenus?.[brandId] || [];
  replaceLiveBrandMenu(brandId, originals.map((item) => ({ ...item })));
}

function setLiveBrandOutletState(brandId, patch) {
  window.brandOutletStates[brandId] = {
    ...window.brandOutletStates[brandId],
    ...patch,
  };
}

function saveLiveBrandOutlets() {
  const saved = {};
  ["tomoro", "fore"].forEach((brandId) => {
    const state = window.brandOutletStates[brandId];
    if (state?.outletCode && state?.outletName) {
      saved[brandId] = { outletCode: state.outletCode, outletName: state.outletName, outletAddress: state.outletAddress || "" };
    }
  });
  localStorage.setItem(LIVE_BRAND_OUTLETS_KEY, JSON.stringify(saved));
}

function getLiveBrandResultsElement() {
  return document.getElementById("manualBrandOutletResults");
}

function setLiveBrandHint(message) {
  const hint = document.getElementById("manualBrandOutletHint");
  if (hint) hint.textContent = message;
}

function clearLiveBrandResults() {
  const results = getLiveBrandResultsElement();
  if (!results) return;
  results.innerHTML = "";
  results.hidden = true;
}

function renderManualLiveBrandOutlet(brandId, keyword) {
  const results = getLiveBrandResultsElement();
  const name = String(keyword || "").trim();
  if (!results || !name) return;
  results.innerHTML = "";
  results.hidden = false;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "outlet-result";
  const title = document.createElement("strong");
  title.textContent = `Gunakan outlet: ${name}`;
  const detail = document.createElement("span");
  detail.textContent = "Menu lokal cadangan akan ditampilkan.";
  button.append(title, detail);
  button.addEventListener("click", () => {
    const outletCode = `manual-${brandId}-${normalizeApiText(name)}`.slice(0, 80);
    setLiveBrandOutletState(brandId, {
      outletCode,
      outletName: name,
      outletAddress: "",
      menuLoading: false,
      menuLoaded: true,
      source: "fallback",
    });
    restoreLiveBrandMenu(brandId);
    saveLiveBrandOutlets();
    clearLiveBrandResults();
    setLiveBrandHint(`Outlet ${name} dipakai dengan menu lokal cadangan.`);
    if (typeof syncCheckoutOutletField === "function") syncCheckoutOutletField();
    if (typeof renderMenu === "function") renderMenu();
  });
  results.appendChild(button);
}

function liveBrandOutletName(brandId, outlet) {
  return brandId === "fore"
    ? String(outlet?.name || "")
    : String(outlet?.storeName || outlet?.name || "");
}

function liveBrandOutletCode(brandId, outlet) {
  return brandId === "fore"
    ? String(outlet?.code || "")
    : String(outlet?.storeCode || outlet?.code || "");
}

function liveBrandOutletAddress(brandId, outlet) {
  return brandId === "fore"
    ? String(outlet?.city || "")
    : String(outlet?.storeAddress || outlet?.address || "");
}

function renderLiveBrandOutletResults(brandId, outlets) {
  const results = getLiveBrandResultsElement();
  if (!results) return;
  results.innerHTML = "";
  results.hidden = false;

  if (!outlets.length) {
    results.innerHTML = '<p class="outlet-empty">Outlet tidak ditemukan.</p>';
    return;
  }

  outlets.forEach((outlet) => {
    const name = liveBrandOutletName(brandId, outlet);
    const code = liveBrandOutletCode(brandId, outlet);
    if (!name || !code) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "outlet-result";
    const title = document.createElement("strong");
    title.textContent = name;
    button.appendChild(title);
    const address = liveBrandOutletAddress(brandId, outlet);
    if (address) {
      const detail = document.createElement("span");
      detail.textContent = address;
      button.appendChild(detail);
    }
    button.addEventListener("click", () => selectLiveBrandOutlet(brandId, { outletCode: code, outletName: name, outletAddress: address }));
    results.appendChild(button);
  });
}

window.searchLiveBrandOutlets = async function(brandId, keyword) {
  if (!["tomoro", "fore"].includes(brandId) || keyword.trim().length < 3) return;
  setLiveBrandHint("Mencari outlet...");
  try {
    const url = `${BRAND_CATALOG_API}?action=${brandId}-outlets&keyword=${encodeURIComponent(keyword.trim())}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    const outlets = Array.isArray(data.outlets) ? data.outlets : [];
    renderLiveBrandOutletResults(brandId, outlets);
    setLiveBrandHint(`${outlets.length} outlet ditemukan. Pilih salah satu.`);
  } catch (error) {
    console.error(`Gagal mencari outlet ${brandId}:`, error);
    renderManualLiveBrandOutlet(brandId, keyword);
    setLiveBrandHint("Pencarian live sedang bermasalah. Gunakan nama outlet yang sudah diketik.");
  }
};

function normalizedLiveName(value) {
  return normalizeApiText(value)
    .replace(/^(iced|ice|hot)-/, "")
    .replace(/-parent$/, "")
    .replace(/cappucino/g, "cappuccino");
}

function buildForeLiveMenu(payload) {
  cacheOriginalLiveBrandMenus();
  const originals = originalLiveBrandMenus?.fore || [];
  const master = Array.isArray(payload?.master) ? payload.master : [];
  const storeRows = new Map((payload?.storeMenu || []).map((row) => [String(row.product_code || "").toLowerCase(), row]));
  const masterByName = new Map();
  master.forEach((item) => {
    const key = normalizedLiveName(item.name);
    if (!masterByName.has(key) || /^iced?-/i.test(String(item.name))) masterByName.set(key, item);
  });

  const matchedItems = originals.flatMap((localItem) => {
    const liveItem = masterByName.get(normalizedLiveName(localItem.name));
    if (!liveItem?.product_code) return [];
    const storeItem = storeRows.get(String(liveItem.product_code).toLowerCase());
    if (!storeItem || storeItem.is_sold_out === true) return [];

    const officialRegular = firstNumber(storeItem.regular_price, storeItem.small_price, liveItem.regular_price, liveItem.small_price);
    if (!officialRegular) return [];
    const officialLarge = firstNumber(storeItem.large_price, liveItem.large_price);
    const largeSellingPrice = officialLarge
      ? localItem.price + Math.max(0, officialLarge - officialRegular)
      : 0;
    const optionTemplate = Array.isArray(localItem.options)
      ? localItem.options
      : (BRANDS_DATA.find((brand) => brand.id === "fore")?.defaultOptions || []);
    const liveOptionGroups = new Set((liveItem.addons || []).map((group) => normalizeApiText(group.group_name).replace(/-/g, "")));
    const defaultOptions = optionTemplate
      .filter((group) => group.key !== "sweetness" || liveOptionGroups.has("sweetness"))
      .map((group) => ({
        ...group,
        options: (group.options || []).map((option) => ({ ...option })),
      }));
    const sizeGroup = defaultOptions.find((group) => group.key === "cupSize");
    if (sizeGroup) {
      sizeGroup.options = [{ value: "Reguler", label: "Reguler", price: localItem.price }];
      if (officialLarge) sizeGroup.options.push({ value: "Large", label: "Large", price: largeSellingPrice });
    }

    return [{
      ...localItem,
      image: liveItem.image_url || localItem.image,
      oldPrice: officialRegular,
      oldLargePrice: officialLarge || undefined,
      largePrice: largeSellingPrice || undefined,
      options: defaultOptions,
      liveOutletMenu: true,
    }];
  });

  const literItems = master.flatMap((liveItem) => {
    const isLiterItem = (liveItem.categories || []).some((category) => /foreveryone\s*1l/i.test(String(category)))
      || /\b1l\b/i.test(String(liveItem.name || ""));
    if (!isLiterItem || !liveItem.product_code) return [];

    const storeItem = storeRows.get(String(liveItem.product_code).toLowerCase());
    if (!storeItem || storeItem.is_sold_out === true) return [];
    const officialPrice = firstNumber(storeItem.regular_price, liveItem.regular_price);
    if (!officialPrice) return [];

    const options = (liveItem.addons || []).map((group) => ({
      key: normalizeApiText(group.group_name).replace(/-/g, "") || "option",
      label: group.group_name || "Option",
      defaultValue: (group.options || []).find((option) => option.is_default)?.label,
      options: (group.options || []).map((option) => ({
        value: option.label,
        label: option.label,
        priceDelta: firstNumber(option.price) || 0,
      })),
    })).filter((group) => group.options.length);

    return [{
      id: `fore-live-${normalizeApiText(liveItem.product_code)}`,
      brand: "fore",
      group: "fore-literan",
      name: liveItem.name,
      oldPrice: officialPrice,
      price: Math.max(0, officialPrice - 7000),
      image: liveItem.image_url,
      options,
      liveOutletMenu: true,
    }];
  });

  return [...matchedItems, ...literItems];
}

function collectTomoroProducts(value, products = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectTomoroProducts(entry, products));
    return products;
  }
  if (!value || typeof value !== "object") return products;
  const name = value.productName || value.menuName || value.goodsName || value.name;
  const price = firstNumber(value.price, value.salePrice, value.originPrice, value.originalPrice);
  if (name && price) products.push(value);
  Object.values(value).forEach((entry) => collectTomoroProducts(entry, products));
  return products;
}

function buildTomoroLiveMenu(payload) {
  cacheOriginalLiveBrandMenus();
  const originals = originalLiveBrandMenus?.tomoro || [];
  const liveByName = new Map(collectTomoroProducts(payload).map((item) => [
    normalizedLiveName(item.productName || item.menuName || item.goodsName || item.name),
    item,
  ]));
  const matched = originals.flatMap((localItem) => {
    const liveItem = liveByName.get(normalizedLiveName(localItem.name));
    if (!liveItem || liveItem.isSoldOut === true || liveItem.soldOut === true) return [];
    return [{
      ...localItem,
      oldPrice: firstNumber(liveItem.price, liveItem.salePrice, liveItem.originPrice, liveItem.originalPrice) || localItem.oldPrice,
      image: liveItem.imageUrl || liveItem.image || localItem.image,
      liveOutletMenu: true,
    }];
  });
  if (matched.length < 3) throw new Error("Data menu Tomoro live belum lengkap");
  return matched;
}

async function loadLiveBrandMenu(brandId, outletCode) {
  setLiveBrandOutletState(brandId, { menuLoading: true, menuLoaded: false, source: "" });
  if (typeof renderMenu === "function") renderMenu();
  try {
    const response = await fetch(`${BRAND_CATALOG_API}?action=${brandId}-menu&outletCode=${encodeURIComponent(outletCode)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    const items = brandId === "fore" ? buildForeLiveMenu(data) : buildTomoroLiveMenu(data);
    if (!items.length) throw new Error("Tidak ada menu yang cocok di outlet ini");
    replaceLiveBrandMenu(brandId, items);
    setLiveBrandOutletState(brandId, { menuLoading: false, menuLoaded: true, source: "live" });
    if (typeof activeBrandId === "undefined" || activeBrandId === brandId) {
      setLiveBrandHint(`${items.length} menu tersedia sesuai outlet terpilih.`);
    }
  } catch (error) {
    console.error(`Gagal memuat menu live ${brandId}:`, error);
    restoreLiveBrandMenu(brandId);
    setLiveBrandOutletState(brandId, { menuLoading: false, menuLoaded: true, source: "fallback" });
    if (typeof activeBrandId === "undefined" || activeBrandId === brandId) {
      setLiveBrandHint("Menu live sedang tidak tersedia. Menu lokal cadangan ditampilkan.");
    }
  }
  if (typeof renderMenu === "function") renderMenu();
}

async function selectLiveBrandOutlet(brandId, outlet) {
  setLiveBrandOutletState(brandId, { ...outlet, menuLoading: true, menuLoaded: false });
  saveLiveBrandOutlets();
  clearLiveBrandResults();
  const input = document.getElementById("manualBrandOutletInput");
  if (input) input.value = outlet.outletName;
  await loadLiveBrandMenu(brandId, outlet.outletCode);
  if (typeof syncCheckoutOutletField === "function") syncCheckoutOutletField();
}

window.clearLiveBrandOutlet = function(brandId) {
  if (!["tomoro", "fore"].includes(brandId)) return;
  setLiveBrandOutletState(brandId, { outletCode: "", outletName: "", outletAddress: "", menuLoading: false, menuLoaded: false, source: "" });
  restoreLiveBrandMenu(brandId);
  saveLiveBrandOutlets();
  clearLiveBrandResults();
  setLiveBrandHint("Ketik minimal 3 huruf, lalu pilih outlet dari hasil pencarian.");
};

document.addEventListener("DOMContentLoaded", () => {
  cacheOriginalLiveBrandMenus();
  try {
    const saved = JSON.parse(localStorage.getItem(LIVE_BRAND_OUTLETS_KEY) || "{}");
    ["tomoro", "fore"].forEach((brandId) => {
      if (!saved?.[brandId]?.outletCode || !saved?.[brandId]?.outletName) return;
      setLiveBrandOutletState(brandId, { ...saved[brandId], menuLoaded: false });
      loadLiveBrandMenu(brandId, saved[brandId].outletCode);
    });
  } catch (error) {
    localStorage.removeItem(LIVE_BRAND_OUTLETS_KEY);
  }

  const input = document.getElementById("manualBrandOutletInput");
  input?.addEventListener("input", (event) => {
    const keyword = event.target.value.trim();
    window.clearTimeout(liveBrandOutletSearchTimer);
    if (keyword.length < 3) {
      clearLiveBrandResults();
      setLiveBrandHint("Ketik minimal 3 huruf, lalu pilih outlet dari hasil pencarian.");
      return;
    }
    const brandId = typeof activeBrandId === "string" ? activeBrandId : "";
    if (!["tomoro", "fore"].includes(brandId)) return;
    liveBrandOutletSearchTimer = window.setTimeout(() => window.searchLiveBrandOutlets(brandId, keyword), 300);
  });
});

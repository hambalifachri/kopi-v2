// Skrip pembersih cache otomatis untuk mengatasi error sesi/storage yang korup di HP pelanggan[cite: 1]
window.addEventListener('load', function() {
    const lastVersion = localStorage.getItem('app_version');
    const currentVersion = '20260715';

    if (lastVersion !== currentVersion) {
        localStorage.clear();
        localStorage.setItem('app_version', currentVersion);
        window.location.reload();
    }
});

const CF_API_BASE = "https://api-kopken.novelveno65.workers.dev"; // URL Cloudflare Anda
const OUTLET_SEARCH_API = "/outlet-search";
const SELECTED_OUTLET_STORAGE_KEY = "kopiFachrindahSelectedOutlet";
const BRAND_CATALOG_API = "https://bpkpydfvevlktyeapunf.supabase.co/functions/v1/brand-catalog";
const LIVE_BRAND_OUTLETS_KEY = "kopiFachrindahLiveBrandOutlets";
let outletSearchTimer = null;
let liveBrandOutletSearchTimer = null;
let originalKopiKenanganMenu = null;
let originalLiveBrandMenus = null;

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
  return outlet?.store_name || outlet?.name || outlet?.outletName || outlet?.title || "";
}

function getOutletCode(outlet) {
  return outlet?.store_code || outlet?.code || outlet?.outletCode || outlet?.id || "";
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
};

// Menggunakan Cloudflare Worker untuk memuat menu Kopi Kenangan
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
    const dynamicBundles = buildDynamicKopiKenanganBundles(dynamicItems);
    const nonKopiKenanganItems = menuItems.filter((item) => item && item.brand !== "kopi-kenangan");
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

// Worker meneruskan pencarian outlet ke NufsFood agar tidak diblokir browser pelanggan.
window.searchOutlets = async function(keyword) {
  const outletHint = document.getElementById("outletSearchHint");
  try {
    if (outletHint) outletHint.textContent = "Mencari outlet...";

    const response = await fetch(`${OUTLET_SEARCH_API}?keyword=${encodeURIComponent(keyword)}&page=1&source=web-v2`);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    // Tetap menerima beberapa struktur respons agar pencarian tidak rapuh.
    let outlets = [];
    if (Array.isArray(data)) {
      outlets = data;
    } else if (Array.isArray(data.outlets)) {
      outlets = data.outlets;
    } else if (Array.isArray(data.data)) {
      outlets = data.data;
    } else if (data.data && Array.isArray(data.data.outlets)) {
      outlets = data.data.outlets;
    }

    renderOutletResults(outlets);
    if (outletHint) outletHint.textContent = `${outlets.length} outlet ditemukan.`;
  } catch (error) {
    console.error("Gagal mencari outlet Kopi Kenangan:", error);
    clearOutletResults();
    if (outletHint) outletHint.textContent = "Gagal mencari outlet. Coba lagi beberapa saat.";
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
    clearLiveBrandResults();
    setLiveBrandHint("Pencarian live sedang bermasalah. Coba lagi sebentar.");
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

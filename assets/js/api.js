// Tambahkan ini di bagian awal script Anda
window.addEventListener('load', function() {
    const lastVersion = localStorage.getItem('app_version');
    const currentVersion = '20260921-2'; // Samakan dengan versi file di atas

    if (lastVersion !== currentVersion) {
        localStorage.clear(); // Hapus sesi lama yang rusak
        localStorage.setItem('app_version', currentVersion);
        window.location.reload(); // Refresh paksa untuk pelanggan
    }
});

// Ganti baris paling atas api.js Anda menjadi seperti ini:
const NUFS_API_BASE = "https://www.nufsfood.shop/api";
const KOPKEN_CATALOG_API = "/api/kopken";
const SELECTED_OUTLET_STORAGE_KEY = "kopiFachrindahSelectedOutlet";
const BRAND_CATALOG_API = "https://omkboytvivjxoobyhumc.supabase.co/functions/v1/brand-catalog";
function getBrandCatalogHeaders() {
  const config = window.KOPI_SUPABASE_CONFIG || {};
  return config.anonKey
    ? { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` }
    : {};
}
const LIVE_BRAND_OUTLETS_KEY = "kopiFachrindahLiveBrandOutlets";
let outletSearchTimer = null;
let outletSearchRequestId = 0;
let liveBrandOutletSearchTimer = null;
let originalKopiKenanganMenu = null;
let originalLiveBrandMenus = null;

async function loadLiveKopkenMenu(outletCode) {
  const response = await fetch(`${KOPKEN_CATALOG_API}?action=live-menu&outletCode=${encodeURIComponent(outletCode)}`, {
    headers: getBrandCatalogHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Menu langsung belum tersedia. Coba lagi.");
  const result = await response.json();
  if (result.outletCode !== outletCode ||
      !new Set(["kopken-official", "catalog-provider", "supabase-cache"]).has(result.source) ||
      !Array.isArray(result.payload?.data?.menu_groups) || !result.payload.data.menu_groups.length) {
    throw new Error("Respons menu outlet belum valid.");
  }
  return result;
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
  /\bcreamy[\s-]+caramel[\s-]+latte\b/i,
  /\bair\s+mineral\b/i,
  /\bseliter\b/i,
  /\bliteran\b/i,
  /\btiramisu\b/i,
  /\btoffee\b/i,
];

const KOPI_KENANGAN_API_MENU_OVERRIDES = {
  "og-thai-tea": { noSugar: true },
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

let outletStatusRequestId = 0;

function renderKopkenOutletLiveStatus() {
  const label = document.getElementById("kopkenOutletLiveStatus");
  if (!label) return;
  const outlet = window.kopiKenanganOutletState;
  const status = outlet.pickupStatus;
  label.hidden = !outlet.outletCode || !status;
  label.textContent = ({
    checking: "Sedang cek status outlet…",
    open: "Outlet buka",
    closed: "Outlet tutup",
    onsite_only: "Hanya bisa pesan di outlet",
    unknown: "Status belum bisa dicek",
  })[status] || "";
  if (status === "unknown" && outlet.source === "supabase-cache") {
    const updated = outlet.menuUpdatedAt
      ? new Date(outlet.menuUpdatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
      : "waktu sinkron tidak tersedia";
    label.textContent = `Mode Supabase sementara · menu terakhir disinkron ${updated} WIB · status buka/tutup belum live.`;
  }
  if (outlet.pickupMessage && (status === "closed" || status === "onsite_only")) {
    label.textContent += ` · ${outlet.pickupMessage}`;
  }
}

async function refreshKopkenOutletStatus(code) {
  const { outletName, searchKeyword } = window.kopiKenanganOutletState;
  const requestId = ++outletStatusRequestId;
  setKopiKenanganOutletState({ pickupStatus: "checking", pickupMessage: "" });
  renderKopkenOutletLiveStatus();
  let status = "unknown", message = "";
  try {
    const params = new URLSearchParams({ action: "status", outletCode: code, outletName });
    if (searchKeyword) params.set("searchKeyword", searchKeyword);
    const response = await fetch(`${KOPKEN_CATALOG_API}?${params}`, {
      headers: getBrandCatalogHeaders(), cache: "no-store", signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("Status outlet tidak tersedia");
    const result = await response.json();
    if (result.outletCode === code && ["open", "closed", "onsite_only"].includes(result.status)) {
      status = result.status;
      message = typeof result.message === "string" ? result.message.slice(0, 120) : "";
    }
  } catch { /* An unavailable check is not a closed outlet. */ }
  if (requestId === outletStatusRequestId && window.kopiKenanganOutletState.outletCode === code) {
    setKopiKenanganOutletState({ pickupStatus: status, pickupMessage: message });
    renderKopkenOutletLiveStatus();
    if (typeof renderMenu === "function") renderMenu();
  }
  return status;
}

window.getKopkenPickupBlock = function() {
  const outlet = window.kopiKenanganOutletState;
  if (outlet.pickupStatus === "closed") return "Outlet sedang tutup";
  if (outlet.pickupStatus === "onsite_only") return "Outlet hanya menerima pesanan langsung di lokasi";
  return "";
};

window.requireKopkenPickupOpen = async function() {
  const code = window.kopiKenanganOutletState.outletCode;
  if (!code) throw new Error("Pilih outlet Kopi Kenangan dahulu.");
  const status = await refreshKopkenOutletStatus(code);
  if (window.kopiKenanganOutletState.outletCode !== code) throw new Error("Outlet berubah saat diperiksa. Coba lagi.");
  if (status === "closed") throw new Error("Outlet sedang tutup. Pilih outlet lain sebelum bayar.");
  if (status === "onsite_only") throw new Error("Outlet hanya menerima pesanan langsung di lokasi. Pilih outlet lain.");
  if (status !== "open") {
    const state = window.kopiKenanganOutletState;
    if (status === "unknown" && state.source === "supabase-cache") {
      const updated = state.menuUpdatedAt
        ? new Date(state.menuUpdatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
        : "waktu sinkron tidak tersedia";
      if (window.confirm(`API live Kopken sedang bermasalah. Menu memakai data Supabase yang terakhir disinkron ${updated} WIB. Status buka/tutup dan ketersediaan menu belum real-time. Tetap lanjut?`)) return;
      throw new Error("Pesanan dihentikan karena status outlet live belum tersedia.");
    }
    throw new Error("Status outlet belum bisa dicek. Coba lagi sebelum bayar.");
  }
};

function getOutletWifiPassword(outlet) {
  return outlet?.wifiPassword || outlet?.wifi_password || outlet?.wifi || outlet?.password || "";
}

function getOutletDisplayName(outlet) {
  const name = outlet?.name || outlet?.outletName || outlet?.title || "";
  return String(name).replace(/^kopi\s+kenangan\s*-\s*/i, "").trim();
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

  const livePromoPrice = firstNumber(item.salePrice, item.sale_price, item.price);
  const apiPrice = livePromoPrice || firstNumber(item.orig_price, item.origPrice);
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

function getApiProductLargePrice(item, localItem) {
  return firstNumber(
    item.large_price,
    item.largePrice,
    item.large_sale_price,
    item.largeSalePrice,
    localItem.largePrice,
  );
}

function getApiProductLargeOldPrice(item, localItem) {
  const explicitOfficialPrice = firstNumber(
    item.large_orig_price,
    item.largeOrigPrice,
    item.large_old_price,
    item.largeOldPrice,
    localItem.oldLargePrice,
  );
  if (explicitOfficialPrice) return explicitOfficialPrice;

  // Selling prices are not official outlet prices. When the API omits the
  // Large official price, preserve the catalog's size surcharge instead.
  const regularOfficialPrice = getApiProductOldPrice(item, localItem);
  const regularSellingPrice = firstNumber(localItem.price);
  const largeSellingPrice = firstNumber(localItem.largePrice);
  if (regularOfficialPrice && regularSellingPrice && largeSellingPrice >= regularSellingPrice) {
    return regularOfficialPrice + (largeSellingPrice - regularSellingPrice);
  }
  return undefined;
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
    hasOutletOfficialPrice: item.hasOutletOfficialPrice === true,
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
    hasOutletOfficialPrice: [...defaultCombination.drinks, defaultCombination.food].every(item => item.hasOutletOfficialPrice === true),
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
  const availableItems = items.filter((item) => !item.isSoldOut && !item.syncPending && item.price > 0 && item.oldPrice > 0);
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

function toKopiKenanganMenuItem(item, localMenuByName, sourceIndex) {
  const itemName = getApiProductName(item);
  const localItem = localMenuByName.get(normalizeMenuName(itemName)) || {};
  const overrideItem = KOPI_KENANGAN_API_MENU_OVERRIDES[normalizeApiText(itemName)] || {};
  const apiGroup = normalizeApiMenuGroup(item._category_name || item.category || item.group_name);
  const finalGroup = apiGroup || localItem.group || "food";
  if (item.catalog_only === true) {
    // Keep our selling prices and options, but use the outlet’s original prices.
    if (!localItem.id || !(Number(localItem.price) > 0)) return null;
    const noLarge = localItem.noLarge === true || item.noLarge === true;
    const outletRegular = firstNumber(item.outlet_regular_price);
    const outletLarge = firstNumber(item.outlet_large_price);
    const localSizeDelta = Math.max(0, (Number(localItem.oldLargePrice) || 0) - (Number(localItem.oldPrice) || 0));
    return { ...localItem, ...overrideItem, outletCodes: [], brand: "kopi-kenangan",
      name: itemName, group: finalGroup, kopkenCategoryOrder: { [finalGroup]: sourceIndex },
      image: item.image || localItem.image, isSoldOut: item.is_sold_out === true,
      isNew: localItem.isNew === true || finalGroup === "baru", syncPending: false,
      noLarge, largePrice: noLarge ? undefined : localItem.largePrice,
      oldPrice: outletRegular || localItem.oldPrice,
      oldLargePrice: outletLarge || (outletRegular ? (localSizeDelta ? outletRegular + localSizeDelta : undefined) : localItem.oldLargePrice),
      hasOutletOfficialPrice: Boolean(outletRegular),
      hasOutletLargePrice: Boolean(outletLarge),
    };
  }
  const isSoldOut = item.is_sold_out === true || item.isSoldOut === true || localItem.isSoldOut === true;
  const image = item.image || item.img || localItem.image || null;
  const regularPrice = getApiProductPrice(item, localItem);
  const apiLargePrice = getApiProductLargePrice(item, localItem);
  // Produk minuman baru kadang belum mengirim data Large dari API.
  const isNewKopkenDrink = finalGroup === "baru"
    || Number(item.type_code) === 4005
    || /(?:taro|cloud)/.test(normalizeApiText(itemName));
  const fallbackLargePrice = isNewKopkenDrink
    ? regularPrice + 7000
    : undefined;
  const largePrice = apiLargePrice || fallbackLargePrice;

  return {
    ...localItem,
    ...overrideItem,
    id: getApiProductId(item),
    outletCodes: [],
    brand: "kopi-kenangan",
    group: finalGroup,
    kopkenCategoryOrder: { [finalGroup]: sourceIndex },
    name: itemName,
    desc: item.description || localItem.desc,
    price: regularPrice,
    oldPrice: getApiProductOldPrice(item, localItem),
    largePrice,
    oldLargePrice: getApiProductLargeOldPrice(item, localItem) || (fallbackLargePrice ? item.orig_price + 7000 : undefined),
    image,
    isNew: localItem.isNew === true || finalGroup === "baru" || item.isNew === true,
    isSoldOut,
    syncPending: item.sync_pending === true,
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
      kopkenCategoryOrder: { ...item.kopkenCategoryOrder, ...existing.kopkenCategoryOrder },
      isNew: existing.isNew === true || item.isNew === true,
      isBestSeller: existing.isBestSeller === true || item.isBestSeller === true,
      isSoldOut: existing.isSoldOut === true && item.isSoldOut === true,
      syncPending: existing.syncPending === true && item.syncPending === true,
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
    .map((item, sourceIndex) => toKopiKenanganMenuItem(item, localMenuByName, sourceIndex)).filter(Boolean);
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
    searchKeyword: String(outlet?.searchKeyword || ""),
    outletCategory: String(outlet?.category || ""),
    pickupStatus: "",
    pickupMessage: "",
  });
  outletStatusRequestId++;
  renderKopkenOutletLiveStatus();

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
      const isApiClosed = outlet.isOpen === false;
      const scheduleClosed = outlet.scheduleClosed === true;
      const isClosed = isApiClosed || scheduleClosed;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `outlet-result${isClosed ? " outlet-result-closed" : ""}`;
      button.disabled = isClosed;
      const nameElement = document.createElement("strong");
      nameElement.textContent = name;
      const heading = document.createElement("span");
      heading.className = "outlet-result-heading";
      heading.appendChild(nameElement);
      const statusElement = document.createElement("span");
      if (isClosed) {
        statusElement.className = scheduleClosed && !isApiClosed ? "outlet-schedule-status" : "outlet-closed-status";
        statusElement.textContent = scheduleClosed && !isApiClosed ? "JADWAL TUTUP"
          : /pesan di outlet/i.test(outlet.openStatus || "") ? "PESAN DI OUTLET" : "TUTUP";
      } else {
        const isOpen = outlet.isOpen === true;
        statusElement.className = isOpen ? "outlet-open-status" : "outlet-unknown-status";
        statusElement.textContent = isOpen ? "BUKA" : "BELUM DICEK";
      }
      heading.appendChild(statusElement);
      button.appendChild(heading);
      if (address) {
        const addressElement = document.createElement("span");
        addressElement.textContent = address;
        button.appendChild(addressElement);
      }
      button.addEventListener("click", () => {
        const selectedOutlet = { ...outlet, name, code, searchKeyword: keyword };
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
  void refreshKopkenOutletStatus(String(outletCode));

  try {
    let rawResponse;
    let outletCategory = getKopiKenanganOutletState?.().outletCategory || "";
    const liveOutlet = await loadLiveKopkenMenu(String(outletCode));
    rawResponse = liveOutlet.payload;
    outletCategory = liveOutlet.category || outletCategory;

    if (String(getKopiKenanganOutletState().outletCode) !== String(outletCode)) return;
    setKopiKenanganOutletState({ outletCategory });
    cacheOriginalKopiKenanganMenu();
    const localMenuByName = new Map(
      (originalKopiKenanganMenu || []).map((item) => [normalizeMenuName(item.name), item])
    );

    const dynamicItems = buildDynamicKopiKenanganItems(rawResponse, localMenuByName);
    if (!dynamicItems.length) throw new Error("Menu outlet kosong");
    const dynamicBundles = buildDynamicKopiKenanganBundles(dynamicItems);
    const nonKopiKenanganItems = menuItems.filter((item) => item && item.brand !== "kopi-kenangan");
    const localItemsToKeep = [];

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
      source: liveOutlet.source,
      menuUpdatedAt: liveOutlet.updatedAt || "",
    });
    renderKopkenOutletLiveStatus();
    if (typeof renderMenu === "function") renderMenu();

  } catch (error) {
    console.error("Gagal memuat API Asli:", error);
    if (String(getKopiKenanganOutletState().outletCode) !== String(outletCode)) return;
    const otherBrands = menuItems.filter(item => item.brand !== "kopi-kenangan");
    menuItems.length = 0;
    menuItems.push(...otherBrands);
    setKopiKenanganOutletState({ menuLoaded: false, menuLoading: false, outletCode, source: "unavailable" });
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
  const requestId = ++outletSearchRequestId;
  try {
    if (outletHint) outletHint.textContent = "Mencari outlet...";

    const catalogResponse = await fetch(`${KOPKEN_CATALOG_API}?action=outlets&keyword=${encodeURIComponent(keyword)}&page=1`, {
      headers: getBrandCatalogHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!catalogResponse.ok) throw new Error("Pencarian outlet resmi gagal");
    const catalogData = await catalogResponse.json();
    if (!new Set(["kopken-official", "catalog-provider", "supabase-catalog"]).has(catalogData.source) || !Array.isArray(catalogData.outlets)) {
      throw new Error("Respons pencarian outlet belum valid");
    }
    const outlets = catalogData.outlets.map((outlet) => ({ ...outlet, source: catalogData.source }));

    if (requestId !== outletSearchRequestId) return;
    renderOutletResults(outlets, keyword);
    if (outletHint) {
      if (catalogData.source === "supabase-catalog") {
        outletHint.textContent = outlets.length
          ? `${outlets.length} outlet ditemukan dari Supabase. Status buka/tutup belum real-time.`
          : "Outlet tidak ditemukan di katalog Supabase. Coba nama gerai atau kota yang lebih spesifik.";
      } else {
        outletHint.textContent = outlets.length
          ? `${outlets.length} outlet ditemukan.`
          : "Outlet tidak ditemukan. Periksa kembali nama kota atau gerainya.";
      }
    }
  } catch (error) {
    if (requestId !== outletSearchRequestId) return;
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

  const closed = (outlet) => brandId === "tomoro" ? outlet?.isOpen === false : outlet?.is_open === false;
  [...outlets]
    .sort((first, second) => Number(closed(first)) - Number(closed(second)))
    .forEach((outlet) => {
      const name = liveBrandOutletName(brandId, outlet);
      const code = liveBrandOutletCode(brandId, outlet);
      if (!name || !code) return;
      const isClosed = closed(outlet);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `outlet-result${isClosed ? " outlet-result-closed" : ""}`;
      button.disabled = isClosed;
      const title = document.createElement("strong");
      title.textContent = name;
      button.appendChild(title);
      const address = liveBrandOutletAddress(brandId, outlet);
      if (address) {
        const detail = document.createElement("span");
        detail.textContent = address;
        button.appendChild(detail);
      }
      if (brandId === "tomoro") {
        const status = document.createElement("span");
        status.className = "outlet-result-heading";
        const badge = document.createElement("span");
        badge.className = isClosed ? "outlet-closed-status" : outlet.isOpen === true ? "outlet-open-status" : "outlet-unknown-status";
        badge.textContent = isClosed ? "TUTUP" : outlet.isOpen === true ? "BUKA" : "BELUM DICEK";
        status.appendChild(badge); button.appendChild(status);
      } else if (isClosed) {
        const status = document.createElement("span"); status.className = "outlet-closed-status";
        status.textContent = "Outlet sedang tutup"; button.appendChild(status);
      }
      button.addEventListener("click", () => selectLiveBrandOutlet(brandId, { outletCode: code, outletName: name, outletAddress: address }));
      results.appendChild(button);
    });
}

window.searchLiveBrandOutlets = async function(brandId, keyword) {
  if (!["tomoro", "fore"].includes(brandId) || keyword.trim().length < 3) return;
  setLiveBrandHint("Mencari outlet...");
  try {
    const url = `${brandId === "tomoro" ? "/api/tomoro" : BRAND_CATALOG_API}?action=${brandId}-outlets&keyword=${encodeURIComponent(keyword.trim())}`;
    const response = await fetch(url, { headers: getBrandCatalogHeaders() });
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

const FORE_LIVE_CATEGORY_GROUPS = new Map([
  ["the-unexpected-twist", "the-unexpected-twist"],
  ["taste-of-our-journey", "sunny-burst-series"],
  ["favorite-choice", "fore-signature"],
  ["fore-signature", "fore-signature"],
  ["foreveryone-1l", "fore-literan"],
  ["coffee", "coffee"],
  ["americano-series", "americano-series"],
  ["non-coffee", "non-coffee"],
  ["fore-junior", "fore-junior"],
  ["fore-deli", "fore-deli"],
  ["refresher", "refresher"],
  ["ice-blended", "ice-blended"],
  ["tea", "tea"],
  ["peduli-kalimantan", "fore-signature"],
]);

function foreLiveGroup(item) {
  const category = Array.isArray(item?.categories) ? item.categories[0] : "";
  return FORE_LIVE_CATEGORY_GROUPS.get(normalizeApiText(category)) || "";
}

function foreSellingPrice(officialPrice) {
  return Math.round((officialPrice * 0.75 + 2250) / 250) * 250;
}

function foreSupportsLargeSize(group) {
  return !["fore-literan", "fore-deli"].includes(group);
}

function foreDefaultLiveOptions(officialRegular, officialLarge = 0) {
  const template = BRANDS_DATA.find((brand) => brand.id === "fore")?.defaultOptions || [];
  return template.map((group) => ({
    ...group,
    options: (group.options || []).map((option) => ({ ...option })),
  })).map((group) => {
    if (group.key !== "cupSize") return group;
    return {
      ...group,
      options: [
        { value: "Reguler", label: "Reguler", price: officialRegular },
        ...(officialLarge ? [{ value: "Large", label: "Large", price: officialLarge }] : []),
      ],
    };
  });
}

function buildForeLiveMenu(payload) {
  const master = Array.isArray(payload?.master) ? payload.master : [];
  const storeRows = new Map((payload?.storeMenu || []).map((row) => [String(row.product_code || "").toLowerCase(), row]));
  return master.flatMap((liveItem) => {
    const group = foreLiveGroup(liveItem);
    if (!group || !liveItem.product_code) return [];

    const storeItem = storeRows.get(String(liveItem.product_code).toLowerCase());
    if (!storeItem || storeItem.is_sold_out === true) return [];
    const officialRegular = firstNumber(storeItem.regular_price, liveItem.regular_price);
    if (!officialRegular) return [];
    const isLiterItem = group === "fore-literan";
    const supportsLarge = foreSupportsLargeSize(group);
    const sellingPrice = isLiterItem ? Math.max(0, officialRegular - 7000) : foreSellingPrice(officialRegular);
    const sellingLargePrice = supportsLarge
      ? firstNumber(storeItem.large_price, liveItem.large_price) || sellingPrice + 7000
      : 0;

    return [{
      id: `fore-live-${normalizeApiText(liveItem.product_code)}`,
      brand: "fore",
      group,
      name: liveItem.name,
      oldPrice: officialRegular,
      price: sellingPrice,
      largePrice: sellingLargePrice || undefined,
      image: liveItem.image_url || undefined,
      options: isLiterItem ? [] : foreDefaultLiveOptions(sellingPrice, sellingLargePrice),
      liveOutletMenu: true,
    }];
  });
}

function collectTomoroProducts(value, products = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectTomoroProducts(entry, products));
    return products;
  }
  if (!value || typeof value !== "object") return products;
  const name = value.productName || value.menuName || value.goodsName || value.name;
  const price = firstNumber(value.price, value.salePrice, value.originPrice, value.originalPrice);
  if (name && (price || value.catalog_only === true)) products.push(value);
  Object.values(value).forEach((entry) => collectTomoroProducts(entry, products));
  return products;
}

function tomoroUiMenuGroup(product) {
  const name = normalizedLiveName(product.productName || product.menuName || product.goodsName || product.name);
  if (/matcha/.test(name)) return "Matcha-Series";
  if (/americano|espresso|cappuccino|caffe|coffee|kopi|soe|breve/.test(name)) return "classic-coffee";
  if (/latte|macchiato|pistachio|aren|caramel|coconut|spanish|oat/.test(name)) return "flavored-latte";
  if (/tea|yakult|lychee|lemon|peach|strawberry|grapefruit|refresh|soda/.test(name)) return "refreshing-series";
  if (/chocolate|cocoa|milk|hojicha/.test(name)) return "non-coffee";
  return "signature";
}

function getTomoroCapturedPrice(product) {
  return firstNumber(product.salePrice, product.sale_price, product.price, product.originPrice, product.originalPrice, product.origPrice, product.orig_price);
}

function getTomoroCapturedOldPrice(product) {
  return firstNumber(product.originPrice, product.originalPrice, product.origPrice, product.orig_price, product.price, product.salePrice, product.sale_price);
}

function getLocalTomoroMenuByName() {
  cacheOriginalLiveBrandMenus();
  return new Map((originalLiveBrandMenus?.tomoro || []).map((item) => [normalizedLiveName(item.name), item]));
}

function isTomoroLiterMenu(product) {
  const rawText = [
    product?.productName,
    product?.menuName,
    product?.goodsName,
    product?.name,
    product?.categoryName,
    product?.category,
    product?.groupName,
    product?.group,
    product?.menuGroupName,
    product?.menu_group_name,
  ].filter(Boolean).join(" ").toLowerCase();
  const normalizedText = normalizedLiveName(rawText);
  return /(^|[^a-z0-9])(1\s*l|1l|1\s*lt|1lt|1\s*liter|one\s*liter|1000\s*ml|1000ml|literan|seliter|liter)([^a-z0-9]|$)/i.test(rawText)
    || /(^|-)(1-l|1l|1-lt|1lt|1-liter|one-liter|1000-ml|1000ml|literan|seliter|liter)(-|$)/i.test(normalizedText);
}

function isTomoroDrinkMenu(product) {
  const name = normalizedLiveName(product.productName || product.menuName || product.goodsName || product.name);
  if (!name || /master-s-o-e|master-soe|s-o-e|\bsoe\b/.test(name)) return false;
  if (isTomoroLiterMenu(product)) return false;
  if (/sticker|keychain|e-money|emoney|merch|merchandise|tumbler|cup|totebag|bag|voucher|bundle/.test(name)) return false;
  if (/food|rice|sandwich|toast|croissant|donut|cake|bun|bread|pastry|muffin|chicken|beef|sausage|cheese roll/.test(name)) return false;
  return /americano|espresso|cappuccino|caffe|coffee|kopi|latte|macchiato|pistachio|aren|caramel|coconut|spanish|oat|matcha|tea|yakult|lychee|lemon|peach|strawberry|grapefruit|refresh|soda|chocolate|cocoa|milk|hojicha|frappe|smoothie/.test(name);
}

function buildTomoroUiCapturedMenu(payload) {
  const products = collectTomoroProducts(payload).filter(isTomoroDrinkMenu);
  const localByName = getLocalTomoroMenuByName();
  const optionGroups = BRANDS_DATA.find((brand) => brand.id === "tomoro")?.defaultOptions || [];
  const cloneGroups = typeof cloneOptionGroups === "function"
    ? cloneOptionGroups
    : (groups) => groups.map((group) => ({ ...group, options: (group.options || []).map((option) => ({ ...option })) }));
  const imageFor = (productName, product) => {
    if (product.imageUrl || product.image) return product.imageUrl || product.image;
    const slug = typeof slugifyAssetName === "function"
      ? slugifyAssetName(productName)
      : String(productName).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return `assets/menu/tomoro-${slug}.jpg`;
  };
  const seen = new Set();
  return products.flatMap((product) => {
    const name = product.productName || product.menuName || product.goodsName || product.name;
    const key = normalizedLiveName(name);
    const localItem = localByName.get(key);
    if (product.catalog_only === true) {
      if (!localItem || !(Number(localItem.price) > 0) || product.isSoldOut === true || seen.has(key)) return [];
      seen.add(key);
      return [{ ...localItem, image: product.imageUrl || localItem.image, liveOutletMenu: true,
        options: cloneGroups(localItem.options || optionGroups).map(group => group.key === "cupSize"
          ? { ...group, options: (group.options || []).filter(option => option.value === "Small") } : group),
      }];
    }
    const price = localItem?.price || getTomoroCapturedPrice(product);
    const oldPrice = getTomoroCapturedOldPrice(product) || localItem?.oldPrice || price;
    if (!name || !price || seen.has(key)) return [];
    seen.add(key);
    return [{
      id: `tomoro-live-${normalizeApiText(name)}`,
      brand: "tomoro",
      group: localItem?.group || tomoroUiMenuGroup(product),
      name,
      oldPrice,
      price,
      image: imageFor(name, product),
      options: cloneGroups(localItem?.options || optionGroups),
      liveOutletMenu: true,
    }];
  });
}

function buildTomoroLiveMenu(payload) {
  const captured = buildTomoroUiCapturedMenu(payload);
  if (captured.length >= 3) return captured;
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
      oldPrice: getTomoroCapturedOldPrice(liveItem) || localItem.oldPrice,
      price: localItem.price,
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
    const url = `${brandId === "tomoro" ? "/api/tomoro" : BRAND_CATALOG_API}?action=${brandId}-menu&outletCode=${encodeURIComponent(outletCode)}`;
    const response = await fetch(url, { headers: getBrandCatalogHeaders(), signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    const items = brandId === "tomoro" ? buildTomoroLiveMenu(data) : buildForeLiveMenu(data);
    if (!items.length) throw new Error("Tidak ada menu yang cocok di outlet ini");
    replaceLiveBrandMenu(brandId, items);
    setLiveBrandOutletState(brandId, { menuLoading: false, menuLoaded: true, source: "live" });
    if (typeof activeBrandId === "undefined" || activeBrandId === brandId) {
      setLiveBrandHint(`${items.length} menu tersedia sesuai outlet terpilih.`);
    }
  } catch (error) {
    console.error(`Gagal memuat menu live ${brandId}:`, error);
    if (brandId === "tomoro") {
      replaceLiveBrandMenu(brandId, []);
      setLiveBrandOutletState(brandId, { menuLoading: false, menuLoaded: false, source: "" });
      setLiveBrandHint("Menu Small untuk voucher 50% belum bisa diperiksa. Pilih ulang outlet atau coba lagi.");
      if (typeof renderMenu === "function") renderMenu();
      return;
    }
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

// Recheck the selected outlet before QRIS and again before saving an order.
window.validateKopkenCartAvailability = async function() {
  if (typeof getCartBrandId !== "function" || getCartBrandId() !== "kopi-kenangan") return;
  const outlet = getKopiKenanganOutletState();
  const code = String(outlet.outletCode || "");
  if (!code || !outlet.selected) throw new Error("Pilih outlet Kopi Kenangan dahulu sebelum melanjutkan.");
  let latest;
  try { latest = await loadLiveKopkenMenu(code); }
  catch { throw new Error("Ketersediaan menu outlet belum bisa diperiksa. Periksa koneksi lalu coba lagi sebelum transfer."); }
  if (String(getKopiKenanganOutletState().outletCode || "") !== code) {
    throw new Error("Outlet berubah saat pemeriksaan. Periksa keranjang lalu lanjutkan kembali.");
  }
  cacheOriginalKopiKenanganMenu();
  const locals = new Map((originalKopiKenanganMenu || []).map(item => [normalizeMenuName(item.name),item]));
  const products = mergeDuplicateMenuItems(buildDynamicKopiKenanganItems(latest.payload,locals));
  if (!products.length) throw new Error("Menu outlet belum tersedia. Pilih ulang outlet atau coba lagi sebelum transfer.");
  const validItems = [...products,...buildDynamicKopiKenanganBundles(products)];
  const missing = [];
  for (const [key,item] of cart) {
    const valid = validItems.some(product => String(product.id) === String(item.id)
      && normalizeMenuName(product.name) === normalizeMenuName(item.name)
      && !product.isSoldOut
      && !product.syncPending
      && (!Array.isArray(product.outletCodes) || !product.outletCodes.length || product.outletCodes.includes(code)));
    if (!valid) { missing.push(item.name); cart.delete(key); }
  }
  const otherBrands = menuItems.filter(item => item.brand !== "kopi-kenangan");
  menuItems.length = 0;
  menuItems.push(...otherBrands,...validItems);
  setKopiKenanganOutletState({menuLoaded:true,menuLoading:false,source:latest.source,menuUpdatedAt:latest.updatedAt || "",outletCategory:latest.category || outlet.outletCategory});
  if (typeof renderMenu === "function") renderMenu();
  if (missing.length) {
    saveCartToStorage();
    renderCart();
    throw new Error("Menu sudah tidak tersedia di outlet ini dan dikeluarkan dari keranjang: "
      + [...new Set(missing)].join(", ") + ". Silakan pilih menu pengganti sebelum melanjutkan.");
  }
};

// Refresh long-open tabs after the customer returns from another app.
let kopkenLastFocusRefresh = 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || typeof getKopiKenanganOutletState !== "function") return;
  const state = getKopiKenanganOutletState();
  if (!state.selected || !state.outletCode || state.menuLoading || Date.now()-kopkenLastFocusRefresh < 60000) return;
  kopkenLastFocusRefresh = Date.now();
  window.loadDynamicMenu(state.outletCode);
});

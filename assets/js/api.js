const NUFS_API_BASE = "https://www.nufsfood.shop/api";
const SELECTED_OUTLET_STORAGE_KEY = "kopiFachrindahSelectedOutlet";
let outletSearchTimer = null;
let originalKopiKenanganMenu = null;

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

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return undefined;
}

function normalizeApiMenuGroup(category) {
  const normalized = String(category || "lainnya")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

  if (normalized === "kopi" || normalized === "coffee") return "coffee";
  if (normalized === "non-kopi" || normalized === "non-coffee") return "non-coffee";
  return normalized;
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
    const response = await fetch(`${NUFS_API_BASE}/menu?outletCode=${encodeURIComponent(outletCode)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const apiMenu = Array.isArray(data.menu) ? data.menu : [];
    if (!apiMenu.length) throw new Error("Menu outlet kosong");

    if (typeof menuItems === "undefined") throw new Error("Data menu lokal belum siap");
    cacheOriginalKopiKenanganMenu();
    const localMenuByName = new Map(
      (originalKopiKenanganMenu || []).map((item) => [normalizeMenuName(item.name), item])
    );

const dynamicItems = apiMenu.map((item) => {
  const localItem = localMenuByName.get(normalizeMenuName(item.name)) || {};
  
  // 1. Ambil harga dasar dari API
  const apiPrice = firstNumber(item.price, item.discountPrice, item.origPrice);
  
  // 2. Hitung harga dasar menggunakan rumus: (API / 2 + 3000)
  let basePrice = apiPrice ? Math.round(apiPrice / 2) + 3000 : (localItem.price || 0);
  
  // 3. Tentukan penyesuaian khusus (jika menu ada di daftar, tambahkan)
  const slugName = slugifyAssetName(item.name);
  const adjustment = PRICE_ADJUSTMENTS[slugName] || 0;
  
  // 4. Harga final adalah harga dasar + penyesuaian
  const finalPrice = basePrice + adjustment;

  return {
    ...localItem,
    id: String(item.id || item.name),
    brand: "kopi-kenangan",
    group: normalizeApiMenuGroup(item.category),
    name: item.name,
    price: finalPrice,
    oldPrice: firstNumber(item.origPrice, item.oldPrice, item.originalPrice) || localItem.oldPrice,
    image: item.img || localItem.image || null,
  };
});

    const remainingItems = menuItems.filter((item) => item.brand !== "kopi-kenangan");
    menuItems.length = 0;
    menuItems.push(...remainingItems, ...dynamicItems);
    setKopiKenanganOutletState({ menuLoaded: true, menuLoading: false, outletCode });
    if (typeof renderMenu === "function") renderMenu();
  } catch (error) {
    setKopiKenanganOutletState({ menuLoaded: false, menuLoading: false, outletCode });
    container.innerHTML = '<p class="no-results">Gagal memuat menu outlet. Coba pilih outlet ulang.</p>';
  }
};

window.searchOutlets = async function(keyword) {
  const outletHint = document.getElementById("outletSearchHint");
  try {
    if (outletHint) outletHint.textContent = "Mencari outlet...";
    const response = await fetch(`${NUFS_API_BASE}/outlets?keyword=${encodeURIComponent(keyword)}&page=1`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const outlets = Array.isArray(data.outlets) ? data.outlets : [];
    renderOutletResults(outlets);
    if (outletHint) outletHint.textContent = `${outlets.length} outlet ditemukan.`;
  } catch (error) {
    clearOutletResults();
    if (outletHint) outletHint.textContent = "Gagal mencari outlet. Coba lagi atau isi nama outlet manual di checkout.";
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

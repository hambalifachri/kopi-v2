// ==========================================
// KONEKSI DINAMIS SUPABASE (MINIMAL ORDER)
// ==========================================
// URL sudah dibersihkan (tanpa /rest/v1/)
const MY_SUPABASE_URL = "https://bpkpydfvevlktyeapunf.supabase.co"; 
const MY_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwa3B5ZGZ2ZXZsa3R5ZWFwdW5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODc2NTQsImV4cCI6MjA5NTE2MzY1NH0.GTnmA5rAfRwH_tDchpxtXXM6TmRpFaK0yOW5jRyVhY4";

// Variabel bawaan
let kopkenMinOrder = 3; 

async function fetchStoreSettings() {
  try {
    // Pastikan library dari HTML sudah terbaca
    if (!window.supabase) return; 
    
    // Buat client khusus untuk membaca settingan
    const mySupabase = window.supabase.createClient(MY_SUPABASE_URL, MY_SUPABASE_ANON_KEY);
    
    // Ambil data dari tabel app_settings
    const { data, error } = await mySupabase
      .from('app_settings')
      .select('kopken_min_order')
      .limit(1);

    if (error) {
       console.log("Abaikan jika tabel belum dibuat di Supabase:", error.message);
       return; 
    }

    if (data && data.length > 0) {
      kopkenMinOrder = data[0].kopken_min_order;
      console.log("⚡ Aturan minimal order hari ini dari Supabase:", kopkenMinOrder);
    }
  } catch (error) {
    console.warn("Gagal memuat aturan, menggunakan minimal bawaan (3).", error.message);
  }
}

// Jalankan saat web dibuka
fetchStoreSettings();

// ==========================================
// (Lanjut ke kode Anda di bawahnya...)
// ==========================================

// ==========================================
// PENGATURAN STATUS TOKO (BUKA / TUTUP)
// ==========================================
const storeConfig = STORE_CONFIG_DATA;

function checkStoreStatus(brandId) {
  const now = getJakartaDate();
  const day = now.getDay(); 
  const hour = now.getHours(); 
  
  const waLink = "<br><br><a href='https://wa.me/6281281400462?text=Halo%20admin%20kopi.fachrindah,%20saya%20mau%20tanya-tanya%20dulu%20dong.' target='_blank' class='wa-direct-btn'>Chat WhatsApp Admin</a>";

  // 1. Cek penutupan spesifik per brand
  if (brandId === 'kopi-kenangan' && storeConfig.isKopkenClosed) {
    return { closed: true, message: storeConfig.manualClosedMessage + waLink };
  }
  if (brandId === 'fore' && storeConfig.isForeClosed) {
    return { closed: true, message: storeConfig.manualClosedMessage + waLink };
  }

  // 2. Cek Sholat Jumat (Berlaku untuk semua)
  if (storeConfig.autoJumatan && day === 5 && hour === 12) {
    return { closed: false, message: "Maaf, toko sedang istirahat untuk ibadah Sholat Jumat dan akan buka kembali otomatis pukul 13:00 WIB.<br><br>Punya pertanyaan atau mau titip pesanan? Langsung chat admin aja ya." + waLink };
  }

  return { closed: false };
}

function getJakartaDate() {
  const waktuJakarta = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
  return new Date(waktuJakarta);
}

function timeToMinutes(time) {
  const [hour, minute] = String(time).split(":").map(Number);
  return hour * 60 + minute;
}

function isScheduleActive(schedule, now = getJakartaDate()) {
  const day = now.getDay();
  if (schedule.days && !schedule.days.includes(day)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(schedule.start);
  const endMinutes = timeToMinutes(schedule.end);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function getActiveSizeBlock(item, size, now = getJakartaDate()) {
  if (!item.sizeBlocks) return null;
  return item.sizeBlocks.find((block) => block.size === size && isScheduleActive(block, now)) || null;
}

function getActiveSizeBlockNotes(item, now = getJakartaDate()) {
  if (!item.sizeBlocks) return [];
  return item.sizeBlocks
    .filter((block) => isScheduleActive(block, now))
    .map((block) => `${block.size} tidak tersedia ${block.label || ""}`.trim());
}

const BRANDS = BRANDS_DATA;
const menuItems = MENU_ITEMS_DATA;
const productImages = PRODUCT_IMAGES_DATA;
let activeBrandId = BRANDS[0]?.id || "kopi-kenangan";

function slugifyAssetName(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getAutoImageFileName(item) {
  return `${item.brand}-${slugifyAssetName(item.name)}.jpg`;
}

function resolveMenuImage(item) {
  // 1. Jika ada link gambar manual di menu-data.js, gunakan itu
  if (item.image) return item.image;
  
  // 2. Jika ada pemetaan di PRODUCT_IMAGES_DATA (jika nanti Anda isi), gunakan itu
  if (typeof productImages !== 'undefined' && productImages[item.id]) {
      return `assets/menu/${productImages[item.id]}`;
  }
  
  // 3. PAKSA OTOMATIS: Gunakan brand dan nama menu untuk mencari gambar
  // Contoh: tomoro-caffe-latte.jpg
  return `assets/menu/${getAutoImageFileName(item)}`;
}

menuItems.forEach((item) => {
  item.brand = item.brand || "kopi-kenangan";
  item.image = resolveMenuImage(item);
});

const cart = new Map();
let pendingItemId = "";
let proofPreviewUrl = "";
let supabaseClient = null;

let selectedOptions = {};

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const brandTabs = document.querySelector("#brandTabs");
const categoryNav = document.querySelector("#categoryNav");
const catalogContainer = document.querySelector("#catalogContainer");
const menuSearch = document.querySelector("#menuSearch");
const clearSearch = document.querySelector("#clearSearch");
const searchStatus = document.querySelector("#searchStatus");
const mainCartItems = document.querySelector("#cartItems");
const modalCartItems = document.querySelector("#modalCartItems");
const subtotalEl = document.querySelector("#modalSubtotal");
const grandTotalEl = document.querySelector("#modalGrandTotal");
const checkoutSummary = document.querySelector("#checkoutSummary");
const clearCartButton = document.querySelector("#modalClearCart");
const orderForm = document.querySelector("#modalOrderForm");
const reviewForm = document.querySelector("#reviewForm");
const brandTitle = document.querySelector("#brandTitle");
const brandSubtitle = document.querySelector("#brandSubtitle");
const brandSummary = document.querySelector("#brandSummary");
const reviewsGrid = document.querySelector("#reviewsGrid");
const testimonialGallery = document.querySelector("#testimonialGallery");
const backToTop = document.querySelector("#backToTop");
const openCartButton = document.querySelector("#openCartButton");
const openCartCount = document.querySelector("#openCartCount");
const openCartTotal = document.querySelector("#openCartTotal");
const headerCartButton = document.querySelector("#headerCartButton");
const headerCartCount = document.querySelector("#headerCartCount");
const headerGuideButton = document.querySelector("#headerGuideButton");
const headerTestimonialButton = document.querySelector("#headerTestimonialButton");
const menuModeTabs = document.querySelector("#menuModeTabs");
const bundleTabs = document.querySelector("#bundleTabs");
const sortSelect = document.querySelector("#sortSelect");
const outletPanel = document.querySelector("#outletPanel");
const selectedOutletName = document.querySelector("#selectedOutletName");
const wifiPasswordBar = document.querySelector("#wifiPasswordBar");
const wifiPasswordText = document.querySelector("#wifiPasswordText");
const wifiDateLabel = document.querySelector("#wifiDateLabel");
const copyWifiButton = document.querySelector("#copyWifiButton");
const wifiChevron = document.querySelector("#wifiChevron");
const wifiDetailPanel = document.querySelector("#wifiDetailPanel");
const orderModal = document.querySelector("#orderModal");
const modalTitle = document.querySelector("#modalItemName");
const modalCustomize = document.querySelector("#modalCustomize");
const modalCartStage = document.querySelector("#modalCartStage");
const modalCheckoutStage = document.querySelector("#modalCheckoutStage");
const modalOptions = document.querySelector("#modalOptions");
const closeOrderModalButton = document.querySelector("#closeOrderModal");
const continueShoppingButton = document.querySelector("#continueShopping");
const goCheckoutButton = document.querySelector("#goCheckout");
const backToCartButton = document.querySelector("#backToCart");
const paymentProofInput = document.querySelector("#modalPaymentProof");
const proofPreview = document.querySelector("#proofPreview");
const shareProofButton = document.querySelector("#shareProofButton");
const selectedDrink = document.querySelector("#selectedDrink");
const itemNoteInput = document.querySelector("#itemNote");
const addConfiguredItemButton = document.querySelector("#addConfiguredItem");

const fallbackTestimonialImages = Array.from({ length: 52 }, (_, index) => `assets/ss-wa-${index + 2}.jpg`);
const PICKUP_START_MINUTES = 8 * 60;
const PICKUP_END_MINUTES = 23 * 60;
const PICKUP_INTERVAL_MINUTES = 15;
const WIFI_PASSWORDS = [
  "TemanKenangan#01", "SelaluSeru@02", "WorkFromKenangan+03", "SahabatSetia=4", "PaduanPas!05",
  "AndalanMantan#06", "NyantaiNgopi@07", "KenanganNyaman+08", "SepenuhHati=09", "AsliAsik!10",
  "KopiKenanganMantan#11", "CafeMaltLatte@12", "SparksAmericano+13", "KenanganFrappe=14", "SusuGrassJelly!15",
  "AdamAyam#16", "FriendChip@17", "CoklatKlasik+18", "SaudiSpicy=19", "ChiMateNikmat!20",
  "ColorpopBubble#21", "TwinsTumbler@22", "CuteCapybara+23", "BaliKintamani=24", "JuwaraBeans!25",
  "SelfRewardDulu#26", "WorkLifeNgopi@27", "SetegukEspresso+28", "JajanKenangan=29", "SehidupSehati!30",
  "KopiFavoritmu#31",
];
let activeMenuMode = "single";
let activeSortMode = "default";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function getBrandById(brandId) {
  return BRANDS.find((brand) => brand.id === brandId) || BRANDS[0];
}

function getActiveBrand() {
  return getBrandById(activeBrandId);
}

function getActiveCategories() {
  return getActiveBrand().categories || [];
}

function formatPickupClock(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function populatePickupSelect(select) {
  if (!select) return;
  const currentValue = select.value;
  // Tambahkan opsi "Sekarang" di paling atas
  select.innerHTML = '<option value="Sekarang">Sekarang (Segera)</option>' + 
                     '<option value="">-- Atau pilih jam --</option>';

  for (let minutes = PICKUP_START_MINUTES; minutes <= PICKUP_END_MINUTES; minutes += PICKUP_INTERVAL_MINUTES) {
    const label = formatPickupClock(minutes);
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    select.appendChild(option);
  }
  // ... (tetap simpan value sebelumnya jika ada)
}

function populatePickupTimeOptions() {
  document.querySelectorAll('select[name="pickupTime"]').forEach(populatePickupSelect);
}

function getTodayWifiPassword() {
  const day = Math.min(new Date().getDate(), 31);
  return WIFI_PASSWORDS[day - 1] || WIFI_PASSWORDS[30];
}

function renderWifiPassword() {
  const today = Math.min(new Date().getDate(), 31);
  if (wifiPasswordText) wifiPasswordText.textContent = getTodayWifiPassword();
  if (wifiDateLabel) wifiDateLabel.textContent = String(today).padStart(2, "0");
}

function renderWifiDetailPanel() {
  if (!wifiDetailPanel) return;
  const today = Math.min(new Date().getDate(), 31);
  wifiDetailPanel.innerHTML = `
    <div class="wifi-detail-title">Semua Password WiFi per tanggal</div>
    <div class="wifi-password-grid">
      ${WIFI_PASSWORDS.map((password, index) => {
        const day = index + 1;
        const isToday = day === today;
        return `<button class="wifi-password-item ${isToday ? "active" : ""}" type="button" data-wifi-password="${escapeHtml(password)}">
          <span>${String(day).padStart(2, "0")}</span>
          <strong>${escapeHtml(password)}</strong>
        </button>`;
      }).join("")}
    </div>`;
}

function toggleWifiDetail() {
  if (!wifiDetailPanel) return;
  const shouldOpen = wifiDetailPanel.hidden;
  if (shouldOpen && !wifiDetailPanel.innerHTML.trim()) renderWifiDetailPanel();
  wifiDetailPanel.hidden = !shouldOpen;
  if (wifiPasswordBar) wifiPasswordBar.setAttribute("aria-expanded", String(shouldOpen));
  if (wifiChevron) wifiChevron.classList.toggle("open", shouldOpen);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.cssText = "position:fixed;left:-999px;top:0;opacity:0;";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

async function copyWifiPassword(password = getTodayWifiPassword()) {
  try {
    await copyTextToClipboard(password);
    if (copyWifiButton) {
      copyWifiButton.textContent = "Tersalin";
      setTimeout(() => { copyWifiButton.textContent = "Salin"; }, 1400);
    }
  } catch (error) {
    alert(`Password WiFi: ${password}`);
  }
}

function syncOutletPanelVisibility() {
  if (!outletPanel) return;
  const shouldShowOutletPanel = activeBrandId === "kopi-kenangan";
  const outletName = selectedOutletName ? selectedOutletName.textContent.trim() : "";
  const hasSelectedOutlet = outletName && outletName !== "Belum dipilih";
  const addressFields = [
    document.getElementById("customerAddress"),
    document.getElementById("modalCustomerAddress"),
  ];

  outletPanel.hidden = !shouldShowOutletPanel;
  if (!shouldShowOutletPanel) {
    const outletResults = document.getElementById("outletResults");
    if (outletResults) outletResults.hidden = true;
    if (wifiDetailPanel) wifiDetailPanel.hidden = true;
    if (wifiPasswordBar) wifiPasswordBar.setAttribute("aria-expanded", "false");
    if (wifiChevron) wifiChevron.classList.remove("open");
    addressFields.forEach((field) => {
      if (field && hasSelectedOutlet && field.value.trim() === outletName) field.value = "";
    });
    return;
  }

  addressFields.forEach((field) => {
    if (field && hasSelectedOutlet && !field.value.trim()) field.value = outletName;
  });
  renderWifiPassword();
}

function updateBrandHero() {
  const activeBrand = getActiveBrand();
  if (brandTitle) brandTitle.textContent = activeBrand.label;
  if (brandSubtitle) brandSubtitle.textContent = activeBrand.description;
  if (brandSummary) {
    brandSummary.innerHTML = `<strong>${escapeHtml(activeBrand.label)}</strong> · ${escapeHtml(activeBrand.description)}`;
  }
}

function getActiveMenuItems() {
  return menuItems.filter((item) => item.brand === activeBrandId);
}

function getKopiKenanganOutletState() {
  return window.kopiKenanganOutletState || {
    selected: false,
    menuLoaded: false,
    menuLoading: false,
    outletName: "",
  };
}

function shouldGateKopiKenanganMenu() {
  const outletState = getKopiKenanganOutletState();
  return activeBrandId === "kopi-kenangan" && !outletState.menuLoaded;
}

function getKopiKenanganGateMessage() {
  const outletState = getKopiKenanganOutletState();
  if (outletState.menuLoading) {
    return {
      title: "Sedang memuat menu outlet...",
      body: "Tunggu sebentar, menu Kopi Kenangan sedang diambil dari API outlet yang dipilih.",
      status: "Sedang memuat menu outlet.",
    };
  }
  if (outletState.selected) {
    return {
      title: "Menu outlet belum tersedia",
      body: "Coba pilih outlet ulang dari hasil pencarian supaya menu Kopi Kenangan dimuat dari API.",
      status: "Menu outlet belum siap. Pilih outlet ulang untuk memuat menu.",
    };
  }
  return {
    title: "Pilih outlet dulu",
    body: "Menu Kopi Kenangan akan tampil setelah kamu memilih outlet dari hasil pencarian. Menu lokal bawaan disembunyikan agar hanya menu API outlet yang dipakai.",
    status: "Pilih outlet Kopi Kenangan untuk melihat menu API outlet.",
  };
}

function renderBrandTabs() {
  if (!brandTabs) return;
  const visibleBrands = BRANDS.filter((brand) => !brand.hidden);
  if (visibleBrands.length === 0) {
    brandTabs.innerHTML = "";
    return;
  }
  if (!visibleBrands.some((brand) => brand.id === activeBrandId)) {
    activeBrandId = visibleBrands[0].id;
  }
  brandTabs.innerHTML = visibleBrands.map((brand) => {
    const isActive = brand.id === activeBrandId;
    return `<button class="brand-tab ${isActive ? "active" : ""}" type="button" data-brand="${brand.id}" style="--brand-accent: ${brand.accent}">
      <strong>${escapeHtml(brand.shortLabel)}</strong>
      <span>${escapeHtml(brand.description)}</span>
    </button>`;
  }).join("");
  updatePromoLabelVisibility();
}

function getCartBrandId() {
  const firstItem = cart.values().next().value;
  return firstItem ? firstItem.brand : "";
}

function getCartBrandName() {
  const brandId = getCartBrandId();
  return brandId ? getBrandById(brandId).label : "";
}

function canAddBrandToCart(item, shouldAlert = true) {
  const cartBrandId = getCartBrandId();
  if (!cartBrandId || cartBrandId === item.brand) return true;
  if (shouldAlert) {
    alert("Maaf, pesanan dari brand berbeda tidak bisa digabung. Selesaikan pesanan sebelumnya atau kosongkan keranjang terlebih dahulu.");
  }
  return false;
}

function getMenuPriceValue(item, ...keys) {
  for (const key of keys) {
    const value = Number(item[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function getKenanganOptionGroups(item) {
  const activeLargeBlock = getActiveSizeBlock(item, "Large")
  const regularPrice = getMenuPriceValue(item, "price") || 0;
  const largePrice = getMenuPriceValue(item, "largePrice", "largeprice", "large_price");
  const sizeOptions = [];

  if (!item.noRegular) {
    sizeOptions.push({ value: "Regular", label: "Regular", price: regularPrice });
  }
  if (largePrice && !activeLargeBlock) {
    sizeOptions.push({ value: "Large", label: "Large", price: largePrice });
  }

  const groups = [
    {
      key: "temperature",
      label: "Temperature",
      options: item.noHot
        ? [{ value: "Ice", label: "Ice", icon: "ice" }]
        : [
            { value: "Ice", label: "Ice", icon: "ice" },
            { value: "Hot", label: "Hot", icon: "hot" },
          ],
    },
  ];

  if (sizeOptions.length > 1 || item.noRegular) {
    groups.push({ key: "size", label: "Size", options: sizeOptions });
  }

  if (item.allowBeans) {
    groups.push({
      key: "beans",
      label: "Biji Kopi (Beans)",
      options: [
        { value: "Kenangan Blend", label: "Kenangan Blend" },
        { value: "Juwara Beans", label: "Juwara Beans", priceDelta: 3000 },
      ],
    });
  }

  if (item.allowOatside) {
    groups.push({
      key: "milk",
      label: "Pilihan Susu (Milk)",
      options: [
        { value: "Milk", label: "Fresh Milk" },
        { value: "Oatside", label: "Oatside", priceDelta: 3000 },
      ],
    });
  }

  groups.push({
    key: "sugar",
    label: "Sugar Level",
    options: item.noSugar
      ? [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" },
        ]
      : [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" },
          { value: "No Sugar", label: "No Sugar" },
        ],
  });

  groups.push({
    key: "ice",
    label: "Ice Level",
    hiddenValue: "No Ice",
    dependsOn: { key: "temperature", value: "Ice" },
    options: item.onlyNormalIce 
      ? [
          { value: "Normal Ice", label: "Normal Ice" }
        ]
      : [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" },
        ],
  });

  // 👇 KOTAK 1: KHUSUS TOPPING (+6000) 👇
  groups.push({
    key: "topping",
    label: "Topping",
    options: [
      { value: "Tanpa Topping", label: "Tanpa Topping" },
      { value: "Espresso Shot Kenangan Blend", label: "Espresso Shot Kenangan Blend", priceDelta: 6000 },
      { value: "Espresso Shot Juwara Beans", label: "Espresso Shot Juwara Beans", priceDelta: 6000 },
      { value: "Golden Boba", label: "Golden Boba", priceDelta: 6000 },
      { value: "Grass Jelly", label: "Grass Jelly", priceDelta: 6000 },
      { value: "Oreo", label: "Oreo", priceDelta: 6000 },
      { value: "Whipped Cream Chocolate", label: "Whipped Cream Chocolate", priceDelta: 6000 },
      { value: "Whipped Cream Vanilla", label: "Whipped Cream Vanilla", priceDelta: 6000 },
      { value: "Caramel Crumble", label: "Caramel Crumble", priceDelta: 6000 },
      { value: "Gula Aren", label: "Gula Aren", priceDelta: 6000 }
    ],
  });

  // 👇 KOTAK 2: KHUSUS ADD ON (+6000) 👇
  groups.push({
    key: "addon",
    label: "Add On",
    options: [
      { value: "Tanpa Add On", label: "Tanpa Add On" },
      { value: "Vanilla Syrup", label: "Vanilla Syrup", priceDelta: 6000 },
      { value: "Hazelnut Syrup", label: "Hazelnut Syrup", priceDelta: 6000 },
      { value: "Caramel Syrup", label: "Caramel Syrup", priceDelta: 6000 },
      { value: "Salted Caramel Sauce", label: "Salted Caramel Sauce", priceDelta: 6000 },
      { value: "Choco Sauce", label: "Choco Sauce", priceDelta: 6000 },
      { value: "Butterscotch Sauce", label: "Butterscotch Sauce", priceDelta: 6000 }
    ],
  });

  return groups;
} 

function cloneOptionGroups(groups) {
  return (groups || []).map((group) => ({
    ...group,
    options: (group.options || []).map((option) => ({ ...option })),
  }));
}

function getItemOptionGroups(item) {
  // Pastikan menu makanan langsung masuk keranjang, tapi Bundle tetap memunculkan pop-up
  if (isFoodItem(item)) return [];

  // Jika di menu-data.js kita memasukkan kustomisasi "options" pada bundle, gunakan itu!
  const itemOptions = Array.isArray(item.options) ? cloneOptionGroups(item.options) : null;
  if (itemOptions) return itemOptions;

  // Jika tidak ada options khusus, gunakan settingan bawaan brand
  const baseOptions = item.brand === "kopi-kenangan"
    ? getKenanganOptionGroups(item)
    : cloneOptionGroups(getBrandById(item.brand).defaultOptions);
    
  const addOns = Array.isArray(item.addOns) ? cloneOptionGroups(item.addOns) : [];
  return [...baseOptions, ...addOns].filter((group) => group.options && group.options.length);
}

function shouldShowOptionGroup(group) {
  if (!group.dependsOn) return true;
  return selectedOptions[group.dependsOn.key] === group.dependsOn.value;
}

function ensureSelectedOptions(item) {
  const groups = getItemOptionGroups(item);
  groups.forEach((group) => {
    const hasSelectedOption = group.options.some((option) => option.value === selectedOptions[group.key]);
    if (!hasSelectedOption && group.options[0]) {
      selectedOptions[group.key] = group.options[0].value;
    }
  });
  groups.forEach((group) => {
    if (!shouldShowOptionGroup(group)) {
      if (group.hiddenValue) selectedOptions[group.key] = group.hiddenValue;
      else delete selectedOptions[group.key];
    }
  });
}

function getVisibleOptionGroups(item) {
  ensureSelectedOptions(item);
  return getItemOptionGroups(item).filter(shouldShowOptionGroup);
}

function getOptionPriceText(option, item) {
  if (option.priceDelta) return `+${rupiah.format(option.priceDelta)}`;
  if (option.price && option.price !== item.price) return rupiah.format(option.price);
  return "";
}

function optionIconHtml(option) {
  if (option.icon === "ice") return '<span class="option-cup ice-cup"></span>';
  if (option.icon === "hot") return '<span class="option-cup hot-cup"></span>';
  return "";
}

function renderDynamicOptions(item) {
  const groups = getVisibleOptionGroups(item);
  modalOptions.hidden = groups.length === 0;
  if (!groups.length) {
    modalOptions.innerHTML = "";
    return;
  }

  modalOptions.innerHTML = groups.map((group) => {
    const gridClass = group.options.length <= 1 ? "one" : group.options.length === 2 ? "two" : "three";
    return `<div class="option-group" data-option-group="${escapeHtml(group.key)}">
      <div class="option-heading">
        <strong>${escapeHtml(group.label)}</strong>
        <span>Select 1</span>
      </div>
      <div class="option-grid ${gridClass}">
        ${group.options.map((option) => {
          const isSelected = selectedOptions[group.key] === option.value;
          const priceText = getOptionPriceText(option, item);
          return `<button class="option-card ${isSelected ? "selected" : ""}" type="button" data-option-group="${escapeHtml(group.key)}" data-option-value="${escapeHtml(option.value)}">
            ${optionIconHtml(option)}
            <strong>${escapeHtml(option.label || option.value)}</strong>
            ${priceText ? `<span class="option-price">${escapeHtml(priceText)}</span>` : ""}
          </button>`;
        }).join("")}
      </div>
    </div>`;
  }).join("");

  syncIceOptions();
}

function getCleanSelectedOptions(item) {
  const visibleGroups = getVisibleOptionGroups(item);
  return visibleGroups.reduce((result, group) => {
    if (selectedOptions[group.key]) result[group.key] = selectedOptions[group.key];
    return result;
  }, {});
}

function formatOptionKey(key) {
  return String(key).replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function menuVisual(item) {
  // KHUSUS UNTUK MENU BUNDLE (KOLASE FOTO)
  if (item.bundleImages && item.bundleImages.length > 0) {
    const collageClass = `items-${item.bundleImages.length}`;
    return `<div class="photo-frame bundle-collage ${collageClass}">
      ${item.bundleImages.map(img => `<img src="assets/menu/${img}" alt="Bundle Item" loading="lazy" />`).join('')}
    </div>`;
  }
  
  // UNTUK MENU SATUAN BIASA
  if (item.image) {
    return `<div class="photo-frame ${item.kind || "drink"}" data-fallback="Foto belum tersedia"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.parentElement.classList.add('no-image'); this.remove();" /></div>`;
  }
  
  // UNTUK MENU YANG TIDAK ADA FOTONYA (MENGGUNAKAN GAMBAR CSS)
  const style = `--cup-color: ${item.color || "#a84e1e"}; --foam-color: ${item.foam || "#fff2df"}; --drizzle-color: ${item.drizzle || "#ffffff"}`;
  const kind = item.kind || "drink";
  return `<div class="menu-visual ${kind}" style="${style}" aria-hidden="true"><i></i><i></i><i></i><b></b><span class="foam"></span><span class="drizzle"></span><span class="heart"></span></div>`;
}

// Ganti fungsi menuCard lama dengan ini:
function menuCard(item) {
  // Pengecekan status toko sekarang MENGGUNAKAN brand item tersebut
  const store = checkStoreStatus(item.brand);
  
  let currentlySoldOut = item.isSoldOut === true || store.closed;
  let unlockMessage = "";

  if (store.closed) {
    unlockMessage = `<span class="unlock-time">TOKO TUTUP</span>`;
  } else if (item.soldOutUntil) {
    const unlockTime = new Date(item.soldOutUntil).getTime();
    const now = new Date().getTime();
    if (now < unlockTime) {
      currentlySoldOut = true;
      const timeObj = new Date(unlockTime);
      const jam = timeObj.getHours().toString().padStart(2, '0');
      const menit = timeObj.getMinutes().toString().padStart(2, '0');
      unlockMessage = `<span class="unlock-time">Buka jam ${jam}:${menit}</span>`;
    }
  }

  const soldOutClass = currentlySoldOut ? "sold-out" : "";
  const bestSellerClass = item.isBestSeller ? "best-seller" : "";
  const brandClass = item.brand ? `brand-${item.brand}` : "";
  const itemBrand = getBrandById(item.brand);
  const sizeBlockNotes = getActiveSizeBlockNotes(item);
  const sizeBlockHtml = sizeBlockNotes.length ? `<span class="sale-note">${sizeBlockNotes.join(" · ")}</span>` : "";
  
  const buttonText = store.closed ? "Tutup" : (currentlySoldOut ? "Habis" : "Tambah");
  const buttonHtml = currentlySoldOut 
    ? `<button class="add-button" type="button" disabled>${buttonText}</button>`
    : `<button class="add-button" type="button" data-id="${item.id}">Tambah</button>`;

return `<article class="menu-card ${item.isNew ? "new" : ""} ${bestSellerClass} ${soldOutClass} ${brandClass}" data-menu-id="${escapeHtml(item.id)}">
    ${menuVisual(item)}
    ${unlockMessage}
    <span class="menu-brand" style="--brand-accent: ${itemBrand.accent}">${escapeHtml(itemBrand.shortLabel)}</span>
    
    <!-- 👇 BUNGKUSAN FINAL (MENGHANCURKAN KUNCIAN TINGGI H3) 👇 -->
    <div style="margin-bottom: auto; display: flex; flex-direction: column; gap: 4px; align-items: center; width: 100%;">
      <h3 style="margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; line-height: 1.2 !important;">${escapeHtml(item.name)}</h3>
      ${item.desc ? `<span style="color: #777; font-size: 0.75rem; font-weight: 600; line-height: 1.3; text-align: center; max-width: 95%; margin: 0 !important;">${escapeHtml(item.desc)}</span>` : ""}
    </div>
    <!-- 👆 SAMPAI SINI 👆 -->
    
    ${item.oldPrice ? `<span class="old-price">${rupiah.format(item.oldPrice)}</span>` : ""}
    <span class="price">${rupiah.format(item.price)}</span>
    ${sizeBlockHtml}
    ${buttonHtml}
  </article>`;
}

function normalizeText(value) { return String(value).toLowerCase().trim(); }

function getItemGroups(item) {
  return Array.isArray(item.group) ? item.group : [item.group].filter(Boolean);
}

function isPromoItem(item) {
  return getItemGroups(item).some((group) => String(group).toLowerCase().includes("promo")) || Boolean(item.bundleImages?.length);
}

function getModeItems(items) {
  const hasPromo = items.some(isPromoItem);
  if (activeMenuMode === "bundle" && hasPromo) return items.filter(isPromoItem);
  if (activeMenuMode === "single" && hasPromo) return items.filter((item) => !isPromoItem(item));
  return items;
}

function sortMenuItems(items) {
  const sorted = [...items];
  if (activeSortMode === "price-asc") {
    return sorted.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
  }
  if (activeSortMode === "price-desc") {
    return sorted.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
  }
  return sorted.sort((a, b) => (b.isBestSeller === true ? 1 : 0) - (a.isBestSeller === true ? 1 : 0));
}

function syncMenuControls(activeItems) {
  const hasPromo = activeItems.some(isPromoItem);
  if (activeMenuMode === "bundle" && !hasPromo) activeMenuMode = "single";

  if (menuModeTabs) {
    menuModeTabs.querySelectorAll("[data-menu-mode]").forEach((button) => {
      const isActive = button.dataset.menuMode === activeMenuMode;
      button.classList.toggle("active", isActive);
      if (button.dataset.menuMode === "bundle") button.disabled = !hasPromo;
    });
  }

  if (!bundleTabs) return;
  const activeBrand = getActiveBrand();
  const promoCategories = (activeBrand.categories || []).filter((category) => {
    return activeItems.some((item) => isPromoItem(item) && getItemGroups(item).includes(category.id));
  });
  bundleTabs.hidden = activeMenuMode !== "bundle" || promoCategories.length === 0;
  bundleTabs.innerHTML = promoCategories
    .map((category) => `<a href="#${category.id}">${escapeHtml(category.title)}</a>`)
    .join("");
}

// FITUR PENYIMPANAN KERANJANG (ANTI-REFRESH)
function saveCartToStorage() {
  localStorage.setItem('kopiFachrindahCart', JSON.stringify(Array.from(cart.entries())));
}

function loadCartFromStorage() {
  const saved = localStorage.getItem('kopiFachrindahCart');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      parsed.forEach(([k, v]) => cart.set(k, v));
      renderCart();
    } catch(e) {}
  }
}

// Tambahkan pemanggilan saveCartToStorage() ke dalam aksi keranjang
const originalAddItem = addItem;
addItem = function(...args) { originalAddItem(...args); saveCartToStorage(); };

const originalUpdateQuantity = updateQuantity;
updateQuantity = function(cartKey, direction) { originalUpdateQuantity(cartKey, direction); saveCartToStorage(); };

clearCartButton.addEventListener("click", () => { cart.clear(); saveCartToStorage(); renderCart(); });

// FITUR POP-UP INFORMASI DI AWAL (LANGSUNG JALAN)
// ==========================================
(function showWelcomePopup() {
  // Panggil fungsi auto-save keranjang & biodata (jika ada)
  if (typeof loadCartFromStorage === "function") loadCartFromStorage();
  if (typeof loadBiodataFromStorage === "function") loadBiodataFromStorage();

  // Cek apakah pop-up sudah pernah muncul di sesi ini
  if (!sessionStorage.getItem('welcomePopUpShown')) {
    const welcomeHtml = `
      <div id="welcomeModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 99999;">
        <div class="info-content" style="background: #fff; padding: 24px; border-radius: 12px; max-width: 90%; width: 400px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: popUpAnim 0.3s ease-out;">
          <h2 style="color: #d94b3d; margin-bottom: 15px; margin-top: 0;">📢 Info Pemesanan</h2>
          <div style="text-align: left; margin-bottom: 20px; font-size: 0.95rem; color: #444; line-height: 1.5;">
<p style="margin-bottom: 12px;"><strong>☕ Kopi Kenangan:</strong><br>Pesan 1 item tetap bisa, namun dikenakan biaya layanan Rp2.000. Hemat biaya dengan pesan 2 item atau lebih.</p>
  <p style="margin: 0;"><strong>🍃 Fore Coffee:</strong><br>Tidak ada biaya layanan tambahan (Bebas pesan 1 item saja).</p>
</div>
          <button id="closeWelcomeBtn" class="send-button" style="width: 100%; border-radius: 999px;">Saya Mengerti</button>
        </div>
      </div>
    `;
    
    // Paksa masukkan pop-up ke dalam HTML saat ini juga
    document.body.insertAdjacentHTML('beforeend', welcomeHtml);
    
    // Beri fungsi klik untuk menutup pop-up
    const closeBtn = document.getElementById('closeWelcomeBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const modal = document.getElementById('welcomeModal');
        if (modal) modal.remove();
      });
    }
    
    // Tandai bahwa pop-up sudah pernah dilihat
    sessionStorage.setItem('welcomePopUpShown', 'true');
  }
})();

function renderMenuLegacy(query = "") {
  renderBrandTabs();
  updateBrandHero();
  const store = checkStoreStatus();
  const bannerHtml = store.closed ? `<div class="store-closed-banner"><strong>TOKO SEDANG TUTUP</strong><p>${store.message}</p></div>` : "";
  const normalizedQuery = normalizeText(query);
  const activeBrand = getActiveBrand();
  const activeCategories = getActiveCategories();
  const activeItems = getActiveMenuItems();
  
  // 1. Tambahkan menu "Best Seller" di awal navigasi kategori
  categoryNav.innerHTML = `<a href="#best-seller">🔥 Best Seller</a>` + 
                          activeCategories.map((category) => `<a href="#${category.id}">${escapeHtml(category.title)}</a>`).join("");

  let htmlOutput = bannerHtml;
  let foundItems = new Set(); 

  // 2. Buat bagian khusus Best Seller di paling atas
  const bestSellers = activeItems.filter((item) => {
    if (!item.isBestSeller) return false;
    if (!normalizedQuery) return true;
    return normalizeText(item.name).includes(normalizedQuery);
  });

  if (bestSellers.length > 0) {
    bestSellers.forEach(item => foundItems.add(item.id));
    htmlOutput += `
    <section class="catalog-section" id="best-seller">
      <h2>🔥 Best Seller</h2>
      <div class="menu-grid">${bestSellers.map(menuCard).join("")}</div>
    </section>`;
  }

  // 3. Render kategori lain di bawahnya dengan logika Group Ganda (Array)
  htmlOutput += activeCategories.map((category) => {
    const categoryMatches = normalizeText(category.title).includes(normalizedQuery);
    
    const items = activeItems.filter((item) => {
      // LOGIKA BARU: Cek apakah item.group adalah array ATAU string tunggal
      const itemGroups = Array.isArray(item.group) ? item.group : [item.group];
      
      // Jika kategori tidak ada dalam daftar group item, skip
      if (!itemGroups.includes(category.id)) return false;
      
      // Filter pencarian
      if (!normalizedQuery) return true;
      return categoryMatches || normalizeText(item.name).includes(normalizedQuery);
    });

    // Urutkan item: yang Best Seller ditaruh di depan pada masing-masing kategori
    items.sort((a, b) => (b.isBestSeller === true ? 1 : 0) - (a.isBestSeller === true ? 1 : 0));

    if (items.length === 0) return "";
    items.forEach(item => foundItems.add(item.id));
    
    return `<section class="catalog-section" id="${category.id}">
      <h2>${escapeHtml(category.title)}</h2>
      <div class="menu-grid">${items.map(menuCard).join("")}</div>
    </section>`;
  }).join("");

  catalogContainer.innerHTML = htmlOutput;

  // 4. Update status teks pencarian
  if (normalizedQuery && foundItems.size === 0) {
    catalogContainer.innerHTML = '<p class="no-results">Menu tidak ditemukan. Coba kata lain.</p>';
  }
  
  searchStatus.textContent = normalizedQuery ? 
    `${foundItems.size} menu ${activeBrand.shortLabel} ditemukan untuk "${query}".` : 
    `${activeItems.length} menu ${activeBrand.shortLabel} tersedia.`;
}

function renderMenu(query = "") {
  renderBrandTabs();
  updateBrandHero();
  syncOutletPanelVisibility();

  const store = checkStoreStatus(activeBrandId);
  const bannerHtml = store.closed
    ? `<div class="store-closed-banner"><strong>TOKO SEDANG TUTUP</strong><p>${store.message}</p></div>`
    : "";
  const normalizedQuery = normalizeText(query);
  const activeBrand = getActiveBrand();
  const activeCategories = getActiveCategories();
  const activeItems = getActiveMenuItems();

  if (shouldGateKopiKenanganMenu()) {
    const gateMessage = getKopiKenanganGateMessage();
    syncMenuControls([]);
    if (bundleTabs) {
      bundleTabs.hidden = true;
      bundleTabs.innerHTML = "";
    }
    categoryNav.innerHTML = "";
    catalogContainer.innerHTML = `${bannerHtml}
      <div class="no-results outlet-required-message">
        <strong>${escapeHtml(gateMessage.title)}</strong>
        <span>${escapeHtml(gateMessage.body)}</span>
      </div>`;
    searchStatus.textContent = gateMessage.status;
    return;
  }

  syncMenuControls(activeItems);
  const modeItems = getModeItems(activeItems);
  const visibleCategories = activeCategories.filter((category) => {
    return modeItems.some((item) => getItemGroups(item).includes(category.id));
  });

  categoryNav.innerHTML = [
    `<a href="#best-seller">Best Seller</a>`,
    ...visibleCategories.map((category) => `<a href="#${category.id}">${escapeHtml(category.title)}</a>`),
  ].join("");

  let htmlOutput = bannerHtml;
  const foundItems = new Set();

  const bestSellers = sortMenuItems(modeItems.filter((item) => {
    if (!item.isBestSeller) return false;
    if (!normalizedQuery) return true;
    return normalizeText(item.name).includes(normalizedQuery);
  }));

  if (bestSellers.length > 0) {
    bestSellers.forEach((item) => foundItems.add(item.id));
    htmlOutput += `
    <section class="catalog-section" id="best-seller">
      <h2>Best Seller</h2>
      <div class="menu-grid">${bestSellers.map(menuCard).join("")}</div>
    </section>`;
  }

  htmlOutput += visibleCategories.map((category) => {
    const categoryMatches = normalizeText(category.title).includes(normalizedQuery);
    const items = sortMenuItems(modeItems.filter((item) => {
      if (!getItemGroups(item).includes(category.id)) return false;
      if (!normalizedQuery) return true;
      return categoryMatches || normalizeText(item.name).includes(normalizedQuery);
    }));

    if (items.length === 0) return "";
    items.forEach((item) => foundItems.add(item.id));

    return `<section class="catalog-section" id="${category.id}">
      <h2>${escapeHtml(category.title)}</h2>
      <div class="menu-grid">${items.map(menuCard).join("")}</div>
    </section>`;
  }).join("");

  if (normalizedQuery && foundItems.size === 0) {
    htmlOutput = '<p class="no-results">Menu tidak ditemukan. Coba kata lain.</p>';
  }

  catalogContainer.innerHTML = htmlOutput;
  searchStatus.textContent = normalizedQuery
    ? `${foundItems.size} menu ${activeBrand.shortLabel} ditemukan untuk "${query}".`
    : `${modeItems.length} menu ${activeBrand.shortLabel} tersedia.`;
}

function renderCart() {
  const entries = [...cart.values()];
  const subtotal = entries.reduce((total, item) => total + item.price * item.qty, 0);
  const serviceFee = getServiceFee();
  const grandTotal = subtotal + serviceFee;

  let targetCartHtml = entries.length === 0
    ? '<p class="empty">Pilih menu dari price list untuk mulai order.</p>'
    : entries.map((item) => {
        const optionsText = formatOptions(item.options);
        const itemNoteText = item.note ? `<small class="cart-item-note">Catatan: ${escapeHtml(item.note)}</small>` : "";
        const safeCartKey = encodeURIComponent(item.cartKey);
        return `<div class="cart-line"><div><h3>${item.name}</h3><span>${rupiah.format(item.price)} x ${item.qty}</span>${optionsText ? `<small class="cart-options">${optionsText}</small>` : ""}${itemNoteText}</div><div class="quantity"><button class="qty-button" type="button" data-action="decrease" data-id="${safeCartKey}">-</button><strong>${item.qty}</strong><button class="qty-button" type="button" data-action="increase" data-id="${safeCartKey}">+</button></div></div>`;
      }).join("");

  // Tambahkan baris biaya layanan ke dalam modal jika ada
  if (serviceFee > 0) {
    targetCartHtml += `<div class="cart-line" style="border-top: 1px dashed #ccc; margin-top: 10px; padding-top: 10px;">
      <div><strong>Biaya Layanan (Order < 2)</strong></div>
      <div><strong>${rupiah.format(serviceFee)}</strong></div>
    </div>`;
  }

  if (modalCartItems) modalCartItems.innerHTML = targetCartHtml;
  if (mainCartItems) mainCartItems.innerHTML = targetCartHtml;

  subtotalEl.textContent = rupiah.format(subtotal);
  grandTotalEl.textContent = rupiah.format(grandTotal); // Gunakan grandTotal
  
  const totalQty = entries.reduce((total, item) => total + item.qty, 0);
  openCartButton.hidden = totalQty === 0;
  document.body.classList.toggle("cart-has-items", totalQty > 0);
  openCartCount.textContent = `${totalQty} menu`;
  openCartTotal.textContent = rupiah.format(grandTotal);
  if (headerCartCount) headerCartCount.textContent = String(totalQty);
  renderCheckoutSummary(entries, subtotal, serviceFee, grandTotal);
}

function renderCheckoutSummary(entries, subtotal, serviceFee, grandTotal) {
  if (!checkoutSummary) return;
  if (entries.length === 0) {
    checkoutSummary.innerHTML = '<p class="empty">Keranjang masih kosong.</p>';
    return;
  }
  let html = `<div class="checkout-lines">${entries.map((item) => {
    const itemNoteText = item.note ? `<small>Catatan: ${escapeHtml(item.note)}</small>` : "";
    return `<div><span>${item.name} x${item.qty}</span><strong>${rupiah.format(item.price * item.qty)}</strong>${itemNoteText}</div>`;
  }).join("")}</div>`;

  if (serviceFee > 0) {
    html += `<div><span>Biaya Layanan</span><strong>${rupiah.format(serviceFee)}</strong></div>`;
  }

  html += `<div class="checkout-total"><span>Total bayar</span><strong>${rupiah.format(grandTotal)}</strong></div>`;
  checkoutSummary.innerHTML = html;
}

function formatOptions(options) {
  if (!options || Object.keys(options).length === 0) return "";
  return Object.entries(options)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${formatOptionKey(key)}: ${value}`)
    .join(" / ");
}

function getSupabaseConfig() { return window.KOPI_SUPABASE_CONFIG || {}; }
function isSupabaseConfigured() {
  const config = getSupabaseConfig();
  return Boolean(window.supabase && config.url && config.anonKey && !config.url.includes("ISI_SUPABASE"));
}
function getSupabaseClient() {
  if (!isSupabaseConfigured()) throw new Error("Supabase belum dikonfigurasi.");
  if (!supabaseClient) {
    const config = getSupabaseConfig();
    supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  }
  return supabaseClient;
}

function makeOrderId() { return `ORD-${new Date().toISOString().slice(0, 19).replace(/\D/g, "")}`; }
function normalizeFileName(fileName) {
  const ext = fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "jpg";
  return `bukti-transfer.${ext}`;
}

async function uploadPaymentProof(file, orderId) {
  const client = getSupabaseClient();
  const config = getSupabaseConfig();
  const filePath = `${orderId}/${Date.now()}-${normalizeFileName(file.name)}`;
  const { data, error } = await client.storage.from(config.paymentProofBucket).upload(filePath, file, { cacheControl: "3600", contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return client.storage.from(config.paymentProofBucket).getPublicUrl(data.path).data.publicUrl;
}

async function createOrderRecord(formData) {
  const entries = [...cart.values()];
  const subtotal = entries.reduce((total, item) => total + item.price * item.qty, 0);
  const proofFile = getPaymentProofFile();
  const orderId = makeOrderId();
  const proofUrl = await uploadPaymentProof(proofFile, orderId);

  return {
    id: orderId,
    customer: {
      name: String(formData.get("customerName")).trim(),
      phone: String(formData.get("customerPhone")).trim(),
      address: String(formData.get("customerAddress")).trim(),
      pickupTime: String(formData.get("pickupTime") || "").trim(),
    },
    note: "",
    items: entries.map(item => ({ brand: getBrandById(item.brand).label, name: item.name, price: item.price, qty: item.qty, options: item.options, note: item.note || "" })),
    subtotal,
    proof: { url: proofUrl, name: proofFile.name, type: proofFile.type, size: proofFile.size }
  };
}

async function saveOrderToSupabase(order) {
  const client = getSupabaseClient();
  const config = getSupabaseConfig();
  const payload = {
    id: order.id, customer_name: order.customer.name, customer_phone: order.customer.phone, customer_address: order.customer.address,
    note: order.note || null, items: order.items, subtotal: order.subtotal, payment_proof_name: order.proof.name,
    payment_proof_type: order.proof.type, payment_proof_size: order.proof.size, payment_proof_path: order.id, payment_proof_url: order.proof.url
  };
  const { error } = await client.from(config.ordersTable).insert(payload);
  if (error) throw error;
}

function isFoodItem(item) { 
  // Sekarang sistem akan mengenali makanan dari 'group' ATAU dari 'kind' nya
  return ["food", "chef-martin", "kenangan-toast", "fore-deli"].includes(item.group) || 
         ["food", "toast", "cookie"].includes(item.kind); 
}

function resetSelectedOptions(item) {
  selectedOptions = {};
  ensureSelectedOptions(item);
  renderDynamicOptions(item);
}

function openOrderModal() {
  orderModal.classList.add("open");
  orderModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeOrderModal() {
  orderModal.classList.remove("open");
  orderModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  pendingItemId = "";
}

function setModalStage(stage) {
  modalCustomize.hidden = stage !== "customize";
  modalCartStage.hidden = stage !== "cart";
  modalCheckoutStage.hidden = stage !== "checkout";
}

function calculateItemPrice(item, options) {
  let price = item.price; 
  getItemOptionGroups(item).forEach((group) => {
    const selectedValue = options[group.key];
    const selectedOption = group.options.find((option) => option.value === selectedValue);
    if (!selectedOption) return;
    if (typeof selectedOption.price === "number") price = selectedOption.price;
    if (typeof selectedOption.priceDelta === "number") price += selectedOption.priceDelta;
  });
  return price;
}

function updateModalLivePrice(item) {
  const calculatedPrice = calculateItemPrice(item, selectedOptions);
  const priceEl = document.getElementById("modalItemPrice");
  if (priceEl) {
    priceEl.textContent = rupiah.format(calculatedPrice);
  }
}

function syncIceOptions() {
  const iceGroup = document.querySelector('[data-option-group="ice"]');
  if (!iceGroup) return;
  const iceButtons = iceGroup.querySelectorAll("[data-option-value]");
  
  if (selectedOptions.temperature === "Hot") {
    selectedOptions.ice = "No Ice";
    iceGroup.style.display = "none"; 
    iceButtons.forEach(btn => {
      btn.classList.toggle("selected", btn.dataset.optionValue === "No Ice");
    });
  } else {
    iceGroup.style.display = "block"; 
    iceButtons.forEach(btn => btn.disabled = false);
  }
}

function selectItemForOptions(id) {
  const item = menuItems.find((menuItem) => menuItem.id === id);
  if (!item) return;

  if (!canAddBrandToCart(item)) return;

  pendingItemId = id;
  resetSelectedOptions(item);
  if (itemNoteInput) itemNoteInput.value = "";

  const isFood = isFoodItem(item);
  const isBundle = item.group && item.group.includes("promo");
  const itemBrand = getBrandById(item.brand);

  modalTitle.textContent = item.name;
  addConfiguredItemButton.disabled = false;
  selectedDrink.innerHTML = `
    <span>${escapeHtml(itemBrand.label)}</span>
    <strong id="modalProductTitleName">${escapeHtml(item.name)}</strong>
    <span id="modalItemPrice" style="font-size: 1.1rem; color: #d35c19; font-weight: 800; display: block; margin-top: 4px;">Rp0</span>
    <small>${isBundle ? "Tulis request paket ini di catatan item." : (isFood ? "Tambahkan catatan item jika perlu." : "Sesuaikan rasa dan catatan item kamu di bawah ini.")}</small>
  `;

  renderDynamicOptions(item);
  updateModalLivePrice(item);
  openOrderModal();
  setModalStage("customize");
}

function addItem(id, note = "") {
  const item = menuItems.find((menuItem) => menuItem.id === id);
  if (!item) return;
  if (!canAddBrandToCart(item)) return;

  const options = isFoodItem(item) ? {} : getCleanSelectedOptions(item);
  const itemNote = String(note || "").trim();
  const calculatedPrice = calculateItemPrice(item, options); // Kalkulasi ulang harga
  const cartKey = `${id}|${JSON.stringify(options)}|${itemNote}`;
  const current = cart.get(cartKey);

  cart.set(cartKey, {
    ...item,
    price: calculatedPrice, // Pakai harga hasil hitungan
    cartKey,
    options,
    note: itemNote,
    qty: current ? current.qty + 1 : 1
  });
  renderCart();
}

function updateQuantity(cartKey, direction) {
  const current = cart.get(cartKey);
  if (!current) return;
  const nextQty = direction === "increase" ? current.qty + 1 : current.qty - 1;
  if (nextQty <= 0) cart.delete(cartKey);
  else cart.set(cartKey, { ...current, qty: nextQty });
  renderCart();
}

// FUNGSI BARU: Khusus merapikan opsi di WhatsApp agar tidak menyamping
function formatOptionsForWA(options) {
  if (!options || Object.keys(options).length === 0) return "";
  const entries = Object.entries(options).filter(([, value]) => Boolean(value));
  if (entries.length === 0) return "";
  
  return entries.map(([key, value], index) => {
    const isLast = index === entries.length - 1;
    const prefix = isLast ? "└" : "├"; // Garis cabang agar mudah dibaca
    return `   ${prefix} ${formatOptionKey(key)}: ${value}`;
  }).join("\n");
}

function formatItemNoteForWA(note) {
  const cleanNote = String(note || "").trim();
  return cleanNote ? `\n   Catatan: ${cleanNote}` : "";
}

function buildWhatsappMessage(formData, savedOrder) {
  const entries = [...cart.values()];
  
  // 1. Hitung Subtotal Asli (Harga Resmi)
  const subtotalAsli = entries.reduce((total, item) => {
    const originalItem = menuItems.find(m => m.id === item.id);
    let basePrice = originalItem ? (originalItem.oldPrice || item.price) : item.price;
    if (item.options && item.options.size === "Large") basePrice += 5000;
    return total + (basePrice * item.qty);
  }, 0);
  
  const finalTotalBayar = entries.reduce((total, item) => total + (item.price * item.qty), 0);
  const brandName = getCartBrandName() || getActiveBrand().label;
  const isKopken = getCartBrandId() === 'kopi-kenangan';
  
  let orderLinesText = "";

  if (isKopken) {
    // Flatten item dengan menyertakan harga resmi (batchPrice)
    let flattenedItems = [];
    entries.forEach(item => {
      const originalItem = menuItems.find(m => m.id === item.id);
      let baseBatch = originalItem ? (originalItem.oldPrice || item.price) : item.price;
      if (item.options && item.options.size === "Large") baseBatch += 5000;
      
      for (let i = 0; i < item.qty; i++) {
        flattenedItems.push({ ...item, qty: 1, batchPrice: baseBatch });
      }
    });

    // Bucket berdasarkan batchPrice (Harga Resmi) agar tidak lebih dari 60rb
    let buckets = [];
    let bucketTotals = [];
    const MAX_BATCH_LIMIT = 60000; 

    for (let item of flattenedItems) {
      let added = false;
      for (let i = 0; i < buckets.length; i++) {
        // PERBAIKAN: Gunakan batchPrice (harga resmi) untuk cek limit
        if (bucketTotals[i] + item.batchPrice <= MAX_BATCH_LIMIT) {
          buckets[i].push(item);
          bucketTotals[i] += item.batchPrice;
          added = true;
          break;
        }
      }
      if (!added) {
        buckets.push([item]);
        bucketTotals.push(item.batchPrice);
      }
    }

    orderLinesText = buckets.map((bucket, index) => {
      let groupedBucket = [];
      bucket.forEach(bItem => {
        let existing = groupedBucket.find(g => g.cartKey === bItem.cartKey);
        if (existing) { existing.qty += 1; } 
        else { groupedBucket.push({ ...bItem, qty: 1 }); }
      });

      let lines = groupedBucket.map((item, i) => {
        const originalItem = menuItems.find((m) => m.id === item.id);
        const ops = item.options && Object.keys(item.options).length > 0 ? `\n${formatOptionsForWA(item.options)}` : "";
        const itemNote = formatItemNoteForWA(item.note);
        let baseResmi = originalItem ? (originalItem.oldPrice || item.price) : item.price;
        if (item.options && item.options.size === "Large") baseResmi += 5000;
        return `${i + 1}. *${item.qty}x ${item.name}* (~${rupiah.format(baseResmi)}~ *${rupiah.format(item.price)}*)${ops}${itemNote}`;
      }).join("\n\n");

      const totalAsliBatch = bucket.reduce((sum, it) => sum + it.batchPrice, 0);
      const totalBayarBatch = bucket.reduce((sum, it) => sum + it.price, 0);
      return `📦 *Order Batch ${index + 1}*\n${lines}\n\n_*Total Batch ${index + 1}: (~${rupiah.format(totalAsliBatch)}~ *${rupiah.format(totalBayarBatch)}*)*_`;
    }).join("\n\n-----------------------------------\n\n");
    
  } else {
    // Logika non-kopken tetap sama
    orderLinesText = entries.map((item, index) => {
      const originalItem = menuItems.find((m) => m.id === item.id);
      const ops = item.options && Object.keys(item.options).length > 0 ? `\n${formatOptionsForWA(item.options)}` : "";
      const itemNote = formatItemNoteForWA(item.note);
      let baseResmi = originalItem ? (originalItem.oldPrice || item.price) : item.price;
      if (item.options && item.options.size === "Large") baseResmi += 5000;
      return `${index + 1}. *${item.qty}x ${item.name}* (~${rupiah.format(baseResmi)}~ *${rupiah.format(item.price)}*)${ops}${itemNote}`;
    }).join("\n\n");
  }

  // ... (Sisa kode untuk messageLines tetap sama) ...
  const serviceFee = getServiceFee();
  const totalFinal = finalTotalBayar + serviceFee;
  const messageLines = [
    "Halo admin kopi.fachrindah, ada pesanan *JASDOR* baru! 🚀", "", `*ID Order:* ${savedOrder.id}`, `*Brand:* ${brandName}`, `*Nama:* ${formData.get("customerName")}`, `*Lokasi Outlet:* ${formData.get("customerAddress")}`, "", "🛒 *DAFTAR PESANAN:*", "===================================", orderLinesText, "===================================", `*Total Harga Asli Semua: ${rupiah.format(subtotalAsli)}*`, `*TOTAL BAYAR: ${rupiah.format(finalTotalBayar)}*`, "_Catatan: Jika harga outlet berbeda, mohon konfirmasi selisihnya terlebih dahulu._", "", `*Bukti Transfer:* ${savedOrder.proof.url}`
  ];
  messageLines.splice(6, 0, `*Jam Pickup:* ${formData.get("pickupTime") || "-"}`);
  if (serviceFee > 0) messageLines.push(`*Biaya Layanan: ${rupiah.format(serviceFee)}*`);
  messageLines.push(`*TOTAL BAYAR: ${rupiah.format(totalFinal)}*`);
  return messageLines.join("\n");
}

function buildWhatsappLinks(adminPhone, encodedMessage) {
  return { waMeUrl: `https://wa.me/${adminPhone}?text=${encodedMessage}`, appUrl: `whatsapp://send?phone=${adminPhone}&text=${encodedMessage}` };
}
function isAndroidDevice() { return /Android/i.test(navigator.userAgent); }
function getCartQuantity() { return [...cart.values()].reduce((total, item) => total + item.qty, 0); }
function getPaymentProofFile() { return paymentProofInput.files && paymentProofInput.files[0] ? paymentProofInput.files[0] : null; }

function updateProofPreview() {
  const file = getPaymentProofFile();
  if (!file) { proofPreview.innerHTML = "<span>Belum ada bukti dipilih</span>"; shareProofButton.disabled = true; return; }
  shareProofButton.disabled = false;
  if (file.type.startsWith("image/")) {
    proofPreviewUrl = URL.createObjectURL(file);
    proofPreview.innerHTML = `<img src="${proofPreviewUrl}" alt="Preview" /><span>${file.name}</span>`;
  } else { proofPreview.innerHTML = `<span>${file.name}</span>`; }
}

function starsFromRating(rating) { return "★".repeat(Number(rating)) + "☆".repeat(5 - Number(rating)); }
function renderSavedReview(review) {
  const article = document.createElement("article");
  article.innerHTML = `<div class="stars">${starsFromRating(review.rating)}</div><p>"${review.text}"</p><strong>${review.name}</strong>`;
  reviewsGrid.prepend(article);
}

function renderTestimonials() {
  if (!testimonialGallery) return;
  
  // 1. Ambil daftar gambarnya
  const images = Array.isArray(window.TESTIMONIAL_IMAGES) && window.TESTIMONIAL_IMAGES.length
    ? window.TESTIMONIAL_IMAGES
    : fallbackTestimonialImages;

  // 2. PUTAR BALIK URUTANNYA (Dari yang paling akhir ke awal)
  const reversedImages = [...images].reverse();

  testimonialGallery.dataset.source = images === fallbackTestimonialImages ? "fallback" : "manifest";
  testimonialGallery.dataset.count = String(images.length);
  
  // 3. Render menggunakan gambar yang sudah diputar balik
  testimonialGallery.innerHTML = reversedImages.map((src, index) => (
    `<div class="testimonial-wrapper">
      <img src="${src}" alt="Testimoni WhatsApp ${index + 1}" loading="lazy" />
    </div>`
  )).join("");
}

modalOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-option-value]");
  if (!button || button.disabled || !pendingItemId) return;

  const item = menuItems.find((menuItem) => menuItem.id === pendingItemId);
  if (!item) return;

  selectedOptions[button.dataset.optionGroup] = button.dataset.optionValue;
  renderDynamicOptions(item);
  updateModalLivePrice(item);
});

if (brandTabs) {
  brandTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-brand]");
    if (!button || button.dataset.brand === activeBrandId) return;
    activeBrandId = button.dataset.brand;
    menuSearch.value = "";
    renderMenu();
  });
}

if (menuModeTabs) {
  menuModeTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-menu-mode]");
    if (!button || button.disabled || button.dataset.menuMode === activeMenuMode) return;
    activeMenuMode = button.dataset.menuMode;
    renderMenu(menuSearch.value);
  });
}

if (sortSelect) {
  sortSelect.addEventListener("change", () => {
    activeSortMode = sortSelect.value;
    renderMenu(menuSearch.value);
  });
}

if (headerCartButton) {
  headerCartButton.addEventListener("click", () => {
    if (getCartQuantity() > 0) {
      openOrderModal();
      setModalStage("cart");
      return;
    }
    const searchPanel = document.querySelector(".search-panel");
    if (searchPanel) searchPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (headerGuideButton) {
  headerGuideButton.addEventListener("click", () => {
    const infoModal = document.getElementById("infoModal");
    if (infoModal) infoModal.classList.remove("hidden");
  });
}

if (headerTestimonialButton) {
  headerTestimonialButton.addEventListener("click", () => {
    const reviews = document.querySelector(".reviews-section");
    if (reviews) reviews.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (copyWifiButton) {
  copyWifiButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    await copyWifiPassword();
  });
}

if (wifiPasswordBar) {
  wifiPasswordBar.addEventListener("click", () => toggleWifiDetail());
  wifiPasswordBar.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleWifiDetail();
    }
  });
}

if (wifiDetailPanel) {
  wifiDetailPanel.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-wifi-password]");
    if (!button) return;
    await copyWifiPassword(button.dataset.wifiPassword);
  });
}

document.addEventListener("click", (event) => {
  const closeTarget = event.target.closest("[data-close-modal]");
  if (closeTarget) { closeOrderModal(); return; }

  const btnGPS = event.target.closest("#btnGPS");
  if (btnGPS) {
    const searchCityInput = document.querySelector("#searchCityInput");
    const gpsStatus = document.querySelector("#gpsStatus");
    const queryCity = searchCityInput.value.trim();
    const mapsBrandName = getCartBrandName() || getActiveBrand().label;
    
    if (queryCity.length > 0) {
      gpsStatus.textContent = "Membuka Maps...";
      window.open("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(`${queryCity} ${mapsBrandName}`), "_blank");
    } else {
      if (!navigator.geolocation) return;
      btnGPS.disabled = true;
      navigator.geolocation.getCurrentPosition((pos) => {
        window.open("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(mapsBrandName) + "&center=" + pos.coords.latitude + "," + pos.coords.longitude + "&zoom=15", "_blank");
        btnGPS.disabled = false;
      }, () => { btnGPS.disabled = false; }, { timeout: 6000 });
    }
    return;
  }

  const addButton = event.target.closest(".add-button[data-id]");
  if (addButton) { selectItemForOptions(addButton.dataset.id); return; }

  const quantityButton = event.target.closest("[data-action]");
  if (quantityButton) {
    const cartKey = quantityButton.dataset.id ? decodeURIComponent(quantityButton.dataset.id) : "";
    updateQuantity(cartKey, quantityButton.dataset.action);
  }
});

addConfiguredItemButton.addEventListener("click", () => {
  if (!pendingItemId) return;
  addItem(pendingItemId, itemNoteInput ? itemNoteInput.value : "");
  setModalStage("cart");
});

closeOrderModalButton.addEventListener("click", () => closeOrderModal());
continueShoppingButton.addEventListener("click", () => closeOrderModal());

// FIX: Memperbaiki aksi klik tombol "Selesai, Bayar QRIS"
// FIX: Memperbaiki aksi klik tombol "Selesai, Bayar QRIS" dengan pengecualian Bundling
// GEMBOK REAL-TIME: Memperbaiki aksi klik tombol "Selesai, Bayar QRIS" saat testing lokal
// Pada goCheckoutButton
goCheckoutButton.addEventListener("click", () => { 
  const cartBrandId = getCartBrandId();
  const store = checkStoreStatus(cartBrandId);
  
  if (store.closed) {
    alert("Maaf, saat ini toko untuk brand tersebut sedang tutup / istirahat. Silakan hubungi WhatsApp admin.");
    return;
  }

  const totalQty = getCartQuantity();
  const hasBundling = [...cart.values()].some(item => item.group && item.group.includes("promo"));
  const requiresKopkenMinimum = cartBrandId === "kopi-kenangan";

  // 👇 SISTEM AKAN MEMBACA ANGKA TERBARU DARI SUPABASE 👇
  const minimalBeli = kopkenMinOrder; 

  if (totalQty === 0) {
    alert("Keranjang masih kosong. Pilih menu dulu ya.");
    return;
  }

  if (!requiresKopkenMinimum || totalQty >= minimalBeli || hasBundling) {
    setModalStage("checkout"); 
  } else {
    alert(`Pesanan kamu baru ${totalQty} menu.\nMinimal untuk Kopi Kenangan saat ini adalah ${minimalBeli} item (bisa gabung makanan/bundle).\nUntuk Tomoro dan Fore, tidak ada minimal pesanan.`);
  }
});

backToCartButton.addEventListener("click", () => setModalStage("cart"));
openCartButton.addEventListener("click", () => { if (getCartQuantity() > 0) { openOrderModal(); setModalStage("cart"); } });

clearCartButton.addEventListener("click", () => { cart.clear(); renderCart(); });
menuSearch.addEventListener("input", () => renderMenu(menuSearch.value));
clearSearch.addEventListener("click", () => { menuSearch.value = ""; renderMenu(); });
paymentProofInput.addEventListener("change", () => updateProofPreview());

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(orderForm);
  const submitButton = orderForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const savedOrder = await createOrderRecord(formData);
    await saveOrderToSupabase(savedOrder);
    const message = encodeURIComponent(buildWhatsappMessage(formData, savedOrder));
    const links = buildWhatsappLinks(String(formData.get("adminPhone")).replace(/\D/g, ""), message);
    
    // 1. Bersihkan keranjang
    cart.clear(); 
    saveCartToStorage(); 
    
    // 2. BERSIHKAN DRAFT BIODATA KARENA SUDAH SUKSES
    localStorage.removeItem('kopiFachrindahBiodata');
    
    orderForm.reset(); 
    renderCart(); 
    closeOrderModal();
    window.location.href = isAndroidDevice() ? links.appUrl : links.waMeUrl;
  } catch (error) { 
    alert("Error menyimpan order. Pastikan Supabase Anda terkonfigurasi dengan benar."); 
  }
  finally { submitButton.disabled = false; }
});

if (reviewForm) {
  reviewForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(reviewForm);
    renderSavedReview({ name: formData.get("reviewName"), rating: formData.get("reviewRating"), text: formData.get("reviewText") });
    reviewForm.reset();
  });
}

backToTop.addEventListener("click", () => {
  const searchPanel = document.querySelector(".search-panel");
  const searchInput = document.getElementById("menuSearch");
  
  if (searchPanel && searchInput) {
    // 1. Geser layar dengan halus ke arah kotak pencarian
    searchPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    
    // 2. Otomatis aktifkan kursor di dalam kotak pencarian setelah layar selesai bergeser
    setTimeout(() => {
      searchInput.focus({ preventScroll: true });
    }, 400); 
  } else {
    // Fallback/cadangan: jika kotak pencarian tidak ditemukan, kembali ke fungsi awal
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

populatePickupTimeOptions();
renderTestimonials();
renderMenu();
renderCart();

// ==========================================
// SATPAM KELILING (BACKGROUND CHECKER) Cerdas
// ==========================================
// Memori ingatan satpam saat website pertama kali dibuka
let statusTokoSebelumnya = checkStoreStatus(activeBrandId).closed;

setInterval(() => {
  const store = checkStoreStatus(activeBrandId);
  
  // SKENARIO 1: Toko harusnya TUTUP, tapi di ingatan satpam masih BUKA
  if (store.closed && statusTokoSebelumnya === false) {
    statusTokoSebelumnya = true; // Update ingatan satpam jadi "Tutup"
    alert("Waktu ibadah Sholat Jumat telah tiba. Toko ditutup sementara hingga pukul 13:00 WIB.");
    renderMenu(); // Tampilkan banner merah & kunci tombol
  } 
  
  // SKENARIO 2: Toko harusnya BUKA (Jam 13:00), tapi di ingatan satpam masih TUTUP
  else if (!store.closed && statusTokoSebelumnya === true) {
    statusTokoSebelumnya = false; // Update ingatan satpam jadi "Buka"
    alert("Toko sudah buka kembali! Silakan melanjutkan pesanan kamu.");
    renderMenu(); // Hilangkan banner merah & normalkan tombol
  }
}, 3000); // <-- Untuk testing biarkan 3000 (3 detik) dulu

// ==========================================
// FITUR POP-UP JASDOR & CARA ORDER (2 TOMBOL)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Ambil kedua ID tombol yang baru
  const btnJasdor = document.getElementById('btnJasdor');
  const btnCaraOrder = document.getElementById('btnCaraOrder');
  
  const infoModal = document.getElementById('infoModal');
  const closeInfoBtn = document.getElementById('closeInfoBtn');

  // Fungsi praktis untuk membuka modal
  const openModal = () => {
    if (infoModal) infoModal.classList.remove('hidden');
  };

  // Pasang sensor klik ke kedua tombol!
  if (btnJasdor) btnJasdor.addEventListener('click', openModal);
  if (btnCaraOrder) btnCaraOrder.addEventListener('click', openModal);

  // Tombol silang untuk menutup
  if (closeInfoBtn) {
    closeInfoBtn.addEventListener('click', () => {
      infoModal.classList.add('hidden');
    });
  }

  // Menutup saat mengklik area gelap di luar kotak
  if (infoModal) {
    infoModal.addEventListener('click', (event) => {
      if (event.target === infoModal) {
        infoModal.classList.add('hidden');
      }
    });
  }
});// ==========================================
// FITUR POP-UP JASDOR & CARA ORDER (2 TOMBOL)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Ambil kedua ID tombol yang baru
  const btnJasdor = document.getElementById('btnJasdor');
  const btnCaraOrder = document.getElementById('btnCaraOrder');
  
  const infoModal = document.getElementById('infoModal');
  const closeInfoBtn = document.getElementById('closeInfoBtn');

  // Fungsi praktis untuk membuka modal
  const openModal = () => {
    if (infoModal) infoModal.classList.remove('hidden');
  };

  // Pasang sensor klik ke kedua tombol!
  if (btnJasdor) btnJasdor.addEventListener('click', openModal);
  if (btnCaraOrder) btnCaraOrder.addEventListener('click', openModal);

  // Tombol silang untuk menutup
  if (closeInfoBtn) {
    closeInfoBtn.addEventListener('click', () => {
      infoModal.classList.add('hidden');
    });
  }

  // Menutup saat mengklik area gelap di luar kotak
  if (infoModal) {
    infoModal.addEventListener('click', (event) => {
      if (event.target === infoModal) {
        infoModal.classList.add('hidden');
      }
    });
  }
});

// ==========================================
// REGISTRASI SERVICE WORKER (MESIN PWA)
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('Mesin PWA berhasil jalan!', registration.scope);
      })
      .catch(error => {
        console.log('Mesin PWA gagal:', error);
      });
  });
}

// ==========================================
// MUNCULKAN TOMBOL INSTALL APLIKASI (PWA)
// ==========================================
let deferredPrompt;
const installAppContainer = document.getElementById('installAppContainer');
const btnInstallApp = document.getElementById('btnInstallApp');
const iosInstallModal = document.getElementById('iosInstallModal');
const closeIosInstallModalButton = document.getElementById('closeIosInstallModal');

function isIosDevice() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /iphone|ipad|ipod/i.test(userAgent) && !window.MSStream;
}

function showIosInstallModal() {
  if (!iosInstallModal) return;
  iosInstallModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeIosInstallModal() {
  if (!iosInstallModal) return;
  iosInstallModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

if (isIosDevice() && installAppContainer) {
  installAppContainer.classList.remove('hidden');
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installAppContainer) {
    installAppContainer.classList.remove('hidden');
  }
});

if (btnInstallApp) {
  btnInstallApp.addEventListener('click', async () => {
    if (installAppContainer) {
      installAppContainer.classList.add('hidden');
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Pilihan user: ${outcome}`);
      deferredPrompt = null;
      return;
    }

    if (isIosDevice()) {
      showIosInstallModal();
      return;
    }

    alert('Perangkat Anda tidak mendukung install otomatis. Silakan buka menu browser dan pilih Add to Home Screen.');
  });
}

if (closeIosInstallModalButton) {
  closeIosInstallModalButton.addEventListener('click', closeIosInstallModal);
}

if (iosInstallModal) {
  iosInstallModal.addEventListener('click', (event) => {
    if (event.target === iosInstallModal) {
      closeIosInstallModal();
    }
  });
}

// ==========================================
// FITUR AUTO-SAVE BIODATA (ANTI-REFRESH FORM)
// ==========================================
const biodataFieldIds = [
  "modalCustomerName", 
  "modalCustomerPhone", 
  "modalPickupTime",
  "searchCityInput", 
  "modalCustomerAddress", 
  // Backup untuk form halaman utama (jika ada)
  "customerName", 
  "customerPhone", 
  "pickupTime",
  "customerAddress"
];

function saveBiodataToStorage() {
  const savedData = {};
  biodataFieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) savedData[id] = el.value;
  });
  localStorage.setItem('kopiFachrindahBiodata', JSON.stringify(savedData));
}

function loadBiodataFromStorage() {
  const saved = localStorage.getItem('kopiFachrindahBiodata');
  if (saved) {
    try {
      const savedData = JSON.parse(saved);
      biodataFieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && savedData[id]) {
          el.value = savedData[id];
        }
      });
    } catch(e) {}
  }
}

// Pasang sensor di setiap kolom: Setiap kali user mengetik, langsung di-save otomatis!
biodataFieldIds.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', saveBiodataToStorage);
  }
});

// Panggil fungsi load saat web pertama kali dimuat
document.addEventListener("DOMContentLoaded", () => {
  loadBiodataFromStorage();
});

// ==========================================
// FITUR PERINGATAN ANTI-REFRESH (MENCEGAH KELUAR TIDAK SENGAJA)
// ==========================================
window.addEventListener("beforeunload", function (event) {
  const proofInput = document.getElementById("modalPaymentProof");
  const hasFile = proofInput && proofInput.files && proofInput.files.length > 0;
  
  // Jika keranjang ada isinya ATAU pelanggan sudah mengupload bukti transfer
  if (cart.size > 0 || hasFile) {
    // Memunculkan pop-up peringatan bawaan browser
    event.preventDefault();
    event.returnValue = ""; 
  }
});

function getServiceFee() {
  const totalQty = getCartQuantity();
  const isKopken = getCartBrandId() === 'kopi-kenangan';
  
  // CEK APAKAH ADA MENU PROMO/BUNDLE DI KERANJANG
  const hasBundling = [...cart.values()].some(item => item.group && item.group.includes("promo"));
  
  // Jika brand Kopi Kenangan, pesan < 2 item, TIDAK ADA BUNDLING, dan keranjang tidak kosong
  // Maka baru dikenakan biaya 3000
  if (isKopken && totalQty > 0 && totalQty < 2 && !hasBundling) {
    return 3000;
  }
  return 0;
}

function updatePromoLabelVisibility() {
  const promoLabel = document.getElementById('promoLabel');
  if (!promoLabel) return;

  // Jika brand aktif adalah 'kopi-kenangan', tampilkan. Jika bukan (misal: 'fore'), sembunyikan total.
  if (activeBrandId === 'kopi-kenangan') {
    promoLabel.style.display = 'block'; 
  } else {
    promoLabel.style.display = 'none'; // Benar-benar hilang dari layout
  }
}

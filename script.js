// --- BAGIAN 1: KONFIGURASI DAN SUPABASE ---
const MY_SUPABASE_URL = "https://bpkpydfvevlktyeapunf.supabase.co"; 
const MY_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwa3B5ZGZ2ZXZsa3R5ZWFwdW5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODc2NTQsImV4cCI6MjA5NTE2MzY1NH0.GTnmA5rAfRwH_tDchpxtXXM6TmRpFaK0yOW5jRyVhY4";
let kopkenMinOrder = 3; 

async function fetchStoreSettings() {
  try {
    if (!window.supabase) return; 
    const mySupabase = window.supabase.createClient(MY_SUPABASE_URL, MY_SUPABASE_ANON_KEY);
    const { data, error } = await mySupabase.from('app_settings').select('kopken_min_order').limit(1);
    if (!error && data && data.length > 0) kopkenMinOrder = data[0].kopken_min_order;
  } catch (error) { console.warn("Gagal memuat aturan."); }
}
fetchStoreSettings();

// --- BAGIAN 2: LOGIKA MENU & OPSI (PERBAIKAN BESAR) ---
function getKenanganOptionGroups(item) {
  const sizeOptions = [];
  if (!item.noRegular) sizeOptions.push({ value: "Regular", label: "Regular", price: item.price });
  // Opsi Large dipaksa muncul jika item punya largePrice
  if (item.largePrice) sizeOptions.push({ value: "Large", label: "Large", price: item.largePrice });

  const groups = [{
    key: "temperature",
    label: "Temperature",
    options: item.noHot ? [{ value: "Ice", label: "Ice", icon: "ice" }] : [{ value: "Ice", label: "Ice", icon: "ice" }, { value: "Hot", label: "Hot", icon: "hot" }],
  }];

  if (sizeOptions.length > 1) groups.push({ key: "size", label: "Size", options: sizeOptions });

  if (item.allowBeans) {
    groups.push({ key: "beans", label: "Biji Kopi (Beans)", options: [{ value: "Kenangan Blend", label: "Kenangan Blend" }, { value: "Juwara Beans", label: "Juwara Beans", priceDelta: 3000 }] });
  }

  if (item.allowOatside) {
    groups.push({ key: "milk", label: "Pilihan Susu (Milk)", options: [{ value: "Milk", label: "Fresh Milk" }, { value: "Oatside", label: "Oatside", priceDelta: 3000 }] });
  }

  groups.push({
    key: "sugar",
    label: "Sugar Level",
    options: item.noSugar ? [{ value: "Normal Sugar", label: "Normal Sugar" }, { value: "Less Sugar", label: "Less Sugar" }] : [{ value: "Normal Sugar", label: "Normal Sugar" }, { value: "Less Sugar", label: "Less Sugar" }, { value: "No Sugar", label: "No Sugar" }],
  });

  groups.push({
    key: "ice",
    label: "Ice Level",
    hiddenValue: "No Ice",
    dependsOn: { key: "temperature", value: "Ice" },
    options: item.onlyNormalIce ? [{ value: "Normal Ice", label: "Normal Ice" }] : [{ value: "Normal Ice", label: "Normal Ice" }, { value: "Less Ice", label: "Less Ice" }, { value: "No Ice", label: "No Ice" }],
  });

  return groups;
}

// --- BAGIAN 3: FUNGSI LAINNYA (SISA KODE ASLI) ---
// (Pastikan fungsi checkStoreStatus, renderMenu, renderCart, dll. ada di sini tanpa dibungkus kurung kurawal)
// Jika Anda ingin saya sertakan fungsi lainnya, pastikan Anda tidak menambahkan '{' di awal file.

// --- BAGIAN 4: INISIALISASI (PASTIKAN INI DI PALING BAWAH) ---
document.addEventListener("DOMContentLoaded", () => {
  if (typeof loadCartFromStorage === "function") loadCartFromStorage();
  if (typeof loadBiodataFromStorage === "function") loadBiodataFromStorage();
  populatePickupTimeOptions();
  renderTestimonials();
  renderMenu();
  renderCart();
});

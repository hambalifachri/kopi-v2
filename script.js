// ==========================================
// KONEKSI DINAMIS SUPABASE (MINIMAL ORDER)
// ==========================================
const MY_SUPABASE_URL = "https://bpkpydfvevlktyeapunf.supabase.co"; 
const MY_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwa3B5ZGZ2ZXZsa3R5ZWFwdW5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODc2NTQsImV4cCI6MjA5NTE2MzY1NH0.GTnmA5rAfRwH_tDchpxtXXM6TmRpFaK0yOW5jRyVhY4";

let kopkenMinOrder = 3; 

async function fetchStoreSettings() {
  try {
    if (!window.supabase) return; 
    const mySupabase = window.supabase.createClient(MY_SUPABASE_URL, MY_SUPABASE_ANON_KEY);
    const { data, error } = await mySupabase
      .from('app_settings')
      .select('kopken_min_order')
      .limit(1);

    if (error) return; 
    if (data && data.length > 0) {
      kopkenMinOrder = data[0].kopken_min_order;
    }
  } catch (error) {
    console.warn("Gagal memuat aturan, menggunakan minimal bawaan (3).");
  }
}
fetchStoreSettings();

// --- Lanjutkan dengan semua fungsi lainnya seperti biasa ---
// PASTIKAN TIDAK ADA '{' atau '}' yang membungkus seluruh file di sini!

function getKenanganOptionGroups(item) {
  const sizeOptions = [];
  if (!item.noRegular) {
    sizeOptions.push({ value: "Regular", label: "Regular", price: item.price });
  }
  if (item.largePrice) {
    sizeOptions.push({ value: "Large", label: "Large", price: item.largePrice });
  }

  const groups = [
    {
      key: "temperature",
      label: "Temperature",
      options: item.noHot
        ? [{ value: "Ice", label: "Ice", icon: "ice" }]
        : [{ value: "Ice", label: "Ice", icon: "ice" }, { value: "Hot", label: "Hot", icon: "hot" }],
    }
  ];

  if (sizeOptions.length > 1) {
    groups.push({ key: "size", label: "Size", options: sizeOptions });
  }

  // Tambahkan grup lain (Beans, Milk, dll) di sini...
  return groups;
}

// ... masukkan sisa fungsi Anda yang lain di bawah sini tanpa dibungkus kurung kurawal apapun

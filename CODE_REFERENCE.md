# 💻 CODE REFERENCE - CHEAT SHEET

## 1️⃣ Struktur Menu Item di menu-data.js

### Format Basic
```javascript
{
  id: "unique-id-here",                    // Unique identifier (alphanumeric + dash)
  name: "Nama Menu",                       // Display name
  price: 25000,                            // Harga (Rupiah)
  brand: "kopi-kenangan",                  // Brand: kopi-kenangan | tomoro | fore
  category: "coffee",                      // Kategori: coffee | non-coffee | signature | food | dll
  image: "nama-file.jpg"                   // Foto file (kosongkan jika tidak ada)
}
```

### Contoh Lengkap
```javascript
{
  id: "kopi-susu-gula-aren",
  name: "Kopi Susu Gula Aren",
  price: 28000,
  brand: "kopi-kenangan",
  category: "coffee",
  image: "kopi-susu-gula-aren.jpg",
  isNew: true,                              // (Optional) Tampilkan badge "New"
  isBestSeller: true,                       // (Optional) Highlight di "Best Seller"
  isSoldOut: false,                         // (Optional) Disable button jika habis
  noHot: false                              // (Optional) Hot/Ice: true=Ice only, false=Both available
}
```

---

## 2️⃣ Tambah Menu Baru

### Step by Step

```javascript
// 1. Buka menu-data.js
// 2. Cari array MENU_ITEMS_DATA
// 3. Tambahkan item baru SEBELUM closing bracket

// Contoh: Menambah menu "Affogato Spesial"
MENU_ITEMS_DATA.push({
  id: "affogato-spesial",
  name: "Affogato Spesial",
  price: 32000,
  brand: "kopi-kenangan",
  category: "coffee",
  image: "affogato-spesial.jpg"
});

// ATAU insert langsung di array:
[
  // ... item lain ...
  {
    id: "affogato-spesial",
    name: "Affogato Spesial",
    price: 32000,
    brand: "kopi-kenangan",
    category: "coffee",
    image: "affogato-spesial.jpg"
  }
]
```

### Naming Convention
```javascript
// ID Format: lowercase, dash-separated
✅ "kopi-susu"
✅ "thai-tea-loaded"
✅ "mango-banana-smoothie"

❌ "KopiSusu" (CamelCase)
❌ "kopi_susu" (Underscore)
❌ "kopi susu" (Space)
```

---

## 3️⃣ Upload Testimoni Programmatic

### Manual Upload via Admin Panel
```html
1. Buka: http://localhost:3000/admin-testimoni.html
2. Drag-drop atau klik upload
3. Pilih file gambar
4. Klik tombol "Upload"
5. File otomatis tersimpan ke assets/testimoni/
```

### Verify Upload via API
```javascript
// Cek daftar file testimoni yang ada
fetch('http://localhost:3000/api/files')
  .then(res => res.json())
  .then(data => console.log(data.files))
```

---

## 4️⃣ Struktur Brand di menu-data.js

### Contoh Brand Configuration
```javascript
{
  id: "kopi-kenangan",              // Unique brand ID
  label: "Kopi Kenangan",           // Display name
  shortLabel: "Kopi Kenangan",      // Short name untuk tab
  description: "Brand Kopi Kenangan",
  accent: "#d35c19",                // Brand color (hex)
  categories: [
    { id: "coffee", title: "Coffee" },
    { id: "non-coffee", title: "Non Coffee" },
    { id: "signature", title: "Signature" }
  ],
  defaultOptions: [
    // Option groups untuk template-based brands (Tomoro, Fore)
    // Kopi Kenangan menggunakan dynamic generation
  ]
}
```

---

## 5️⃣ Render Menu Otomatis

### Cara Kerja (Behind The Scenes)
```javascript
// Di script.js:

function renderMenu() {
  const activeItems = getActiveMenuItems();  // Ambil menu by brand
  
  activeItems.forEach(item => {
    const html = menuCard(item);              // Generate HTML
    // ... append ke DOM
  });
}

function menuCard(item) {
  // Generate kartu menu individual
  return `
    <article class="menu-card">
      ${menuVisual(item)}            // Foto atau CSS gelas
      <h3>${item.name}</h3>
      <span>${rupiah.format(item.price)}</span>
      <button data-id="${item.id}">Tambah</button>
    </article>
  `;
}

function menuVisual(item) {
  if (item.image) {
    // Ada foto? Tampilkan foto
    return `<img src="${item.image}" />`;
  } else {
    // Tidak ada foto? Tampilkan gelas CSS
    return `<div class="menu-visual"></div>`;
  }
}
```

---

## 6️⃣ Handle Option Groups (Temperature, Size, dll)

### Dynamic Option Generation (Kopi Kenangan)
```javascript
// function getKenanganOptionGroups(item) di script.js
// Auto-generate Temperature, Size, Beans, Milk, Sugar, Ice

const groups = [
  {
    key: "temperature",
    label: "Temperature",
    options: [
      { value: "Ice", label: "Ice", icon: "ice" },
      { value: "Hot", label: "Hot", icon: "hot" }
    ]
  },
  {
    key: "size",
    label: "Ukuran",
    options: [
      { value: "Regular", label: "Regular" },
      { value: "Large", label: "Large", priceDelta: 7000 }
    ]
  }
  // ... more groups
];
```

### Template-Based Options (Tomoro, Fore)
```javascript
// Di menu-data.js dalam brand config:
defaultOptions: [
  {
    key: "temperature",
    label: "Temperature",
    options: [
      { value: "Ice", label: "Ice", icon: "ice" },
      { value: "Hot", label: "Hot", icon: "hot" }
    ]
  },
  // ... lebih banyak
]
```

### Custom Item Options (Override)
```javascript
// Item dengan custom options:
{
  id: "specialty-item",
  name: "Specialty Drink",
  price: 40000,
  brand: "tomoro",
  options: [                          // Override brand defaultOptions
    {
      key: "size",
      label: "Size",
      options: [
        { value: "Small", label: "Small" },
        { value: "Medium", label: "Medium" }
      ]
    }
    // Custom options only, tidak ambil dari brand default
  ]
}
```

---

## 7️⃣ Sync Ice Options (Temperature Logic)

### Automatic Ice Selection
```javascript
// Di script.js:

function syncIceOptions() {
  if (selectedOptions.temperature === "Hot") {
    // Pilih Hot? Otomatis set Ice jadi "No Ice"
    selectedOptions.ice = "No Ice";
    
    // Hide ice option group (tidak boleh customize ice saat Hot)
    document.querySelector('[data-option-group="ice"]').style.display = "none";
  } else {
    // Pilih Ice? Tampilkan ice options normal
    document.querySelector('[data-option-group="ice"]').style.display = "block";
  }
}

// Trigger setiap kali pilih temperature:
modalOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-option-value]");
  if (button?.dataset.optionGroup === "temperature") {
    syncIceOptions();  // Auto-sync
  }
});
```

---

## 8️⃣ Cart Encoding/Decoding

### Problem: Special Characters in JSON
```javascript
// Kalau biasa simpan di data attribute:
const cartKey = `${id}|${JSON.stringify(options)}`;
// Hasil: "item-1|{"temperature":"Ice","size":"Regular"}"
// HTML: data-id="item-1|{"temperature":"Ice","size":"Regular"}"
// ❌ BROKEN: Quote characters break HTML attribute!
```

### Solution: URL Encode
```javascript
// Encode sebelum simpan di HTML:
const safeCartKey = encodeURIComponent(cartKey);
// Hasil: "item-1%7C%7B%22temperature%22%3A%22Ice%22%7D"
// ✅ SAFE: Hanya alphanumeric + special chars yang aman

// HTML: data-id="item-1%7C%7B%22temperature%22%3A%22Ice%22%7D"

// Decode saat diambil:
const cartKey = decodeURIComponent(button.dataset.id);
// Kembali ke: "item-1|{"temperature":"Ice","size":"Regular"}"
```

---

## 9️⃣ Gallery Images Auto-Generation

### How It Works
```javascript
// tools/testimonial-admin-server.js:

function regenerateGalleryImages() {
  // 1. Baca semua file di assets/testimoni/
  const files = fs.readdirSync(testimoniFolder);
  
  // 2. Filter hanya file gambar
  const images = files.filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
  
  // 3. Generate JavaScript file
  const content = `window.TESTIMONIAL_IMAGES = ${JSON.stringify(images)};`;
  
  // 4. Tulis ke gallery-images.js
  fs.writeFileSync('gallery-images.js', content);
}

// Trigger otomatis:
// - Setiap kali ada upload file (POST /api/upload)
// - Setiap kali delete file (DELETE /api/file/:filename)
// - Saat server startup
```

### Usage di Frontend
```javascript
// Di script.js:

function renderTestimonials() {
  const images = window.TESTIMONIAL_IMAGES || [];
  
  const html = images.map((src, i) => 
    `<img src="${src}" alt="Testimoni ${i+1}" />`
  ).join('');
  
  testimonialGallery.innerHTML = html;
}

// Render gallery otomatis saat page load
renderTestimonials();
```

---

## 🔟 Error Handling & Fallback

### Safe Image Loading
```html
<!-- Di menuCard() atau gallery: -->
<img 
  src="path/to/image.jpg" 
  alt="Menu Name"
  loading="lazy"
  onerror="this.parentElement.classList.add('no-image'); this.remove();"
/>

<!-- CSS fallback: -->
<style>
  .photo-frame.no-image {
    background-color: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
  }
</style>
```

### Check Gallery Loaded
```javascript
// Verify gallery-images.js ter-load:
console.log(window.TESTIMONIAL_IMAGES);
// Output: Array of image paths

if (!window.TESTIMONIAL_IMAGES) {
  console.warn('Gallery images not loaded. Using fallback.');
  window.TESTIMONIAL_IMAGES = fallbackTestimonialImages;
}
```

---

## 1️⃣1️⃣ Common Errors & Fixes

### Error 1: "Menu not showing"
```javascript
// Problem: gambar tidak di-load
// Check:
1. Buka menu-data.js
2. Verify property "image" ada dan benar
3. Foto file ada di assets/testimoni/ ?
4. Refresh browser (Ctrl+Shift+R)

// Fallback: kosongkan image property
image: ""  // Akan tampilkan gelas CSS
```

### Error 2: "Cart buttons not working"
```javascript
// Problem: quantity +/- tidak berfungsi
// Check:
1. Console (F12) ada error?
2. cartKey encoding correct? (cek Network tab)
3. Event listener di-register? (search "updateQuantity")
4. Decoding working? (test di console: decodeURIComponent("..."))
```

### Error 3: "Testimoni tidak muncul"
```javascript
// Problem: gallery kosong
// Check:
1. Upload file di admin panel?
2. File ada di assets/testimoni/?
3. gallery-images.js ter-generate? (cek folder root)
4. Reload halaman (Ctrl+Shift+R, jangan F5)
5. Check console (F12) ada error?
```

---

## 1️⃣2️⃣ Debugging Tips

### 1. Console Logging
```javascript
// Di script.js, tambahkan:

console.log('Active Brand:', activeBrandId);
console.log('Menu Items:', getActiveMenuItems());
console.log('Cart Contents:', [...cart.values()]);
console.log('Gallery Images:', window.TESTIMONIAL_IMAGES);

// Buka browser console (F12) untuk lihat output
```

### 2. Inspect Element
```
1. Buka halaman website
2. Tekan F12 (Developer Tools)
3. Klik tombol "Inspect" (kotak dengan panah)
4. Klik elemen di halaman untuk lihat HTML/CSS
5. Tab Console untuk lihat error JavaScript
```

### 3. Network Debugging
```
1. F12 → Network tab
2. Refresh halaman
3. Lihat request list:
   - gallery-images.js - loaded?
   - menu-data.js - loaded?
   - Admin API calls - success (200)?
4. Klik request untuk lihat response
```

---

## Templates Copy-Paste Ready

### Template: Edit Menu
```javascript
// Copy & modify:
{
  id: "CHANGE-THIS",
  name: "CHANGE THIS",
  price: 25000,
  brand: "kopi-kenangan",          // atau: tomoro, fore
  category: "coffee",              // atau: non-coffee, signature
  image: ""                         // atau: "file-name.jpg"
}
```

### Template: Menu with All Options
```javascript
{
  id: "premium-item",
  name: "Premium Item Name",
  price: 35000,
  brand: "kopi-kenangan",
  category: "coffee",
  image: "premium-item.jpg",
  isNew: true,
  isBestSeller: true,
  color: "#a84e1e",
  foam: "#fff2df"
}
```

### Template: Custom Options
```javascript
{
  id: "special-drink",
  name: "Special Drink",
  price: 40000,
  brand: "tomoro",
  category: "signature",
  image: "special.jpg",
  options: [
    {
      key: "size",
      label: "Size",
      options: [
        { value: "Small", label: "Small" },
        { value: "Large", label: "Large", priceDelta: 5000 }
      ]
    }
  ]
}
```

---

**Last Updated:** 2 Juni 2026


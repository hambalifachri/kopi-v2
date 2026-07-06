# 🗑️ LAPORAN DEAD CODE & FILE SAMPAH

## Ringkasan
Website sudah dirombak menjadi sistem dinamis berbasis data. File-file berikut sudah tidak digunakan dan **AMAN UNTUK DIDELETE**.

---

## 📁 FILE SAMPAH DI FOLDER `assets/`

### ✅ AMAN DIDELETE

#### Kategori 1: Testimoni WhatsApp Lama
```
assets/ss-wa-2.jpg
assets/ss-wa-3.jpg
assets/ss-wa-4.jpg
... (dan seterusnya)
```
**Alasan:** Testimoni sudah dimigrasikan ke `assets/testimoni/` dan di-manage via admin panel.  
**Pengganti:** Upload ulang ke admin panel jika masih ingin dipakai.

#### Kategori 2: Photo & Image Lama yang Redundan
Cek folder `assets/menu/` dan `assets/New folder/`:
- File gambar menu yang sudah tidak dipakai
- Gambar yang duplicate atau versi lama
- Pastikan sudah di-backup sebelum delete

**Cara identify:**
1. Buka file `menu-data.js` → lihat daftar property `image` yang aktif
2. Bandingkan dengan file di folder `assets/menu/` dan `assets/New folder/`
3. File yang TIDAK ada di menu-data.js bisa didelete

---

## 🧹 DEAD CODE DI CSS (styles.css)

### Potensi CSS yang Tidak Dipakai
Berikut classes yang mungkin tidak digunakan (cek penggunaan di HTML/JS):

```css
/* Kemungkinan tidak dipakai (verify dulu sebelum delete) */
.hidden { }           /* Gunakan display:none atau [hidden] attribute */
.no-image { }         /* Fallback for image onerror event */
.old-price { }        /* Jika semua product tidak punya harga lama */
.sale-note { }        /* Jika tidak ada promo dengan saleNote */
.new::after { }       /* Jika tidak ada item dengan class "new" */
.best-seller { }      /* Jika tidak ada item dengan isBestSeller */
.locked { }           /* Jika tidak ada fitur item terkunci */
.sold-out { }         /* Jika tidak ada item dengan isSoldOut */
```

**Cara Verifikasi:**
1. Cari di `index.html`, `script.js`, `menu-data.js` apakah class/property ini digunakan
2. Jika tidak ketemu, bisa didelete dari styles.css

---

## 🧹 DEAD CODE DI JAVASCRIPT (script.js)

### Fungsi yang Mungkin Tidak Dipakai
Cari penggunaan fungsi ini di script.js:

| Fungsi | Status | Catatan |
|--------|--------|---------|
| `fallbackTestimonialImages` | ✅ Dipakai | Backup jika window.TESTIMONIAL_IMAGES tidak ada |
| `getSizeBlockNotes()` | ✅ Dipakai | Generate label promo/sale |
| `getActiveSizeBlockNotes()` | ✅ Dipakai | Untuk display di menu card |
| `formatOptions()` | ✅ Dipakai | Format opsi di cart |
| `starsFromRating()` | ✅ Dipakai | Generate star rating UI |
| `isFoodItem()` | ✅ Dipakai | Conditional cart/modal behavior |

**Semua function di script.js tampaknya masih digunakan ✅**

---

## 🚀 REKOMENDASI CLEANUP

### Phase 1: Safe Delete (100% aman)
```
1. Rename folder "assets/New folder" menjadi "assets/unused-old"
2. Delete semua file di dalamnya yang tidak ada di menu-data.js
3. Delete semua file ss-wa-*.jpg dari assets/ (kecuali di assets/testimoni/)
```

### Phase 2: Conditional Delete (Verify dulu)
```
1. Cek styles.css untuk CSS classes yang tidak dimulai dari elemen HTML
2. Comment out dulu sebelum delete (untuk safety)
3. Test aplikasi - jika tidak ada visual issue, baru delete permanent
```

### Phase 3: Future Optimization
```
1. Minify CSS & JS untuk production
2. Lazy load gambar dengan loading="lazy"
3. Compress image testimoni dengan tool seperti ImageMagick
```

---

## 📋 STRUKTUR FOLDER YANG BERSIH

### Recommended Final Structure
```
project/
├── index.html
├── script.js
├── styles.css
├── menu-data.js
├── gallery-images.js (AUTO-GENERATED)
├── admin-testimoni.html
├── manifest.json
├── README.md
│
├── assets/
│   ├── menu/                    (Menu photo jika ada)
│   ├── testimoni/               (Testimoni WhatsApp)
│   │   ├── 1780405472740-1-Logo-KF.png
│   │   └── (more testimoni...)
│   └── qris-kopi-fachrindah.jpeg
│
├── tools/
│   ├── testimonial-admin-server.js
│   └── update-testimonials.js
│
└── PANDUAN_SETUP.md
```

---

## ⚠️ JANGAN DELETE

- [ ] `index.html` - Halaman utama
- [ ] `script.js` - Logic core
- [ ] `styles.css` - Styling
- [ ] `menu-data.js` - Konfigurasi menu
- [ ] `gallery-images.js` - AUTO-GENERATED (akan dibuat ulang otomatis)
- [ ] `assets/testimoni/` - Folder penyimpanan testimoni
- [ ] `assets/qris-kopi-fachrindah.jpeg` - QRIS untuk pembayaran
- [ ] `manifest.json` - PWA manifest
- [ ] `tools/testimonial-admin-server.js` - Server backend
- [ ] `admin-testimoni.html` - Admin panel
- [ ] `Buka Admin Testimoni.bat` - Launcher

---

## 🔄 Proses Cleanup Aman

```bash
# Langkah 1: Backup existing folder
# (Manual backup ke USB atau Cloud)

# Langkah 2: Identify files
# Buka menu-data.js → lihat semua "image" properties
# Buka assets/ → cek file mana yang listed

# Langkah 3: Delete unused
# Delete file yang TIDAK ada di menu-data.js

# Langkah 4: Test
# Buka index.html
# Refresh halaman
# Cek apakah semua menu muncul dengan benar

# Langkah 5: Verify
# Buka admin-testimoni.html
# Upload test image
# Cek apakah berfungsi normal
```

---

## 📊 Estimasi Cleanup

| Kategori | File Count | Size Est. | Action |
|----------|-----------|-----------|--------|
| Old testimonial images | ~52 | 50-100MB | DELETE |
| Unused menu photos | ~5-10 | 5-10MB | DELETE |
| CSS dead code | 5-10 lines | <1KB | COMMENT OUT |
| JS dead code | ~0 lines | - | NONE |

**Total potential cleanup:** ~55-110 MB

---

**Catatan:** Backup folder project sebelum melakukan cleanup!


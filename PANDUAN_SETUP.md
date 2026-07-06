# 📖 PANDUAN SETUP SISTEM OTOMASI KOPI.FACHRINDAH

## Daftar Isi
1. [Instalasi Node.js](#instalasi-nodejs)
2. [Menjalankan Admin Panel](#menjalankan-admin-panel)
3. [Struktur Sistem Otomasi](#struktur-sistem-otomasi)
4. [Cara Menggunakan](#cara-menggunakan)
5. [Troubleshooting](#troubleshooting)

---

## 🔧 Instalasi Node.js

### Langkah 1: Download Node.js
1. Buka website resmi: **https://nodejs.org/**
2. Download versi **LTS (Long Term Support)** (yang tidak berlabel "Latest")
   - Pilih installer untuk Windows (.msi file)
3. Simpan file di Downloads

### Langkah 2: Install Node.js
1. **Klik 2x** file installer yang sudah didownload
2. Klik **"Next"** sampai muncul button **"Install"**
3. Klik **"Install"** untuk mulai instalasi
4. Tunggu sampai selesai (±2 menit)
5. Klik **"Finish"**

### Langkah 3: Verifikasi Instalasi
1. Buka **Command Prompt** (tekan Windows+R, ketik `cmd`, Enter)
2. Ketik perintah ini:
   ```
   node --version
   npm --version
   ```
3. Jika muncul nomor versi, instalasi berhasil ✅

### Langkah 4: Install Dependencies
1. Buka **File Explorer**, navigate ke folder project:
   ```
   C:\Users\[NamaUser]\Documents\Codex\2026-05-21\aku-mau-buat-aplikasi-atau-web
   ```
2. Tekan **Shift+Right Click** di folder kosong → pilih **"Open command window here"** (atau **"Open PowerShell window here"**)
3. Ketik perintah:
   ```
   npm install express multer cors
   ```
4. Tunggu sampai selesai (muncul folder `node_modules`)

---

## 🚀 Menjalankan Admin Panel

### Cara Tercepat: Gunakan File .BAT
1. Navigate ke folder project Anda
2. **Klik 2x** file bernama: **`Buka Admin Testimoni.bat`**
3. Command Prompt akan terbuka secara otomatis dan menjalankan server
4. Tunggu sampai muncul pesan:
   ```
   📍 Server berjalan di: http://localhost:3000
   Buka browser ke: http://localhost:3000/admin-testimoni.html
   ```
5. **Buka browser**, ketik di address bar:
   ```
   http://localhost:3000/admin-testimoni.html
   ```

### Cara Manual (Jika .BAT tidak bekerja)
1. Buka **Command Prompt** di folder project
2. Ketik:
   ```
   node tools/testimonial-admin-server.js
   ```
3. Lakukan step 4-5 di atas

### Menghentikan Server
- Tekan **Ctrl+C** di jendela Command Prompt/PowerShell

---

## 📁 Struktur Sistem Otomasi

### 1️⃣ Admin Panel untuk Upload Testimoni
```
admin-testimoni.html
├── Interface untuk drag-drop file gambar
├── Tombol upload & delete
└── Preview gambar yang sudah diupload
```

**Fitur:**
- Drag-drop gambar ke area upload
- Preview semua gambar yang ada di folder `assets/testimoni/`
- Delete individual gambar
- Auto-refresh list

### 2️⃣ Backend Server Node.js
```
tools/testimonial-admin-server.js
├── API endpoint untuk upload
├── API endpoint untuk delete
├── API endpoint untuk list files
└── Auto-generate gallery-images.js
```

**Port:** `3000` (default)

### 3️⃣ Auto-Generated Gallery Images
```
gallery-images.js (AUTO-GENERATED)
└── window.TESTIMONIAL_IMAGES = [...]
```

**Konten:**
- Daftar path semua file di `assets/testimoni/`
- Auto-update setiap kali upload/delete file
- **JANGAN EDIT MANUAL** - file ini di-generate otomatis

### 4️⃣ Menu Data (Dinamis)
```
menu-data.js
├── BRANDS_DATA - Konfigurasi brand (Kopi Kenangan, Tomoro, Fore)
├── MENU_ITEMS_DATA - Daftar menu dengan harga & kategori
└── PRODUCT_IMAGES_DATA - Mapping nama gambar
```

**Cara Update Menu:**
1. Edit file `menu-data.js`
2. Tambah item di array `MENU_ITEMS_DATA`
3. Contoh:
   ```javascript
   {
     id: "new-item",
     name: "Nama Menu Baru",
     price: 25000,
     brand: "kopi-kenangan",
     category: "coffee",
     image: "new-item.jpg"  // Kosongkan untuk fallback CSS
   }
   ```
4. Refresh halaman browser

---

## 💻 Cara Menggunakan

### Workflow Unggah Testimoni

#### Step 1: Buka Admin Panel
```
Klik 2x: Buka Admin Testimoni.bat
→ Tunggu Command Prompt muncul
→ Buka browser: http://localhost:3000/admin-testimoni.html
```

#### Step 2: Upload Gambar Testimoni
```
Di halaman admin-testimoni.html:
1. Drag-drop screenshot WhatsApp ke area "Drop files here"
   ATAU
   Klik area → pilih file dari folder
2. Klik tombol "Upload"
3. Tunggu sampai status berubah menjadi sukses
```

#### Step 3: Verifikasi
```
1. Gambar muncul di list bawah
2. Buka index.html (menu price list)
3. Scroll ke bagian "Real Testimoni"
4. Gambar testimoni baru akan muncul otomatis
```

---

### Workflow Tambah/Edit Menu

#### Step 1: Edit File menu-data.js
```javascript
// Di array MENU_ITEMS_DATA, tambahkan:
{
  id: "kopi-susu-premium",
  name: "Kopi Susu Premium",
  price: 32000,
  brand: "kopi-kenangan",
  category: "coffee",
  group: undefined,
  image: "kopi-susu-premium.jpg",
  color: "#a84e1e",
  foam: "#fff2df"
}
```

#### Step 2: Reload Browser
```
Tekan F5 atau Ctrl+Shift+R
Menu baru akan muncul di halaman
```

#### Step 3: (Opsional) Upload Foto Menu
```
1. Siapkan foto dengan nama: kopi-susu-premium.jpg
2. Buka admin-testimoni.html
3. Upload foto ke folder assets/testimoni/
4. Update property image di menu-data.js ke nama file yang benar
5. Reload browser
```

---

## 🐛 Troubleshooting

### ❌ Error: "Port 3000 is already in use"
**Solusi:**
```
Mungkin server sudah running di jendela lain
1. Tutup semua Command Prompt/PowerShell yang terbuka
2. Tunggu 5 detik
3. Coba jalankan .bat file lagi
```

### ❌ Error: "Cannot find module 'express'"
**Solusi:**
```
Dependencies belum ter-install dengan benar
1. Buka Command Prompt di folder project
2. Ketik: npm install express multer cors
3. Tunggu sampai selesai
4. Coba jalankan .bat file lagi
```

### ❌ Browser menampilkan "Cannot GET /admin-testimoni.html"
**Solusi:**
```
Server tidak berjalan atau file tidak ditemukan
1. Pastikan .bat file sudah menghasilkan output:
   "Server berjalan di: http://localhost:3000"
2. Pastikan file admin-testimoni.html ada di root folder
3. Coba akses: http://localhost:3000/ (tanpa path)
   Jika muncul halaman, berarti server OK
```

### ❌ Testimoni tidak muncul di index.html
**Solusi:**
```
File gallery-images.js mungkin belum ter-generate
1. Pastikan sudah upload minimal 1 gambar di admin panel
2. Cek folder assets/testimoni/ - apakah ada file gambar?
3. Cek browser console (F12) apakah ada error
4. Reload halaman dengan Ctrl+Shift+R (hard refresh)
```

### ❌ Menu foto tidak muncul (hitam/kosong)
**Solusi:**
```
Fallback CSS berjalan karena file gambar tidak ditemukan
Pilihan:
1. Upload foto ke folder assets/testimoni/ dengan nama yang sama
   di property "image" pada menu-data.js
2. Atau kosongkan property "image" untuk gunakan fallback CSS
   (gelas yang digambar dengan CSS)
```

---

## 📋 File Penting & Fungsinya

| File | Fungsi | Edit Manual? |
|------|--------|-------------|
| `admin-testimoni.html` | Interface upload testimoni | ❌ Tidak perlu |
| `tools/testimonial-admin-server.js` | Backend server | ❌ Tidak perlu |
| `gallery-images.js` | Daftar testimoni (auto-generated) | ❌ **Jangan edit** |
| `menu-data.js` | Konfigurasi menu & brand | ✅ **EDIT INI** |
| `script.js` | Logic utama aplikasi | ✅ Jika perlu feature baru |
| `index.html` | Halaman utama | ✅ Jika perlu layout baru |
| `styles.css` | Styling | ✅ Jika perlu desain baru |

---

## 🎯 Checklist Setelah Setup

- [ ] Node.js terinstall (cek: `node --version` di CMD)
- [ ] npm install dependencies selesai (`node_modules` folder ada)
- [ ] Admin panel berjalan (http://localhost:3000/admin-testimoni.html)
- [ ] Bisa upload gambar testimoni
- [ ] Gambar testimoni muncul di index.html
- [ ] Bisa edit menu di menu-data.js
- [ ] Menu baru muncul setelah reload halaman

---

## 📞 Bantuan Cepat

### Format error di browser console?
- Buka **F12** (Developer Tools)
- Tab **Console** → cek pesan error
- Kirim error message ke Copilot untuk fix

### Port 3000 ingin diganti?
- Edit file `.bat`:
  ```
  node tools\testimonial-admin-server.js 3001
  ```
  (ganti 3001 dengan port pilihan)

### Server perlu restart?
- Tekan **Ctrl+C** di Command Prompt
- Jalankan `.bat` file lagi

---

**Terakhir Diupdate:** 2 Juni 2026  
**Versi:** 1.0


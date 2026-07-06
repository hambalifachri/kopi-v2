# Price List Jasdor kopi.fachrindah

Web price list bergaya poster untuk menjual jasa order atau jasdor minuman kopi.

## Cara Pakai

1. Buka `index.html` di browser.
2. Pilih detail minuman: temperature, size, sugar level, dan ice level.
3. Pilih menu dari price list.
4. Isi data pelanggan dan alamat antar.
5. Pastikan nomor WhatsApp admin sudah benar.
6. Upload bukti transfer QRIS.
7. Klik tombol simpan order dan notifikasi WhatsApp.

## Ubah Nomor Admin

Nomor default ada di `index.html` pada bagian:

```html
<input id="adminPhone" name="adminPhone" type="tel" value="6281234567890" required />
```

Ganti `6281281400462` dengan nomor admin milikmu. Pakai format Indonesia tanpa tanda plus, contoh `628123000111`.

## Ubah Menu dan Harga

Data menu ada di `script.js`, bagian `categories` dan `menuItems`. Kategori yang dipakai sekarang mengikuti screenshot: Promo & Combo, Baru!, Coffee, Non Coffee, Kenangan Frappe, Chef Martin Praja's Signature Bake, Kenangan Toast, dan Food.

### Nonaktifkan Size Berdasarkan Jam

Untuk menu yang size tertentu tidak bisa dijual di jam tertentu, pakai field `sizeBlocks` pada menu terkait. Contoh saat ini ada di Kopi Kenangan Mantan: size Large otomatis hilang jam 13:00-15:00 WIB.

```js
sizeBlocks: [
  { size: "Large", start: "13:00", end: "15:00", label: "jam 13.00-15.00" }
]
```

Di luar jam tersebut, size Large kembali muncul memakai harga normal.

### Harga Beda Tiap Outlet

Harga di website diperlakukan sebagai total sementara. Pesan WhatsApp order sudah menambahkan catatan agar admin mengonfirmasi dulu kalau harga outlet berbeda sebelum pesanan diproses.

## Foto Menu

Foto produk disimpan di `assets/menu`. Mapping foto ke produk ada di `script.js`, bagian `productImages`.

## Minimal Order

Minimal order adalah 2 menu. Biaya jasa tidak dihitung di aplikasi ini.

## Pembayaran

Pembayaran menggunakan QRIS `kopi.fachrindah`. Customer scan QRIS sesuai total bayar, lalu upload bukti pembayaran saat checkout. Bukti transfer masuk ke Supabase Storage, data order masuk ke tabel Supabase, sedangkan WhatsApp mengirim notifikasi berisi ID order, ringkasan pesanan, dan link bukti transfer.

Halaman customer hanya bisa mengirim order. Daftar pesanan tidak ditampilkan di web publik. Admin melihat data lengkap dari Supabase Dashboard:

- Table Editor > `orders`
- Storage > bucket `payment-proofs`

## Setup Supabase

1. Buat project Supabase.
2. Buka SQL Editor, lalu jalankan isi file `supabase-schema.sql`.
3. Buka Project Settings > API, salin Project URL dan anon public key.
4. Isi `supabase-config.js`:

```js
window.KOPI_SUPABASE_CONFIG = {
  url: "https://project-id.supabase.co",
  anonKey: "anon-public-key",
  ordersTable: "orders",
  paymentProofBucket: "payment-proofs",
};
```

Catatan: policy di `supabase-schema.sql` tidak membuka public read untuk tabel order. Bucket `payment-proofs` dibuat public supaya link bukti transfer bisa dikirim dan dibuka dari WhatsApp. Siapa pun yang punya link bukti bisa melihat file tersebut.

## Review

Review ditampilkan sebagai testimoni di halaman utama, tapi customer tidak wajib mengisi review saat order. Ganti isi review placeholder di `index.html` kalau sudah punya review asli.

Screenshot WhatsApp sekarang dibaca dari `gallery-images.js`, jadi nama file tidak perlu diseragamkan.

Cara paling mudah:

1. Klik dua kali `Buka Admin Testimoni.bat`.
2. Pilih atau drag screenshot WhatsApp ke halaman admin.
3. Klik `Upload ke Website`.
4. Refresh halaman website.

File akan disimpan otomatis ke `assets/testimoni` dan `gallery-images.js` diperbarui sendiri.

Cara manual tetap bisa: taruh screenshot baru di `assets/New folder` atau `assets/testimoni`, lalu jalankan:

```bash
node tools/update-testimonials.js
```

File manifest akan diperbarui otomatis. Nama seperti `WhatsApp Image 2026-06-05 at 12.30.00.jpeg` tetap bisa dipakai.

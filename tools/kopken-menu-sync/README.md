# Sinkron Menu Kopi Kenangan

Program mencari outlet lewat aplikasi Kopi Kenangan di HP, membaca respons menu yang ditangkap HTTP Toolkit, lalu menyimpannya ke `kopken_outlets_catalog` di Supabase.

## Aplikasi Windows

Buka `Kopken Menu Sync.exe` untuk menjalankan seluruh fitur dari satu jendela. Aplikasi menyediakan sinkron menu yang belum ada, sinkron ulang semua menu, pembaruan khusus **Outlet Utama**, pencarian outlet baru, pembaruan satu outlet, pause/lanjut/stop, pengaturan koneksi VSPhone, progress, dan log berjalan.

## Outlet utama dan jadwal

Tombol **Update Outlet Utama** hanya memproses daftar pada `outlet utama wajib reload setiap hari.txt`. Proses ini tetap dapat dipause dan dilanjutkan; checkpoint terpisah akan dibersihkan saat seluruh daftar selesai sehingga pembaruan berikutnya kembali memproses semuanya.

Tombol **Jadwalkan Update** membuat jadwal Windows harian untuk mode Outlet Utama. Pilih jamnya di aplikasi. Komputer, HTTP Toolkit, dan VSPhone harus tetap menyala serta tersambung pada jam tersebut.

Shortcut `Kopken Menu Sync` juga dapat dibuat di Desktop. Jika source aplikasi diubah, jalankan `Build Aplikasi Sync.ps1` untuk membangun ulang file EXE.

## Cari outlet baru

Jalankan `Cari Outlet Baru Kopken.bat` saat sinkron menu sedang tidak berjalan. Program memakai VSPhone `menu` untuk mencari outlet melalui aplikasi Kopi Kenangan, menangkap respons `query_pageable_store`, lalu hanya menambahkan `outlet_code` Kopi Kenangan yang belum ada ke Supabase. Menu outlet yang sudah tersimpan tidak diubah.

Jika batas sesi HTTP Toolkit tercapai, aplikasi HTTP Toolkit dibuka ulang dan pencarian dilanjutkan dari checkpoint secara otomatis. Daftar outlet yang ditemukan pada sesi terakhir disimpan di `logs/outlet-baru-terakhir.json`.

## Persiapan pertama

1. Salin `.env.example` menjadi `.env.kopken-sync` di folder utama proyek.
2. Isi `SUPABASE_SERVICE_ROLE_KEY` dari Supabase Dashboard > Project Settings > API Keys.
3. Isi daftar outlet pada `outlets.txt`, satu nama per baris.
4. Hubungkan HP melalui USB, aktifkan USB debugging, HTTP Toolkit, dan Android interception.
5. Pastikan HP sudah terbuka dan aplikasi Kopi Kenangan sudah login.

Jalankan `Mulai Sinkron Menu.bat`. Jangan memakai HP selama proses berlangsung.

Outlet yang sudah berhasil disimpan di progres lokal dan akan terus dilewati. Jalankan `Sinkron Ulang Semua Menu.bat` saat ingin memperbarui ulang seluruh outlet, misalnya setiap hari.

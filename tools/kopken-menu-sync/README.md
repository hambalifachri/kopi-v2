# Sinkron Menu Kopi Kenangan

Program mencari outlet lewat aplikasi Kopi Kenangan di HP, membaca respons menu yang ditangkap HTTP Toolkit, lalu menyimpannya ke `kopken_outlets_catalog` di Supabase.

## Persiapan pertama

1. Salin `.env.example` menjadi `.env.kopken-sync` di folder utama proyek.
2. Isi `SUPABASE_SERVICE_ROLE_KEY` dari Supabase Dashboard > Project Settings > API Keys.
3. Isi daftar outlet pada `outlets.txt`, satu nama per baris.
4. Hubungkan HP melalui USB, aktifkan USB debugging, HTTP Toolkit, dan Android interception.
5. Pastikan HP sudah terbuka dan aplikasi Kopi Kenangan sudah login.

Jalankan `Mulai Sinkron Menu.bat`. Jangan memakai HP selama proses berlangsung.

Outlet yang sudah berhasil disimpan di progres lokal dan akan terus dilewati. Jalankan `Sinkron Ulang Semua Menu.bat` saat ingin memperbarui ulang seluruh outlet, misalnya setiap hari.

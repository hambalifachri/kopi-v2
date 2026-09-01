# Sinkron Menu Tomoro

Program ini sengaja dipisah dari Kopi Kenangan. Tomoro memakai folder, env, log, dan tabel Supabase sendiri:

- folder: `tools/tomoro-menu-sync`
- tabel cache: `tomoro_outlets_catalog`
- secret runtime: `tomoro_runtime_headers`

## Cara kerja

Script mengambil outlet/menu dari official API Tomoro memakai header runtime app, lalu menyimpan hasil ke Supabase. Web bisa membaca cache dari Supabase tanpa memanggil Tomoro langsung dari browser/cloud.

## Menjalankan

Untuk aplikasi Windows, buka `Tomoro Menu Sync.exe`.

Salin `.env.example` menjadi `.env.tomoro-sync` di root project, lalu isi `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`.

```bash
node tools/tomoro-menu-sync/sync.mjs --keyword=bogor
node tools/tomoro-menu-sync/sync.mjs --store=ID_STORE_TOMORO
node tools/tomoro-menu-sync/capture-http-toolkit.mjs --seconds=90
```

Gunakan `--keyword=` untuk mencari dan menyimpan outlet, dan `--store=` untuk refresh menu satu outlet.

Kalau request langsung kena `Tomoro HTTP 405`, gunakan `capture-http-toolkit.mjs`. Jalankan HTTP Toolkit interception, buka app Tomoro di VSPhone, lalu script akan mengambil response outlet/menu yang lewat HTTP Toolkit dan menyimpannya ke tabel cache Tomoro.

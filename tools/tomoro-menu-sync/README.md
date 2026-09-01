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
node tools/tomoro-menu-sync/capture-frida.mjs --seconds=90
```

Gunakan `--keyword=` untuk mencari dan menyimpan outlet, dan `--store=` untuk refresh menu satu outlet.

Kalau request langsung kena `Tomoro HTTP 405`, gunakan `capture-frida.mjs`. Tomoro dapat meminta jaringan `NOT_VPN`, sehingga traffic tidak selalu terlihat di HTTP Toolkit. Capture Frida otomatis mematikan HTTP Toolkit VPN/proxy dulu, membaca response outlet/menu dari OkHttp di dalam app Tomoro, lalu menyimpannya ke tabel cache Tomoro.

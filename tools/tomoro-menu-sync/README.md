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
node tools/tomoro-menu-sync/capture-frida.mjs --seconds=180 --city-sweep
node tools/tomoro-menu-sync/capture-frida.mjs --seconds=180 --all-outlets --max-scrolls=60
node tools/tomoro-menu-sync/capture-frida.mjs --seconds=90 --keyword=bogor
node tools/tomoro-menu-sync/capture-frida.mjs --menu-sweep --menu-limit=50
```

Gunakan `--city-sweep` untuk mengambil outlet nasional dengan mencari daftar kota otomatis dari `tomoro-city-keywords.txt`. Di aplikasi Windows, kosongkan keyword lalu klik `Capture Frida` untuk mode ini. Gunakan `--all-outlets` untuk mengambil outlet sekitar lokasi yang muncul di Store List sambil auto-scroll. Tambahkan `--max-scrolls=` untuk membatasi jumlah scroll. Gunakan `--keyword=` kalau ingin mencari kota/outlet tertentu, dan `--store=` untuk refresh menu satu outlet.

Untuk menu, klik `Capture Menu` di aplikasi Windows atau jalankan `--menu-sweep`. Mode ini membaca outlet Tomoro yang sudah tersimpan di Supabase, mencari outlet satu per satu di app Tomoro, menekan `Start Order`, lalu Frida menyimpan response menu ke row outlet UI dan `storeCode` resmi yang tertangkap.

Kalau request langsung kena `Tomoro HTTP 405`, gunakan `capture-frida.mjs`. Tomoro dapat meminta jaringan `NOT_VPN`, sehingga traffic tidak selalu terlihat di HTTP Toolkit. Capture Frida otomatis mematikan HTTP Toolkit VPN/proxy dulu, membuka Store List, lalu menyimpan outlet dari response OkHttp atau fallback UI Android. Tambahkan `--manual` kalau ingin mencari outlet sendiri tanpa auto tap.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Error: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset di environment variables!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncMenu() {
    const outletCode = "JKT.RKMRYSN"; // Ganti jika perlu
    
    try {
        console.log("Sedang mengambil data dari Cloudflare Worker...");
        // Ganti URL di bawah dengan URL Cloudflare Worker Anda yang asli
        const workerUrl = `https://<worker-anda>.workers.dev/?outletCode=${outletCode}`;
        
        const response = await fetch(workerUrl);
        const result = await response.json();

        console.log("Menyimpan data ke Supabase...");
        const { error } = await supabase
            .from('kopken_catalog_snapshots')
            .upsert({
                outlet_code: outletCode,
                outlet_name: result.outlet_name || "Kopi Kenangan",
                outlet_address: result.outlet_address || "",
                category: "All",
                menu: result,
                updated_at: new Date()
            }, { 
                onConflict: 'outlet_code' 
            });

        if (error) {
            console.error('Gagal simpan ke Supabase:', error.message);
        } else {
            console.log('Sukses! Menu berhasil diperbarui di Supabase.');
        }

    } catch (err) {
        console.error('Terjadi kesalahan:', err.message);
    }
}

syncMenu();

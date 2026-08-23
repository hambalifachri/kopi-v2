async function syncMenu() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("Error: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset!");
        process.exit(1);
    }

    const outletCode = "JKT.RKMRYSN"; // Ganti jika perlu
    
    try {
        console.log("1. Mengambil data dari Cloudflare Worker...");
        const workerUrl = `https://api-kopken.novelveno65.workers.dev/?outletCode=${outletCode}`;
        
        const response = await fetch(workerUrl);
        const result = await response.json();

        console.log("2. Menyimpan data langsung ke Supabase via REST API...");
        
        // Menggunakan REST API Supabase langsung (tanpa library tambahan yang error)
        const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/kopken_catalog_snapshots`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates' // Berfungsi seperti upsert
            },
            body: JSON.stringify({
                outlet_code: outletCode,
                outlet_name: result.outlet_name || "Kopi Kenangan",
                outlet_address: result.outlet_address || "",
                category: "All",
                menu: result,
                updated_at: new Date().toISOString()
            })
        });

        if (!supabaseResponse.ok) {
            const errText = await supabaseResponse.text();
            throw new Error(`Gagal simpan ke Supabase: ${errText}`);
        }

        console.log('Sukses! Menu berhasil diperbarui di Supabase.');

    } catch (err) {
        console.error('Terjadi kesalahan:', err.message);
        process.exit(1);
    }
}

syncMenu();

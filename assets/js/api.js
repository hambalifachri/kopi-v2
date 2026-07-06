// assets/js/api.js

async function loadDynamicMenu(outletCode = 'JKT.RKMRYSN') {
    const container = document.getElementById('catalogContainer');
    if (!container) return;

    try {
        const response = await fetch(`https://www.nufsfood.shop/api/menu?outletCode=${outletCode}`);
        const data = await response.json();

        // 1. Ubah format data dari API agar sesuai dengan struktur website Anda
        const dynamicItems = data.menu.map(item => ({
            id: String(item.id),
            brand: "kopi-kenangan", 
            group: item.category.toLowerCase() === 'kopi' ? 'coffee' : 'non-coffee',
            name: item.name,
            price: Math.round((item.origPrice / 2) + 2000), 
            oldPrice: item.origPrice,
            image: null 
        }));

        // 2. Masukkan data ke array global 'menuItems' yang ada di script.js
        if (typeof menuItems !== 'undefined') {
            menuItems.push(...dynamicItems);
            // 3. Jalankan fungsi renderMenu agar tampilan terupdate
            renderMenu(); 
        }
    } catch (err) {
        console.error("Gagal memuat API:", err);
    }
}

// Jalankan otomatis
loadDynamicMenu();
async function searchOutlets(keyword) {
    try {
        const response = await fetch(`https://www.nufsfood.shop/api/outlets?keyword=${keyword}&page=1`);
        const data = await response.json();
        
        // DEBUG: Lihat apa isi datanya di Console
        console.log("Data outlet dari API:", data); 

        // CEK STRUKTUR: Apakah datanya langsung array atau di dalam object?
        // Jika data berupa object, mungkin harus diakses melalui data.outlets atau data.data
        const outlets = Array.isArray(data) ? data : (data.data || data.outlets || []);

        outletResults.innerHTML = '';
        if (outlets.length > 0) {
            outletResults.style.display = 'block';
            outlets.forEach(outlet => {
                const div = document.createElement('div');
                div.textContent = outlet.name;
                div.style.padding = '8px';
                div.style.cursor = 'pointer';
                div.onclick = () => {
                    loadDynamicMenu(outlet.code);
                    outletSearch.value = outlet.name;
                    outletResults.style.display = 'none';
                };
                outletResults.appendChild(div);
            });
        } else {
            outletResults.innerHTML = '<div style="padding:8px;">Outlet tidak ditemukan</div>';
            outletResults.style.display = 'block';
        }
    } catch (err) {
        console.error("Gagal cari outlet:", err);
    }
}
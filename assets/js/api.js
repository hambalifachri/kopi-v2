const CF_API_BASE = "https://api-kopken.novelveno65.workers.dev"; // Pastikan URL benar

window.loadDynamicMenu = function(outletCode = "JKT.RKMRYSN") {
  const container = document.getElementById("catalogContainer");
  if (container) container.innerHTML = 'Sedang memuat...';

  // Menambahkan tag script untuk mengambil data (JSONP)
  const script = document.createElement('script');
  script.src = `${CF_API_BASE}?outletCode=${encodeURIComponent(outletCode)}&callback=handleKopiKenanganData`;
  document.body.appendChild(script);
};

window.handleKopiKenanganData = function(data) {
  const apiMenu = data.menu || [];
  
  // Ambil data menu lokal untuk kebutuhan styling
  cacheOriginalKopiKenanganMenu();
  const localMenuByName = new Map((originalKopiKenanganMenu || []).map(i => [normalizeMenuName(i.name), i]));

  const dynamicItems = apiMenu.map(item => {
    const localItem = localMenuByName.get(normalizeMenuName(item.name)) || {};
    return {
      ...localItem,
      id: String(item.id),
      brand: "kopi-kenangan",
      group: normalizeApiMenuGroup(item.category),
      name: item.name,
      price: item.price ? Math.round(item.price / 2) + 3000 : (localItem.price || 0),
      oldPrice: item.origPrice || localItem.oldPrice,
      image: item.image || localItem.image || null
    };
  });

  // Gabungkan dengan menu non-kopken
  const nonKopiKenanganItems = menuItems.filter(i => i.brand !== "kopi-kenangan");
  menuItems.length = 0;
  menuItems.push(...nonKopiKenanganItems, ...dynamicItems);

  if (typeof renderMenu === "function") renderMenu();
};

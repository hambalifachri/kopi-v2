(() => {
  let rankings = {};
  const nameKey = value => String(value || '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
  window.menuSalesScore = item => Number(rankings[item.brand]?.[nameKey(item.name)]) || 0;
  window.rankedBestSellers = items => {
    const brand = items[0]?.brand;
    if (!rankings[brand]) return items.filter(item => item.isBestSeller);
    return items.filter(item => window.menuSalesScore(item)>0 && !item.isSoldOut)
      .sort((a,b)=>window.menuSalesScore(b)-window.menuSalesScore(a) || a.name.localeCompare(b.name))
      .slice(0,8);
  };
  fetch('assets/data/best-sellers.json?v=20261030', {cache:'no-cache'})
    .then(response => {if (!response.ok) throw new Error('Unavailable');return response.json();})
    .then(data => {
      rankings = data.brands || {};
      if (typeof renderMenu === 'function') renderMenu(typeof menuSearch !== 'undefined' ? menuSearch.value : '');
    })
    .catch(()=>{}); // Existing curated choices remain usable when the snapshot cannot load.
})();

const BASE = 'https://cingops.com';
const SOURCE = 'tomoro-cingops';
const EXCLUDED = /ice[ -]?cream|es krim|master\s+s[.\s]*o[.\s]*e|frapp[ée]|jujutsu|kaisen|collab|kolaborasi|character cup|limited edition|one piece|sanrio|pokemon|bundle|merchandise|\bfood\b|\b1\s*l\b|literan/i;

export function isAirportOutlet(outlet) {
  return /bandara|airport|soekarno.?hatta|ngurah rai|juanda international|apt pranoto/i.test([outlet.name, outlet.address, outlet.storeCategory].join(' '));
}

async function read(path, query, signal) {
  const response = await fetch(BASE + path + '?' + new URLSearchParams({ brand: 'tomoro', ...query }), {
    headers: { Accept: 'application/json' }, signal,
  });
  if (!response.ok) throw Error('Sumber Tomoro tidak tersedia');
  const body = await response.json();
  if (!body.success || (body.brand && body.brand !== 'tomoro')) throw Error('Respons Tomoro tidak valid');
  return body;
}

function outletStatus(outlet) {
  const observed = Date.parse(outlet.availabilityObservedAt);
  const expires = Date.parse(outlet.availabilityExpiresAt);
  const now = Date.now();
  return outlet.availabilityKnown === true && observed <= now + 5000 && expires > now && typeof outlet.isOpen === 'boolean'
    ? outlet.isOpen : null;
}

function supportsIcedSmall(details) {
  if (!details || details.isSoldOut !== false || !Array.isArray(details.variants)) return false;
  return details.variants.some(variant => {
    if (variant.isSoldOut !== false || !Array.isArray(variant.properties)) return false;
    const size = variant.properties.find(property => property.propertyCode === 'P012' || /^cup\s*size$/i.test(property.propertyName));
    const temp = variant.properties.find(property => property.propertyCode === 'P002' || /^temperature$/i.test(property.propertyName));
    return /^small$/i.test(size?.valueName) && (!temp || /^ice(?:d)?$/i.test(temp.valueName));
  });
}

async function readMenu(storeCode, storeName) {
  const menu = await read('/api/menu', { storeCode, storeName, includeBundles: '0' }, AbortSignal.timeout(14000));
  if (menu.dynamic?.storeCode !== storeCode || menu.dynamicOutlet?.code !== storeCode || !Array.isArray(menu.menuGroups)) {
    throw Error('Menu tidak cocok dengan outlet');
  }
  if (isAirportOutlet(menu.dynamicOutlet)) return { blocked: true };
  const candidates = new Map();
  for (const group of menu.menuGroups) {
    for (const product of group.products || []) {
      const title = [group.groupName, product.groupName, product.name].join(' ');
      if (!product.id || !product.name || EXCLUDED.test(title) || product.isComboV2 || product.isMixMatch) continue;
      if (product.typeCode !== 1 || product.isSoldOut !== false) continue;
      candidates.set(product.id, product);
    }
  }
  const pending = [...candidates.values()];
  const signal = AbortSignal.timeout(17000);
  const products = await Promise.all(Array.from({ length: Math.min(5, pending.length) }, async () => {
    const verified = [];
    while (pending.length && !signal.aborted) {
      const product = pending.shift();
      try {
        const detail = await read('/api/item-details', { storeCode, itemCode: product.id }, AbortSignal.any([signal, AbortSignal.timeout(4000)]));
        if (detail.dynamic?.storeCode !== storeCode || String(detail.dynamic?.itemCode) !== String(product.id)) continue;
        if (supportsIcedSmall(detail.details)) verified.push({
          productName: product.name, imageUrl: product.image, catalog_only: true,
        });
      } catch { /* Only list products whose Small stock was confirmed. */ }
    }
    return verified;
  }));
  return { products: products.flat().sort((a, b) => a.productName.localeCompare(b.productName)) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak didukung' });
  const params = new URL(req.url, 'https://local.invalid').searchParams;
  const action = params.get('action');
  try {
    if (action === 'tomoro-outlets') {
      const keyword = (params.get('keyword') || '').trim().slice(0, 100);
      if (keyword.length < 3) return res.status(200).json({ source: SOURCE, outlets: [] });
      const data = await read('/api/search-outlets', { keyword, pageSize: '15' }, AbortSignal.timeout(9000));
      if (!Array.isArray(data.stores)) throw Error('Daftar outlet tidak valid');
      const outlets = data.stores.filter(outlet => outlet.code && !isAirportOutlet(outlet)).map(outlet => ({
        storeCode: outlet.code, storeName: outlet.name, storeAddress: outlet.address,
        isOpen: outletStatus(outlet),
      }));
      return res.status(200).json({ source: SOURCE, outlets });
    }
    if (action === 'tomoro-menu') {
      const code = params.get('outletCode') || '';
      if (code.startsWith('ui-') || !/^[a-zA-Z0-9._-]{2,80}$/.test(code)) return res.status(400).json({ error: 'Pilih lagi outlet dari hasil pencarian' });
      const storeName = (params.get('outletName') || '').trim().slice(0, 160);
      const menu = await readMenu(code, storeName);
      if (menu.blocked) return res.status(400).json({ error: 'Voucher 50% tidak berlaku di outlet bandara.' });
      if (!menu.products.length) return res.status(503).json({ error: 'Stok menu Small untuk voucher 50% belum bisa dipastikan.' });
      res.setHeader('Vercel-CDN-Cache-Control', 's-maxage=20');
      return res.status(200).json({ source: SOURCE, products: menu.products });
    }
    return res.status(400).json({ error: 'Action tidak valid' });
  } catch {
    return res.status(503).json({ error: 'Outlet atau menu Tomoro sementara belum bisa diperiksa.' });
  }
}

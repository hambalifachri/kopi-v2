const BASE = 'https://cingops.com';
const SOURCE = 'tomoro-cingops';
const CATALOG = 'https://omkboytvivjxoobyhumc.supabase.co/rest/v1/tomoro_outlets_catalog';

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

async function sharedMenu(request) {
  const query = new URLSearchParams({
    select: 'menu,menu_updated_at',
    menu: 'not.is.null',
    order: 'menu_updated_at.desc.nullslast,store_code.asc',
    limit: '30',
  });
  const headers = { Accept: 'application/json' };
  for (const name of ['apikey', 'authorization']) {
    if (typeof request.headers?.[name] === 'string') headers[name] = request.headers[name];
  }
  const response = await fetch(CATALOG + '?' + query, { headers, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Error('Katalog Tomoro sementara tidak dapat dibaca');
  const catalog = await response.json();
  if (!Array.isArray(catalog) || !catalog.length) throw Error('Katalog umum Tomoro belum tersedia');
  return {
    source: 'tomoro-cache',
    menu: catalog.map(row => row.menu),
    sharedCatalog: true,
    updatedAt: catalog[0].menu_updated_at,
  };
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
      if (!/^[a-zA-Z0-9._-]{2,80}$/.test(code)) return res.status(400).json({ error: 'Pilih lagi outlet dari hasil pencarian' });
      const storeName = (params.get('outletName') || '').trim().slice(0, 160);
      if (isAirportOutlet({ name: storeName })) return res.status(400).json({ error: 'Voucher 50% tidak berlaku di outlet bandara.' });
      return res.status(200).json(await sharedMenu(req));
    }
    return res.status(400).json({ error: 'Action tidak valid' });
  } catch {
    return res.status(503).json({ error: 'Outlet atau menu Tomoro sementara belum bisa diperiksa.' });
  }
}

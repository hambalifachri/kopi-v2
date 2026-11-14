export function isAirportOutlet(o) { return /bandara|airport|soekarno.?hatta|juanda international|ngurah rai/i.test(o.name||''); }

const CATALOG = 'https://omkboytvivjxoobyhumc.supabase.co/rest/v1/tomoro_outlets_catalog';
const SOURCE = 'tomoro-cache';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({error: 'Method tidak didukung'});
  const params = new URL(req.url, 'https://local.invalid').searchParams;
  const action = params.get('action');
  const query = new URLSearchParams();
  if (action === 'tomoro-outlets') {
    const keyword = (params.get('keyword') || '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim().slice(0, 100);
    if (keyword.length < 3) return res.status(200).json({source: SOURCE, outlets: []});
    query.set('select', 'store_code,store_name,store_address,raw_store');
    query.set('or', '(store_name.ilike.*'+keyword+'*,store_address.ilike.*'+keyword+'*)');
    query.set('order', 'store_name.asc');
    query.set('limit', '30');
  } else if (action === 'tomoro-menu') {
    const code = params.get('outletCode') || '';
    if (!/^[a-zA-Z0-9._-]{2,80}$/.test(code)) return res.status(400).json({error: 'Kode outlet tidak valid'});
    query.set('select', 'store_name,menu,menu_updated_at');
    query.set('store_code', 'eq.'+code);
    query.set('limit', '1');
  } else {
    return res.status(400).json({error: 'Action tidak valid'});
  }
  try {
    const headers = {Accept: 'application/json'};
    for (const key of ['apikey', 'authorization']) {
      if (typeof req.headers[key] === 'string') headers[key] = req.headers[key];
    }
    const response = await fetch(CATALOG+'?'+query, {headers, signal: AbortSignal.timeout(9000)});
    if (!response.ok) throw Error('Database unavailable');
    const rows = await response.json();
    if (action === 'tomoro-outlets') {
      const outlets = rows.filter(row => !isAirportOutlet({name: row.store_name})).map(row => ({
        storeCode: row.store_code,
        storeName: row.store_name,
        storeAddress: row.store_address,
        isOpen: typeof row.raw_store?.isOpen === 'boolean' ? row.raw_store.isOpen : null,
      }));
      return res.status(200).json({source: SOURCE, outlets});
    }
    const [outlet] = rows;
    if (!outlet || isAirportOutlet({name: outlet.store_name})) return res.status(404).json({error: 'Outlet Tomoro tidak tersedia'});
    if (!outlet.menu) return res.status(404).json({error: 'Menu outlet ini belum disinkronkan ke Supabase.'});
    return res.status(200).json({source: SOURCE, menu: outlet.menu, updatedAt: outlet.menu_updated_at});
  } catch {
    return res.status(503).json({error: 'Katalog Tomoro sementara tidak dapat dibaca.'});
  }
}

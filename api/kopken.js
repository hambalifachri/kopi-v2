// Public browser API used by Dibeliin; outlet reference prices never replace our selling prices.
const BASE = 'https://db.akzara.id';
const PUBLIC_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpubWtqbHh2d3N3cW9iZmxldXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4Mjc2NjksImV4cCI6MjA4NDQwMzY2OX0.3an86_X5-KwdVcE9jIOP2v-mJiQQe_UV55uYV0AuIXk";
const FALLBACK = 'https://omkboytvivjxoobyhumc.supabase.co/functions/v1/kopken-catalog';
const SOURCE = 'catalog-provider';
const headers = { apikey: PUBLIC_KEY, Authorization: 'Bearer '+PUBLIC_KEY };
export async function rows(table, params) {
  const response = await fetch(BASE+'/rest/v1/'+table+'?'+new URLSearchParams(params), {headers,signal:AbortSignal.timeout(6500)});
  if (!response.ok) throw new Error('Source unavailable');
  const data=await response.json();if(!Array.isArray(data))throw new Error('Invalid source');return data;
}
function outletRow(o) {
  return {code:o.code,name:o.name,address:o.address||'',isOpen:typeof o.is_open==='boolean'?o.is_open:null,openStatus:o.open_status||''};
}
export function normalizeMenu(catalog, stock, code) {
  if(!stock.length)throw new Error('No outlet inventory');
  const byCode=new Map(stock.map(p=>[String(p.product_code),p]));const groups=new Map();
  for(const p of catalog){const inventory=byCode.get(String(p.product_code));if(!inventory||!p.name)continue;
    for(const name of Array.isArray(p.categories)&&p.categories.length?p.categories:['Food']){
      if(!groups.has(name))groups.set(name,[]);
      groups.get(name).push({id:p.product_code,name:p.name,brand:'Kopi Kenangan',image:p.image_url,
        catalog_only:true,is_sold_out:inventory.is_sold_out===true,
        outlet_regular_price: Number(inventory.regular_price) || undefined,
        outlet_large_price: Number(inventory.large_price) || undefined});
    }
  }
  if(!groups.size)throw new Error('Incomplete outlet catalog');
  return {outletCode:code,source:SOURCE,checkedAt:new Date().toISOString(),payload:{data:{menu_groups:[...groups].map(([group_name,menu_products])=>({group_name,menu_products}))}}};
}
async function primary(params) {
  const action=params.get('action');
  if(action==='outlets'){
    const keyword=(params.get('keyword')||'').replace(/[^\p{L}\p{N}\s-]/gu,' ').trim().slice(0,100);
    if(keyword.length<3)return {outlets:[],source:SOURCE};
    const outlets=await rows('outlets',{select:'code,name,address,is_open,open_status',brand:'eq.kenangan',is_active:'eq.true',name:'ilike.*'+keyword+'*',order:'name.asc',limit:'30'});
    return {outlets:outlets.filter(o=>o.code).map(outletRow),source:SOURCE,page:1,hasMore:false};
  }
  const code=params.get('outletCode')||'';if(!/^[a-zA-Z0-9._-]{3,80}$/.test(code))throw Error('Invalid code');
  const [outlet]=await rows('outlets',{select:'code,name,address,is_open,open_status',brand:'eq.kenangan',is_active:'eq.true',code:'eq.'+code,limit:'1'});
  if(!outlet)throw Error('Outlet missing');
  if(action==='status')return {outletCode:code,source:SOURCE,status:/pesan di outlet/i.test(outlet.open_status||'')?'onsite_only':outlet.is_open===true?'open':outlet.is_open===false?'closed':'unknown',message:outlet.open_status||'',checkedAt:new Date().toISOString()};
  if(action==='live-menu'){
    // The source website invokes this same public refresh before reading store_menus.
    try {await fetch(BASE+'/functions/v1/sync-outlet-menu',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({store_code:code}),signal:AbortSignal.timeout(5000)});}catch{}
    const [catalog,stock]=await Promise.all([
      rows('menu_items',{select:'product_code,name,categories,image_url',brand:'eq.kenangan',is_available:'eq.true',order:'id.asc',limit:'1000'}),
      rows('store_menus',{select:'product_code,is_sold_out,regular_price,large_price',store_code:'eq.'+code,limit:'1000'})
    ]);
    return normalizeMenu(catalog,stock,code);
  }
  throw Error('Unsupported action');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak didukung' });
  const params = new URL(req.url, 'https://local.invalid').searchParams;
  if (!['outlets', 'live-menu', 'status'].includes(params.get('action'))) return res.status(400).json({ error: 'Action tidak valid' });
  try { return res.status(200).json(await primary(params)); }
  catch {
    try {
      const headers = { Accept: 'application/json' };
      for (const key of ['apikey', 'authorization']) if (typeof req.headers[key] === 'string') headers[key] = req.headers[key];
      const response = await fetch(`${FALLBACK}?${params}`, { headers, signal: AbortSignal.timeout(10000) });
      const body = await response.json();
      return res.status(response.status).json(body);
    } catch { return res.status(503).json({ error: 'Layanan outlet dan cadangan sementara tidak tersedia' }); }
  }
}

export async function refreshSourceMenu(brand,code) {
 if(!['tomoro'].includes(brand))throw Error('Invalid brand');
 try {await fetch(BASE+'/functions/v1/sync-'+brand+'-menu',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({store_code:code}),signal:AbortSignal.timeout(5000)});}catch{}
}

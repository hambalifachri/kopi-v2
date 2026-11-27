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
const KLIK_KOPI_BASE = "https://jasdorin-byklikkopi.vercel.app";
let catalogSession = null;

async function newCatalogSession() {
  const response = await fetch(KLIK_KOPI_BASE + "/api/kopken/session", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Sesi sumber katalog gagal");
  const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  if (!cookie) throw new Error("Sesi katalog tidak tersedia");
  return { cookie, expiresAt: Date.now() + 10 * 60 * 1000 };
}

async function klikKopi(path) {
  if (!catalogSession) catalogSession = newCatalogSession().catch(error => { catalogSession = null; throw error; });
  let session = await catalogSession;
  if (session.expiresAt <= Date.now()) {
    catalogSession = newCatalogSession().catch(error => { catalogSession = null; throw error; });
    session = await catalogSession;
  }
  const request = () => fetch(KLIK_KOPI_BASE + "/api/kopken/" + path, {
    headers: { Accept: "application/json", Cookie: session.cookie },
    cache: "no-store", signal: AbortSignal.timeout(12000),
  });
  let response = await request();
  if (response.status === 401) {
    catalogSession = newCatalogSession().catch(error => { catalogSession = null; throw error; });
    session = await catalogSession;
    response = await request();
  }
  if (!response.ok) throw new Error("Sumber katalog belum tersedia");
  return response.json();
}

function klikOutlet(outlet) {
  return { code: outlet.code, name: outlet.name, address: outlet.address || "",
    category: outlet.category || "", isOpen: null,
    openStatus: "" };
}

async function primary(params) {
  const action = params.get("action");
  const source = "klik-kopi";
  if (action === "outlets") {
    const keyword = (params.get("keyword") || "").trim().slice(0, 100);
    if (keyword.length < 3) return { outlets: [], source };
    const data = await klikKopi("outlets?" + new URLSearchParams({ q: keyword }));
    if (!Array.isArray(data.outlets)) throw new Error("Daftar outlet tidak valid");
    return { outlets: data.outlets.filter(o => o.code && o.name).map(klikOutlet), source, page: 1, hasMore: false };
  }
  const code = params.get("outletCode") || "";
  if (!/^[a-zA-Z0-9._-]{2,80}$/.test(code)) throw new Error("Kode outlet tidak valid");
  const data = await klikKopi("menu?" + new URLSearchParams({ outletRef: code, priceTier: "normal" }));
  if (!Array.isArray(data.menu) || data.storeCode && data.storeCode !== code) throw new Error("Menu outlet tidak valid");
  if (action === "status") {
    const status = data.isClosed === true || data.checkoutAllowed === false ? "closed"
      : data.isClosed === false && data.checkoutAllowed === true ? "open" : "unknown";
    return { outletCode: code, source, status,
      message: status === "open" ? "Outlet menerima pesanan" : status === "closed" ? "Outlet belum menerima pesanan" : "",
      checkedAt: new Date().toISOString() };
  }
  const groups = new Map();
  const aliases = { "Kopi": "Coffee", "Non-Kopi": "Non Coffee", "Frappe": "Kenangan Frappe", "Oatside": "Oatside Series" };
  for (const product of data.menu) {
    if (!product.id || !product.name) continue;
    const category = product.sourceCategory || product.category || "Food";
    const name = aliases[category] || category;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({ id: product.productCode || product.code || product.id,
      name: product.name, image: product.img, brand: "Kopi Kenangan",
      catalog_only: true, is_sold_out: product.isSoldOut === true,
      outlet_regular_price: Number(product.origPrice) || undefined });
  }
  if (!groups.size) throw new Error("Menu kosong");
  return { outletCode: code, source, checkedAt: new Date().toISOString(),
    upstreamSource: data.source || "", stockFresh: data.stockFresh === true,
    payload: { data: { is_closed: data.isClosed, menu_groups: [...groups].map(([group_name,menu_products]) => ({group_name,menu_products})) } } };
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

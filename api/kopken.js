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
async function jasdoryuk(path) {
  const response = await fetch("https://jasdoryuk.com/api/" + path, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Sumber outlet belum tersedia");
  const body = await response.json();
  if (!body?.data) throw new Error("Respons sumber tidak valid");
  return body.data;
}

function jasdoryukOutlet(outlet) {
  return {
    code: outlet.code, name: outlet.name, address: outlet.address || "",
    category: outlet.category || "", isOpen: typeof outlet.isOpen === "boolean" ? outlet.isOpen : null,
    openStatus: outlet.openStatus || outlet.order_msg || "",
  };
}

async function primary(params) {
  const action = params.get("action");
  if (action === "outlets") {
    const keyword = (params.get("keyword") || "").trim().slice(0, 100);
    const page = Math.max(1, Number(params.get("page")) || 1);
    if (keyword.length < 3) return { outlets: [], source: "jasdoryuk" };
    const data = await jasdoryuk("outlets?" + new URLSearchParams({
      fuzzy_name: keyword, page_index: String(page), page_size: "30",
    }));
    if (!Array.isArray(data.store)) throw new Error("Daftar outlet tidak valid");
    const outlets = data.store.filter(o => o.code && o.name).map(jasdoryukOutlet);
    if (page === 1) {
      const term = keyword.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim();
      const supplementary = term.length >= 3 ? await rows("outlets", {
        select: "code,name,address,is_open,open_status", brand: "eq.kenangan",
        is_active: "eq.true", name: "ilike.*" + term + "*", order: "name.asc", limit: "30",
      }).catch(() => []) : [];
      const existing = new Set(outlets.map(outlet => outlet.code));
      for (const outlet of supplementary) {
        if (!existing.has(outlet.code)) {
          outlets.push({ ...outletRow(outlet), isOpen: null, openStatus: "", catalogFallback: true });
          existing.add(outlet.code);
        }
      }
    }
    return { outlets,
      source: "jasdoryuk", page, hasMore: page < Number(data.pages || 1) };
  }
  const code = params.get("outletCode") || "";
  if (!/^[a-zA-Z0-9._-]{2,80}$/.test(code)) throw new Error("Kode outlet tidak valid");
  if (action === "status") {
    const data = await jasdoryuk("outlets?" + new URLSearchParams({
      fuzzy_name: code, page_index: "1", page_size: "30",
    }));
    const raw = data.store?.find(o => o.code === code);
    let outlet;
    let source = "jasdoryuk";
    if (raw) outlet = jasdoryukOutlet(raw);
    else {
      const response = await fetch("https://kopken.digitalinmad.my.id/miong/api/outlets/" + encodeURIComponent(code), {
        headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Status detail outlet belum tersedia");
      const detail = (await response.json())?.data?.store;
      if (!detail || detail.code !== code) throw new Error("Kode detail outlet tidak cocok");
      outlet = { ...jasdoryukOutlet(detail), canOrder: detail.canOrder, statusText: detail.statusText };
      source = "digitalinmad";
    }
    const onsite = /pesan di outlet|order at store|in.store only|hanya pesan di outlet/i.test(outlet.openStatus + " " + (outlet.statusText || ""));
    return { outletCode: code, source,
      status: onsite ? "onsite_only"
        : outlet.isOpen === false || outlet.canOrder === false ? "closed"
        : outlet.isOpen === true ? "open" : "unknown",
      message: outlet.openStatus, checkedAt: new Date().toISOString() };
  }
  const data = await jasdoryuk("outlets/" + encodeURIComponent(code) + "/menu");
  if (!Array.isArray(data.menu_groups) || !data.menu_groups.length) throw new Error("Menu kosong");
  const groups = new Map();
  for (const group of data.menu_groups) {
    for (const product of group.menu_products || []) {
      if (!product.id || !product.name || product.not_carried === true) continue;
      const categories = Array.isArray(product.categories) && product.categories.length ? product.categories : [group.group_name];
      for (const name of categories) {
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push({
          id: product.id, name: product.name, image: product.image, brand: "Kopi Kenangan",
          catalog_only: true, is_sold_out: product.is_sold_out === true,
          outlet_regular_price: Number(product.orig_price || product.normal_price || product.price) || undefined,
        });
      }
    }
  }
  if (!groups.size) throw new Error("Menu tidak valid");
  return { outletCode: code, source: "jasdoryuk", checkedAt: new Date().toISOString(),
    upstreamBackup: data.is_backup === true,
    payload: { data: { is_closed: data.is_closed, menu_groups: [...groups].map(([group_name,menu_products]) => ({group_name,menu_products})) } } };
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

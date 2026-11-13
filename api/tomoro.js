import { rows, refreshSourceMenu } from './kopken.js';

const PROMO_GROUPS = new Set(['TOMORO SIGNATURE','FLAVOURED DRINKS','FLAVORED DRINKS','FLAVORED LATTE','FLAVOURED LATTE','MILK BASED COFFEE','BLACK COFFEE','REFRESHING SERIES','MATCHA SERIES','TEA SERIES','MONT BLANC SERIES']);
export function isPromoProduct(p, stock) {
  const groups=Array.isArray(p.categories)?p.categories:[];
  const text=[p.name,...groups].join(' ');
  return p.is_small_available===true && Number(stock?.small_price)>0 && stock?.is_sold_out!==true
    && groups.length>0 && groups.every(g=>PROMO_GROUPS.has(String(g).toUpperCase()))
    && !/ice[ -]?cream|master|s\.?\s*o\.?\s*e\.?|frapp|jujutsu|kaisen|collab|kolaborasi|character cup|limited edition cup|one piece|sanrio|pokemon/i.test(text);
}
export function isAirportOutlet(o) { return /bandara|airport|soekarno.?hatta|juanda international|ngurah rai/i.test(o.name||''); }

const FALLBACK = 'https://omkboytvivjxoobyhumc.supabase.co/functions/v1/brand-catalog';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if(req.method !== 'GET')return res.status(405).json({error:'Method tidak didukung'});
  const params=new URL(req.url,'https://local.invalid').searchParams;
  const action=params.get('action');
  if(!['tomoro-outlets','tomoro-menu'].includes(action))return res.status(400).json({error:'Action tidak valid'});
  try {
    if(action==='tomoro-outlets') {
      const keyword=(params.get('keyword')||'').replace(/[^\p{L}\p{N}\s-]/gu,' ').trim().slice(0,100);
      if(keyword.length<3)return res.status(200).json({outlets:[],source:'akzara'});
      const outlets=await rows('outlets',{select:'code,name,address,is_open,open_status',brand:'eq.tomoro',is_active:'eq.true',name:'ilike.*'+keyword+'*',order:'name.asc',limit:'30'});
      return res.status(200).json({source:'akzara',outlets:outlets.filter(o=>o.code && !isAirportOutlet(o)).map(o=>({storeCode:o.code,storeName:o.name,storeAddress:o.address,isOpen:typeof o.is_open==='boolean'?o.is_open:null,openStatus:o.open_status||''}))});
    }
    const code=params.get('outletCode')||'';
    if(!/^[a-zA-Z0-9._-]{3,80}$/.test(code))throw Error('Invalid code');
    const [outlet]=await rows('outlets',{select:'code,name',brand:'eq.tomoro',is_active:'eq.true',code:'eq.'+code,limit:'1'});
    if(!outlet || isAirportOutlet(outlet))return res.status(400).json({error:'Voucher 50% tidak berlaku di outlet bandara atau outlet tidak ditemukan'});
    await refreshSourceMenu('tomoro',code);
    const [catalog,stock]=await Promise.all([
      rows('menu_items',{select:'product_code,name,image_url,is_small_available,categories',brand:'eq.tomoro',is_available:'eq.true',limit:'1000'}),
      rows('store_menus',{select:'product_code,is_sold_out,small_price',store_code:'eq.'+code,limit:'1000'})
    ]);
    if(!stock.length)throw Error('Missing inventory');
    const inventory=new Map(stock.map(p=>[String(p.product_code),p]));
    const products=catalog.filter(p=>isPromoProduct(p,inventory.get(String(p.product_code)))).map(p=>({productName:p.name,productCode:p.product_code,imageUrl:p.image_url,isSoldOut:inventory.get(String(p.product_code)).is_sold_out===true,catalog_only:true,small_only:true,promo_50:true}));
    if(!products.length)throw Error('Empty menu');
    return res.status(200).json({source:'akzara',products});
  } catch {
    if(action==='tomoro-menu')return res.status(503).json({error:'Menu Small untuk voucher 50% belum dapat diperiksa. Coba lagi.'});
    try {
      const headers={Accept:'application/json'};
      for(const key of ['apikey','authorization'])if(typeof req.headers[key]==='string')headers[key]=req.headers[key];
      const response=await fetch(FALLBACK+'?'+params,{headers,signal:AbortSignal.timeout(10000)});
      return res.status(response.status).json(await response.json());
    } catch {return res.status(503).json({error:'Menu Tomoro sementara tidak tersedia'});}
  }
}

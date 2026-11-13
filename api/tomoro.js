import { rows, refreshSourceMenu } from './kopken.js';
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
      return res.status(200).json({source:'akzara',outlets:outlets.filter(o=>o.code).map(o=>({storeCode:o.code,storeName:o.name,storeAddress:o.address,isOpen:typeof o.is_open==='boolean'?o.is_open:null,openStatus:o.open_status||''}))});
    }
    const code=params.get('outletCode')||'';
    if(!/^[a-zA-Z0-9._-]{3,80}$/.test(code))throw Error('Invalid code');
    const [outlet]=await rows('outlets',{select:'code',brand:'eq.tomoro',is_active:'eq.true',code:'eq.'+code,limit:'1'});
    if(!outlet)throw Error('Unknown outlet');
    await refreshSourceMenu('tomoro',code);
    const [catalog,stock]=await Promise.all([
      rows('menu_items',{select:'product_code,name,image_url',brand:'eq.tomoro',is_available:'eq.true',limit:'1000'}),
      rows('store_menus',{select:'product_code,is_sold_out',store_code:'eq.'+code,limit:'1000'})
    ]);
    if(!stock.length)throw Error('Missing inventory');
    const inventory=new Map(stock.map(p=>[String(p.product_code),p]));
    const products=catalog.filter(p=>inventory.has(String(p.product_code))).map(p=>({productName:p.name,productCode:p.product_code,imageUrl:p.image_url,isSoldOut:inventory.get(String(p.product_code)).is_sold_out===true,catalog_only:true}));
    if(!products.length)throw Error('Empty menu');
    return res.status(200).json({source:'akzara',products});
  } catch {
    try {
      const headers={Accept:'application/json'};
      for(const key of ['apikey','authorization'])if(typeof req.headers[key]==='string')headers[key]=req.headers[key];
      const response=await fetch(FALLBACK+'?'+params,{headers,signal:AbortSignal.timeout(10000)});
      return res.status(response.status).json(await response.json());
    } catch {return res.status(503).json({error:'Menu Tomoro sementara tidak tersedia'});}
  }
}

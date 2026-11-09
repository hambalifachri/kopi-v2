const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const api = fs.readFileSync(path.join(__dirname, "../assets/js/api.js"), "utf8");
const menu = { data: { menu_groups: [{ group_name: "Coffee", menu_products: [
  { id: 1, name: "Spanish Latte", brand: "Kopi Kenangan", price: 21000, orig_price: 24000 },
] }] } };
const code = "KK.KWG.RKAMDYNICKP";
const results = { children: [], appendChild(child) { this.children.push(child); }, set innerHTML(value) { this.children = []; } };
const requests = [];
let failSearch = false, failTomoro = false;
let pickupStatus = "open";
const localTomoro = { id:"tomoro-local",brand:"tomoro",name:"Local fallback",price:19000 };
const respond = data => ({ok:true,json:async()=>data});
const ctx = {
  window:{addEventListener(){},KOPI_SUPABASE_CONFIG:{url:"https://example.supabase.co",anonKey:"test"}},
  document:{addEventListener(){},getElementById:id=>id==="outletResults"?results:null,createElement:()=>({appendChild(){},addEventListener(){}})},
  console:{warn(){},error(){}},AbortSignal,menuItems:[localTomoro],
  BRANDS_DATA:[{id:"tomoro",defaultOptions:[]}],
  fetch:async url=>{
    const u=new URL(url); requests.push(u); assert.ok(u.hostname.endsWith(".supabase.co"),u.hostname);
    if(u.pathname.endsWith("/kopken-catalog")){
      if(u.searchParams.get("action")==="status"){
        assert.equal(u.searchParams.get("outletCode"),code);
        return respond({outletCode:code,status:pickupStatus});
      }
      if(failSearch)throw Error("catalog unavailable");
      return respond({outlets:[{code,name:"Ruko Ahmad Yani Cikampek",isOpen:null}]});
    }
    if(u.pathname.startsWith("/rest/v1/")){
      return respond(u.searchParams.has("outlet_code")?[{menu}]:[{outlet_code:code,outlet_name:"Ruko Ahmad Yani Cikampek"}]);
    }
    assert.equal(u.pathname,"/functions/v1/brand-catalog");
    if(u.searchParams.get("action")==="tomoro-outlets")return respond({outlets:[]});
    assert.equal(u.searchParams.get("action"),"tomoro-menu");
    if(failTomoro)throw Error("catalog unavailable");
    return respond({data:{categories:[{categoryName:"Coffee",products:[
      {productName:"Caffe Latte",price:23000},
      {productName:"Cappuccino",price:23000},
      {productName:"Americano",price:20000}
    ]}]}});
  }
};
vm.runInNewContext(api+'\nglobalThis.testApi={loadSupabaseKopkenMenu,buildDynamicKopiKenanganItems,loadLiveBrandMenu};',ctx);
(async()=>{
 await ctx.window.searchOutlets("Cikampek");
 assert.equal(results.children.length,1);
 assert.equal(results.children[0].disabled,false,"Unknown outlet status is not treated as closed");
 failSearch=true;
 await ctx.window.searchOutlets("Cikampek");
 assert.equal(results.children.length,1,"Table search fallback remains available");
 const data=await ctx.testApi.loadSupabaseKopkenMenu(code);
 const [item]=ctx.testApi.buildDynamicKopiKenanganItems(data.payload,new Map());
 assert.equal(item.name,"Spanish Latte");
 assert.equal(item.syncPending,false);
 ctx.window.kopiKenanganOutletState.outletCode=code;
 await ctx.window.requireKopkenPickupOpen();
 pickupStatus="closed";
 await assert.rejects(ctx.window.requireKopkenPickupOpen(),/Outlet sedang tutup/);
 assert.match(ctx.window.getKopkenPickupBlock(),/tutup/);
 pickupStatus="onsite_only";
 await assert.rejects(ctx.window.requireKopkenPickupOpen(),/langsung di lokasi/);
 pickupStatus="unknown";
 await assert.rejects(ctx.window.requireKopkenPickupOpen(),/belum bisa dicek/);
 assert.equal(ctx.window.getKopkenPickupBlock(),"");
 await ctx.window.searchLiveBrandOutlets("tomoro","Gobah");
 assert.equal(requests.at(-1).searchParams.get("action"),"tomoro-outlets");
 await ctx.testApi.loadLiveBrandMenu("tomoro","PKB08A");
 assert.equal(ctx.window.brandOutletStates.tomoro.source,"live");
 failTomoro=true;
 await ctx.testApi.loadLiveBrandMenu("tomoro","PKB08A");
 assert.equal(ctx.window.brandOutletStates.tomoro.source,"fallback");
 assert.equal(ctx.menuItems[0].id,"tomoro-local");
 console.log("Own catalog search, menu and fallback: OK.");
})().catch(e=>{console.error(e);process.exitCode=1;});

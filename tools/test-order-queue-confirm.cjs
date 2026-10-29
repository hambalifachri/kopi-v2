const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/js/order-queue.js','utf8');
async function setup(data, reply=true) {
  let calls=0, prompts=[];
  const ctx={
    window:{confirm:message=>(prompts.push(message),reply)},
    document:{visibilityState:'visible',querySelectorAll:()=>[{querySelector:()=>({})}],querySelector:()=>null,getElementById:()=>null,addEventListener(){}},
    activeBrandId:'kopi-kenangan',getCartBrandId:()=> 'kopi-kenangan',
    cart:new Map([['1',{}]]),buildStoredOrderBatches:()=>[{},{}],
    MutationObserver:class {observe(){}},AbortController,setTimeout,clearTimeout,setInterval(){},
    fetch:async()=>{calls++;if(data instanceof Error)throw data;return {ok:true,json:async()=>data};},
  };
  vm.createContext(ctx);vm.runInContext(source,ctx);
  await ctx.window.confirmKopkenQueue();
  return {ctx,prompts,calls:()=>calls};
}
(async()=>{
  const busy=await setup({batches:5,minMinutes:10,maxMinutes:20,mode:'sequential'},false);
  assert.equal(await busy.ctx.window.confirmKopkenQueue(),false);
  assert.match(busy.prompts[0],/5 batch/);assert.match(busy.prompts[0],/10–20 menit/);
  assert.match(busy.prompts[0],/2 batch/);assert.equal(busy.ctx.cart.size,1);
  const accepted=await setup({batches:5,minMinutes:10,maxMinutes:20,mode:'sequential'});
  assert.equal(await accepted.ctx.window.confirmKopkenQueue(),true);
  assert.equal(accepted.prompts.length,1);assert.equal(accepted.calls(),1);
  const empty=await setup({batches:0,minMinutes:0,maxMinutes:0,mode:'sequential'});
  assert.equal(empty.prompts.length,0);
  const failed=await setup(new Error('offline'),false);
  assert.match(failed.prompts[0],/belum dapat dipastikan/);
  console.log('Queue confirmation: decline preserves cart, estimate and batch count, accepted cache, empty queue, failed connection.');
})().catch(error=>{console.error(error);process.exitCode=1;});

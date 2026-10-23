const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(require('node:path').join(__dirname,'../assets/js/order-receipt.js'),'utf8');
const context={window:{},Intl,Date};vm.runInNewContext(src,context);
const build=context.window.KopiOrderReceipt.buildHtml;
const sample={id:'ORD-123',created_at:'2026-10-23T01:00:00Z',customer_name:'<img src=x onerror=alert(1)>',status:'processing',subtotal:20000,total:23000,service_fee:1000,takeaway_plastic_fee:2000};
const html=build(sample,[{number:1,sellingTotal:20000,items:[{name:'A & B',qty:2,price:10000,options:{size:'Large'},note:'<script>bad</script>'}]}]);
assert(html.includes('&lt;img'));assert(!html.includes('<script>bad'));assert(html.includes('08.00'));assert(html.includes('WIB'));assert(html.includes('23.000'));assert(html.includes('20.000'));assert(html.includes('Diproses'));assert(!html.includes('Lunas'));
context.window.open=()=>null;assert.throws(()=>context.window.KopiOrderReceipt.printOrder(sample,[]),/pop-up/);
console.log('Receipt totals, quantities, fees, WIB, HTML escaping, status and blocked popup checks passed.');

// Tests for the product editor upgrades (ds-editor.js): colour naming, variant builder markup, action bar, no circular buttons.
// Run from the repository root: node tools/web-seller-tests/ds-editor.js
const {make,J,vm}=require('./harness');const assert=require('assert');let pass=0,fail=0;
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message);process.exitCode=1}};
const icons=require('fs').readFileSync(require('path').join(__dirname,'../../shared/icons.js'),'utf8');
const EDITOR='<h1>Edit</h1><form data-form="wsprod" id="wsform"><div class="card" id="ds-sec-variants"><h3>Variants</h3><p class="sm">q</p><div class="seg" aria-label="Variants"></div><div id="wsvopts"><div class="fgrid"></div><div id="wstbl"></div></div></div>'
 +'<div class="actbar"><a class="btn o" href="/portal/products">Cancel</a><button class="btn o" type="submit" value="draft">Save draft</button><button class="btn" type="submit" value="review">Submit for review</button></div></form>';
function ed(o){o=o||{};const x=make({});
  x.ctx.document={documentElement:{classList:{toggle(){},add(){},remove(){}}},body:null,getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
  x.ctx.Core.path=()=>'/portal';vm.runInContext(icons,x.ctx);vm.runInContext(J('ds.js'),x.ctx);
  x.V.portal=()=>Promise.resolve({layout:'portal',title:'Product',active:'portal/products',html:o.html||EDITOR});
  x.ctx.DS.spOk=()=>o.spOk!==false;x.ctx.DS.spVals=()=>({});
  vm.runInContext(J('ds-editor.js'),x.ctx);return x}
(async()=>{
 await t('colour names: RGB is translated to plain colour language',()=>{
   const n=ed().ctx.DS.colourName;
   const E={'#000000':'Black','#FFFFFF':'White','#7B4A2B':'Brown','#A9744F':'Light Brown','#4A2C1A':'Dark Brown','#14213D':'Navy','#D62828':'Red','#2E9E5B':'Green','#F4A6C0':'Pink'};
   for(const h in E)assert.equal(n(h),E[h],h);
   assert.equal(n('#8b5a3c'),'Brown');assert.equal(n('#c0392b'),'Red')});
 await t('editor: variant builder replaces the radio and four inputs (they stay hidden in the form), hidden colour map only when specs loaded',async()=>{
   const r=await ed().V.portal(['product','p1']);
   assert(r.html.includes('id="ds-vb"')&&r.html.includes('Options and variants')&&r.html.includes('name="attr_variant_colours"')&&r.html.includes('value="json"'));
   assert(r.html.includes('Price, photo and SKU for each variant are not available yet'));
   const q=await ed({spOk:false}).V.portal(['product','p1']);assert(!q.html.includes('attr_variant_colours'),'never sends attributes when specs failed to load')});
 await t('action bar: rectangles, close icon, Save draft and Send for review; no oversized circular buttons',async()=>{
   const r=await ed().V.portal(['product','p1']);
   assert(r.html.includes('actbar ds-bar')&&r.html.includes('aria-label="Cancel and go back"')&&r.html.includes('value="draft">Save draft')&&r.html.includes('Send for review')&&!r.html.includes('Submit for review'));
   assert(r.html.includes('value="review"')&&r.html.includes('id="ds-barp"'));
   const css=require('fs').readFileSync(require('path').join(__dirname,'../../web/assets/css/ds.css'),'utf8');
   assert(!/\.ds-bar[^{]*\{[^}]*border-radius:\s*(50%|999px|9999px)/.test(css))});
 await t('action bar: a published product only offers Save changes',async()=>{
   const h=EDITOR.replace('<button class="btn o" type="submit" value="draft">Save draft</button><button class="btn" type="submit" value="review">Submit for review</button>','<button class="btn" type="submit" value="save">Save changes</button>');
   const r=await ed({html:h}).V.portal(['product','p1']);assert(r.html.includes('value="save"')&&!r.html.includes('value="review"')&&!r.html.includes('Save draft'))});
 await t('a problem while decorating the editor returns the original editor, not an error',async()=>{
   const x=ed();x.ctx.DS.spOk=()=>{throw new Error('boom')};const r=await x.V.portal(['product','p1']);assert.equal(r.html,EDITOR)});
 await t('other pages are untouched; actions are ds- prefixed',async()=>{
   const x=ed();assert.equal((await x.V.portal(['orders'])).html,EDITOR);
   Object.keys(x.A).forEach(k=>assert(k.startsWith('ds-'),k));['ds-vo-add','ds-vo-edit','ds-vo-del','ds-vo-fill','ds-sp-pick','ds-ms-add'].forEach(k=>assert.equal(typeof x.A[k],'function',k))});
 console.log(`${pass} passed, ${fail} failed`);
})();

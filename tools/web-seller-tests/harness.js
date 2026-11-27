// Minimal browser stand-ins so the seller and admin page builders can run in Node. Data shapes match staging.
// Run from the repository root: node tools/web-seller-tests/run.js   (set WEB_JS to test another scripts folder)
const fs=require('fs'),vm=require('vm');
const path=require('path');
const J=(p)=>fs.readFileSync(path.join(process.env.WEB_JS||path.join(__dirname,'../../web/assets/js'),p),'utf8');
const PLANS=[{id:'plan-free',name:'Free',price:0,period:'monthly',product_limit:5,commission_discount:0,features:["Seller storefront","Basic seller workspace","Up to 5 active products","Up to 2 new product listings per day","Basic catalogue and order workspace"]},
{id:'plan-starter',name:'Starter',price:3000,period:'monthly',product_limit:25,commission_discount:0,features:["Up to 25 products","Standard commission","Seller dashboard and earnings","Hub or direct delivery"]},
{id:'plan-growth',name:'Growth',price:8000,period:'monthly',product_limit:200,commission_discount:2,features:["Up to 200 products","2 points lower commission","Seller dashboard and earnings","Hub or direct delivery"]},
{id:'plan-pro',name:'Pro',price:20000,period:'monthly',product_limit:null,commission_discount:4,features:["Unlimited products","4 points lower commission","Seller dashboard and earnings","Hub or direct delivery"]}];
const ENTS=[{plan_id:'plan-free',active_product_limit:5,active_products_unlimited:false,daily_new_product_limit:2,daily_new_products_unlimited:false,verification_included:false,verification_required_to_activate:false},
{plan_id:'plan-starter',active_product_limit:25,active_products_unlimited:false,daily_new_product_limit:null,daily_new_products_unlimited:true,verification_included:false,verification_required_to_activate:false},
{plan_id:'plan-growth',active_product_limit:200,active_products_unlimited:false,daily_new_product_limit:null,daily_new_products_unlimited:true,verification_included:true,verification_required_to_activate:true},
{plan_id:'plan-pro',active_product_limit:null,active_products_unlimited:true,daily_new_product_limit:null,daily_new_products_unlimited:true,verification_included:true,verification_required_to_activate:true}];
const RULES=['business_address','face_liveness','identity','phone'].map(c=>({check_type:c,country:'NG',required:true,requirement_scope:'commercial',enabled:true,help_text:null}));
function make(over){
  const calls=[];
  const Supa={uid:()=> 'u1',calls,
    get(p){calls.push('GET '+p);
      if(p.startsWith('store_plans'))return Promise.resolve(PLANS);
      if(p.startsWith('seller_plan_entitlements'))return Promise.resolve(over.ents===undefined?ENTS:over.ents);
      if(p.startsWith('seller_verification_rules'))return Promise.resolve(RULES);
      if(p.startsWith('store_verification_checks'))return Promise.resolve(over.checks||[]);
      if(p.startsWith('stores?select=*&owner_id'))return Promise.resolve([over.store]);
      if(p.startsWith('store_applications'))return Promise.resolve([over.app||{plan_id:null}]);
      if(p.startsWith('products?'))return Promise.resolve(over.products||[]);
      if(p.startsWith('notifications'))return Promise.resolve([]);
      return Promise.resolve([]);},
    rpc(f,a){calls.push('RPC '+f+' '+JSON.stringify(a));
      if(f==='seller_plan_catalog')return Promise.reject(new Error('Could not find the function'));
      if(f==='my_store_entitlements')return over.entFn?over.entFn():Promise.resolve(over.ent);
      if(f==='my_seller_orders')return Promise.resolve(over.orders||[]);
      if(f==='choose_plan'){over.chosen=a.p_plan;return Promise.resolve(null)}
      if(f==='request_store_activation')return Promise.resolve(over.act||{activated:false,reason_code:'X'});
      return Promise.resolve(null)}};
  const A={},F={},V={portal:()=>Promise.resolve({layout:'portal',html:'BASE'}),admin:null};
  const Core={V,A,F,esc:s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
    money:n=>'₦'+Number(n||0).toLocaleString('en-NG'),when:t=>t?'D':'',ago:()=> 'now',toast(m,e){calls.push('TOAST '+(e?'E ':'')+m)},go(){},empty:(t)=>'EMPTY '+t,me:()=>({role:'admin'})};
  const ctx={window:null,Core,Supa,CFG:{countries:{NG:'Nigeria'}},matchMedia:()=>({matches:false}),document:{body:{contains:()=>true},getElementById:()=>null,querySelector:()=>null,addEventListener(){}},location:{pathname:'/portal'},Intl,Promise,console,setTimeout,requestAnimationFrame:f=>0,addEventListener(){},Math,Object,Array,String,Number,JSON,Date,Error};
  ctx.window=ctx;vm.createContext(ctx);return{ctx,calls,A,F,V,Supa};
}
module.exports={make,J,PLANS,ENTS,RULES,vm};

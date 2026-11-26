/* G-Exp financial reference: Firestore only. No localStorage business data writes.
 * Legacy browser finance data remains untouched, with explicit opt-in review/import.
 */
(function(){
'use strict';
const SCHEMA='GEXP-FIN-1';
const COLLECTION={links:'financialBudgetLinks',budgets:'financialBudgets',costObjects:'financialCostObjects',allocations:'financialAllocations',actuals:'financialActuals',adjustments:'financialAdjustments',commitments:'financialCommitments',forecasts:'financialForecasts'};
const buckets=Object.keys(COLLECTION);
const now=()=>new Date().toISOString();
const uid=p=>p+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
const clone=x=>JSON.parse(JSON.stringify(x));
let readyPromise=null,hydrated=false,lastError=null;
function store(){if(!window.GEStore||GEStore.source!=='Firestore')throw Error('G-Exp online data service unavailable.');return GEStore;}
function read(){const state=store().get();return {schemaVersion:SCHEMA,...Object.fromEntries(buckets.map(b=>[b,Array.isArray(state[COLLECTION[b]])?state[COLLECTION[b]]:[]])),onlineReady:hydrated,readError:lastError?.message||''};}
async function ready(){if(readyPromise)return readyPromise;readyPromise=(async()=>{await store().waitAuth();await store().hydrate(Object.values(COLLECTION));hydrated=true;lastError=null;window.dispatchEvent(new CustomEvent('gexp-financial-ready'));return read();})().catch(e=>{lastError=e;readyPromise=null;window.dispatchEvent(new CustomEvent('gexp-financial-error',{detail:{message:e.message}}));throw e});return readyPromise;}
function list(bucket,filter={}){if(!COLLECTION[bucket])throw Error('Unknown financial group.');return read()[bucket].filter(x=>Object.entries(filter).every(([k,v])=>v===''||v==null||String(x[k])===String(v)));}
function actor(){return window.gxGetSession?.()||{};}
function allowedStation(st){const a=actor();if(a.role==='Super Admin'||String(a.scopeType||'').toUpperCase()==='ALL'||(['Head Office','GE Team','Ground Experience Team'].includes(a.role)&&a.accessLevel==='Admin'))return true;const s=(Array.isArray(a.assignedStations)&&a.assignedStations.length?a.assignedStations:Array.isArray(a.airports)?a.airports:[]).map(x=>String(typeof x==='object'?x.stationCode||x.code||x.iata:x).toUpperCase());return !!st&&s.includes(String(st).toUpperCase());}
function validate(bucket,x){if(!COLLECTION[bucket])throw Error('Unknown financial group.');if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Invalid financial record.');const station=String(x.station||x.stationCode||x.airport||'').trim().toUpperCase();if(station&&!allowedStation(station))throw Error('Station outside account scope.');if(['Approved','Verified'].includes(String(x.status||''))&&!(['Super Admin','Admin'].includes(actor().role)||actor().accessLevel==='Admin'))throw Error('Approval requires authorized management.');if(bucket==='allocations'&&x.budgetId&&x.costObjectId&&x.budgetId===x.costObjectId)throw Error('Budget and cost object must be separate references.');for(const k of ['amount','approvedAmount','proposedAmount','forecastAmount','actualAmount'])if(x[k]!==undefined&&x[k]!==null&&x[k]!==''&&!Number.isFinite(Number(x[k])))throw Error(k+' must be a valid number.');}
async function save(bucket,r){await ready();const before=r?.id?list(bucket).find(x=>String(x.id)===String(r.id)):null;const x={...(before||{}),...clone(r||{}),id:r?.id||uid(bucket.slice(0,3)),updatedAt:now()};if(!x.status)x.status='Draft';if(!before)x.createdAt=now();validate(bucket,x);await store().saveRecord(COLLECTION[bucket],before?'UPDATE':'CREATE',x.id,x);return list(bucket).find(y=>String(y.id)===String(x.id))||x;}
function legacy(){return store().get()||{};}
function initiative(id){return (legacy().initiatives||[]).find(x=>String(x.id)===String(id))||null;}
function costObject(id){return list('costObjects').find(x=>String(x.id)===String(id))||null;}
function budget(id){return list('budgets').find(x=>String(x.id)===String(id))||null;}
function amount(v){return v===''||v==null?null:Number.isFinite(Number(v))?Number(v):null;}
function sum(vals){const v=vals.filter(x=>x!==null&&Number.isFinite(x));return v.length?v.reduce((a,b)=>a+b,0):null;}
function financialForCostObject(id){const co=costObject(id);if(!co)return null;const alloc=list('allocations',{costObjectId:id}),act=list('actuals',{costObjectId:id}),comm=list('commitments',{costObjectId:id}),forecast=list('forecasts',{costObjectId:id});const allocated=sum(alloc.map(x=>amount(x.amount))),actual=sum(act.map(x=>amount(x.amount))),committed=sum(comm.map(x=>amount(x.outstandingAmount??x.amount))),forecastAmount=sum(forecast.map(x=>amount(x.amount)));return {costObject:co,allocated,actual,committed,forecast:forecastAmount,variance:allocated===null||actual===null?null:allocated-actual,allocationCount:alloc.length,actualCount:act.length};}
function financialForInitiative(id){const cos=list('costObjects',{initiativeId:String(id)}),rows=cos.map(x=>financialForCostObject(x.id));return {initiative:initiative(id),costObjects:rows,allocated:sum(rows.map(x=>x.allocated)),actual:sum(rows.map(x=>x.actual)),committed:sum(rows.map(x=>x.committed)),forecast:sum(rows.map(x=>x.forecast))};}
function variance(b,a){return b==null||a==null?null:Number(b)-Number(a);}
function utilization(a,b){return a==null||b==null||Number(b)===0?null:Number(a)/Number(b)*100;}
function costPerImprovementPoint(actual,improvement){return actual==null||improvement==null||Number(improvement)===0?null:Number(actual)/Number(improvement);}
function financialSummary(id,improvement){const x=financialForInitiative(id);return {...x,variance:variance(x.allocated,x.actual),utilization:utilization(x.actual,x.allocated),costPerImprovementPoint:costPerImprovementPoint(x.actual,improvement)};}
function budgetPosition(id){
 const b=budget(id);if(!b)return null;
 const current=amount(b.revisedApprovedAmount??b.approvedAmount);
 const allocations=list('allocations',{budgetId:id});
 // Costs shared between BO and HO must be allocated explicitly to a funding source.
 // Never allocate the full actual of one cost object to two budgets.
 const linked=[...new Set(allocations.map(x=>String(x.costObjectId||'')).filter(Boolean))];
 const belongsToBudget=(row,costObjectId)=>String(row.budgetId||'')===String(id)||(!row.budgetId&&new Set(list('allocations',{costObjectId}).map(x=>String(x.budgetId||''))).size===1);
 const actualRows=linked.flatMap(costObjectId=>list('actuals',{costObjectId}).filter(row=>belongsToBudget(row,costObjectId)));
 const ambiguous=linked.some(costObjectId=>{
  const sources=new Set(list('allocations',{costObjectId}).map(x=>String(x.budgetId||'')));
  return sources.size>1&&list('actuals',{costObjectId}).some(x=>!x.budgetId);
 });
 const actual=sum(actualRows.map(x=>amount(x.amount)));
 const commitments=linked.flatMap(costObjectId=>list('commitments',{costObjectId}).filter(row=>belongsToBudget(row,costObjectId)));
 const committed=sum(commitments.map(x=>amount(x.outstandingAmount??x.amount)));
 return {budget:b,approved:current,actual,committed,ambiguousFunding:ambiguous,
  remainingVsActual:current===null||actual===null||ambiguous?null:current-actual,
  availableAfterCommitments:current===null||actual===null||committed===null||ambiguous?null:current-actual-committed};
}
function integrity(){const d=read(),issues=[];d.costObjects.forEach(x=>{if(x.initiativeId&&!initiative(x.initiativeId))issues.push({type:'ORPHAN_INITIATIVE',id:x.id})});d.allocations.forEach(x=>{if(!costObject(x.costObjectId))issues.push({type:'ORPHAN_ALLOCATION',id:x.id});if(x.budgetId&&!budget(x.budgetId))issues.push({type:'ORPHAN_BUDGET',id:x.id})});d.actuals.forEach(x=>{if(!costObject(x.costObjectId))issues.push({type:'ORPHAN_ACTUAL',id:x.id})});return {ok:!issues.length,issues};}
function stats(){const d=read();return {budgets:d.budgets.length,costObjects:d.costObjects.length,allocations:d.allocations.length,actuals:d.actuals.length,integrity:integrity(),onlineReady:hydrated};}
const LEGACY_KEY='GE_V257_BUDGET_COST_P4';
function inspectLegacy(){let v;try{v=JSON.parse(localStorage.getItem(LEGACY_KEY)||'null')}catch{return {found:false,error:'Legacy record is malformed.'}};return {found:!!v,counts:Object.fromEntries(buckets.map(k=>[k,Array.isArray(v?.[k])?v[k].length:0])),requiresReview:true};}
async function importLegacyReviewed({confirmed=false}={}){if(!confirmed)throw Error('Explicit user confirmation required to import browser financial records.');await ready();const src=JSON.parse(localStorage.getItem(LEGACY_KEY)||'null');if(!src)throw Error('No browser financial data found.');const report={imported:0,skipped:0,errors:[]};for(const bucket of buckets){for(const item of Array.isArray(src[bucket])?src[bucket]:[]){if(!item.id||list(bucket).some(x=>String(x.id)===String(item.id))){report.skipped++;continue}try{await save(bucket,{...item,status:'Draft',migrationSource:'GE_V257_BUDGET_COST_P4'});report.imported++}catch(e){report.errors.push({bucket,id:item.id,message:e.message})}}}return report;/* Legacy browser data is intentionally not deleted. */}
window.GEBudgetCost={schemaVersion:SCHEMA,read,ready,list,save,budget,costObject,initiative,financialForCostObject,financialForInitiative,budgetPosition,variance,utilization,costPerImprovementPoint,financialSummary,integrity,stats,inspectLegacy,importLegacyReviewed};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>ready().catch(()=>{}));else ready().catch(()=>{});
})();

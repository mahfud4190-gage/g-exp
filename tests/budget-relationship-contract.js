'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),server=fs.readFileSync(path.join(root,'netlify/functions/edition1-data.js'),'utf8'),client=fs.readFileSync(path.join(root,'assets/gexp-budget-relationships.js'),'utf8');
for(const phrase of ['LINK_BUDGET_INITIATIVE','UNLINK_BUDGET_INITIATIVE','SUBMIT_BUDGET_REALLOCATION','DECIDE_BUDGET_REALLOCATION'])assert(server.includes(phrase));
assert(client.includes('Confirm')&&client.includes('Initiative'));
const records=new Map(),clone=x=>JSON.parse(JSON.stringify(x));let seq=0;
function snap(p){const v=records.get(p);return {id:p.split('/').at(-1),exists:!!v,data:()=>v?clone(v):undefined};}
function doc(p){return {path:p,id:p.split('/').at(-1),get:async()=>snap(p)};}
function collection(p){return {doc:(id)=>doc(p+'/'+(id||'auto-'+(++seq))),where:(key,op,val)=>({p,key,val})};}
const dataRef=(db,col,id)=>doc('portalData/'+col+'/records/'+id),dataQuery=(db,col)=>collection('portalData/'+col+'/records');
const db={collection:name=>({doc:id=>({...doc(name+'/'+id),collection:child=>collection(name+'/'+id+'/'+child)})}),runTransaction:async fn=>{
 const writes=[],tx={get:async ref=>ref.p?{docs:[...records].filter(([key,val])=>key.startsWith(ref.p+'/')&&val[ref.key]===ref.val).map(([key,val])=>({id:key.split('/').at(-1),data:()=>clone(val)}))}:snap(ref.path),create:(ref,v)=>writes.push([ref,'create',v]),update:(ref,v)=>writes.push([ref,'update',v])};
 const result=await fn(tx);for(const [ref,action,v] of writes){if(action==='create')assert(!records.has(ref.path),'duplicate creation');if(action==='update')assert(records.has(ref.path),'update missing');records.set(ref.path,{...(action==='create'?{}:records.get(ref.path)||{}),...clone(v)});}return result;
 }};
const start=server.indexOf('// Canonical budget relationships and governed reallocations.'),end=server.indexOf('async function budgetWorkbookImport(db,actor,body){',start);
assert(start>0&&end>start);
const sandbox={require,FieldValue:{increment:n=>n},dataRef,dataQuery,cleanId:x=>String(x),isExternalActor:()=>false,canWrite:()=>true,isOperationalAdmin:x=>x.role==='Super Admin'||x.role==='Admin',inScope:(actor,row)=>!row.station||actor.role==='Super Admin'||row.station==='CGK',bumpCacheVersion:async()=>{},console,Date};
vm.createContext(sandbox);vm.runInContext(server.slice(start,end)+'\nthis.relationship=budgetRelationshipAction;',sandbox);const run=sandbox.relationship;
const requester={id:'staff',role:'Editor'},approver={id:'boss',role:'Super Admin'};
function seed(col,id,v){records.set(dataRef(db,col,id).path,v);}
seed('financialBudgets','b1',{name:'Lounge',year:2027,currency:'IDR',approvedAmount:1000,station:'CGK'});
seed('financialBudgets','b2',{name:'Station Systems',year:2027,currency:'IDR',approvedAmount:500,station:'CGK'});
seed('initiatives','i1',{name:'Service Improvement',station:'CGK'});
async function fail(action,code){let c='';try{await action()}catch(e){c=e.code;}assert.equal(c,code);}
(async()=>{
 const link=await run(db,requester,{action:'LINK_BUDGET_INITIATIVE',budgetId:'b1',initiativeId:'i1',allocatedAmount:800});assert.equal(link.status,'Active');
 await fail(()=>run(db,requester,{action:'LINK_BUDGET_INITIATIVE',budgetId:'b1',initiativeId:'i1',allocatedAmount:1200}),'ALLOCATION_EXCEEDS_BUDGET');
 await fail(()=>run(db,requester,{action:'UNLINK_BUDGET_INITIATIVE',budgetId:'b1',initiativeId:'i1'}),'ALLOCATION_RELEASE_REQUIRED');
 const request=await run(db,requester,{action:'SUBMIT_BUDGET_REALLOCATION',sourceBudgetId:'b1',destinationBudgetId:'b2',amount:300,reason:'Reallocate support',reference:'REQ-001'});
 await fail(()=>run(db,requester,{action:'DECIDE_BUDGET_REALLOCATION',reallocationId:request.id,decision:'APPROVE'}),'APPROVER_REQUIRED');
 await fail(()=>run(db,approver,{action:'DECIDE_BUDGET_REALLOCATION',reallocationId:request.id,decision:'APPROVE'}),'SOURCE_FUNDS_RESERVED');
 assert.equal(records.get(dataRef(db,'financialBudgets','b1').path).revisedApprovedAmount,undefined);
 await run(db,requester,{action:'LINK_BUDGET_INITIATIVE',budgetId:'b1',initiativeId:'i1',allocatedAmount:600});
 const result=await run(db,approver,{action:'DECIDE_BUDGET_REALLOCATION',reallocationId:request.id,decision:'APPROVE'});
 assert.equal(result.status,'Approved');assert.equal(records.get(dataRef(db,'financialBudgets','b1').path).revisedApprovedAmount,700);assert.equal(records.get(dataRef(db,'financialBudgets','b2').path).revisedApprovedAmount,800);
 await fail(()=>run(db,approver,{action:'DECIDE_BUDGET_REALLOCATION',reallocationId:request.id,decision:'APPROVE'}),'ALREADY_DECIDED');
 const rejected=await run(db,requester,{action:'SUBMIT_BUDGET_REALLOCATION',sourceBudgetId:'b2',destinationBudgetId:'b1',amount:50,reason:'Reverse part',reference:'REQ-002'});await run(db,approver,{action:'DECIDE_BUDGET_REALLOCATION',reallocationId:rejected.id,decision:'REJECT'});
 assert.equal(records.get(dataRef(db,'financialBudgets','b1').path).revisedApprovedAmount,700);
 console.log('BUDGET_RELATIONSHIPS_PASS link allocation limits, unlink protection, submission, approval/denial, immutable decision, reserved funds, audit');
})().catch(e=>{console.error(e);process.exitCode=1});

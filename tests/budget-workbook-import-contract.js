'use strict';
const assert=require('assert'), fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..'),ui=fs.readFileSync(path.join(root,'assets/gexp-budget-workbook-import.js'),'utf8');
const server=fs.readFileSync(path.join(root,'netlify/functions/edition1-data.js'),'utf8');
const registry=fs.readFileSync(path.join(root,'assets/clean-page-registry.js'),'utf8');
assert(registry.includes('gexp-budget-workbook-import.js'));
assert(registry.includes('initiativeWorkProgramRegister'));
assert(ui.includes('Preview &amp; Validate')&&ui.includes('Confirm Import'));
assert(server.includes('IMPORT_BUDGET_WORKBOOK'));
assert(server.includes('Only Superadmin may register missing Cost Elements.'));
const start=server.indexOf('// Work Program / Activity / Budget workbook import.'),end=server.indexOf('exports.handler=async',start);
assert(start>0&&end>start);
const records=new Map();let randomSeq=1;
const clone=x=>JSON.parse(JSON.stringify(x));
function doc(path){const id=path.split('/').at(-1);return {path,id,get:async()=>snap(path)};}
function snap(path){const v=records.get(path);return {id:path.split('/').at(-1),exists:!!v,data:()=>v?clone(v):undefined};}
function collection(prefix){return {doc:(id)=>doc(prefix+'/'+(id||'generated-'+randomSeq++)),get:async()=>({docs:[...records].filter(([k])=>k.startsWith(prefix+'/')&&k.slice(prefix.length+1).indexOf('/')<0).map(([k])=>({id:k.split('/').at(-1),data:()=>clone(records.get(k))}))}),where(field,op,value){assert.equal(op,'==');return {prefix,field,value};}};}
const db={collection:(name)=>({doc:(id)=>({...doc(name+'/'+id),collection:(child)=>collection(name+'/'+id+'/'+child)})}),runTransaction:async fn=>{const writes=[];const tx={get:async ref=>{if(ref.prefix){return {docs:[...records].filter(([key,val])=>key.startsWith(ref.prefix+'/')&&val[ref.field]===ref.value).map(([key,val])=>({id:key.split('/').at(-1),data:()=>clone(val)}))};}return snap(ref.path);},create:(ref,v)=>writes.push({op:'CREATE',ref,v}),set:(ref,v,opts)=>writes.push({op:'SET',ref,v}),update:(ref,v)=>writes.push({op:'UPDATE',ref,v})};const result=await fn(tx);const paths=new Set();for(const w of writes){if(paths.has(w.ref.path))throw Error('Duplicate transaction write '+w.ref.path);paths.add(w.ref.path);if(w.op==='CREATE'&&records.has(w.ref.path))throw Error('Create existing doc '+w.ref.path);}for(const {op,ref,v} of writes){records.set(ref.path,{...(op==='CREATE'?{}:records.get(ref.path)||{}),...v});}return result;}};
const dataRef=(_,c,id)=>doc('portalData/'+c+'/records/'+id),dataQuery=(_,c)=>collection('portalData/'+c+'/records');
const sandbox={require,db,dataRef,dataQuery,FieldValue:{serverTimestamp:()=> '2026-11-26T00:00:00Z',increment:n=>n},canWrite:()=>true,isExternalActor:()=>false,isOperationalAdmin:()=>false,inScope:()=>true,ownerKey:x=>String(x||'').trim().toUpperCase(),console,Set,Map,Number,String};
vm.createContext(sandbox);vm.runInContext(server.slice(start,end)+'\nthis.importFn=budgetWorkbookImport;',sandbox);
const f=sandbox.importFn,actor={id:'user1',role:'Super Admin'};
async function check(){
 const list=[{kind:'SUMMARY',sourceRow:2,pkNumber:23,akNumber:1,program:'Garuda Executive Lounge',activity:'CGK Lounge Improvement',pkCode:'27.DN.JKTCS.23',akCode:'27.DN.JKTCS.23.1',costElement:'5601506',costCenter:'JKTCGGA',currency:'IDR',quantity:4,rate:1000,total:4000},{kind:'SUMMARY',sourceRow:3,pkNumber:23,akNumber:2,program:'Garuda Executive Lounge',activity:'DPS Lounge Improvement',pkCode:'27.DN.JKTCS.23',akCode:'27.DN.JKTCS.23.2',costElement:'5601506',costCenter:'JKTCGGA',currency:'IDR',quantity:2,rate:1000,total:2000},{kind:'LOUNGE',sourceRow:3,station:'UPG',provider:'Prayana Lounge',costElement:'5390009',costCenter:'UPGKK',currency:'IDR',year:2027,rate:126500,visitors:31765}];
 const base={owner:'DN.JKTCS',year:2027,rows:list};
 let preview=await f(db,actor,{...base,mode:'PREVIEW'});assert(preview.conflicts.length===3&&preview.preview);
 preview=await f(db,actor,{...base,mode:'PREVIEW',includeMissingCostElements:true,costElements:[{code:'5601506',name:'Leasehold Improvement'},{code:'5390009',name:'Lounge Expense'}]});assert(!preview.conflicts.length&&preview.newCostElements===2);
 const out=await f(db,actor,{...base,mode:'COMMIT',confirmed:true,includeMissingCostElements:true,costElements:[{code:'5601506',name:'Leasehold Improvement'},{code:'5390009',name:'Lounge Expense'}]});assert(out.committed&&out.newRecords>=7);
 const budgets=[...records].filter(([k])=>k.startsWith('portalData/financialBudgets/records/')).map(([k,v])=>v);assert.equal(budgets.length,3);assert(budgets.every(b=>b.status==='Draft'&&b.approvedAmount===null&&/^BGT-\d+$/.test(b.businessCode)));
 const activities=[...records].filter(([k])=>k.startsWith('portalData/workActivities/records/')).map(([k,v])=>v);assert.deepEqual(activities.map(a=>a.akCode).sort(),['27.DN.JKTCS.23.1','27.DN.JKTCS.23.2']);
 const retry=await f(db,actor,{...base,mode:'COMMIT',confirmed:true});assert.equal(retry.newRecords,0);
 let rejected=false;try{await f(db,actor,{...base,rows:[{...list[0],total:6000}],mode:'COMMIT',confirmed:true});}catch(e){rejected=e.code==='IMPORT_EXISTING_CONFLICT';}assert(rejected,'changed proposed values must not silently overwrite');
 const newAK={...list[0],sourceRow:4,akNumber:null,akCode:'',activity:'New Activity',total:8000};const next=await f(db,actor,{...base,rows:[newAK],mode:'COMMIT',confirmed:true});assert(next.newRecords>0);const acts=[...records].filter(([k,v])=>k.startsWith('portalData/workActivities/records/')&&v.name==='New Activity').map(([,v])=>v);assert.equal(acts.length,1);assert.equal(acts[0].akCode,'27.DN.JKTCS.23.3');
 const sameLabelDifferentCode={...list[0],sourceRow:27,pkNumber:70,akNumber:1,pkCode:'27.DN.JKTCS.70',akCode:'27.DN.JKTCS.70.1',total:9000};
 const incomplete={...list[2],sourceRow:24,station:'BKS',provider:'Bencoolen Sinar Food',rate:161000,visitors:null};
 const distinct=await f(db,actor,{...base,rows:[sameLabelDifferentCode,incomplete],mode:'COMMIT',confirmed:true});assert(distinct.newRecords>0);
 const differentPrograms=[...records].filter(([k])=>k.startsWith('portalData/workPrograms/records/')).map(([,v])=>v).filter(v=>v.name==='Garuda Executive Lounge');
 assert.deepEqual(differentPrograms.map(p=>p.pkNumber).sort((a,b)=>a-b),[23,70]);
 const incompleteBudget=[...records].filter(([k,v])=>k.startsWith('portalData/financialBudgets/records/')&&v.station==='BKS').map(([,v])=>v);
 assert.equal(incompleteBudget.length,1);assert.equal(incompleteBudget[0].proposedAmount,null);assert.equal(incompleteBudget[0].annualForecasts.length,0);
 console.log('BUDGET_WORKBOOK_IMPORT_PASS preview, master mapping, company codes, atomic persistence, idempotence, conflict, next AK, duplicate PK labels, incomplete forecast');
}
check().catch(e=>{console.error(e);process.exitCode=1});

'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function element(){
  const classes=new Set();
  return {
    value:'',textContent:'',innerHTML:'',dataset:{},attributes:{},
    classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v),toggle(v,on){if(on)classes.add(v);else classes.delete(v);}},
    setAttribute(name,value){this.attributes[name]=value;},
    addEventListener(type,fn){(this.events??={})[type]=fn;},
    querySelector:()=>null,querySelectorAll:()=>[]
  };
}
async function verifySingleRecordPersistence(){
  let reject=false;
  const calls=[];
  const window={GXFirebase:{currentUser:async()=>({getIdToken:async()=>'local-fixture'})},addEventListener(){}};
  const fetch=async(url,options)=>{
    const request=JSON.parse(options.body);
    calls.push({url,request});
    const result={...request.data,id:request.id};
    return {ok:!reject,status:reject?403:200,json:async()=>reject?{message:'Write rejected'}:{result}};
  };
  vm.runInNewContext(fs.readFileSync('assets/edition1-store.js','utf8'),
    {window,fetch,setTimeout,clearTimeout,AbortController,console},{filename:'edition1-store.js'});
  const store=window.GEStore;
  await store.saveRecord('airports','CREATE','text-id',{code:'AMQ',status:'Active'});
  reject=true;
  await assert.rejects(store.saveRecord('airports','UPDATE','text-id',{status:'Inactive'}),/Write rejected/);
  assert.equal(store.get().airports[0].status,'Active');
  reject=false;
  await store.saveRecord('airports','UPDATE','text-id',{code:'AMQ',status:'Inactive'});
  assert.equal(store.get().airports[0].status,'Inactive');
  assert.equal(calls.length,3);
  assert.ok(calls.every(({url,request})=>url==='/api/edition1-data'&&request.id==='text-id'&&request.collection==='airports'));
}
async function main(){
  const fields=new Map(),events={},button=element(),writes=[];
  const add=id=>{const node=element();fields.set(id,node);return node;};
  const document={readyState:'complete',body:{},querySelector:()=>null,querySelectorAll:()=>[],getElementById:key=>fields.get(key)||null,addEventListener(){}};
  const state={airports:[{id:'amq-record',code:'AMQ',city:'Ambon',status:'Active',lat:-3.71,lon:128.08},
    {id:'new-master',code:'XYZ',city:'No coordinates',status:'Active'}],lounges:[{airport:'AMQ',documentNumber:'1',documentType:'PKS',documentStatus:'Valid'}],
    personnel:[{id:'gm-record',airport:'AMQ',function:'GM',name:'Fixture GM'}],loungeVisitors:[{airport:'AMQ'}]};
  let rejected=false;
  const window={addEventListener:(type,fn)=>(events[type]??=[]).push(fn),
    GEStore:{get:()=>state,async saveRecord(key,action,id,data){
      writes.push({key,action,id,data});
      if(rejected)throw Error('Write rejected');
      if(action==='CREATE')state[key].push({...data,id});
      else Object.assign(state[key].find(row=>String(row.id)===String(id)),data);
    }},location:new URL('http://localhost/app.html?page=data')};
  const context={window,document,location:window.location,localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    sessionStorage:{getItem:()=>null,setItem(){}},MutationObserver:class{observe(){}},
    URLSearchParams,URL,console,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},addEventListener(){},
    queueMicrotask(){},requestAnimationFrame(){},crypto,
    gxCanManage:()=>true,gxAirportAllowed:()=>true,gxGetSession:()=>({role:'Super Admin',scopeType:'ALL'})};
  vm.runInNewContext(fs.readFileSync('assets/edition1-business-runtime.js','utf8'),context,{filename:'edition1-business-runtime.js'});
  for(const name of ['openAirportModalV231','geSetAirportStatus','saveAirportV231','deleteAirportV231','savePersonnel',
    'addPortalDocument','openAirportSystemModalV231','saveGasoV231','downloadVisitorReportPDFV239','startCameraScanner','savePurchaseV232'])
    assert.equal(typeof window[name],'function',name);

  const airportRows=add('airportRows');
  for(const id of ['airportMasterTotal','airportMasterContracts','airportMasterPending','airportMasterInactive'])add(id);
  add('geStorageNoticeV223');const notice=add('geStorageNoticeTitleV223');add('geStorageNoticeMessageV223');
  const airportModal=add('airportModalV231');airportModal.querySelector=()=>button;
  for(const id of ['ModalTitle','EditId','Code','City','Name','Wilayah','Region','Status','Lat','Lon'])add('airport'+id+'V231');
  window.renderAirports();
  assert.equal(fields.get('airportMasterTotal').textContent,2);
  assert.equal(fields.get('airportMasterContracts').textContent,1);
  assert.equal(fields.get('airportMasterPending').textContent,0);
  assert.match(airportRows.innerHTML,/Fixture GM.*>1<\/td>/);
  assert.match(airportRows.innerHTML,/data-airport-id="amq-record"/);

  window.openAirportModalV231('amq-record');
  assert.equal(fields.get('airportCodeV231').value,'AMQ');
  fields.get('airportCityV231').value='Ambon Edited';
  await window.saveAirportV231();
  assert.equal(writes.at(-1).id,'amq-record');
  assert.equal(state.airports[0].city,'Ambon Edited');
  assert.equal(airportModal.classList.contains('show'),false);
  assert.match(notice.textContent,/tersimpan/);

  const status=element();
  await window.geSetAirportStatus('AMQ','Inactive',status);
  assert.equal(state.airports[0].status,'Inactive');
  assert.equal(fields.get('airportMasterInactive').textContent,1);
  rejected=true;
  status.value='Active';
  await window.geSetAirportStatus('AMQ','Active',status);
  assert.equal(status.value,'Inactive');
  assert.equal(state.airports[0].status,'Inactive');
  assert.equal(status.disabled,false);
  assert.match(notice.textContent,/belum tersimpan/);
  rejected=false;

  window.openAirportModalV231();
  fields.get('airportCodeV231').value='ABC';
  fields.get('airportCityV231').value='New Airport';
  await window.saveAirportV231();
  assert.ok(state.airports.some(row=>row.code==='ABC'&&row.lat===null));
  assert.equal(fields.get('airportMasterTotal').textContent,3);

  function makeMap(){
    const layer=add('airportMarkerLayer');
    let currentMarker;
    layer.querySelectorAll=()=>[currentMarker];
    const host=add('airportDetail'),body=element();
    host.querySelector=()=>body;
    const search=add('mapAirportSearch');
    add('mapProviderType');
    document.querySelector=selector=>selector==='.map-search-tools'?element():null;
    window.geInitAirportCanonical();
    assert.match(layer.innerHTML,/data-code="AMQ"/);
    assert.doesNotMatch(layer.innerHTML,/data-code="XYZ"|data-code="ABC"/);
    const click=()=>{
      currentMarker=element();
      currentMarker.dataset.code='AMQ';
      layer.events.click({target:{closest:()=>currentMarker}});
      assert.match(host.innerHTML,/station=AMQ/);
      assert.equal(currentMarker.attributes['aria-pressed'],'true');
    };
    click();
    search.value='AMQ';
    search.events.input();
    assert.match(layer.innerHTML,/aria-pressed="true"/);
    click();
    window.filterAirportMap('Domestik',element());
    assert.match(layer.innerHTML,/airport-map-marker/);
    click();
    for(const refresh of events['gx-data-background-refresh'])refresh();
    click();
  }
  makeMap();
  makeMap();
  assert.equal(state.airports.length,3,'Map must never replace the airport master with the subset with coordinates');

  const charts=add('initiativeCharts');
  const grid=add('initRows');
  add('initiativeListSection');
  state.touchpoints=['Lounge'];
  state.initiatives=[{id:'init-1',name:'Touch point fixture',tp:'All Touch Point',journey:'Pre-Flight',plan:100,real:50}];
  window.geInitInitiativeCanonical();
  assert.match(charts.innerHTML,/Lounge/);
  assert.match(grid.innerHTML,/Touch point fixture/);
  window.geSetInitiativeView('list');
  assert.match(grid.innerHTML,/data-initiative-list/);
  await verifySingleRecordPersistence();
  console.log('BUSINESS_CONTROLS_RUNTIME_PASS');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

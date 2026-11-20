'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');

function assertStyles(){
  const css=read('assets/global-ui-canonical.css');
  const legacy=read('assets/portal.css');
  assert.doesNotMatch(legacy,/\.ge-assess-tabs|\.ge-map-gallery|\.ge-ref-row-actions/);
  const tabRule=css.match(/\.ge-assess-tabs>button\{([^}]+)\}/g);
  assert.equal(tabRule?.length,1);
  assert.match(tabRule[0],/font-size:var\(--ui-button-font\)/);
  assert.match(tabRule[0],/font-weight:var\(--ui-button-weight\)/);
  assert.match(css,/\.ge-native-dialog\{[^}]+max-block-size:calc\(100dvh - 32px\)/);
  assert.match(css,/\.ge-checklist-share-body\{[^}]+overflow:auto/);
  assert.match(css,/\.ge-checklist-share-result:not\(\[hidden\]\)\{display:grid/);
  assert.match(css,/\.ge-share-qr:not\(\[hidden\]\)\{display:flex/);
  assert.match(css,/\.ge-table-action-cell[^{}]*\{[^}]+min-inline-size: max-content/);
  assert.match(css,/dialog\[open\]\) > :is\([^}]+\.ge-native-dialog-card\) \{\s*zoom: var\(--ge-portal-zoom\)/);
  assert.match(read('assets/edition1-business-runtime.js'),/class="ge-native-dialog-card ge-map-gallery-card"/);
}

function assertMonitoringViews(){
  const listeners=[];
  const model={monitoringWorks:[],formTemplates:[],airports:[],formSubmissions:[]};
  const root={innerHTML:'',contains:()=>true,querySelectorAll:()=>[]};
  const fields=new Map();
  const dialog={
    dataset:{},setAttribute(){},showModal(){this.open=true;},addEventListener(){},
    querySelectorAll:()=>[],querySelector(selector){
      if(!fields.has(selector))fields.set(selector,{});
      return fields.get(selector);
    }
  };
  const document={
    getElementById:()=>root,createElement:()=>dialog,querySelector:()=>null,
    body:{appendChild(node){assert.equal(node,dialog);}},
    addEventListener(type,callback){if(type==='click')listeners.push(callback);}
  };
  const window={gxCanManage:()=>true,GEStore:{get:()=>model}};
  vm.runInNewContext(read('assets/form-management.js'),{window,document});
  const click=async dataset=>{
    const target={dataset,closest:selector=>selector==='button'?target:null};
    for(const listener of listeners)await listener({target});
  };
  return (async()=>{
    for(const view of ['overview','templates','works','submissions']){
      await click({tab:view});
      assert.match(root.innerHTML,new RegExp('class="ge-assess-tab active" aria-current="page" data-tab="'+view+'"'));
    }
    await click({action:'assign'});
    assert.match(root.innerHTML,/Assign form to work/);
    assert.match(root.innerHTML,/class="ge-assess-tab active" aria-current="page" data-tab="works"/);
    await click({share:'fixture-work'});
    assert.equal(dialog.open,true);
    assert.equal(dialog.className,'ge-native-dialog');
    assert.match(dialog.innerHTML,/class="ge-native-dialog-card ge-checklist-share-dialog"/);
    assert.match(dialog.innerHTML,/data-share-result hidden/);
    assert.match(dialog.innerHTML,/data-share-qr hidden/);
    assert.match(dialog.innerHTML,/data-share-generate>Generate Link/);
  })();
}

function node(tag,textContent=''){
  const classes=new Set();
  return {
    tag,textContent,children:[],classList:{add:v=>classes.add(v),contains:v=>classes.has(v)},
    get className(){return [...classes].join(' ');},
    set className(value){classes.add(value);},
    matches:selector=>selector.split(',').includes(tag),hasAttribute:()=>false,colSpan:1,
    insertBefore(child,ref){this.children.splice(this.children.indexOf(ref),0,child);child.parent=this;},
    append(...nodes){for(const child of nodes){
      if(child.parent)child.parent.children.splice(child.parent.children.indexOf(child),1);
      this.children.push(child);child.parent=this;
    }}
  };
}
function assertTableActions(){
  const doc={readyState:'loading',addEventListener(){},createElement:tag=>node(tag)};
  const ctx=vm.createContext({document:doc});
  vm.runInContext(read('assets/table-runtime.js'),ctx);
  const apply=vm.runInContext('geTableActionCells',ctx);
  const cell=node('td'),other=node('td'),wrap=node('div');
  const complete=node('button','Complete'),share=node('button','Share'),remove=node('button','Delete');
  complete.onclick=()=>true;
  cell.append(complete,share,remove);
  const table={ownerDocument:doc,closest:()=>wrap,tHead:{rows:[{cells:[node('th','Station'),node('th','Action')]}]}};
  const rows=[{cells:[other,cell]}];
  apply(table,rows);
  apply(table,rows);
  assert.equal(cell.children.length,1);
  assert.equal(cell.children[0].className,'ge-table-action-group');
  assert.deepEqual(cell.children[0].children,[complete,share,remove]);
  assert.equal(complete.onclick(),true);
  assert.equal(other.children.length,0);
  assert.equal(wrap.className,'ge-table-action-scroll');
}

(async()=>{
  assertStyles();
  await assertMonitoringViews();
  assertTableActions();
  console.log('MONITORING_LAYOUT_CONTRACT_PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});

/* ==============================================================
   Canonical shared table controls
   Every table: 10 / 20 / 50 rows + clickable sortable headers.
   The displayed "No" value stays attached to its original row.
   ============================================================== */
const GETableState = new WeakMap();

function geComparable(text){
  const s=String(text??'').trim();
  const normalized=s.replace(/\s+/g,' ');
  if(/^[-+]?\d+(?:[.,]\d+)?%?$/.test(normalized)){
    return {type:'number', value:Number(normalized.replace('%','').replace(',','.'))};
  }
  const idDate=normalized.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(idDate)return {type:'number',value:new Date(+idDate[3],+idDate[2]-1,+idDate[1]).getTime()};
  const iso=normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if(iso)return {type:'number',value:new Date(+iso[1],+iso[2]-1,+iso[3]).getTime()};
  const monthNames={jan:0,feb:1,mar:2,apr:3,mei:4,may:4,jun:5,jul:6,agu:7,aug:7,sep:8,okt:9,oct:9,nov:10,des:11,dec:11};
  const namedDate=normalized.toLowerCase().match(/^(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})$/i);
  if(namedDate){const key=namedDate[2].slice(0,3),month=monthNames[key];if(month!==undefined)return {type:'number',value:new Date(+namedDate[3],month,+namedDate[1]).getTime()};}
  const currency=normalized.match(/^(IDR|USD|SGD|AUD|JPY|CNY|SAR|MYR)\s*([\d.,]+)/i);
  if(currency)return {type:'number',value:Number(currency[2].replace(/[.,]/g,''))};
  return {type:'text',value:normalized.toLocaleLowerCase('id-ID')};
}
function geCompare(a,b){
  if(a.type==='number'&&b.type==='number')return a.value-b.value;
  return String(a.value).localeCompare(String(b.value),'id',{numeric:true,sensitivity:'base'});
}
function geTablePage(total,page,size){
  const pages=Math.max(1,Math.ceil(total/size));
  const current=Math.max(1,Math.min(page,pages));
  const start=(current-1)*size;
  return {page:current,pages,start,end:Math.min(start+size,total),total,size};
}
function geUpdatePager(controls,model){
  controls.querySelector('select').value=String(model.size);
  const info=model.total
    ?`Menampilkan ${model.start+1}–${model.end} dari ${model.total} data`
    :'Tidak ada data';
  const label=`Halaman ${model.page} / ${model.pages}`;
  const infoNode=controls.querySelector('.table-info'),pageNode=controls.querySelector('.table-page-info');
  if(infoNode.textContent!==info)infoNode.textContent=info;
  if(pageNode.textContent!==label)pageNode.textContent=label;
  controls.querySelector('.prev').disabled=model.page<=1;
  controls.querySelector('.next').disabled=model.page>=model.pages;
}
function geCreatePager(model,onChange){
  const controls=document.createElement('nav');
  controls.className='table-controls';
  controls.setAttribute('aria-label','Navigasi halaman data');
  controls.innerHTML=`<div class="table-size-control"><span>Tampilkan</span>
    <select aria-label="Jumlah data per halaman"><option>10</option><option>20</option><option>50</option></select>
    <span>data</span></div>
    <div class="table-page-control"><span class="table-info" aria-live="polite"></span>
      <button type="button" class="table-page-btn prev" aria-label="Halaman sebelumnya">‹</button>
      <span class="table-page-info"></span>
      <button type="button" class="table-page-btn next" aria-label="Halaman berikutnya">›</button>
    </div>`;
  geUpdatePager(controls,model);
  controls.querySelector('select').onchange=e=>onChange(1,Number(e.target.value),'select');
  controls.querySelector('.prev').onclick=()=>onChange(model.page-1,model.size,'.prev');
  controls.querySelector('.next').onclick=()=>onChange(model.page+1,model.size,'.next');
  return controls;
}
function geIsActionHeader(cell){
  return cell.hasAttribute('data-table-action')||/^(actions?|aksi|kelola|tindakan|manage|controls?)$/i.test(cell.textContent.trim().replace(/[↑↓↕]/g,'').trim());
}
function geTableActionCells(table,rows){
  const headers=[...(table.tHead?.rows[0]?.cells||[])];
  let column=0;
  const actionColumns=new Set();
  for(const header of headers){
    if(header.colSpan===1&&geIsActionHeader(header)){
      header.classList.add('ge-table-action-heading');
      actionColumns.add(column);
    }
    column+=header.colSpan;
  }
  if(!actionColumns.size)return;
  table.closest('.table-scroll,.table-wrap,.ge-table-wrap')?.classList.add('ge-table-action-scroll');
  const control='button,a[href],form';
  for(const row of rows){
    let index=0;
    for(const cell of row.cells){
      if(cell.colSpan===1&&actionColumns.has(index)){
        cell.classList.add('ge-table-action-cell');
        const direct=[...cell.children].filter(item=>item.matches(control));
        if(direct.length){
          let group=[...cell.children].find(item=>item.classList.contains('ge-table-action-group'));
          if(!group){
            group=table.ownerDocument.createElement('div');
            group.className='ge-table-action-group';
            cell.insertBefore(group,direct[0]);
          }
          group.append(...direct);
        }
        for(const item of cell.children){
          if(!item.matches(control)&&[...item.children].some(child=>child.matches(control)))item.classList.add('ge-table-action-group');
        }
      }
      index+=cell.colSpan;
    }
  }
}
function geTableApply(table){
  const state=GETableState.get(table);
  const tbody=table.tBodies[0];
  if(!state||!tbody)return;
  const rows=[...tbody.rows];
  const displayed=rows.filter(row=>!row.hidden&&row.cells[0]?.tagName==='TD'&&
    (row.cells.length>1||row.cells[0].colSpan===1));
  Object.assign(state.model,geTablePage(displayed.length,state.model.page,state.model.size));
  const records=new Set(displayed);
  const visible=new Set(displayed.slice(state.model.start,state.model.end));
  rows.forEach(row=>{
    const display=!records.has(row)&&row.cells.length===1&&row.cells[0].colSpan>1?'':visible.has(row)?'':'none';
    if(row.style.display!==display)row.style.display=display;
  });
  geTableActionCells(table,rows);
  geUpdatePager(state.controls,state.model);
}
function geTableSort(table,col,th){
  const state=GETableState.get(table); if(!state)return;
  const tbody=table.tBodies[0]; if(!tbody)return;
  const dir=(state.sortCol===col && state.sortDir==='asc')?'desc':'asc';
  state.sortCol=col; state.sortDir=dir; state.model.page=1;
  [...table.tHead.querySelectorAll('th')].forEach(h=>{h.classList.remove('sort-asc','sort-desc');h.removeAttribute('aria-sort')});
  th.classList.add(dir==='asc'?'sort-asc':'sort-desc');
  th.setAttribute('aria-sort',dir==='asc'?'ascending':'descending');

  const rows=[...tbody.rows].map((row,idx)=>({row,idx,key:geComparable(row.cells[col]?.textContent||'')}));
  rows.sort((a,b)=>{const c=geCompare(a.key,b.key); return (c===0?a.idx-b.idx:c)*(dir==='asc'?1:-1)});
  rows.forEach(x=>tbody.appendChild(x.row));
  geTableApply(table);
}
function geBindTableHead(table,state){
  const headers=table.tHead?.rows[0]?.cells||[];
  [...headers].forEach((th,col)=>{
    if(state.headers.has(th)||geIsActionHeader(th)||th.onclick||th.matches('[data-sort],[data-sub-sort]')||th.querySelector('button,a,input,select'))return;
    state.headers.add(th);
    th.classList.add('sortable-th');
    th.tabIndex=0;
    th.title='Klik untuk mengurutkan data';
    th.addEventListener('click',()=>geTableSort(table,col,th));
    th.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();geTableSort(table,col,th)}});
  });
}
function geEnhanceTable(table){
  if(!table.tHead||!table.tBodies.length)return;
  const tbody=table.tBodies[0];
  const manual=table.hasAttribute('data-table-manual');
  if(manual){geTableActionCells(table,[...tbody.rows]);return}
  const existing=GETableState.get(table);
  if(existing){
    geBindTableHead(table,existing);
    geTableApply(table);
    return;
  }
  const anchor=table.closest('.table-scroll,.ge-table-wrap,.table-wrap')||table;
  const wrap=anchor.parentElement;
  if(!wrap)return;
  const model=geTablePage(0,1,10);
  const controls=geCreatePager(model,(page,size)=>{
    Object.assign(model,{page,size});
    geTableApply(table);
  });
  wrap.insertBefore(controls,anchor);
  const state={model,controls,headers:new WeakSet(),sortCol:null,sortDir:null};
  GETableState.set(table,state);
  geBindTableHead(table,state);
  geTableApply(table);
}
function geEnhanceAllTables(){
  document.querySelectorAll('table').forEach(geEnhanceTable);
}
function geStartTables(){
  setTimeout(geEnhanceAllTables,0);
  const pageObserver=new MutationObserver(records=>{
    const changed=new Set();
    for(const {addedNodes,target} of records){
      const table=target.nodeType===1?target.closest('table'):null;
      if(table)changed.add(table);
      for(const node of addedNodes){
        if(node.nodeType!==1)continue;
        if(node.matches('table'))changed.add(node);
        else node.querySelectorAll('table').forEach(candidate=>changed.add(candidate));
      }
    }
    changed.forEach(table=>{if(table.isConnected)geEnhanceTable(table)});
  });
  pageObserver.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',geStartTables,{once:true});
else geStartTables();

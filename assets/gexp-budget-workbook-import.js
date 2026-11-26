/* Integrated Budget Import: workbook preview -> validated Firestore transaction.
 * Reads Excel in memory; never stores workbook contents in browser storage.
 */
(function(){'use strict';
const host=document.getElementById('gexpBudgetWorkbookImport');if(!host)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const string=x=>String(x??'').trim(),upper=x=>string(x).toUpperCase();
const number=x=>x==null||String(x).trim()===''?null:Number(x);
let staged=[],costElements=[],preview=null,workbookName='',currentPage=1,pageSize=50;
host.innerHTML=`<div class="ge-panel"><h2>Integrated Budget Workbook Import</h2><p>Upload a workbook containing <strong>Summary</strong> and/or <strong>Kertas Kerja</strong>. PK/AK company codes, Cost Elements and funding estimates are validated before import. No data is written during preview.</p>
 <div class="ge-form-grid"><label>Budget Workbook <input id="gbwiFile" type="file" accept=".xlsx,.xls"></label><label>Fiscal Year <input id="gbwiYear" type="number" min="2020" max="2100" value="2027"></label><label>Organizational Owner Code<input id="gbwiOwner" placeholder="e.g. DN.JKTCS" autocomplete="off"></label></div>
 <label class="ge-check"><input id="gbwiImportCE" type="checkbox"> Register missing Cost Elements from List CE (Superadmin only)</label>
 <div class="ge-page-actions"><button type="button" id="gbwiPreview" class="ge-btn">Preview &amp; Validate</button><button type="button" id="gbwiCommit" class="ge-btn primary" disabled>Confirm Import</button></div>
 <p id="gbwiStatus" role="status" aria-live="polite">Select a workbook to review its records.</p><div id="gbwiResults" class="ge-table-wrap"></div></div>`;
const $=id=>document.getElementById(id),status=s=>{$('gbwiStatus').textContent=s};
const owner=()=>upper($('gbwiOwner').value),year=()=>Number($('gbwiYear').value);
function excelRows(sheet){return window.XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:''});}
function loadWorkbook(data){
 if(!window.XLSX)throw Error('Spreadsheet reader is not available.');
 const book=window.XLSX.read(data,{type:'array',cellDates:false});let rows=[];
 costElements=[];if(book.Sheets['List CE']){const ceGrid=excelRows(book.Sheets['List CE']);if(upper(ceGrid[0]?.[0])!=='COST ELEMENT')throw Error('List CE header is invalid.');const used=new Set();for(const r of ceGrid.slice(1)){const code=string(r[0]),name=string(r[1]);if(!code||!name||used.has(code))continue;used.add(code);costElements.push({code,name,hierarchy:r.slice(2,7).map(string)});}}
 const sheetSummary=book.Sheets.Summary;
 if(sheetSummary){const grid=excelRows(sheetSummary),header=grid[0]||[];
  if(upper(header[0])!=='NOMOR PK'||upper(header[4])!=='KODE PK'||upper(header[8])!=='CELEMENT')throw Error('Summary columns do not match the approved company workbook.');
  grid.slice(1).forEach((r,i)=>{if(!string(r[1])&&!string(r[3]))return;
   rows.push({kind:'SUMMARY',sourceRow:i+2,pkNumber:number(r[0]),program:string(r[1]),akNumber:number(r[2]),activity:string(r[3]),pkCode:upper(r[4]),akCode:upper(r[5]),subunit:string(r[6]),costCenter:upper(r[7]),costElement:string(r[8]),classification:string(r[11]),mandatory:string(r[12]),procurement:string(r[14]),contractYears:r[16]??null,currency:upper(r[17]||'IDR'),quantity:number(r[18]),rate:number(r[19]),total:number(r[20]),monthly:r.slice(21,33).map(number)});
  });
 }
 const sheetLounge=book.Sheets['Kertas Kerja'];
 if(sheetLounge){const grid=excelRows(sheetLounge),h=grid[0]||[],h2=grid[1]||[];
  // Use the explicit H/I/J, K/L/M and N/O/P groups; header L/M are
  // duplicated in the supplied sample, so columns are resolved by 2nd-row labels.
  const groups=[{year:Number(h[7]),base:7},{year:Number(h[10]),base:10},{year:Number(h[13]),base:13}];
  if(groups.some(g=>!Number.isSafeInteger(g.year)||upper(h2[g.base])!=='RATE'||upper(h2[g.base+1])!=='VISITOR'))throw Error('Kertas Kerja must contain Rate and Visitor columns grouped by fiscal year.');
  grid.slice(2).forEach((r,i)=>{const branch=string(r[1]);if(!branch)return;const station=upper(branch.match(/\bBO\s+([A-Z0-9]{3,4})\b/i)?.[1]||'');
   groups.forEach(g=>{const rate=number(r[g.base]),visitors=number(r[g.base+1]);if(rate===null&&visitors===null)return;
    rows.push({kind:'LOUNGE',sourceRow:i+3,station,provider:string(r[2]),costCenter:upper(r[3]),costElement:string(r[4]),contractPeriod:string(r[6]),year:g.year,rate,visitors,currency:'IDR'});
   });
  });
 }
 if(!sheetSummary&&!sheetLounge)throw Error('The workbook must contain Summary and/or Kertas Kerja.');
 if(!rows.length)throw Error('No budget lines were found in the workbook.');
 const inferred=rows.filter(r=>r.kind==='SUMMARY'&&r.pkCode).map(r=>r.pkCode.split('.').slice(1,-1).join('.'));
 if(inferred.length&&new Set(inferred).size===1&&!owner())$('gbwiOwner').value=inferred[0];
 const derivedYears=[...new Set(rows.filter(r=>r.kind==='SUMMARY'&&r.pkCode).map(r=>'20'+r.pkCode.split('.')[0]))];
 if(derivedYears.length===1)$('gbwiYear').value=derivedYears[0];
 return rows;
}
async function api(mode){const u=await window.GXFirebase?.currentUser?.();if(!u)throw Error('Please sign in before importing.');const token=await u.getIdToken();const r=await fetch('/api/edition1-data',{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'IMPORT_BUDGET_WORKBOOK',mode,confirmed:mode==='COMMIT',owner:owner(),year:year(),rows:staged,includeMissingCostElements:$('gbwiImportCE').checked,costElements:costElements.filter(x=>staged.some(r=>r.costElement===x.code))})});const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.message||`Import failed (${r.status}).`);return p.result;}
function render(){const issues=preview?.conflicts||[],statuses=preview?.statuses||[],counts={SUMMARY:staged.filter(r=>r.kind==='SUMMARY').length,LOUNGE:staged.filter(r=>r.kind==='LOUNGE').length};
 const pages=Math.max(1,Math.ceil(statuses.length/pageSize));currentPage=Math.max(1,Math.min(currentPage,pages));
 const first=(currentPage-1)*pageSize,shown=statuses.slice(first,first+pageSize);
 $('gbwiResults').innerHTML=`<p><strong>${esc(workbookName)}</strong> · ${staged.length} budget lines (${counts.SUMMARY} Program/Activity, ${counts.LOUNGE} Lounge). <strong>${issues.length} conflicts.</strong>${preview?.newCostElements?` · ${preview.newCostElements} new Master Cost Elements pending confirmation`:''}</p>
 ${issues.length?`<details class="ge-import-issues"><summary>View ${issues.length} validation conflicts</summary><div class="ge-table-wrap"><table data-table-manual><thead><tr><th>Excel Row</th><th>Code</th><th>Validation</th></tr></thead><tbody>${issues.map(x=>`<tr><td>${esc(x.row)}</td><td>${esc(x.code)}</td><td>${esc(x.message)}</td></tr>`).join('')}</tbody></table></div></details>`:'<p>Master Cost Elements and station scope validated. Generated PK/AK numbers are issued by the server at confirmation.</p>'}
 ${statuses.length?`<p>${preview.newLines} New · ${preview.unchangedLines} Unchanged · ${issues.length} Conflict</p>
 <nav class="ge-import-pagination" aria-label="Import preview pages"><label>Rows per page <select id="gbwiPageSize"><option value="10" ${pageSize===10?'selected':''}>10</option><option value="20" ${pageSize===20?'selected':''}>20</option><option value="50" ${pageSize===50?'selected':''}>50</option></select></label><span>Showing ${first+1}–${Math.min(first+pageSize,statuses.length)} of ${statuses.length} records</span><button class="ge-btn secondary" type="button" id="gbwiPrev" ${currentPage===1?'disabled':''}>Previous</button><span>Page ${currentPage} / ${pages}</span><button class="ge-btn secondary" type="button" id="gbwiNext" ${currentPage===pages?'disabled':''}>Next</button></nav>
 <div class="ge-table-wrap"><table data-table-manual><thead><tr><th>Source</th><th>Row</th><th>PK/AK / Station</th><th>Cost Element</th><th>Proposed</th><th>Status</th></tr></thead><tbody>${shown.map(x=>`<tr><td>${esc(x.source)}</td><td>${esc(x.row)}</td><td>${esc(x.reference)}</td><td>${esc(x.costElement)}</td><td>${x.proposed==null?'Not available':Number(x.proposed).toLocaleString('en-US',{maximumFractionDigits:2})}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table></div>`:''}<p><strong>Budget Status:</strong> Draft · Proposed from workbook estimate · Approved and Revised remain unset.</p>`;
 $('gbwiCommit').disabled=!!issues.length;
 const size=$('gbwiPageSize');if(size)size.addEventListener('change',()=>{pageSize=Number(size.value);currentPage=1;render()});
 $('gbwiPrev')?.addEventListener('click',()=>{currentPage--;render()});$('gbwiNext')?.addEventListener('click',()=>{currentPage++;render()});
}

async function stage(){const file=$('gbwiFile').files?.[0];if(!file)throw Error('Choose a workbook first.');if(!/\.(xlsx|xls)$/i.test(file.name)||file.size>12*1024*1024)throw Error('Choose an Excel workbook smaller than 12 MB.');staged=loadWorkbook(await file.arrayBuffer());workbookName=file.name;currentPage=1;preview=await api('PREVIEW');render();status(preview.conflicts.length?'Resolve validation conflicts in Master Data or workbook before importing.':'Review the record counts and confirm when ready.');}
$('gbwiFile').addEventListener('change',()=>{$('gbwiCommit').disabled=true;preview=null;staged=[];$('gbwiResults').textContent='';});
for(const id of ['gbwiYear','gbwiOwner','gbwiImportCE'])$(id).addEventListener(id==='gbwiImportCE'?'change':'input',()=>{$('gbwiCommit').disabled=true;preview=null;});
$('gbwiPreview').addEventListener('click',async()=>{const b=$('gbwiPreview');b.disabled=true;$('gbwiCommit').disabled=true;status('Validating workbook against Firestore Master Data…');try{await stage()}catch(e){status('Preview failed: '+e.message)}finally{b.disabled=false}});
$('gbwiCommit').addEventListener('click',async()=>{if(!preview||preview.conflicts.length||!staged.length)return;const b=$('gbwiCommit');b.disabled=true;status('Importing approved preview into Firestore…');try{const result=await api('COMMIT');status(`Import confirmed: ${result.newRecords} new records, ${result.unchanged} existing records preserved. Approved amounts were not changed.`);preview=null;await window.GEStore?.hydrate?.(['financialBudgets','workPrograms','workActivities']);window.dispatchEvent(new Event('gx-data-hydrated'));}catch(e){status('Import not confirmed: '+e.message+' Recheck existing records and preview before retrying.');}finally{b.disabled=true}});
})();

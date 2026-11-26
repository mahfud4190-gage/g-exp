/* G-Exp financial links: read-only on Initiative and Planning pages. No budget writes. */
(function(){'use strict';
if(!window.GEBudgetCost)return;
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const href=id=>'app.html?page=budget-cost'+(id?'&budgetId='+encodeURIComponent(id):'');
const fmt=(v,c='IDR')=>v===null||v===undefined||!Number.isFinite(Number(v))?'Not available':E(c||'IDR')+' '+Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
function row(x){const approval=x.revisedApprovedAmount??x.approvedAmount;return `<tr><td><a href="${href(x.id)}">${E(x.businessCode||x.name||x.id)}</a></td><td>${E(x.station||x.ownerType||'HO')}</td><td>${E(x.year||'—')}</td><td>${fmt(x.proposedAmount,x.currency)}</td><td>${fmt(approval,x.currency)}</td><td>${E(x.status||'Draft')}</td></tr>`}
const table=rows=>`<div class="ge-table-wrap"><table><thead><tr><th>Budget</th><th>Station / Owner</th><th>Fiscal Year</th><th>Proposed</th><th>Approved / Revised</th><th>Status</th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table></div>`;
function render(){const data=GEBudgetCost.read().budgets||[],st=GEStore.get(),e=document.getElementById('initiativeFinancialSummary');
 if(e){const allowed=new Set((st.initiatives||[]).map(x=>String(x.id)));const matches=data.filter(x=>x.initiativeId&&allowed.has(String(x.initiativeId)));e.innerHTML=matches.length?table(matches):'<p>No linked budgets have been recorded. Create a budget in Budget & Financial.</p>';}
 const p=document.getElementById('planningFinancialSummary');if(p){const domain=new URLSearchParams(location.search).get('page')||'',category=new URLSearchParams(location.search).get('category')||'';
 const mapping={'lounge-list':['LOUNGE'],'service-provider':['LOUNGE','GHA','AIRPORT_OPERATOR','CATERING'],'space-building':['SPACE_BUILDING'],'station-resources':['STATION_MATERIAL'],'airport-systems-planning':['AIRPORT_SYSTEMS'],'airport-cost-structure':['AIRPORT_OPERATOR'],'planning-workspace':[]};
 const types=mapping[domain]||[];const matches=domain==='planning-workspace'?data:data.filter(x=>types.includes(x.planningDomain)&&(!category||x.planningDomain===category));
 p.innerHTML=matches.length?table(matches):'<p>No linked budgets for this domain.</p>';}
 const edit=document.getElementById('initiativeBudgetReadonly');if(edit){const id=document.getElementById('initiativeEditIdV224')?.value||'';const matches=data.filter(x=>String(x.initiativeId)===String(id)&&id);edit.innerHTML=`<strong>Budget & Financial</strong><p>${matches.length?matches.map(x=>`${E(x.year)} · ${fmt(x.revisedApprovedAmount??x.approvedAmount,x.currency)}`).join(' · '):'No linked budget yet.'} <a href="${href(matches[0]?.id)}">View in Budget & Financial</a></p>`;}
}
window.geRenderLinkedFinancial=render;
GEBudgetCost.ready().then(()=>{render();setTimeout(render,500)}).catch(()=>{for(const id of ['initiativeFinancialSummary','planningFinancialSummary']){const n=document.getElementById(id);if(n)n.textContent='Financial data is currently unavailable.';}});
window.addEventListener('gx-data-hydrated',render);
window.addEventListener('gx-data-background-refresh',e=>{if((e.detail?.collections||[]).some(x=>['financialBudgets','financialAllocations','financialActuals','financialCommitments','financialForecasts'].includes(x)))render()});
})();

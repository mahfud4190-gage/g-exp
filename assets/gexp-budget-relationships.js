/* Budget & Financial is the sole owner of Initiative budget links and reallocations.
 * Server transactions enforce approval, ownership, limits and audit history.
 */
(function(){'use strict';
const register=document.getElementById('register');if(!register||!window.GEBudgetCost||!window.GEStore)return;
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=document.createElement('section');root.className='ge-panel ge-budget-relationships';root.innerHTML=`<h2>Initiative Budget Linking & Reallocation</h2><p>Manage budget relationships here. Initiative pages display linked budgets in read-only mode. Approval is required before a transfer changes the approved amounts.</p>
<details open><summary><b>Link Budget to Initiative</b></summary><div class="ge-form-grid">
<label>Budget<select id="gbrBudget"></select></label><label>Initiative<select id="gbrInitiative"></select></label>
<label>Allocated Amount<input id="gbrAmount" type="number" min="0" step="any" placeholder="Leave empty to link without allocation"></label>
<div class="ge-form-action"><button type="button" class="ge-btn primary" id="gbrLink">Save Link</button></div></div>
<div id="gbrLinks"></div></details>
<details><summary><b>Budget Reallocation</b></summary><div class="ge-form-grid">
<label>Source Budget<select id="gbrSource"></select></label><label>Destination Budget<select id="gbrDestination"></select></label>
<label>Transfer Amount<input id="gbrTransfer" type="number" min="0" step="any"></label><label>Reference<input id="gbrReference" placeholder="Approval / request reference"></label>
<label class="span2">Reason<textarea id="gbrReason" rows="2" placeholder="Reason for budget reallocation"></textarea></label>
<div class="ge-form-action"><button type="button" class="ge-btn primary" id="gbrSubmit">Submit Reallocation</button></div></div>
<div id="gbrRequests"></div></details><p id="gbrStatus" role="status" aria-live="polite"></p>`;
register.closest('.ge-panel')?.before(root);
const $=id=>root.querySelector('#'+id),data=()=>GEStore.get();
const format=(v,c)=>v==null?'Not available':E(c||'IDR')+' '+Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
const title=b=>[b.businessCode||b.pkCode||b.id,b.name,b.year,b.station].filter(Boolean).join(' · ');
function opts(id,items,label){let select=$(id),old=select.value;select.innerHTML=`<option value="">${E(label)}</option>`+items.map(x=>`<option value="${E(x.id)}">${E(x.label)}</option>`).join('');if(items.some(x=>String(x.id)===old))select.value=old;}
const statuses=x=>String(x.status||'');
function render(){const d=data(),budgets=GEBudgetCost.read().budgets||[],inits=d.initiatives||[],links=(d.financialBudgetLinks||[]).filter(x=>statuses(x)==='Active'),req=(d.financialAdjustments||[]).filter(x=>x.kind==='Budget Reallocation').sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 const candidates=budgets.map(x=>({id:x.id,label:title(x)}));for(const key of ['gbrBudget','gbrSource','gbrDestination'])opts(key,candidates,'Select budget');
 opts('gbrInitiative',inits.map(x=>({id:x.id,label:[x.businessCode||x.id,x.name||x.title,x.airport||x.station].filter(Boolean).join(' · ')})),'Select initiative');
 const byBudget=new Map(budgets.map(x=>[String(x.id),x])),byInit=new Map(inits.map(x=>[String(x.id),x]));
 $('gbrLinks').innerHTML=links.length?`<div class="ge-table-wrap"><table data-table-manual><thead><tr><th>Budget</th><th>Initiative</th><th>Allocation</th><th>Action</th></tr></thead><tbody>${links.map(x=>`<tr><td>${E(title(byBudget.get(String(x.budgetId))||{id:x.budgetId}))}</td><td>${E(byInit.get(String(x.initiativeId))?.name||x.initiativeId)}</td><td>${format(x.allocatedAmount,x.currency)}</td><td><button type="button" class="ge-btn secondary" data-unlink="${E(x.budgetId)}" data-init="${E(x.initiativeId)}" ${Number(x.allocatedAmount||0)>0?'disabled title="Release the allocation before unlinking"':''}>Unlink</button></td></tr>`).join('')}</tbody></table></div>`:'<p>No budget links recorded.</p>';
 const role=window.gxGetSession?.()||{},canApprove=role.role==='Super Admin'||role.role==='Admin'||role.accessLevel==='Admin';
 $('gbrRequests').innerHTML=req.length?`<div class="ge-table-wrap"><table data-table-manual><thead><tr><th>Reference</th><th>Source → Destination</th><th>Amount</th><th>Status</th><th>Decision</th></tr></thead><tbody>${req.map(x=>`<tr><td>${E(x.reference)}</td><td>${E(title(byBudget.get(String(x.sourceBudgetId))||{id:x.sourceBudgetId}))} → ${E(title(byBudget.get(String(x.destinationBudgetId))||{id:x.destinationBudgetId}))}</td><td>${format(x.amount,x.currency)}</td><td>${E(x.status)}</td><td>${x.status==='Submitted'&&canApprove?`<button type="button" class="ge-btn" data-decision="APPROVE" data-id="${E(x.id)}" ${String(x.createdBy)===String(role.id||role.uid)?'disabled':''}>Approve</button> <button type="button" class="ge-btn secondary" data-decision="REJECT" data-id="${E(x.id)}" ${String(x.createdBy)===String(role.id||role.uid)?'disabled':''}>Reject</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:'<p>No budget reallocations recorded.</p>';
}
async function request(body){const user=await window.GXFirebase?.currentUser?.();if(!user)throw Error('Please sign in.');const response=await fetch('/api/edition1-data',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify(body)});const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.message||`Request failed (${response.status}).`);return result.result;}
async function submit(button,body){button.disabled=true;$('gbrStatus').textContent='Saving to Firestore…';try{const result=await request(body);await GEStore.hydrate(['financialBudgets','financialBudgetLinks','financialAdjustments']);render();window.dispatchEvent(new Event('gx-data-hydrated'));$('gbrStatus').textContent='Confirmed by server: '+result.status+'.';}catch(e){$('gbrStatus').textContent='Not saved: '+e.message;}finally{button.disabled=false;}}
$('gbrLink').addEventListener('click',()=>{const b=$('gbrBudget').value,i=$('gbrInitiative').value,raw=$('gbrAmount').value.trim();if(!b||!i){$('gbrStatus').textContent='Select a budget and an Initiative.';return;}submit($('gbrLink'),{action:'LINK_BUDGET_INITIATIVE',budgetId:b,initiativeId:i,allocatedAmount:raw===''?null:Number(raw)})});
$('gbrSubmit').addEventListener('click',()=>{const sourceBudgetId=$('gbrSource').value,destinationBudgetId=$('gbrDestination').value,amount=Number($('gbrTransfer').value),reference=$('gbrReference').value.trim(),reason=$('gbrReason').value.trim();if(!sourceBudgetId||!destinationBudgetId||sourceBudgetId===destinationBudgetId||!amount||amount<=0||!reference||!reason){$('gbrStatus').textContent='Select different source/destination budgets, positive amount, reference and reason.';return;}submit($('gbrSubmit'),{action:'SUBMIT_BUDGET_REALLOCATION',sourceBudgetId,destinationBudgetId,amount,reference,reason});});
root.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-unlink')){if(!confirm('Unlink this budget from the Initiative? The budget will be retained.'))return;submit(button,{action:'UNLINK_BUDGET_INITIATIVE',budgetId:button.dataset.unlink,initiativeId:button.dataset.init});}if(button.hasAttribute('data-decision')){const decision=button.dataset.decision;if(!confirm(decision==='APPROVE'?'Approve this reallocation and adjust both budgets?':'Reject this reallocation?'))return;submit(button,{action:'DECIDE_BUDGET_REALLOCATION',reallocationId:button.dataset.id,decision});}});
GEBudgetCost.ready().then(async()=>{await GEStore.hydrate(['initiatives','financialBudgetLinks','financialAdjustments']);render()}).catch(e=>{$('gbrStatus').textContent='Unable to load budget relationships: '+e.message});
window.addEventListener('gx-data-hydrated',render);
})();

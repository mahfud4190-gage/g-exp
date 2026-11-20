/* Shared portal UI behavior: one overlay stack, one confirmation dialog, one control language. */
(function(){'use strict';
const OVERLAYS='.initiative-dialog,.modal-backdrop,.overlay-backdrop,.ge-id-backdrop,.ge-ref-backdrop,.r70-backdrop,[data-modal-root]';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function promoteOverlays(root=document){
 const items=[...(root.querySelectorAll?.(OVERLAYS)||[])];
 root.querySelectorAll?.('[id*="Modal"],[id*="Dialog"]').forEach(el=>{if(el.matches('dialog'))return;const open=el.classList.contains('show')||el.hasAttribute('open')||el.getAttribute('aria-hidden')==='false';const wrapper=el.matches('.modal-backdrop,.overlay-backdrop,.initiative-dialog,[data-modal-root]')||!!el.querySelector('.modal-card,.initiative-dialog-card,.planning-modal,.ge-id-modal,.ge-ref-modal');if(open&&wrapper&&!items.includes(el))items.push(el)});
 items.forEach(el=>{if(el.parentElement!==document.body){if(window.geMovePortalOverlay)window.geMovePortalOverlay(el);else document.body.appendChild(el);}if(!el.classList.contains('ge-portal-overlay'))el.classList.add('ge-portal-overlay');if(!el.getAttribute('role'))el.setAttribute('role','dialog');if(el.getAttribute('aria-modal')!=='true')el.setAttribute('aria-modal','true')})
}
function normalizeButtons(root=document){
 const targets='.initiative-dialog button,.modal-card button,.planning-modal button,.ge-id-modal button,.ge-ref-modal button,#r43Monitoring button';
 const custom='.modal-x,.planning-modal-close,.ge-picker-trigger-r11,.ge-form-section-select,.ge-form-field-select,.ge-assess-tabs>button';
 root.querySelectorAll?.(targets).forEach(button=>{
  if(button.matches(custom))return;
  if(!button.classList.contains('ge-btn')&&!button.classList.contains('btn'))button.classList.add('ge-btn');
  const label=(button.textContent||'').trim().toLowerCase();
  if(/delete|hapus|remove/.test(label)){
   if(!button.classList.contains('danger'))button.classList.add('danger');
  }else if(/save|submit|publish|create|add|apply|update|confirm|simpan|tambah/.test(label)&&!button.classList.contains('danger')&&!button.classList.contains('primary')){
   button.classList.add('primary');
  }
 });
}
function normalizeMap(){document.querySelectorAll('.map-region-cards,.map-region-cards-v216').forEach(el=>{if(!el.hidden)el.hidden=true;if(el.getAttribute('aria-hidden')!=='true')el.setAttribute('aria-hidden','true')})}
function normalizePageTitle(){const route=new URLSearchParams(location.search).get('page');if(!route)return;const subpages=new Set(['lounge-list','service-provider','space-building','station-resources','airport-systems-planning','planning-documents-hub','planning-standards','airport-cost-structure','branch-office-planning','gaso-planning','planning-documents']);if(subpages.has(route))return;const candidates=[...document.querySelectorAll('.ge-nav-link.active,.ge-nav-link[aria-current="page"],nav a.active,.sidebar a.active')];const active=candidates.find(a=>{const href=a.getAttribute('href')||'';return href.includes('page='+route)||href.endsWith('/'+route+'.html')||href.endsWith(route+'.html')});const label=active?.querySelector('span:not(.ni)')?.textContent?.trim()||active?.textContent?.trim();if(!label)return;const title=document.querySelector('#cleanPageOutlet .ge-page-head h1,#cleanPageOutlet .hero h2,#cleanPageOutlet h1');if(title&&title.dataset.subpageTitle!=="1"&&title.textContent!==label)title.textContent=label}
function apply(){if(typeof window.GE_MAP_REGION==='undefined')window.GE_MAP_REGION='';promoteOverlays(document);normalizeButtons(document);normalizeMap();normalizePageTitle()}
window.gePortalApplyStandards=apply;
window.gePortalConfirm=function({title='Confirm Action',message='',confirmLabel='Confirm',cancelLabel='Cancel',danger=false}={}){return new Promise(resolve=>{document.getElementById('gePortalConfirmDialog')?.remove();const layer=document.createElement('div');layer.id='gePortalConfirmDialog';layer.className='ge-confirm-layer';layer.innerHTML=`<section class="ge-confirm-card" role="dialog" aria-modal="true" aria-labelledby="geConfirmTitle"><header><div><h2 id="geConfirmTitle">${esc(title)}</h2><p>${esc(message)}</p></div><button type="button" class="ge-confirm-x" aria-label="Close">×</button></header><footer><button type="button" class="ge-btn" data-cancel>${esc(cancelLabel)}</button><button type="button" class="ge-btn ${danger?'danger':'primary'}" data-confirm>${esc(confirmLabel)}</button></footer></section>`;document.body.appendChild(layer);let done=false;const finish=v=>{if(done)return;done=true;layer.remove();resolve(v)};layer.querySelector('[data-cancel]').onclick=()=>finish(false);layer.querySelector('.ge-confirm-x').onclick=()=>finish(false);layer.querySelector('[data-confirm]').onclick=()=>finish(true);layer.addEventListener('click',e=>{if(e.target===layer)finish(false)});const onKey=e=>{if(e.key==='Escape'){document.removeEventListener('keydown',onKey,true);finish(false)}};document.addEventListener('keydown',onKey,true);layer.querySelector('[data-confirm]')?.focus({preventScroll:true})})};
let standardsFrame=0;
const watchedNodes=OVERLAYS+',dialog,[id*="Modal"],[id*="Dialog"],.map-region-cards,.map-region-cards-v216';
const observer=new MutationObserver(records=>{
 const hasUiChange=records.some(record=>record.type==='attributes'
  ? record.target.matches(watchedNodes)
  : Array.from(record.addedNodes).some(node=>node.nodeType===1&&(node.matches(watchedNodes)||node.querySelector(watchedNodes))));
 if(!hasUiChange||standardsFrame)return;
 standardsFrame=requestAnimationFrame(()=>{standardsFrame=0;apply();});
});
const watch=()=>observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','open','aria-hidden']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply();watch()});else{apply();watch()}
})();

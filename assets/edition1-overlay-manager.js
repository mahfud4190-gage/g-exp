/* Edition 1 overlay manager.
 * All page dialogs are promoted to document.body so they own the full viewport,
 * including the fixed portal header and sidebar. No page-local stacking context
 * can trap a modal underneath the shell.
 */
(function(){
'use strict';
if(window.__GE_EDITION1_OVERLAY_MANAGER__) return;
window.__GE_EDITION1_OVERLAY_MANAGER__=true;
const selectors=[
  '.initiative-dialog', '.modal-backdrop', '.tp-modal-backdrop',
  '.map-move-modal-backdrop', '#r8InitiativeBackdrop', '#r9InitiativeBackdrop',
  '.r9-portal-dialog', '.ge-viewport-overlay', '.modal.open', '.overlay-backdrop.show', '[data-overlay-backdrop].show', 'dialog[open]', '.ge-ref-backdrop', '.ge-id-backdrop', '.planning-dialog-layer', '.ge-modal-backdrop', '#geGlobalRefModal', '#geV251EventModal',
  '#geV2542DraftModal', '#geCalListModalV2533', '#geV2532ListModal'
];
const selector=selectors.join(',');
const owned=new Set();
function moveToBody(el){
  if(el.parentElement===document.body)return;
  if(el.closest('#cleanPageOutlet'))owned.add(el);
  document.body.appendChild(el);
}
function promote(root){
  if(root.matches?.(selector))moveToBody(root);
  root.querySelectorAll(selector).forEach(moveToBody);
}
function install(){
  promote(document);
  new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes)if(node.nodeType===1)promote(node);
    }
  }).observe(document.body,{childList:true,subtree:true});
}
window.geMovePortalOverlay=moveToBody;
window.geDisposeRouteOverlays=()=>{
  for(const el of owned)el.remove();
  owned.clear();
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

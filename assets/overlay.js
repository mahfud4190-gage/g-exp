/* P30 — portal-wide overlay/layer integrity. Does not modify shell geometry. */
(function(){
  'use strict';
  const SELECTORS=['.modal-backdrop','.tp-modal-backdrop','.map-move-modal-backdrop','.initiative-dialog','.r9-portal-dialog','.modal.open','dialog[open]'];
  const selector=SELECTORS.join(',');
  const focusMemory=new WeakMap();
  function isOpen(el){return !!(el?.classList?.contains('show')||el?.classList?.contains('open')||el?.matches?.('dialog[open]'))}
  function cardOf(el){return el?.querySelector?.('.initiative-dialog-card,.modal-card,.tp-modal,.map-move-modal-card,.r8-modal-card,.r9-dialog-card,.box,[role="dialog"]')||null}
  function syncScrollLock(){
    const open=[...document.querySelectorAll('.ge-viewport-overlay')].some(isOpen);
    document.documentElement.classList.toggle('p30-overlay-open',open);
    document.body.classList.toggle('p30-overlay-open',open);
    if(open){if(!Object.prototype.hasOwnProperty.call(document.body.dataset,'p30Overflow'))document.body.dataset.p30Overflow=document.body.style.overflow||'';document.body.style.overflow='hidden'}
    else if(Object.prototype.hasOwnProperty.call(document.body.dataset,'p30Overflow')){document.body.style.overflow=document.body.dataset.p30Overflow;delete document.body.dataset.p30Overflow}
  }
  function focusInto(el){
    if(!isOpen(el)||focusMemory.has(el))return;
    try{
      focusMemory.set(el,document.activeElement);
      const target=el.querySelector('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])');
      target?.focus({preventScroll:true});
    }catch(_){ }
    syncScrollLock();
  }
  function restoreFocus(el){
    if(isOpen(el))return;
    const target=focusMemory.get(el);
    try{if(target&&target.isConnected)target.focus({preventScroll:true})}catch(_){ }
    focusMemory.delete(el);syncScrollLock();
  }
  function promote(el){
    if(!el||el.nodeType!==1)return;
    if(el.parentElement!==document.body){if(window.geMovePortalOverlay)window.geMovePortalOverlay(el);else document.body.appendChild(el);}
    if(!el.classList.contains('ge-viewport-overlay'))el.classList.add('ge-viewport-overlay');
    const card=cardOf(el);
    if(card){
      if(!card.classList.contains('ge-viewport-overlay-card'))card.classList.add('ge-viewport-overlay-card');
      if(!card.hasAttribute('role'))card.setAttribute('role','dialog');
      if(card.getAttribute('aria-modal')!=='true')card.setAttribute('aria-modal','true');
    }
    if(el.getAttribute('aria-modal')!=='true')el.setAttribute('aria-modal','true');
    if(isOpen(el))focusInto(el);else restoreFocus(el);
  }
  function scan(root=document){if(root.matches?.(selector))promote(root);root.querySelectorAll?.(selector).forEach(promote)}
  function init(){
    scan(document);
    const obs=new MutationObserver(records=>records.forEach(r=>{
      if(r.type==='childList'){r.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n)});if(r.removedNodes.length&&document.body.classList.contains('p30-overlay-open'))syncScrollLock()}
      if(r.type==='attributes'&&r.target.matches?.(selector+',.ge-viewport-overlay'))promote(r.target)
    }));
    obs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','open']});
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        const open=[...document.querySelectorAll('.ge-viewport-overlay')].filter(isOpen),top=open[open.length-1];
        if(top&&!/(delete|hapus|deactivate|nonaktif|critical)/i.test(top.textContent||'')){if(top.matches('dialog[open]')){try{top.close()}catch(_){}}else top.classList.remove('show','open')}
      }
      if(e.key==='Tab'){
        const open=[...document.querySelectorAll('.ge-viewport-overlay')].filter(isOpen),top=open[open.length-1];if(!top)return;
        const focusables=[...top.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);
        if(!focusables.length)return;const first=focusables[0],last=focusables[focusables.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
      }
    },true);
  }
  window.GEOverlayV30={promote,scan};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

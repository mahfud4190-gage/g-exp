// Guards against the Master Data modal being detached or hidden during route transitions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
const app=read('app.html');
const ui=read('assets/portal-ui-runtime.js');
const manager=read('assets/edition1-overlay-manager.js');
const master=read('assets/master-reference.js');
assert(!app.includes('document.head.appendChild(canonicalUi)'), 'Do not reappend canonical stylesheet on navigation');
assert(ui.includes("el.id==='geGlobalRefModal'||el.closest('#geGlobalRefModal')"), 'UI runtime must not detach Master Data modal');
assert(manager.includes("el.id==='geGlobalRefModal'||el.closest('#geGlobalRefModal')"), 'Overlay manager must preserve Master Data modal');
assert(master.includes("host.classList.remove('ge-portal-overlay')"), 'Master Data modal must not inherit hidden shared overlay state');
console.log('MASTER_DIALOG_SIDEBAR_STABILITY_PASS');

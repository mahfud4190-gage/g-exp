'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function testStylesheetOrder() {
  const app = read('app.html');
  assert.match(app, /<link id="geCanonicalUiStyle" rel="stylesheet" href="assets\/global-ui-canonical\.css">/);
  assert.doesNotMatch(app, /appendChild\(canonicalUi\)/);
  const base = {href: 'https://gage.test/assets/portal.css'};
  const canonical = {href: 'https://gage.test/assets/global-ui-canonical.css', before(link) {
    links.splice(links.indexOf(this), 0, link);
  }};
  const links = [base, canonical];
  const document = {
    querySelectorAll() { return links; },
    getElementById(id) { assert.equal(id, 'geCanonicalUiStyle'); return canonical; },
    createElement(tag) { assert.equal(tag, 'link'); return {}; }
  };
  const source = app.slice(app.indexOf(' function ensureStyle('), app.indexOf(' const runtimeGlobals='));
  const ensureStyle = vm.runInNewContext(source + '\nensureStyle', {document});
  ensureStyle('assets/portal.css');
  ensureStyle('assets/edition1-pages.css');
  ensureStyle('assets/checklist-share.css');
  ensureStyle('assets/edition1-pages.css');
  assert.deepEqual(links.map(link => link.href), [
    base.href, 'assets/edition1-pages.css', 'assets/checklist-share.css', canonical.href
  ]);
  assert.equal(links.at(-1), canonical, 'Keep the original canonical stylesheet attached');
}

async function run() {
  testStylesheetOrder();
  const scripts = [];
  const document = {
    scripts,
    body: { appendChild(script) { scripts.push(script); } },
    createElement() {
      return {
        getAttribute(name) { return this[name]; },
        remove() { scripts.splice(scripts.indexOf(this), 1); }
      };
    }
  };
  const window = {addEventListener() {}};
  const context = vm.createContext({window, document, setTimeout, clearTimeout});
  const app = read('app.html');
  const loader = app.slice(app.indexOf('const runtimeGlobals='), app.indexOf("if(['cx-import'"));
  const loadSrc = vm.runInContext(loader + '\nloadSrc', context);

  const loadingStore = loadSrc('assets/edition1-store.js');
  vm.runInContext(read('assets/edition1-store.js'), context);
  scripts.at(-1).onload();
  await loadingStore;
  const firestoreStore = window.GEStore;
  assert.equal(typeof firestoreStore.waitAuth, 'function');
  assert.equal(typeof firestoreStore.deleteRecord, 'function');

  // Airport Experience can load a legacy data script after the Firestore store.
  vm.runInContext(read('assets/data.js'), context);
  assert.equal(window.GEStore, firestoreStore);
  // A previously overwritten global must also recover without resetting state.
  window.GEStore = {get() {}};
  await loadSrc('assets/edition1-store.js');
  assert.equal(window.GEStore, firestoreStore);
  assert.equal(scripts.length, 1);

  const loadingFiles = loadSrc('assets/edition1-files.js');
  scripts.at(-1).onerror();
  await assert.rejects(loadingFiles, /Gagal memuat assets\/edition1-files\.js/);
  const retryFiles = loadSrc('assets/edition1-files.js');
  vm.runInContext(read('assets/edition1-files.js'), context);
  scripts.at(-1).onload();
  await retryFiles;
  const firebaseFiles = window.GEFiles;
  vm.runInContext(read('assets/files.js'), context);
  assert.equal(window.GEFiles, firebaseFiles);
  window.GEFiles = {get() {}};
  await loadSrc('assets/edition1-files.js');
  assert.equal(window.GEFiles, firebaseFiles);

  const missingPlanning = loadSrc('assets/planning-domains.js', true);
  scripts.at(-1).onerror();
  await assert.rejects(missingPlanning, /Gagal memuat assets\/planning-domains\.js/);
  const retryPlanning = loadSrc('assets/planning-domains.js', true);
  assert.match(scripts.at(-1).src, /^assets\/planning-domains\.js\?route=/);
  scripts.at(-1).onload();
  await retryPlanning;
  console.log('RUNTIME_LOADER_RECOVERY_CONTRACT_PASS');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

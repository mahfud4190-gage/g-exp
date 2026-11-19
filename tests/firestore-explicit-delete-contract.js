'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

async function testBrowserStore() {
  const posts = [];
  const events = [];
  let finishDelete;
  let rejectDelete = false;
  const window = {
    GXFirebase: {currentUser: async () => ({getIdToken: async () => 'test-token'})},
    addEventListener() {},
    dispatchEvent(event) { events.push(event.type); }
  };
  const fetch = async (url, options) => {
    if (!options?.method) {
      const collections = url.includes('manifest=1') ? {} : {initiatives: [
        {id: 'a', title: 'Original A'}, {id: 'b', title: 'Original B'}
      ]};
      return {ok: true, json: async () => ({collections, manifest: {version: 1}})};
    }
    const body = JSON.parse(options.body);
    posts.push(body);
    if (body.action === 'DELETE_RECORD') {
      if (rejectDelete) return {ok: false, status: 403, json: async () => ({message: 'Denied'})};
      await new Promise(resolve => { finishDelete = resolve; });
    }
    return {ok: true, json: async () => ({result: {id: body.id}})};
  };
  const code = fs.readFileSync(path.join(root, 'assets/edition1-store.js'), 'utf8');
  vm.runInNewContext(code, {window, fetch, AbortController, setTimeout, clearTimeout, console,
    CustomEvent: class { constructor(type) { this.type = type; } }});
  const store = window.GEStore;
  const state = await store.hydrate(['initiatives']);
  store.save({initiatives: []});
  await store.flush();
  assert.equal(posts.length, 0, 'An empty save must not send writes');
  store.save({initiatives: [{id: 'a', title: 'Edited'}]});
  await store.flush();
  assert.deepEqual(posts.map(({action,id}) => [action,id]), [['UPDATE','a']]);
  store.save({initiatives: [{id: 'b', title: 'Original B'}, {id: 'c', title: 'New C'}]});
  await store.flush();
  assert.deepEqual(posts.map(({action,id}) => [action,id]), [['UPDATE','a'],['CREATE','c']]);

  rejectDelete = true;
  await assert.rejects(store.deleteRecord('initiatives', 'b'), /Denied/);
  assert(state.initiatives.some(row => row.id === 'b'), 'Rejected deletion must leave the UI state intact');

  rejectDelete = false;
  const deletion = store.deleteRecord('initiatives', 'b');
  assert.equal(store.deleteRecord('initiatives', 'b'), deletion, 'Duplicate delete clicks share the same request');
  store.save({initiatives: [{id: 'b', title: 'Stale B'}]});
  await new Promise(resolve => setImmediate(resolve));
  assert(state.initiatives.some(row => row.id === 'b'), 'Wait for server confirmation before changing the UI');
  finishDelete();
  await deletion;
  await store.flush();
  assert(!state.initiatives.some(row => row.id === 'b'));
  assert.deepEqual(posts.slice(2).map(({action,id}) => [action,id]), [['DELETE_RECORD','b'],['DELETE_RECORD','b']]);
}

async function testApi() {
  let role = 'Super Admin';
  let recordExists = true;
  let nextId = 0;
  const commits = [];
  let recordAccess = 0;
  function ref(name) {
    return {
      id: name.split('/').at(-1),
      collection(key) { return ref(name + '/' + key); },
      doc(key) { return ref(name + '/' + (key ?? 'generated-' + ++nextId)); },
      get() {
        assert.equal(name, 'users/actor-1');
        return {exists: true, data: () => ({role, status: 'Active'})};
      }
    };
  }
  const db = {
    collection(key) {
      if (key === 'portalData') recordAccess++;
      return ref(key);
    },
    async runTransaction(fn) {
      const staged = [];
      const result = await fn({
        get(document) {
          assert.equal(document.id, 'a');
          return {exists: recordExists, data: () => ({title: 'Example', airport: 'CGK'})};
        },
        delete(document) { staged.push(['delete', document.id]); },
        set(document, fields) { staged.push(['set', document.id, fields]); }
      });
      commits.push(staged);
      if (staged.some(([action]) => action === 'delete')) recordExists = false;
      return result;
    }
  };
  const response = (statusCode, body) => ({statusCode, body: JSON.stringify(body)});
  const dependencies = {
    './_firebase': {
      bad: (status, code, message) => response(status, {code, message}),
      ok: body => response(200, body),
      bearer: () => 'test-token',
      firebase: () => ({auth: {verifyIdToken: async () => ({uid: 'actor-1'})}, db})
    },
    'firebase-admin/firestore': {FieldValue: {increment: n => n, serverTimestamp: () => 'timestamp'}},
    './inbox-policy': {}
  };
  const exports = {};
  const code = fs.readFileSync(path.join(root, 'netlify/functions/edition1-data.js'), 'utf8');
  vm.runInNewContext(code, {exports, require: name => dependencies[name]});
  const post = async body => {
    const result = await exports.handler({httpMethod: 'POST', body: JSON.stringify({collection: 'initiatives', ...body})});
    return [result.statusCode, JSON.parse(result.body)];
  };

  for (const [body, code] of [
    [{action: 'DELETE', id: 'a'}, 'EXPLICIT_DELETE_REQUIRED'],
    [{action: 'BATCH', changes: [{action: 'UPDATE', id: 'a'}, {action: 'DELETE', id: 'b'}]}, 'INVALID_BATCH_ACTION'],
    [{action: 'BATCH', changes: [{action: 'DELETE_RECORD', id: 'a'}]}, 'INVALID_BATCH_ACTION'],
    [{action: 'DELETE_RECORD'}, 'INVALID_ID'],
    [{action: 'DELETE_RECORD', id: 'a/nested/b'}, 'INVALID_ID']
  ]) {
    const [status, result] = await post(body);
    assert.equal(status, 400);
    assert.equal(result.code, code);
  }
  assert.equal(recordAccess, 0, 'Reject unsafe requests before starting any batch writes');
  role = 'Viewer';
  assert.equal((await post({action: 'DELETE_RECORD', id: 'a'}))[0], 403);
  assert.equal(commits.length, 0);
  role = 'Super Admin';
  const [status, result] = await post({action: 'DELETE_RECORD', id: 'a'});
  assert.equal(status, 200);
  assert.equal(result.result.deleted, true);
  assert.deepEqual(commits[0].map(([action, id]) => [action,id]), [
    ['delete','a'],['set','cacheState'],['set','generated-1']
  ]);
  assert.equal(commits[0][2][2].targetId, 'a');
  assert.equal((await post({action: 'DELETE_RECORD', id: 'a'}))[1].result.deleted, false);
  assert.equal(commits[1].length, 0, 'A retry must not create another audit record');
}

(async () => {
  await testBrowserStore();
  await testApi();
  console.log('FIRESTORE_EXPLICIT_DELETE_CONTRACT_PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const store=fs.readFileSync('assets/edition1-store.js','utf8');
const api=fs.readFileSync('netlify/functions/edition1-data.js','utf8');
// A partially populated browser snapshot must NEVER imply deletion of other records.
const persist=store.slice(store.indexOf('async function persistSnapshot('),store.indexOf('function save(next)',store.indexOf('async function persistSnapshot(')));
assert(!/action\s*:\s*['"]DELETE(?:_RECORD)?['"]/.test(persist),'Snapshot sync must not delete records.');
assert(persist.includes("changes.push({action:'CREATE'") && persist.includes("changes.push({action:'UPDATE'"),'Snapshot writes must support create and update.');
const explicit=store.slice(store.indexOf('function deleteRecord('),store.indexOf('\n  function ',store.indexOf('function deleteRecord(')+1));
assert(explicit.includes("action:'DELETE_RECORD'"),'Explicit delete must use its own server action.');
assert(api.includes("if(action==='DELETE')return bad(400,'EXPLICIT_DELETE_REQUIRED'"),'Legacy DELETE action must be rejected by server.');
assert(api.includes("action==='DELETE_RECORD'"),'Server must require explicit deletion action.');
assert(api.includes('TOUCHPOINT_SOURCE_PROTECTED') && api.includes('CSI_TOUCHPOINT_LOCKED'),'Corporate NPS/CSI source must remain protected.');
assert(api.includes('SCOPE_FORBIDDEN')&&api.includes('OWNERSHIP_FORBIDDEN'),'Server must enforce scope and ownership.');
console.log('FIRESTORE_EXPLICIT_DELETE_CONTRACT_PASS');

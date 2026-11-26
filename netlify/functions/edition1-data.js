'use strict';
const { bad, ok, bearer, firebase } = require('./_firebase');
const { FieldValue } = require('firebase-admin/firestore');
const {canChangeReadState,isInboxRecipient} = require('./inbox-policy');

const COLLECTIONS = new Set([
  'airports','initiatives','news','touchpoints','documents','projectEvents','loungePurchases','loungeVisitors','flightSchedule',
  'stationMaterials','boSpaces','serviceProcurement','airportSystems','skyPriority','touchpointStandards',
  'gasoMaster','gasoServiceSupport','gasoPlanningService','personnel','articles','announcements','faqs',
  'inbox','auditLogs','users','lounges','standardContent','portalManager','contactMessages','guestbook',
  'airlines','groundHandlers','serviceAlignments','airportCosts','aircraftConfigs','assets','facilities',
  'monitoringTemplates','monitoringAssessments','formTemplates','monitoringWorks','formSubmissions','customerExperience','attentionSettings',
  'referenceCatalog','requirementMatrix','stationCapabilities','planningDomains','currencies','exchangeRates',
  'financialBudgets','financialCostObjects','financialAllocations','financialActuals','financialAdjustments','financialCommitments','financialForecasts','operationalUsage'
]);
const DATA_GROUP_BY_COLLECTION = Object.fromEntries([...COLLECTIONS].map(name => [name, name]));
const FINANCIAL_COLLECTIONS = new Set(['financialBudgets','financialCostObjects','financialAllocations','financialActuals','financialAdjustments','financialCommitments','financialForecasts']);
const METADATA_COLLECTIONS = new Set(['standardContent','portalManager','attentionSettings']);
function dataRef(db, collection, id) {
  const group = DATA_GROUP_BY_COLLECTION[collection] || collection;
  if (METADATA_COLLECTIONS.has(collection)) return db.collection('portalMetadata').doc(group).collection('records').doc(id);
  return db.collection('portalData').doc(group).collection('records').doc(id);
}
function dataQuery(db, collection) {
  const group = DATA_GROUP_BY_COLLECTION[collection] || collection;
  if (METADATA_COLLECTIONS.has(collection)) return db.collection('portalMetadata').doc(group).collection('records');
  return db.collection('portalData').doc(group).collection('records');
}
function canonicalRole(value){const role=String(value||'').trim();return ['super administrator','superadmin','super admin'].includes(role.toLowerCase())?'Super Admin':role}
const READ_ROLES = new Set(['Super Admin','Admin','Management','Head Office','GE Team','Ground Experience Team','Branch Office','Staff','Viewer','Approver','Editor','External User','External','Collaborator','Lounge Staff','Lounge Luar Biasa']);
const WRITE_LEVELS = new Set(['Editor','Admin']);
const ADMIN_ROLES = new Set(['Super Admin','Admin']);
const EXTERNAL_ROLES = new Set(['External User','External','Collaborator','Partner']);
function isExternalActor(actor){
  const role=String(actor?.role||'').trim().toLowerCase();
  const org=String(actor?.organizationType||actor?.organisationType||actor?.orgType||'').trim().toLowerCase();
  return ['external user','external','collaborator','partner'].includes(role) || ['partner','external','external partner','airline partner','vendor','supplier','ground handling agent','gha'].includes(org);
}
function ownsRecord(actor,row){return [row?.ownerUserId,row?.createdBy,row?.actorId,row?.userId].filter(Boolean).map(String).includes(String(actor?.id||''));}
const MODULE_BY_COLLECTION = {
  initiatives:'initiatives', financialBudgets:'planning',financialCostObjects:'planning',financialAllocations:'planning',financialActuals:'planning',financialAdjustments:'planning',financialCommitments:'planning',financialForecasts:'planning',operationalUsage:'planning', projectEvents:'calendar', inbox:'inbox', airports:'data', personnel:'data',
  lounges:'planning', loungeVisitors:'lounge-visitor', loungePurchases:'lounge-purchase', flightSchedule:'lounge-flights',
  stationMaterials:'planning', boSpaces:'planning', serviceProcurement:'planning', airportSystems:'planning',
  gasoMaster:'planning', gasoServiceSupport:'planning', gasoPlanningService:'planning', documents:'planning',
  news:'news', articles:'news', announcements:'news', faqs:'news', contactMessages:'contact', guestbook:'contact',
  touchpoints:'services', skyPriority:'services', touchpointStandards:'services', standardContent:'services',
  portalManager:'admin', auditLogs:'admin', users:'admin', airlines:'data', groundHandlers:'data', serviceAlignments:'services', airportCosts:'planning', aircraftConfigs:'data', assets:'planning', facilities:'planning',
  monitoringTemplates:'services', monitoringAssessments:'services', formTemplates:'services', monitoringWorks:'services', formSubmissions:'services', customerExperience:'services', attentionSettings:'services', referenceCatalog:'data', requirementMatrix:'services', stationCapabilities:'services', planningDomains:'planning', currencies:'data', exchangeRates:'data', events:'calendar'
};
function active(actor){return actor && String(actor.status || 'Active').toLowerCase() !== 'inactive';}
function isOperationalAdmin(actor){ return actor?.role === 'Admin' || String(actor?.accessLevel||'') === 'Admin'; }
function canModule(actor, collection){
  if (actor.role === 'Super Admin') return true;
  if (collection === 'users') return actor.role === 'Super Admin' || (['Head Office','GE Team','Ground Experience Team'].includes(actor.role) && actor.accessLevel === 'Admin');
  if (collection === 'portalManager') return false; // Super Admin handled above.
  if (collection === 'auditLogs') return actor.role==='Super Admin';
  const module=MODULE_BY_COLLECTION[collection];
  if (!module) return true;
  if (isExternalActor(actor)) return ['initiatives','calendar','project-tracking','news','contact','inbox'].includes(module);
  if (isOperationalAdmin(actor)) return true;
  const p=(Array.isArray(actor.permissions)?actor.permissions:[]).map(String);
  const t=(Array.isArray(actor.tabs)?actor.tabs:[]).map(String);
  if (p.length) return p.includes(module) || p.includes('ALL') || p.includes('all');
  if (t.length) return t.includes(module) || t.includes('ALL') || t.includes('all');
  return true;
}
function canRead(actor,c){
  if(!active(actor) || !READ_ROLES.has(actor.role)) return false;
  // Active internal users read business collections; station scope is enforced after read.
  // permissions/tabs govern page/navigation, not whether a visible page can hydrate its own data.
  if(c==='users' || c==='auditLogs' || c==='portalManager') return canModule(actor,c);
  if(FINANCIAL_COLLECTIONS.has(c) && isExternalActor(actor))return false;
  if(isExternalActor(actor)) return canModule(actor,c);
  return true;
}
function canWrite(actor,c){
  if (!active(actor)) return false;
  if(FINANCIAL_COLLECTIONS.has(c) && isExternalActor(actor))return false;
  if (c==='requirementMatrix' || c==='stationCapabilities') return actor.role==='Super Admin'||(['Head Office','GE Team','Ground Experience Team'].includes(actor.role)&&actor.accessLevel==='Admin');
  if(c==='attentionSettings') return actor.role==='Super Admin'||(['Head Office','GE Team','Ground Experience Team'].includes(actor.role)&&actor.accessLevel==='Admin');
  if (c==='users') return actor.role==='Super Admin' || (['Head Office','GE Team','Ground Experience Team'].includes(actor.role) && actor.accessLevel==='Admin');
  if (c==='auditLogs') return actor.role==='Super Admin';
  if (isExternalActor(actor)) return ['initiatives','projectEvents'].includes(c);
  if (c==='formSubmissions' && !isExternalActor(actor)) return true;
  if (c==='inbox') return ADMIN_ROLES.has(actor.role) || WRITE_LEVELS.has(String(actor.accessLevel||''));
  if (actor.role==='Super Admin' || isOperationalAdmin(actor)) return true;
  return canModule(actor,c) && (WRITE_LEVELS.has(String(actor.accessLevel||'')) || actor.role==='Admin');
}
function allowedStations(actor){
  if (actor.role==='Super Admin' || (['Head Office','GE Team','Ground Experience Team'].includes(actor.role) && String(actor.accessLevel||'')==='Admin') || String(actor.scopeType||'').toUpperCase()==='ALL') return null;
  const assigned=Array.isArray(actor.assignedStations)?actor.assignedStations:[];
  const legacy=Array.isArray(actor.airports)?actor.airports:[];
  const a=assigned.length?assigned:legacy;
  return new Set(a.map(x=>String(x&&typeof x==='object'?(x.stationCode||x.code||x.iata||x.airportCode||x.id||''):x).trim().toUpperCase()).filter(Boolean));
}
function stationsOf(x){
  const raw=(x?.flight&&x?.from&&x?.to?[x.from,x.to]:undefined) ?? x?.stations ?? x?.stationCodes ?? x?.stationCode ?? x?.airport ?? x?.station ?? x?.relatedAirport ?? [];
  const list=Array.isArray(raw)?raw:String(raw||'').split(/[,;]+/);
  return list.map(v=>String(v||'').trim().toUpperCase()).filter(Boolean);
}
function stationOf(x){ return stationsOf(x)[0]||''; }
function inScope(actor,x){
  const allowed=allowedStations(actor); if (!allowed) return true;
  const stations=stationsOf(x); return !stations.length || stations.some(s=>allowed.has(s));
}
function sanitize(v,depth=0){
  if(depth>8) return null;
  if(v===null||v===undefined||typeof v==='string'||typeof v==='number'||typeof v==='boolean') return v;
  if(v instanceof Date) return v.toISOString();
  if(Array.isArray(v)) return v.map(x=>sanitize(x,depth+1));
  if(typeof v==='object'){
    if(typeof v.toDate==='function') return v.toDate().toISOString();
    const o={}; for(const [k,val] of Object.entries(v)){ if(k==='password'||k==='passwordHash'||k==='temporaryPassword') continue; o[k]=sanitize(val,depth+1); } return o;
  }
  return String(v);
}
async function actorFor(event){
  const token=bearer(event); if(!token) throw Object.assign(new Error('Authentication required.'),{statusCode:401,code:'AUTH_REQUIRED'});
  const {auth,db}=firebase();
  let decoded; try{decoded=await auth.verifyIdToken(token,true)}catch{throw Object.assign(new Error('Invalid or expired authentication token.'),{statusCode:401,code:'AUTH_INVALID'})}
  const snap=await db.collection('users').doc(decoded.uid).get();
  if(!snap.exists) throw Object.assign(new Error('User profile not found.'),{statusCode:403,code:'PROFILE_NOT_FOUND'});
  // The authenticated UID is authoritative; a legacy profile's `id` must not override it.
  const profile=snap.data()||{};
  const actor={...profile,id:decoded.uid,role:canonicalRole(profile.role)};
  if(!active(actor)) throw Object.assign(new Error('Account inactive.'),{statusCode:403,code:'ACCOUNT_INACTIVE'});
  return {db,actor};
}
function queryCollections(event){
  const raw=event.queryStringParameters?.collections || event.queryStringParameters?.collection || '';
  return String(raw).split(',').map(x=>x.trim()).filter(Boolean);
}
async function readCollection(db,actor,c){
  if(!COLLECTIONS.has(c)) throw Object.assign(new Error(`Collection not allowed: ${c}`),{statusCode:400,code:'COLLECTION_NOT_ALLOWED'});
  if(!canRead(actor,c)) throw Object.assign(new Error(`Read access denied for ${c}.`),{statusCode:403,code:'FORBIDDEN'});
  if(c==='auditLogs' && !(actor.role==='Super Admin'||isOperationalAdmin(actor))) return [];
  let docs;
  if(c==='initiatives' && isExternalActor(actor)){
    const [a,b]=await Promise.all([
      dataQuery(db,c).where('ownerUserId','==',String(actor.id)).get(),
      dataQuery(db,c).where('createdBy','==',String(actor.id)).get()
    ]); const map=new Map(); [...a.docs,...b.docs].forEach(d=>map.set(d.id,d)); docs=[...map.values()];
  } else if(c==='projectEvents' && isExternalActor(actor)){
    const ownInitiatives=await readCollection(db,actor,'initiatives');
    const ownIds=new Set(ownInitiatives.map(x=>String(x.id)));
    const snap=await dataQuery(db,c).get(); docs=snap.docs.filter(d=>{const row=d.data()||{};return ownsRecord(actor,row)||ownIds.has(String(row.initiativeId||row.projectId||''));});
  } else if(c==='contactMessages' && !isOperationalAdmin(actor) && actor.role!=='Super Admin'){
    const snap=await dataQuery(db,c).where('ownerUserId','==',String(actor.id)).get(); docs=snap.docs;
  } else if(c==='inbox'){
    const snap=await dataQuery(db,c).where('recipientId','==',String(actor.id)).get(); docs=snap.docs;
  } else if(c==='users'){
    const snap=await db.collection('users').get(); docs=snap.docs;
  } else if(c==='auditLogs'){
    const [canonical,legacy]=await Promise.all([dataQuery(db,c).get(),db.collection('auditLogs').get()]);
    const merged=new Map();
    [...canonical.docs,...legacy.docs].forEach(doc=>merged.set(String(doc.id),doc));
    docs=[...merged.values()];
  } else {
    const snap=await dataQuery(db,c).get(); docs=snap.docs;
  }
  let rows=docs.map(d=>({id:d.id,...sanitize(d.data())}));
  if(c==='auditLogs'){
    rows=rows.map(x=>({
      ...x,
      timestamp:x.timestamp||x.at||x.createdAt||x.updatedAt||'',
      name:x.name||x.actorName||x.user||x.username||'',
      username:x.username||x.email||'',
      role:x.role||x.actorRole||'',
      module:x.module||(/^(Login|Logout)$/i.test(String(x.action||''))?'Authentication':'Portal'),
      object:x.object||x.targetType||x.page||'Activity',
      detail:x.detail||x.message||''
    })).sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||'')));
  }
  // Personal Inbox is always scoped to the authenticated recipient, including Superadmin.
  // Unassigned legacy messages remain stored but are not claimed by an arbitrary administrator.
  if(c==='users') rows=rows.map(x=>{delete x.password;delete x.passwordHash;delete x.temporaryPassword;return x});
  if(c==='formTemplates' && !isOperationalAdmin(actor) && actor.role!=='Super Admin'){
    rows=rows.filter(x=>x.status==='Published' || String(x.createdBy||'')===String(actor.id));
  }
  if(c==='initiatives' && !isExternalActor(actor) && !isOperationalAdmin(actor) && actor.role!=='Super Admin'){
    const ids=[...new Set(rows.map(x=>String(x.createdBy||'')).filter(Boolean))];
    const creators=new Map(await Promise.all(ids.map(async id=>{const user=await db.collection('users').doc(id).get();return [id,user.exists?user.data():null]})));
    rows=rows.map(x=>({...x,createdByAccessLevel:creators.get(String(x.createdBy))?.accessLevel||x.createdByAccessLevel||'',createdByRole:creators.get(String(x.createdBy))?.role||x.createdByRole||''}));
  }
  if(c!=='inbox' && c!=='contactMessages' && c!=='users' && c!=='auditLogs' && !(['initiatives','projectEvents'].includes(c)&&isExternalActor(actor))) rows=rows.filter(x=>inScope(actor,x));
  if(FINANCIAL_COLLECTIONS.has(c) && allowedStations(actor))rows=rows.filter(x=>stationsOf(x).length>0?inScope(actor,x):String(x.createdBy||x.ownerUserId||'')===String(actor.id));
  return rows;
}
function cleanId(id){ const s=String(id||'').trim(); if(!s||s.length>200) throw Object.assign(new Error('Invalid document id.'),{statusCode:400,code:'INVALID_ID'}); return s; }
function cleanData(data){
  if(!data || typeof data!=='object' || Array.isArray(data)) throw Object.assign(new Error('Invalid data payload.'),{statusCode:400,code:'INVALID_DATA'});
  const out={...data}; delete out.id; delete out.createdAt; delete out.createdBy; delete out.updatedAt; delete out.updatedBy; delete out.actorId; delete out.password; delete out.passwordHash; delete out.temporaryPassword; return out;
}
async function bumpCacheVersion(db,collection){
  await db.collection('portalMetadata').doc('cacheState').set({version:FieldValue.increment(1),updatedAt:FieldValue.serverTimestamp(),lastCollection:String(collection||'')},{merge:true});
}
async function writeOne(db,actor,collection,action,id,raw,{initiativeImport=false}={}){
  if(!COLLECTIONS.has(collection)) throw Object.assign(new Error(`Collection not allowed: ${collection}`),{statusCode:400,code:'COLLECTION_NOT_ALLOWED'});
  if(!(collection==='inbox' && ['CREATE','UPDATE','DELETE'].includes(action)) && !(collection==='contactMessages' && action==='CREATE' && !isExternalActor(actor)) && !canWrite(actor,collection)) throw Object.assign(new Error(`Write access denied for ${collection}.`),{statusCode:403,code:'FORBIDDEN'});
  if(['users','auditLogs'].includes(collection) && !(actor.role==='Super Admin'||isOperationalAdmin(actor))) throw Object.assign(new Error('Administrative access required.'),{statusCode:403,code:'FORBIDDEN'});
  if(collection==='formSubmissions' && !isOperationalAdmin(actor) && actor.role!=='Super Admin' && action!=='CREATE') throw Object.assign(new Error('Submitted forms cannot be edited by the submitter.'),{statusCode:403,code:'SUBMISSION_IMMUTABLE'});
  const ref=dataRef(db,collection,id?cleanId(id):db.collection('portalData').doc().id);
  if(isExternalActor(actor) && !['initiatives','projectEvents'].includes(collection)) throw Object.assign(new Error(`Write access denied for ${collection}.`),{statusCode:403,code:'FORBIDDEN'});
  if(FINANCIAL_COLLECTIONS.has(collection) && action==='DELETE')throw Object.assign(new Error('Financial records must be archived/reversed, never deleted.'),{statusCode:403,code:'FINANCIAL_DELETE_FORBIDDEN'});
  if(action==='DELETE')return db.runTransaction(async transaction=>{
    const snap=await transaction.get(ref); if(!snap.exists) return {id:ref.id,deleted:false};
    const prev=snap.data()||{}; if(collection==='inbox'&&!isInboxRecipient(actor.id,prev))throw Object.assign(new Error('Only the recipient may delete this message.'),{statusCode:403,code:'INBOX_RECIPIENT_ONLY'}); if(collection==='touchpoints' && /(?:^|[^a-z])(nps|csi)(?:[^a-z]|$)/i.test([prev.sourceType,prev.source,prev.sourceLabel,prev.origin,prev.originSource].filter(Boolean).join(' '))) throw Object.assign(new Error('Corporate NPS/CSI touch points cannot be deleted.'),{statusCode:403,code:'TOUCHPOINT_SOURCE_PROTECTED'}); if(isExternalActor(actor)&&!ownsRecord(actor,prev)) throw Object.assign(new Error('External users can only delete their own records.'),{statusCode:403,code:'OWNERSHIP_FORBIDDEN'}); if(!isExternalActor(actor)&&collection!=='inbox'&&!inScope(actor,prev)) throw Object.assign(new Error('Record outside account scope.'),{statusCode:403,code:'SCOPE_FORBIDDEN'});
    if(collection==='initiatives' && !isExternalActor(actor) && actor.role!=='Super Admin' && !isOperationalAdmin(actor)) throw Object.assign(new Error('Admin access required to delete initiatives.'),{statusCode:403,code:'HIERARCHY_FORBIDDEN'});
    transaction.delete(ref);
    transaction.set(db.collection('portalMetadata').doc('cacheState'),{version:FieldValue.increment(1),updatedAt:FieldValue.serverTimestamp(),lastCollection:collection},{merge:true});
    transaction.set(dataQuery(db,'auditLogs').doc(),{actorId:actor.id,actorRole:actor.role,name:actor.name||actor.username||actor.email||actor.id,username:actor.username||actor.email||'',module:collection,object:ref.id,detail:`${collection} ${action.toLowerCase()}`,targetType:`EDITION1_${collection.toUpperCase()}`,targetId:ref.id,action:'Delete',timestamp:FieldValue.serverTimestamp(),result:'SUCCESS'});
    return {id:ref.id,deleted:true};
  });
  const data=cleanData(raw); const existing=await ref.get(); const prev=existing.exists?existing.data()||{}:{};
  if(collection==='inbox' && action==='UPDATE'){
    if(!existing.exists||!canChangeReadState(actor.id,prev,data))throw Object.assign(new Error('Only your own inbox read state can change.'),{statusCode:403});
  }
  let inboxAudience=[];const isInboxReply=collection==='inbox'&&action==='CREATE'&&!!data.replyToId;
  if(isInboxReply){
    const parentSnap=await dataRef(db,'inbox',cleanId(data.replyToId)).get(),parent=parentSnap.data()||{};
    if(!parentSnap.exists||![parent.senderId,parent.recipientId].map(String).includes(String(actor.id)))throw Object.assign(new Error('Conversation access denied.'),{statusCode:403});
    const recipientId=String(parent.recipientId)===String(actor.id)?String(parent.senderId||''):String(parent.recipientId||'');
    if(!recipientId||recipientId===String(actor.id)||!String(data.body||'').trim())throw Object.assign(new Error('Reply requires another participant and a message.'),{statusCode:400});
    const recipient=await db.collection('users').doc(recipientId).get();if(!recipient.exists||recipient.data()?.status==='Inactive')throw Object.assign(new Error('Recipient is unavailable.'),{statusCode:400});
    const threadId=String(parent.threadId||parentSnap.id),subject=String(parent.subject||parent.title||'Pesan').replace(/^Balasan:\s*/i,'');
    for(const key of Object.keys(data))delete data[key];
    Object.assign(data,{type:'Message',subject:'Balasan: '+subject,body:String(raw.body).trim(),threadId,replyToId:parentSnap.id,senderId:String(actor.id),senderName:actor.name||actor.username||actor.email||String(actor.id),senderArea:(Array.isArray(actor.assignedStations)&&actor.assignedStations.length?actor.assignedStations:(Array.isArray(actor.airports)?actor.airports:[])).join(', ')||actor.unit||'',recipientId,status:'Unread',notificationStatus:'Unread',destination:`app.html?page=admin&inbox=${encodeURIComponent(ref.id)}`});
  }
  if(collection==='inbox' && action==='CREATE' && !isOperationalAdmin(actor) && actor.role!=='Super Admin'){
    if(!['Article Proposal','Suggestion / Guest Book','Message'].includes(String(data.type)))throw Object.assign(new Error('Inbox category is not available for submission.'),{statusCode:403});
    if(!String(data.subject||'').trim()||!String(data.body||'').trim())throw Object.assign(new Error('Subject and content required.'),{statusCode:400});
    if(!isInboxReply){
    const users=await db.collection('users').get();inboxAudience=users.docs.filter(doc=>{const u=doc.data()||{};return u.status!=='Inactive'&&(u.role==='Super Admin'||isOperationalAdmin(u))}).map(doc=>doc.id);
    if(!inboxAudience.length)throw Object.assign(new Error('No support administrator is available.'),{statusCode:409});
    data.destination=`app.html?page=admin&inbox=${encodeURIComponent(ref.id)}`;data.recipientId=inboxAudience.shift();data.senderId=String(actor.id);data.senderName=actor.name||actor.username||actor.email||String(actor.id);data.senderArea=(Array.isArray(actor.assignedStations)&&actor.assignedStations.length?actor.assignedStations:(Array.isArray(actor.airports)?actor.airports:[])).join(', ')||actor.unit||'';data.status='Unread';
    }
  }
  if(collection==='contactMessages'){
    const admin=isOperationalAdmin(actor)||actor.role==='Super Admin';
    if(action==='CREATE'){
      if(admin) throw Object.assign(new Error('Support request must originate from a user.'),{statusCode:403});
      if(!String(data.subject||'').trim()||!String(data.message||'').trim())throw Object.assign(new Error('Subject and message required.'),{statusCode:400});
      data.ownerUserId=String(actor.id);data.senderName=actor.name||actor.username||actor.email||String(actor.id);data.senderArea=(Array.isArray(actor.assignedStations)&&actor.assignedStations.length?actor.assignedStations:(Array.isArray(actor.airports)?actor.airports:[])).join(', ')||actor.unit||'';
      data.messages=[{actorId:String(actor.id),senderName:actor.name||actor.username||actor.email||String(actor.id),body:String(data.message),at:data.messages?.[0]?.at||new Date().toISOString()}];
      data.status='Open';
    }else{
      if(!existing.exists || (!admin && String(prev.ownerUserId)!==String(actor.id)))throw Object.assign(new Error('Support conversation access denied.'),{statusCode:403});
      if(String(data.ownerUserId||'')!==String(prev.ownerUserId||''))throw Object.assign(new Error('Conversation owner cannot change.'),{statusCode:403});
      const prior=Array.isArray(prev.messages)?prev.messages:[];
      const messages=Array.isArray(data.messages)?data.messages:[];
      if(messages.length!==prior.length+1 || messages.slice(0,-1).some((m,i)=>String(m.actorId)!==String(prior[i]?.actorId)||String(m.body)!==String(prior[i]?.body)||String(m.at)!==String(prior[i]?.at)) || String(messages.at(-1)?.actorId)!==String(actor.id) || !String(messages.at(-1)?.body||'').trim())throw Object.assign(new Error('Only a new reply can be added.'),{statusCode:403});
      data.messages=[...prior,{actorId:String(actor.id),senderName:actor.name||actor.username||actor.email||String(actor.id),body:String(messages.at(-1).body),at:messages.at(-1).at||new Date().toISOString()}];
      for(const key of Object.keys(data))if(key!=='messages')delete data[key];
      data.subject=prev.subject;data.senderName=prev.senderName;data.senderArea=prev.senderArea;data.ownerUserId=prev.ownerUserId;data.status=prev.status||'Open';
    }
  }

  if(FINANCIAL_COLLECTIONS.has(collection)){
    const editor=actor.role==='Super Admin'||isOperationalAdmin(actor);
    if(!editor && ['Approved','Verified'].includes(String(data.status||'')))throw Object.assign(new Error('Approval requires authorized management.'),{statusCode:403,code:'FINANCIAL_APPROVAL_FORBIDDEN'});
    if(!editor && existing.exists && ['Approved','Verified'].includes(String(prev.status||'')))throw Object.assign(new Error('Approved financial records require authorized management to change.'),{statusCode:403,code:'APPROVED_RECORD_PROTECTED'});
    if(!editor && !stationsOf({...prev,...data}).length && String(data.status||'Draft')!=='Draft')throw Object.assign(new Error('Select a station before submitting this financial record.'),{statusCode:403,code:'FINANCIAL_SCOPE_REQUIRED'});
    if(existing.exists && ['Approved','Verified'].includes(String(prev.status||'')) && String(data.status||'')==='Draft')throw Object.assign(new Error('Approved records require formal revision, not a reset to Draft.'),{statusCode:409,code:'FINANCIAL_REVISION_REQUIRED'});
  }
  if(collection==='operationalUsage'){
    if(action==='DELETE')throw Object.assign(new Error('Operational usage is retained for audit; use a correction record.'),{statusCode:403,code:'USAGE_DELETE_FORBIDDEN'});
    if(action==='UPDATE')throw Object.assign(new Error('Usage records are immutable; contact the authorized owner for a documented correction.'),{statusCode:403,code:'USAGE_IMMUTABLE'});
    const day=String(data.date||''),station=String(data.station||'').toUpperCase(),system=String(data.systemType||'').toUpperCase();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(new Date(day+'T00:00:00Z').getTime())||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day||!['SSBD','KIOSK'].includes(system)||!/^[A-Z0-9]{3,4}$/.test(station)||ref.id!==system+'-'+station+'-'+day||!Number.isSafeInteger(Number(data.usageCount))||Number(data.usageCount)<0){
      throw Object.assign(new Error('Valid date, station, system type and nonnegative integer usage count are required.'),{statusCode:400,code:'USAGE_INVALID'});
    }
    if(!inScope(actor,{station}))throw Object.assign(new Error('Station outside account scope.'),{statusCode:403,code:'SCOPE_FORBIDDEN'});
    data.station=station;data.systemType=system;data.date=day;data.usageCount=Number(data.usageCount);
    if(!String(data.source||'').trim())data.source='Manual Entry';
  }
  if(collection==='financialBudgets'){
    const projection=Array.isArray(data.annualForecasts)?data.annualForecasts:[];
    if(projection.length>20)throw Object.assign(new Error('Too many fiscal forecast periods.'),{statusCode:400,code:'FORECAST_LIMIT'});
    const years=new Set();
    for(const r of projection){
      const year=Number(r.year),rate=Number(r.ratePerVisitor),visitors=Number(r.forecastVisitors),escalation=r.escalationPercent;
      if(!Number.isInteger(year)||year<2000||year>2100||years.has(year)||r.ratePerVisitor==null||r.forecastVisitors==null||!Number.isFinite(rate)||rate<0||!Number.isSafeInteger(visitors)||visitors<0||escalation!=null&&(!Number.isFinite(Number(escalation))||Number(escalation)< -100||Number(escalation)>100))throw Object.assign(new Error('Invalid annual forecast period.'),{statusCode:400,code:'FORECAST_INVALID'});
      years.add(year);r.calculatedCost=rate*visitors;
    }
    if(data.planningDomain==='LOUNGE'&&data.ratePerVisitor!=null&&data.annualForecastVisitors!=null){
      const rate=Number(data.ratePerVisitor),visitors=Number(data.annualForecastVisitors);
      if(!Number.isFinite(rate)||rate<0||!Number.isSafeInteger(visitors)||visitors<0)throw Object.assign(new Error('Invalid Lounge cost estimate.'),{statusCode:400,code:'LOUNGE_FORECAST_INVALID'});
      data.calculatedAnnualCost=rate*visitors;
    }
  }
  if(collection==='referenceCatalog' && data.kind==='businessCodePrefix' && actor.role!=='Super Admin')throw Object.assign(new Error('Only Superadmin may configure reference code prefixes.'),{statusCode:403,code:'PREFIX_ADMIN_ONLY'});
  if(collection==='financialBudgets' && !isOperationalAdmin(actor) && actor.role!=='Super Admin'){
    for(const field of ['approvedAmount','revisedApprovedAmount','approvalReference']){
      const before=existing.exists?prev[field]??null:null,next=data[field]??null;
      if(JSON.stringify(before)!==JSON.stringify(next))throw Object.assign(new Error('Approved and revised budget values require authorized management.'),{statusCode:403,code:'APPROVAL_FIELD_FORBIDDEN'});
    }
  }
  if(collection==='financialBudgets' && ['Approved','Verified'].includes(String(data.status||''))){
    if((data.approvedAmount==null||data.approvedAmount==='')&&(data.revisedApprovedAmount==null||data.revisedApprovedAmount==='') || !Number.isFinite(Number(data.revisedApprovedAmount??data.approvedAmount)) || Number(data.revisedApprovedAmount??data.approvedAmount)<0 || !String(data.approvalReference||'').trim())throw Object.assign(new Error('Approved Budget requires amount and approval reference.'),{statusCode:400,code:'FINANCIAL_APPROVAL_INCOMPLETE'});
  }
  if(collection==='touchpoints'&&existing.exists&&/(?:^|[^a-z])(nps|csi)(?:[^a-z]|$)/i.test([prev.sourceType,prev.source,prev.sourceLabel,prev.origin,prev.originSource].filter(Boolean).join(' '))) throw Object.assign(new Error('Corporate NPS/CSI touch points cannot be edited.'),{statusCode:403,code:'CSI_TOUCHPOINT_LOCKED'});
  if(collection==='inbox' && action==='CREATE'){
    // Every message requires one real recipient. Non-admin submissions are assigned
    // to individual support administrators above; administrative messages must be explicit.
    const recipientId=String(data.recipientId||'').trim();
    if(!recipientId)throw Object.assign(new Error('Select a recipient before sending the message.'),{statusCode:400,code:'INBOX_RECIPIENT_REQUIRED'});
    const recipient=await db.collection('users').doc(recipientId).get();
    if(!recipient.exists || String(recipient.data()?.status||'').toLowerCase()==='inactive')throw Object.assign(new Error('Recipient is not an active user.'),{statusCode:400,code:'INBOX_RECIPIENT_INVALID'});
    data.recipientId=recipientId;
    data.notificationStatus='Unread';
  }
  if(isExternalActor(actor) && existing.exists && !ownsRecord(actor,prev)) throw Object.assign(new Error('External users can only update their own records.'),{statusCode:403,code:'OWNERSHIP_FORBIDDEN'});
  if(!isExternalActor(actor) && existing.exists && collection!=='inbox' && !inScope(actor,prev)) throw Object.assign(new Error('Record outside account scope.'),{statusCode:403,code:'SCOPE_FORBIDDEN'});
  if(collection==='initiatives'){
    for(const field of ['budget','estimatedCost','actualCost']){
      if(Object.prototype.hasOwnProperty.call(data,field) && (!existing.exists || JSON.stringify(data[field]??null)!==JSON.stringify(prev[field]??null))){
        throw Object.assign(new Error('Budget values must be maintained in Budget & Financial.'),{statusCode:403,code:'BUDGET_SINGLE_ENTRY'});
      }
    }
  }
  if(collection==='initiatives' && existing.exists && !isExternalActor(actor) && actor.role!=='Super Admin' && !isOperationalAdmin(actor)){
    const creator=prev.createdBy?(await db.collection('users').doc(String(prev.createdBy)).get()):null;
    const owner=creator?.exists?creator.data():null;
    if(!owner || isOperationalAdmin(owner) || owner.role==='Super Admin') throw Object.assign(new Error('Initiative milik Admin hanya dapat diubah oleh Admin.'),{statusCode:403,code:'HIERARCHY_FORBIDDEN'});
    const editable=new Set(['real','remark']);
    for(const [key,value] of Object.entries(data)){
      if(key==='createdByAccessLevel'||key==='createdByRole')continue;
      if(!editable.has(key) && JSON.stringify(sanitize(value))!==JSON.stringify(sanitize(prev[key]))) throw Object.assign(new Error('Hanya progress dan remark yang dapat diubah oleh Editor.'),{statusCode:403,code:'HIERARCHY_FORBIDDEN'});
    }
  }
  if(isExternalActor(actor) && collection==='initiatives'){delete data.touchPoint;delete data.touchpoint;delete data.touchPoints;delete data.touchpoints;delete data.station;delete data.stations;data.ownerUserId=actor.id;data.visibility='EXTERNAL_PRIVATE';data.initiativeScope='GENERAL';}
  if(isExternalActor(actor) && collection==='projectEvents'){data.ownerUserId=actor.id;data.visibility='EXTERNAL_PRIVATE';}
  if(existing.exists && collection==='financialBudgets'){
    const tracked=['proposedAmount','approvedAmount','revisedApprovedAmount','status','fundingSource'];
    if(tracked.some(k=>JSON.stringify(prev[k]??null)!==JSON.stringify(data[k]??null))){
      data.revisionHistory=[...(Array.isArray(prev.revisionHistory)?prev.revisionHistory:[]),{at:new Date().toISOString(),by:String(actor.id),previous:Object.fromEntries(tracked.map(k=>[k,prev[k]??null])),next:Object.fromEntries(tracked.map(k=>[k,data[k]??null])),reference:String(data.approvalReference||'')}];
    }else data.revisionHistory=Array.isArray(prev.revisionHistory)?prev.revisionHistory:[];
  }
  if(existing.exists && ['groundHandlers','serviceProcurement'].includes(collection)){
    if(JSON.stringify(prev.priceSchedules||[])!==JSON.stringify(data.priceSchedules||[]))data.priceRevisionHistory=[...(Array.isArray(prev.priceRevisionHistory)?prev.priceRevisionHistory:[]),{at:new Date().toISOString(),by:String(actor.id),previous:prev.priceSchedules||[],agreement:String(prev.documentNumber||prev.agreement||'')}];
    else data.priceRevisionHistory=Array.isArray(prev.priceRevisionHistory)?prev.priceRevisionHistory:[];
  }
  const station=stationOf({...prev,...data}); if(!isExternalActor(actor) && station && !inScope(actor,collection==='flightSchedule'?{...prev,...data}:{airport:station,stationCode:station})) throw Object.assign(new Error('Station outside account scope.'),{statusCode:403,code:'SCOPE_FORBIDDEN'});
  const now=FieldValue.serverTimestamp();
  const next={...data,updatedAt:now,updatedBy:actor.id}; if(!existing.exists){next.createdAt=now;next.createdBy=actor.id;if(collection==='initiatives'){next.createdByRole=actor.role;next.createdByAccessLevel=actor.accessLevel||''}}else if(collection==='initiatives'){next.createdByRole=prev.createdByRole||'';next.createdByAccessLevel=prev.createdByAccessLevel||''}
  if(action==='CREATE' && existing.exists) throw Object.assign(new Error('Record already exists.'),{statusCode:409,code:'ALREADY_EXISTS'});
  if(initiativeImport){
    if(action==='UPDATE'&&!existing.exists)throw Object.assign(new Error('Record no longer exists.'),{statusCode:409,code:'RECORD_CHANGED'});
    const batch=db.batch();
    if(action==='CREATE')batch.create(ref,next);
    else batch.update(ref,next,{lastUpdateTime:existing.updateTime});
    batch.set(db.collection('portalMetadata').doc('cacheState'),{
      version:FieldValue.increment(1),updatedAt:now,lastCollection:collection
    },{merge:true});
    batch.create(dataQuery(db,'auditLogs').doc(),{
      actorId:actor.id,actorRole:actor.role,name:actor.name||actor.username||actor.email||actor.id,
      username:actor.username||actor.email||'',module:collection,object:ref.id,
      detail:`${collection} ${action.toLowerCase()}`,targetType:'EDITION1_INITIATIVES',targetId:ref.id,
      action:action==='CREATE'?'Create':'Update',timestamp:now,result:'SUCCESS'
    });
    await batch.commit();
    return {id:ref.id};
  }
  // User-facing business code is assigned by the server, atomically. Technical Firestore ID stays unchanged.
  const type=collection==='groundHandlers'?'GHA':collection==='initiatives'?'INITIATIVE':collection==='financialBudgets'?'BUDGET':collection==='financialCostObjects'?'COST_OBJECT':collection==='financialAllocations'?'ALLOCATION':collection==='financialActuals'?'ACTUAL':collection==='serviceProcurement'?String(data.planningCategoryId||data.serviceCategory||'').toUpperCase():'';
  const defaultPrefixes={GHA:'GHA',AIRPORT_OPERATOR:'AP',CATERING:'CAT',INITIATIVE:'IN',BUDGET:'BGT',COST_OBJECT:'COST',ALLOCATION:'ALC',ACTUAL:'ACT'};
  if(action==='CREATE' && !existing.exists && defaultPrefixes[type]){
    const rules=await dataQuery(db,'referenceCatalog').where('kind','==','businessCodePrefix').get();
    const config=rules.docs.map(doc=>({id:doc.id,...doc.data()})).find(row=>String(row.id).toUpperCase()===type&&row.status!=='Inactive');
    const prefix=String(config?.prefix||defaultPrefixes[type]).replace(/[^A-Z0-9-]/gi,'').toUpperCase();
    const digits=Math.max(2,Math.min(8,Number(config?.digits||4)));
    const counter=db.collection('portalMetadata').doc('businessCodeCounters').collection('sequences').doc(type);
    await db.runTransaction(async tx=>{
      const [oldCounter,oldRecord]=await Promise.all([tx.get(counter),tx.get(ref)]);
      if(oldRecord.exists)throw Object.assign(new Error('Record already exists.'),{statusCode:409,code:'ALREADY_EXISTS'});
      const seq=Number(oldCounter.data()?.value||0)+1;
      const code=prefix+'-'+String(seq).padStart(digits,'0');
      tx.create(ref,{...next,businessCode:code});
      tx.set(counter,{value:seq,updatedAt:now},{merge:true});
      tx.set(db.collection('portalMetadata').doc('cacheState'),{version:FieldValue.increment(1),updatedAt:now,lastCollection:collection},{merge:true});
    });
  }else{
    if(existing.exists&&prev.businessCode)next.businessCode=prev.businessCode;
    await ref.set(next,{merge:action==='UPDATE'});
    await bumpCacheVersion(db,collection);
  }

  if(collection==='inbox' && inboxAudience.length)await Promise.all(inboxAudience.map(uid=>dataRef(db,'inbox',`${ref.id}:${uid}`).set({...next,recipientId:uid},{merge:false})));
  if(collection==='contactMessages'){
    const admin=isOperationalAdmin(actor)||actor.role==='Super Admin';
    const audience=admin?[String(prev.ownerUserId)]:[];
    if(!admin){const users=await db.collection('users').get();users.docs.forEach(doc=>{const u=doc.data()||{};if(u.status!=='Inactive' && (u.role==='Super Admin'||(isOperationalAdmin(u)&&((!Array.isArray(u.assignedStations)||!u.assignedStations.length)&&(!Array.isArray(u.airports)||!u.airports.length)||!data.senderArea||(Array.isArray(u.assignedStations)&&u.assignedStations.length?u.assignedStations:(Array.isArray(u.airports)?u.airports:[])).some(code=>String(data.senderArea).split(/[,;]+/).map(x=>x.trim()).includes(String(code))))) ))audience.push(doc.id)})}
    const last=(data.messages||[]).at(-1)||{};
    await Promise.all([...new Set(audience)].filter(Boolean).map(async uid=>{
      const messageId=`support:${ref.id}:${data.messages.length}:${uid}`;
      await dataRef(db,'inbox',messageId).set({type:'Contact Support',subject:`${admin?'Balasan Bantuan':'Permintaan Bantuan'}: ${data.subject}`,title:`${admin?'Balasan Bantuan':'Permintaan Bantuan'}: ${data.subject}`,body:String(last.body||''),message:String(last.body||''),senderName:actor.name||actor.username||actor.email||String(actor.id),senderArea:data.senderArea||'',senderId:String(actor.id),recipientId:uid,relatedType:'contactMessages',referenceId:ref.id,status:'Unread',notificationStatus:'Unread',createdAt:new Date().toISOString(),destination:`app.html?page=${admin?'kontak':'admin'}&support=${encodeURIComponent(ref.id)}`},{merge:false});
    }));
  }
  const out=await ref.get();
  await dataQuery(db,'auditLogs').add({actorId:actor.id,actorRole:actor.role,name:actor.name||actor.username||actor.email||actor.id,username:actor.username||actor.email||'',module:collection,object:ref.id,detail:`${collection} ${action.toLowerCase()}`,targetType:`EDITION1_${collection.toUpperCase()}`,targetId:ref.id,action:action.charAt(0)+action.slice(1).toLowerCase(),timestamp:FieldValue.serverTimestamp(),result:'SUCCESS'});
  return {id:ref.id,...sanitize(out.data())};
}
exports.handler=async(event)=>{
  try{
    const {db,actor}=await actorFor(event);
    if(event.httpMethod==='GET'){
      if(event.queryStringParameters?.thread){
        const id=cleanId(event.queryStringParameters.thread),root=await dataRef(db,'inbox',id).get();
        if(!root.exists)throw Object.assign(new Error('Conversation not found.'),{statusCode:404});
        const initial=root.data()||{},threadId=String(initial.threadId||root.id),member=x=>[x.senderId,x.recipientId].map(String).includes(String(actor.id));
        if(!member(initial))throw Object.assign(new Error('Conversation access denied.'),{statusCode:403});
        const [children,parent]=await Promise.all([dataQuery(db,'inbox').where('threadId','==',threadId).get(),dataRef(db,'inbox',threadId).get()]);
        const entries=new Map();for(const doc of [parent,...children.docs])if(doc.exists&&member(doc.data()||{}))entries.set(doc.id,{id:doc.id,...sanitize(doc.data())});
        return ok({ok:true,thread:[...entries.values()].sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')))});
      }
      if(String(event.queryStringParameters?.manifest||'')==='1'){
        const snap=await db.collection('portalMetadata').doc('cacheState').get();
        const meta=snap.exists?sanitize(snap.data()):{};
        return ok({ok:true,source:'Firestore',manifest:{version:Number(meta.version||0),updatedAt:meta.updatedAt||null,lastCollection:meta.lastCollection||''}});
      }
      const cols=queryCollections(event); if(!cols.length) return bad(400,'COLLECTION_REQUIRED','At least one collection is required.');
      const out=Object.fromEntries(await Promise.all(cols.map(async c=>[c,await readCollection(db,actor,c)]))); return ok({ok:true,source:'Firestore',collections:out,actor:{id:actor.id,role:actor.role,accessLevel:actor.accessLevel||'',scopeType:actor.scopeType||'CUSTOM'}});
    }
    if(event.httpMethod==='POST'){
      let body; try{body=JSON.parse(event.body||'{}')}catch{return bad(400,'INVALID_JSON','Invalid JSON body.')}
      const collection=String(body.collection||'').trim(); const action=String(body.action||'').toUpperCase();
      if(action==='BATCH'){
        const changes=Array.isArray(body.changes)?body.changes:[];
        if(!changes.length || changes.length>75) return bad(400,'INVALID_BATCH','Batch must contain 1 to 75 changes.');
        // Validate the entire batch before starting any writes.
        if(changes.some(ch=>!['CREATE','UPDATE'].includes(String(ch?.action||'').toUpperCase())))
          return bad(400,'INVALID_BATCH_ACTION','Batch only accepts CREATE and UPDATE.');
        if(collection==='initiatives'&&body.reportOutcomes===true){
          const ids=changes.map(change=>String(change.id||''));
          if(ids.some(id=>!id)||new Set(ids).size!==ids.length)
            return bad(400,'INVALID_BATCH_IDS','Initiative import requires one unique ID per record.');
          const result=await Promise.all(changes.map(async change=>{
            const id=String(change.id);
            try{
              await writeOne(db,actor,collection,String(change.action).toUpperCase(),id,change.data||{},{initiativeImport:true});
              return {id,status:'saved'};
            }catch(error){
              const known=error.statusCode>=400&&error.statusCode<500||[5,6,9,10].includes(error.code);
              return {id,status:known?'failed':'unconfirmed',code:String(error.code||'INITIATIVE_WRITE_ERROR')};
            }
          }));
          return ok({ok:true,source:'Firestore',result});
        }
        // One authenticated function request for a bulk import. Writes retain the exact
        // writeOne permission/scope/audit contract, but execute concurrently to remove
        // the previous row-by-row network wait experienced by the browser.
        const result=await Promise.all(changes.map(ch=>{
          const a=String(ch?.action||'').toUpperCase();
          return writeOne(db,actor,collection,a,ch?.id,ch?.data||{});
        }));
        return ok({ok:true,source:'Firestore',result});
      }
      if(action==='DELETE')return bad(400,'EXPLICIT_DELETE_REQUIRED','Use the explicit record deletion action.');
      if(!['CREATE','UPDATE','DELETE_RECORD'].includes(action)) return bad(400,'INVALID_ACTION','Invalid write action.');
      const deleting=action==='DELETE_RECORD';
      const id=deleting?cleanId(body.id):body.id;
      if(deleting && (id.includes('/') || id==='.' || id==='..'))return bad(400,'INVALID_ID','Invalid document id.');
      const result=await writeOne(db,actor,collection,deleting?'DELETE':action,id,body.data||{}); return ok({ok:true,source:'Firestore',result});
    }
    return bad(405,'METHOD_NOT_ALLOWED','Method not allowed.');
  }catch(e){return bad(e.statusCode||500,e.code||'EDITION1_DATA_ERROR',e.message||'Edition 1 data request failed.');}
};

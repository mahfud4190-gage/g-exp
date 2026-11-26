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
  'workPrograms','workActivities','financialBudgets','financialCostObjects','financialAllocations','financialActuals','financialAdjustments','financialCommitments','financialForecasts','operationalUsage'
]);
const DATA_GROUP_BY_COLLECTION = Object.fromEntries([...COLLECTIONS].map(name => [name, name]));
const FINANCIAL_COLLECTIONS = new Set(['workPrograms','workActivities','financialBudgets','financialCostObjects','financialAllocations','financialActuals','financialAdjustments','financialCommitments','financialForecasts']);
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
  initiatives:'initiatives',workPrograms:'planning',workActivities:'planning', financialBudgets:'planning',financialCostObjects:'planning',financialAllocations:'planning',financialActuals:'planning',financialAdjustments:'planning',financialCommitments:'planning',financialForecasts:'planning',operationalUsage:'planning', projectEvents:'calendar', inbox:'inbox', airports:'data', personnel:'data',
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
  if(FINANCIAL_COLLECTIONS.has(c) && allowedStations(actor)){const owner=ownerKey(actor.budgetOwnerCode||actor.companyOwnerCode||actor.organizationalOwnerCode||'');rows=rows.filter(x=>stationsOf(x).length>0?inScope(actor,x):String(x.createdBy||x.ownerUserId||'')===String(actor.id)||(owner&&owner===ownerKey(x.ownerCode)));}
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
  if(['workPrograms','workActivities'].includes(collection))throw Object.assign(new Error('Company PK/AK records are managed through the validated Budget Workbook Import.'),{statusCode:403,code:'COMPANY_CODE_SERVER_ONLY'});
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
    const identifiers=['pkNumber','pkCode','akNumber','akCode','programId','activityId','ownerCode','sourceSystem','sourceSheet','sourceRow'];
    if(!existing.exists&&identifiers.some(k=>Object.prototype.hasOwnProperty.call(data,k)))throw Object.assign(new Error('Company PK/AK identity is assigned by the verified Budget Workbook Import.'),{statusCode:403,code:'COMPANY_IDENTITY_SERVER_ONLY'});
    if(existing.exists&&identifiers.some(k=>Object.prototype.hasOwnProperty.call(data,k)&&JSON.stringify(data[k]??null)!==JSON.stringify(prev[k]??null)))throw Object.assign(new Error('Company PK/AK identity cannot be modified through the Budget form.'),{statusCode:403,code:'COMPANY_IDENTITY_LOCKED'});
    const proposedCE=String(data.costElement||'').trim();
    if(proposedCE&&(!existing.exists||proposedCE!==String(prev.costElement||'').trim())){
      const refs=await dataQuery(db,'referenceCatalog').get();
      const found=refs.docs.some(doc=>{const v=doc.data()||{};return ['costElement','id:costElement','cost-element','id:cost-element'].includes(v.kind)&&v.status!=='Inactive'&&String(v.code||v.id||doc.id).trim()===proposedCE});
      if(!found)throw Object.assign(new Error('Select an active Cost Element from Master Data.'),{statusCode:400,code:'COST_ELEMENT_UNMAPPED'});
    }
  }
  if(collection==='financialBudgets'){
    const projection=Array.isArray(data.annualForecasts)?data.annualForecasts:[];
    if(projection.length>20)throw Object.assign(new Error('Too many fiscal forecast periods.'),{statusCode:400,code:'FORECAST_LIMIT'});
    const years=new Set();
    for(const r of projection){
      const year=Number(r.year),rate=Number(r.ratePerVisitor),visitors=Number(r.forecastVisitors),escalation=r.escalationPercent;
      if(!Number.isInteger(year)||year<2000||year>2100||years.has(year)||r.ratePerVisitor==null||r.forecastVisitors==null||!Number.isFinite(rate)||rate<0||!Number.isFinite(visitors)||visitors<0||escalation!=null&&(!Number.isFinite(Number(escalation))||Number(escalation)< -100||Number(escalation)>100))throw Object.assign(new Error('Invalid annual forecast period.'),{statusCode:400,code:'FORECAST_INVALID'});
      years.add(year);r.calculatedCost=rate*visitors;
    }
    if(data.planningDomain==='LOUNGE'&&data.ratePerVisitor!=null&&data.annualForecastVisitors!=null){
      const rate=Number(data.ratePerVisitor),visitors=Number(data.annualForecastVisitors);
      if(!Number.isFinite(rate)||rate<0||!Number.isFinite(visitors)||visitors<0)throw Object.assign(new Error('Invalid Lounge cost estimate.'),{statusCode:400,code:'LOUNGE_FORECAST_INVALID'});
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
// Work Program / Activity / Budget workbook import. Read-only preview by default;
// commit is one Firestore transaction. No automatic approval or destructive reconciliation.
const crypto = require('crypto');
const importError=(code,message,statusCode=400)=>Object.assign(new Error(message),{code,statusCode});
const keyHash=x=>crypto.createHash('sha256').update(String(x)).digest('hex').slice(0,32);
const norm=x=>String(x??'').trim().replace(/\s+/g,' ');
const ownerKey=x=>norm(x).toUpperCase();
const codeConfig=/^[A-Z0-9]+(?:\.[A-Z0-9]+)*$/;
const pkIdentity=r=>r.pkNumber!=null?'number:'+r.pkNumber:'name:'+norm(r.program).toLowerCase();
const akIdentity=r=>pkIdentity(r)+'|'+(r.akNumber!=null?'number:'+r.akNumber:'name:'+norm(r.activity).toLowerCase());
function importOwner(actor,requested){
 const owner=ownerKey(requested);
 if(!owner||owner.length>45||!codeConfig.test(owner))throw importError('OWNER_REQUIRED','Select a valid organizational budget owner.');
 if(actor.role==='Super Admin'||isOperationalAdmin(actor))return owner;
 const permitted=ownerKey(actor.budgetOwnerCode||actor.companyOwnerCode||actor.organizationalOwnerCode||'');
 if(!permitted||permitted!==owner)throw importError('OWNER_SCOPE','Budget owner must match the verified organizational owner on your account.',403);
 return owner;
}
const nonnegative=(v,label)=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);if(!Number.isFinite(n)||n<0)throw importError('INVALID_AMOUNT',label+' must be a nonnegative number.');return n;};
function validateImportRows(rows,owner,year){
 if(!Array.isArray(rows)||!rows.length||rows.length>220)throw importError('INVALID_IMPORT_SIZE','Upload 1 to 220 budget lines in one workbook.');
 if(!Number.isSafeInteger(year)||year<2020||year>2100)throw importError('YEAR_INVALID','Select a valid fiscal year.');
 const seen=new Set(),pkSeen=new Map(),akSeen=new Map(),pkNumberOwner=new Map(),akNumberOwner=new Map(),out=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i];if(!r||!['SUMMARY','LOUNGE'].includes(r.kind))throw importError('IMPORT_ROW_INVALID','Unsupported workbook row '+(i+1));
  const costElement=norm(r.costElement),costCenter=norm(r.costCenter).toUpperCase(),currency=ownerKey(r.currency||'IDR');
  if(!/^\d{4,12}$/.test(costElement)||!costCenter||costCenter.length>40||!/^[A-Z]{3}$/.test(currency))throw importError('IMPORT_REFERENCE_INVALID','Cost Element, Cost Center, or Currency is invalid at row '+(i+1));
  const sourceRow=Number(r.sourceRow);if(!Number.isSafeInteger(sourceRow)||sourceRow<2||sourceRow>100000)throw importError('IMPORT_SOURCE_INVALID','Invalid source row.');
  const base={kind:r.kind,sourceRow,costElement,costCenter,currency};
  if(r.kind==='SUMMARY'){
   const pk=norm(r.program),ak=norm(r.activity),code=ownerKey(r.pkCode),akCode=ownerKey(r.akCode);
   if(!pk||!ak||pk.length>250||ak.length>350)throw importError('IMPORT_NAME_REQUIRED','Work program and activity names are required at row '+sourceRow);
   const number=v=>v===''||v==null?null:Number(v);
   const pkNumber=number(r.pkNumber),akNumber=number(r.akNumber);
   if(pkNumber!==null&&(!Number.isSafeInteger(pkNumber)||pkNumber<1)||akNumber!==null&&(!Number.isSafeInteger(akNumber)||akNumber<1))throw importError('IMPORT_CODE_INVALID','Invalid PK/AK number at row '+sourceRow);
   // Validate legacy code segments; do not invent a new code for a historical identifier.
   const prefix=String(year).slice(-2)+'.'+owner+'.';
   if(code&&(!pkNumber||code!==prefix+pkNumber))throw importError('IMPORT_PK_MISMATCH','PK code and number disagree at row '+sourceRow);
   if(akCode&&(!akNumber||!pkNumber||akCode!==prefix+pkNumber+'.'+akNumber))throw importError('IMPORT_AK_MISMATCH','AK code and number disagree at row '+sourceRow);
   const qty=nonnegative(r.quantity,'Quantity'),rate=nonnegative(r.rate,'Rate'),total=nonnegative(r.total,'Total cost');
   const proposed=total!==null?total:qty!==null&&rate!==null?qty*rate:null;
   const identitySource={program:pk,activity:ak,pkNumber,akNumber},pkK=pkIdentity(identitySource),akK=akIdentity(identitySource);
   if(pkSeen.has(pkK)&&pkSeen.get(pkK)!==pk.toLowerCase())throw importError('PK_NAME_CONFLICT','One company PK code has conflicting program names.');
   if(akSeen.has(akK)&&akSeen.get(akK)!==ak.toLowerCase())throw importError('AK_NAME_CONFLICT','One company AK code has conflicting activity names.');
   if(pkNumber!=null){const prev=pkNumberOwner.get(pkNumber);if(prev&&prev!==pk.toLowerCase())throw importError('PK_NUMBER_CONFLICT','PK Number is reused by a different work program.');pkNumberOwner.set(pkNumber,pk.toLowerCase());}
   if(akNumber!=null&&pkNumber!=null){const akRef=pkNumber+':'+akNumber,prev=akNumberOwner.get(akRef);if(prev&&prev!==ak.toLowerCase())throw importError('AK_NUMBER_CONFLICT','AK Number is reused by a different activity under the same PK.');akNumberOwner.set(akRef,ak.toLowerCase());}
   pkSeen.set(pkK,pk.toLowerCase());akSeen.set(akK,ak.toLowerCase());
   const key='SUMMARY:'+akK+':'+costElement+':'+costCenter+':'+currency;
   if(seen.has(key))throw importError('IMPORT_DUPLICATE','Duplicate Summary budget line at row '+sourceRow);seen.add(key);
   out.push({...base,program:pk,activity:ak,pkNumber,akNumber,pkCode:code,akCode,quantity:qty,rate,proposed,subunit:norm(r.subunit),classification:norm(r.classification),mandatory:norm(r.mandatory),procurement:norm(r.procurement),contractYears:r.contractYears??null,monthly:Array.isArray(r.monthly)?r.monthly.map(x=>nonnegative(x,'Monthly allocation')):[],sourceKey:key});
  }else{
   const station=ownerKey(r.station),provider=norm(r.provider),fy=Number(r.year);
   if(!/^[A-Z0-9]{3,4}$/.test(station)||!provider||!Number.isSafeInteger(fy)||fy<2020||fy>2100)throw importError('LOUNGE_ROW_INVALID','Invalid Lounge forecast at row '+sourceRow);
   const rate=nonnegative(r.rate,'Rate'),visitors=nonnegative(r.visitors,'Visitors');
   if(rate===null&&visitors===null)throw importError('LOUNGE_FORECAST_INCOMPLETE','Lounge rate and visitors are both missing at row '+sourceRow);
   const key='LOUNGE:'+station+':'+provider.toLowerCase()+':'+fy+':'+costCenter+':'+costElement+':'+norm(r.contractPeriod).toLowerCase();
   if(seen.has(key))throw importError('IMPORT_DUPLICATE','Duplicate Lounge budget line at row '+sourceRow);seen.add(key);
   out.push({...base,station,provider,year:fy,rate,visitors,proposed:rate===null||visitors===null?null:rate*visitors,sourceKey:key,contractPeriod:norm(r.contractPeriod)});
  }
 }
 return out;
}
async function budgetWorkbookImport(db,actor,body){
 if(!canWrite(actor,'financialBudgets')||isExternalActor(actor))throw importError('IMPORT_FORBIDDEN','Budget import requires internal planning edit access.',403);
 const owner=importOwner(actor,body.owner),year=Number(body.year),rows=validateImportRows(body.rows,owner,year);
 // Firestore Master Data is the authority. Spreadsheet CE names are not trusted.
 const ceDocs=await dataQuery(db,'referenceCatalog').get();
 const ce=new Map();for(const doc of ceDocs.docs){const x=doc.data()||{};if(['costElement','id:costElement','cost-element','id:cost-element'].includes(String(x.kind))&&x.status!=='Inactive')ce.set(String(x.code||x.id||doc.id).trim(),{name:x.name||x.costElementName||'',id:doc.id});}
 const allowCE=body.includeMissingCostElements===true;
 if(allowCE && actor.role!=='Super Admin')throw importError('MASTER_IMPORT_FORBIDDEN','Only Superadmin may register missing Cost Elements.',403);
 const workbookCE=new Map();for(const x of (Array.isArray(body.costElements)?body.costElements:[])){
   const code=norm(x.code),name=norm(x.name);if(!/^\d{4,12}$/.test(code)||!name||name.length>240)throw importError('MASTER_CE_INVALID','Invalid Cost Element reference in workbook.');
   if(workbookCE.has(code)&&workbookCE.get(code).name!==name)throw importError('MASTER_CE_DUPLICATE','Cost Element has conflicting names in List CE.');
   workbookCE.set(code,{code,name,hierarchy:Array.isArray(x.hierarchy)?x.hierarchy.slice(0,5).map(norm):[]});
 }
 const missing=rows.filter(r=>!ce.has(r.costElement));
 const mismatches=missing.filter(r=>!allowCE||!workbookCE.has(r.costElement)).map(r=>({row:r.sourceRow,code:r.costElement,message:'Cost Element not found in active Master Data. Register it first or select authorized master import.'}));
 const ceNew=[...new Set(missing.filter(r=>allowCE&&workbookCE.has(r.costElement)).map(r=>r.costElement))].map(code=>workbookCE.get(code));
 const scope=rows.filter(r=>r.station&&!inScope(actor,{station:r.station})).map(r=>({row:r.sourceRow,code:r.station,message:'Station outside account scope.'}));
 const conflicts=[...mismatches,...scope];
 // We never infer Approved Budget from workbook estimates or monthly distributions.
 if(String(body.mode||'PREVIEW').toUpperCase()!=='COMMIT'){
  const refs=rows.map(r=>dataRef(db,'financialBudgets','wb-'+keyHash(owner+'|'+year+'|'+r.sourceKey)));
  const snapshots=typeof db.getAll==='function'?await db.getAll(...refs):await Promise.all(refs.map(ref=>ref.get()));
  const statuses=rows.map((r,i)=>{const found=snapshots[i].exists,previous=found?snapshots[i].data()||{}:null;
    const mismatch=found&&((previous.proposedAmount??null)!==(r.proposed??null)||String(previous.costElement||'')!==r.costElement);
    return {source:r.kind,row:r.sourceRow,reference:r.kind==='SUMMARY'?(r.akCode||'Code assigned on import'):r.station+' / '+r.year,costElement:r.costElement,proposed:r.proposed,status:mismatch?'Conflict':found?'Unchanged':'New'};
  });
  const clashes=statuses.filter(x=>x.status==='Conflict').map(x=>({row:x.row,code:x.reference,message:'Existing budget differs from imported Proposed Amount or Cost Element. No overwrite permitted.'}));
  return {preview:true,owner,year,count:rows.length,programLines:rows.filter(r=>r.kind==='SUMMARY').length,loungeLines:rows.filter(r=>r.kind==='LOUNGE').length,newCostElements:ceNew.length,newLines:statuses.filter(x=>x.status==='New').length,unchangedLines:statuses.filter(x=>x.status==='Unchanged').length,conflicts:[...conflicts,...clashes],statuses,requiresConfirmation:true};
 }
 if(conflicts.length)throw importError('IMPORT_CONFLICT','Resolve all Cost Element and station conflicts before import.',409);
 if(body.confirmed!==true)throw importError('IMPORT_CONFIRMATION_REQUIRED','Review and confirm the import before writing.');
 const programs=rows.filter(r=>r.kind==='SUMMARY');
 const identity=x=>keyHash(owner+'|'+year+'|'+x);
 // Numeric company codes already on the worksheet take precedence, but are checked
 // against same-owner records. Missing codes are allocated inside this transaction.
 const counterRef=db.collection('portalMetadata').doc('budgetCompanySequences').collection('owners').doc(keyHash(owner+'|'+year));
 const businessCounter=db.collection('portalMetadata').doc('businessCodeCounters').collection('sequences').doc('BUDGET');
 const prefixConfig=ceDocs.docs.map(d=>d.data()||{}).find(x=>x.kind==='businessCodePrefix'&&ownerKey(x.id)==='BUDGET'&&x.status!=='Inactive')||{};
 const budgetPrefix=String(prefixConfig.prefix||'BGT').toUpperCase().replace(/[^A-Z0-9-]/g,'')||'BGT',budgetDigits=Math.max(2,Math.min(8,Number(prefixConfig.digits||4)));
 const refPK=x=>dataRef(db,'workPrograms','wp-'+identity('PK:'+x));
 const refAK=x=>dataRef(db,'workActivities','wa-'+identity('AK:'+x));
 const plannedPk=new Map();
 for(const r of programs){const p=pkIdentity(r),old=plannedPk.get(p);if(old&&norm(old.name).toLowerCase()!==norm(r.program).toLowerCase())throw importError('IMPORT_PK_CONFLICT','One PK code has conflicting program names.');if(!old)plannedPk.set(p,{name:r.program,pkNumber:r.pkNumber});}
 const pkRefs=[...plannedPk].map(([k,v])=>({key:k,ref:refPK(k),...v}));
 const akRefs=[...new Map(programs.map(r=>[akIdentity(r),{key:akIdentity(r),ref:refAK(akIdentity(r)),row:r}])).values()];
 const lineRefs=rows.map(r=>({r,ref:dataRef(db,'financialBudgets','wb-'+keyHash(owner+'|'+year+'|'+r.sourceKey))}));
 const ceRefs=ceNew.map(x=>({x,ref:dataRef(db,'referenceCatalog','ce-'+x.code)}));
 const now=FieldValue.serverTimestamp(),all=[counterRef,businessCounter,...pkRefs.map(p=>p.ref),...akRefs.map(a=>a.ref),...lineRefs.map(l=>l.ref),...ceRefs.map(c=>c.ref)];
 if(new Set(all.map(x=>x.path)).size!==all.length)throw importError('IMPORT_KEY_CONFLICT','Multiple records resolve to the same identifier.');
 if(all.length+5>450)throw importError('IMPORT_SIZE_LIMIT','Workbook exceeds the safe atomic import size. Separate it by fiscal year or organizational owner.');
 const answer=await db.runTransaction(async tx=>{
  // All reads precede writes for Firestore transaction compliance.
  const [snapshots,priorPrograms,priorActivities]=await Promise.all([Promise.all(all.map(x=>tx.get(x))),tx.get(dataQuery(db,'workPrograms').where('ownerCode','==',owner)),tx.get(dataQuery(db,'workActivities').where('ownerCode','==',owner))]);const snaps=new Map(all.map((x,i)=>[x.path,snapshots[i]]));
  let nextPK=Number(snapshots[0].data()?.nextPK||0),nextBudget=Number(snapshots[1].data()?.value||0),newRecords=0,unchanged=0;
  for(const {x,ref} of ceRefs){if(snaps.get(ref.path).exists)throw importError('MASTER_CE_CONCURRENT','Cost Element was registered during preview. Refresh and preview again.',409);tx.create(ref,{id:x.code,kind:'costElement',name:x.name,code:x.code,hierarchy:x.hierarchy,status:'Active',createdBy:actor.id,createdAt:now,updatedAt:now});newRecords++;ce.set(x.code,{name:x.name,id:ref.id});}
  const pkNums=new Map(),akNums=new Map();
  const prefix=String(year).slice(-2)+'.'+owner+'.';
  const usedPK=new Map(),usedAK=new Map();
  for(const doc of priorPrograms.docs){const v=doc.data()||{},n=Number(v.pkNumber||0);if(Number(v.fiscalYear)!==year)continue;if(n){usedPK.set(n,norm(v.name).toLowerCase());nextPK=Math.max(nextPK,n);}}
  for(const doc of priorActivities.docs){const v=doc.data()||{},k=String(v.programId||''),n=Number(v.akNumber||0);if(Number(v.fiscalYear)!==year)continue;if(k&&n){const map=usedAK.get(k)||new Map();map.set(n,norm(v.name).toLowerCase());usedAK.set(k,map);}}
  for(const p of pkRefs){const old=snaps.get(p.ref.path).data()||{};if(old.pkNumber!=null)usedPK.set(Number(old.pkNumber),norm(p.name).toLowerCase());if(p.pkNumber!=null){const collision=usedPK.get(p.pkNumber);if(collision&&collision!==norm(p.name).toLowerCase())throw importError('PK_NUMBER_CONFLICT','PK number is already assigned to another work program.',409);usedPK.set(p.pkNumber,norm(p.name).toLowerCase());}}
  for(const p of pkRefs){const snap=snaps.get(p.ref.path),old=snap.data()||{};
   if(old.name&&norm(old.name).toLowerCase()!==norm(p.name).toLowerCase())throw importError('PK_NAME_CONFLICT','Existing PK identity mismatch.',409);
   if(old.pkNumber!=null&&p.pkNumber!=null&&Number(old.pkNumber)!==p.pkNumber)throw importError('PK_NUMBER_CONFLICT','Existing PK number differs from workbook.',409);
   const n=Number(old.pkNumber||p.pkNumber||0)||(()=>{do{nextPK++}while(usedPK.has(nextPK));return nextPK})();nextPK=Math.max(nextPK,n);usedPK.set(n,norm(p.name).toLowerCase());pkNums.set(p.key,n);
   if(!snap.exists)newRecords++;else unchanged++;
  }
  for(const a of akRefs){const snap=snaps.get(a.ref.path),old=snap.data()||{},r=a.row,pkKey=pkIdentity(r),pkNumber=pkNums.get(pkKey);const pool=akNums.get(pkKey)||new Map(usedAK.get(refPK(pkKey).id)||[]);akNums.set(pkKey,pool);
   if(old.akNumber!=null)pool.set(Number(old.akNumber),a.key);
   if(r.akNumber!=null){const c=pool.get(r.akNumber);if(c&&c!==r.activity.toLowerCase()&&c!==a.key)throw importError('AK_NUMBER_CONFLICT','AK number already assigned under this PK.',409);pool.set(r.akNumber,a.key);}
   if(old.akNumber!=null&&r.akNumber!=null&&Number(old.akNumber)!==r.akNumber)throw importError('AK_NUMBER_CONFLICT','Existing AK number differs from workbook.',409);
   const n=Number(old.akNumber||r.akNumber||0)||(()=>{let t=Number(snaps.get(refPK(pkKey).path).data()?.nextAK||0);while(pool.has(++t)){}return t})();pool.set(n,a.key);
   const code=prefix+pkNumber+'.'+n;
   if(!snap.exists){tx.create(a.ref,{name:r.activity,programId:refPK(pkKey).id,ownerCode:owner,performingUnit:r.subunit||'',fiscalYear:year,pkNumber,pkCode:prefix+pkNumber,akNumber:n,akCode:code,status:'Draft',createdBy:actor.id,createdAt:now,updatedAt:now});newRecords++;}else unchanged++;
  }
  for(const p of pkRefs){const pool=akNums.get(p.key)||new Map(),snap=snaps.get(p.ref.path),maximum=Math.max(Number(snap.data()?.nextAK||0),0,...pool.keys()),n=pkNums.get(p.key);if(!snap.exists)tx.create(p.ref,{name:p.name,ownerCode:owner,fiscalYear:year,pkNumber:n,pkCode:prefix+n,nextAK:maximum,status:'Draft',createdBy:actor.id,createdAt:now,updatedAt:now});else if(maximum>Number(snap.data()?.nextAK||0))tx.update(p.ref,{nextAK:maximum,updatedAt:now});}
  for(const {r,ref} of lineRefs){const snap=snaps.get(ref.path);
   if(snap.exists){const old=snap.data()||{};
    // Re-import never silently modifies proposals, approvals or financial actuals.
    if((old.proposedAmount??null)!==(r.proposed??null)||String(old.costElement||'')!==r.costElement)throw importError('IMPORT_EXISTING_CONFLICT','An existing budget differs from the workbook at row '+r.sourceRow+'. Review manually.',409);
    unchanged++;continue;
   }
   const programKey=r.kind==='SUMMARY'?pkIdentity(r):null,activityKey=r.kind==='SUMMARY'?akIdentity(r):null,pkNumber=programKey?pkNums.get(programKey):null,akNumber=activityKey?akNums.get(programKey).get(activityKey):null;
   tx.create(ref,{businessCode:budgetPrefix+'-'+String(++nextBudget).padStart(budgetDigits,'0'),name:r.kind==='SUMMARY'?r.activity:r.provider+' · '+r.station,year:r.kind==='SUMMARY'?year:r.year,ownerCode:owner,ownerType:r.kind==='LOUNGE'?'BO':'HO',station:r.station||'',category:r.kind==='LOUNGE'?'Lounge':'Work Program',planningDomain:r.kind==='LOUNGE'?'LOUNGE':'INITIATIVE',currency:r.currency,costCenter:r.costCenter,costElement:r.costElement,costElementName:ce.get(r.costElement).name,proposedAmount:r.proposed,approvedAmount:null,revisedApprovedAmount:null,status:'Draft',programId:programKey?refPK(programKey).id:'',activityId:activityKey?refAK(activityKey).id:'',pkNumber,pkCode:pkNumber?prefix+pkNumber:'',akNumber,akCode:akNumber?prefix+pkNumber+'.'+akNumber:'',quantity:r.quantity??null,rate:r.rate,ratePerVisitor:r.kind==='LOUNGE'?r.rate:null,annualForecastVisitors:r.kind==='LOUNGE'?r.visitors:null,calculatedAnnualCost:r.kind==='LOUNGE'?r.proposed:null,annualForecasts:r.kind==='LOUNGE'&&r.rate!==null&&r.visitors!==null?[{year:r.year,ratePerVisitor:r.rate,forecastVisitors:r.visitors,calculatedCost:r.proposed}]:[],contractPeriod:r.contractPeriod||'',monthlyAllocation:r.monthly||[],sourceSystem:'Budget Workbook',sourceSheet:r.kind==='SUMMARY'?'Summary':'Kertas Kerja',sourceRow:r.sourceRow,createdBy:actor.id,createdAt:now,updatedAt:now});newRecords++;
  }
  if(newRecords===0)return {newRecords,unchanged};
  tx.set(counterRef,{nextPK:Math.max(nextPK,Number(snapshots[0].data()?.nextPK||0)),ownerCode:owner,year,updatedAt:now},{merge:true});
  if(nextBudget>Number(snapshots[1].data()?.value||0))tx.set(businessCounter,{value:nextBudget,updatedAt:now},{merge:true});
  tx.set(db.collection('portalMetadata').doc('cacheState'),{version:FieldValue.increment(1),updatedAt:now,lastCollection:'financialBudgets'},{merge:true});
  tx.create(dataQuery(db,'auditLogs').doc(),{actorId:actor.id,actorRole:actor.role,module:'Budget Import',action:'Import',timestamp:now,detail:'Integrated workbook import',rowCount:rows.length,ownerCode:owner,fiscalYear:year,result:'SUCCESS'});
  return {newRecords,unchanged};
 });
 return {...answer,owner,year,totalLines:rows.length,committed:true};
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
      if(action==='IMPORT_BUDGET_WORKBOOK')return ok({ok:true,source:'Firestore',result:await budgetWorkbookImport(db,actor,body)});
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

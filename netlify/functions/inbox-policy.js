'use strict';
// Only the authenticated recipient may change their own read/pin state.
function isInboxRecipient(actorId,message){
  return Boolean(message && String(actorId||'').trim() && String(message.recipientId||'').trim() && String(message.recipientId)===String(actorId));
}
function canChangeReadState(actorId,previous,data){
  if(!isInboxRecipient(actorId,previous))return false;
  const allowed=['status','notificationStatus','pinned'];
  if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!allowed.includes(k)))return false;
  const changed=Object.keys(data).filter(k=>JSON.stringify(data[k])!==JSON.stringify(previous[k]));
  if(!changed.length)return false;
  if(changed.includes('status')&&!['Read','Unread','Handled'].includes(data.status))return false;
  if(changed.includes('notificationStatus')&&!['Read','Unread'].includes(data.notificationStatus))return false;
  if(changed.includes('pinned')&&typeof data.pinned!=='boolean')return false;
  return true;
}
module.exports={canChangeReadState,isInboxRecipient};

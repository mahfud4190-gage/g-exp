'use strict';
// Only the authenticated recipient may change their own read/pin state.
function canChangeReadState(actorId,previous,data){
  if(!previous||String(previous.recipientId||'')!==String(actorId||''))return false;
  const changed=Object.keys(data).filter(k=>JSON.stringify(data[k])!==JSON.stringify(previous[k]));
  if(!changed.length||changed.some(k=>!['status','notificationStatus','pinned'].includes(k)))return false;
  if(changed.includes('status')&&!['Read','Unread','Handled'].includes(data.status))return false;
  if(changed.includes('notificationStatus')&&!['Read','Unread'].includes(data.notificationStatus))return false;
  if(changed.includes('pinned')&&typeof data.pinned!=='boolean')return false;
  return true;
}
module.exports={canChangeReadState};

/* G-Exp spreadsheet parser for Planning Workspace. Scoped to this page; no business records stored locally. */
(function(){
'use strict';
function geParseCSVV223(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i],next=text[i+1];
  if(quoted){if(c==='"'&&next==='"'){cell+='"';i++}else if(c==='"')quoted=false;else cell+=c}
  else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell=''}
  else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell=''}else if(c!=='\r')cell+=c;
 }
 if(cell||row.length){row.push(cell);rows.push(row)}return rows;
}
function geColumnIndexV223(ref){
 const letters=String(ref||'').match(/[A-Z]+/i)?.[0]?.toUpperCase()||'A';
 let n=0;for(const ch of letters)n=n*26+(ch.charCodeAt(0)-64);return n-1;
}
async function geInflateZipEntryV223(bytes,method){
  if(method===0)return bytes;
  if(method!==8)throw new Error('Unsupported ZIP compression method');
  if(typeof DecompressionStream==='undefined')throw new Error('Browser tidak mendukung decompression XLSX.');
  const ds=new DecompressionStream('deflate-raw');
  const stream=new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function geReadZipEntriesV223(buffer){
  const u=new Uint8Array(buffer),dv=new DataView(buffer);
  let eocd=-1;
  for(let i=u.length-22;i>=Math.max(0,u.length-65557);i--){
    if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}
  }
  if(eocd<0)throw new Error('File XLSX tidak valid.');
  const count=dv.getUint16(eocd+10,true),central=dv.getUint32(eocd+16,true);
  let p=central;const entries=new Map(),dec=new TextDecoder();
  for(let k=0;k<count;k++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const method=dv.getUint16(p+10,true),comp=dv.getUint32(p+20,true);
    const nameLen=dv.getUint16(p+28,true),extraLen=dv.getUint16(p+30,true),commentLen=dv.getUint16(p+32,true);
    const local=dv.getUint32(p+42,true);
    const name=dec.decode(u.slice(p+46,p+46+nameLen));
    if(dv.getUint32(local,true)!==0x04034b50)throw new Error('Local ZIP header tidak valid.');
    const ln=dv.getUint16(local+26,true),le=dv.getUint16(local+28,true);
    const start=local+30+ln+le;
    const raw=u.slice(start,start+comp);
    entries.set(name,await geInflateZipEntryV223(raw,method));
    p+=46+nameLen+extraLen+commentLen;
  }
  return entries;
}
async function geParseXLSXV223(file){
  const entries=await geReadZipEntriesV223(await file.arrayBuffer());
  const dec=new TextDecoder();
  const shared=[];
  if(entries.has('xl/sharedStrings.xml')){
    const doc=new DOMParser().parseFromString(dec.decode(entries.get('xl/sharedStrings.xml')),'application/xml');
    [...doc.getElementsByTagNameNS('*','si')].forEach(si=>{
      shared.push([...si.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join(''));
    });
  }
  const sheetKey=[...entries.keys()].find(k=>/^xl\/worksheets\/sheet1\.xml$/i.test(k)) ||
                 [...entries.keys()].find(k=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(k));
  if(!sheetKey)throw new Error('Worksheet tidak ditemukan.');
  const doc=new DOMParser().parseFromString(dec.decode(entries.get(sheetKey)),'application/xml');
  const rows=[];
  [...doc.getElementsByTagNameNS('*','row')].forEach(r=>{
    const vals=[];
    [...r.getElementsByTagNameNS('*','c')].forEach(c=>{
      const idx=geColumnIndexV223(c.getAttribute('r'));
      const type=c.getAttribute('t')||'';
      let val='';
      if(type==='inlineStr')val=[...c.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join('');
      else{
        const v=c.getElementsByTagNameNS('*','v')[0]?.textContent??'';
        val=type==='s'?shared[Number(v)]??'':v;
      }
      vals[idx]=val;
    });
    rows.push(vals);
  });
  return rows;
}
async function geReadTabularFileV223(file){
  if(!file)throw new Error('Pilih file terlebih dahulu.');
  const ext=file.name.toLowerCase().split('.').pop();
  if(ext==='csv')return geParseCSVV223(await file.text());
  if(ext==='xlsx')return geParseXLSXV223(file);
  throw new Error('Format file harus .xlsx atau .csv');
}

window.geReadTabularFileV223=window.geReadTabularFileV223||geReadTabularFileV223;
})();

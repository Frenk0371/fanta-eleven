(function(){
let syncInFlight=null,lastSync=0;
const KNOWN_FIXES={
  'mastantuono|fiorentina':{
    sourceId:'7078',
    image:'https://content.fantacalcio.it/web/campioncini/21/medium/7078.png?v=20260902'
  },
  'franco mastantuono|fiorentina':{
    sourceId:'7078',
    image:'https://content.fantacalcio.it/web/campioncini/21/medium/7078.png?v=20260902'
  }
};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const keyOf=p=>`${norm(p?.name)}|${norm(p?.club)}`;
const bioKey=p=>{
  const name=norm(p?.name),club=norm(p?.club),role=norm(p?.role);
  return name&&club?`${name}|${club}|${role}`:'';
};
const officialImageUrl=id=>/^\d+$/.test(String(id||''))?'https://content.fantacalcio.it/web/campioncini/21/medium/'+encodeURIComponent(String(id))+'.png?v=20260902a':'';
function analysisTimestamp(a){const t=Date.parse(a?.updatedAt||'');return Number.isFinite(t)?t:0}
function mergePlayer(target,duplicate){
  let changed=false;
  for(const field of ['sourceId','profileUrl','image','name','club','role']){
    if(!target[field]&&duplicate[field]){target[field]=duplicate[field];changed=true}
  }
  if(typeof analyses!=='undefined'){
    const ta=analyses[target.id],da=analyses[duplicate.id];
    if(da&&(!ta||analysisTimestamp(da)>analysisTimestamp(ta))){
      analyses[target.id]={...da,playerId:target.id,playerName:target.name,club:target.club};
      changed=true;
    }
    if(duplicate.id!==target.id&&analyses[duplicate.id])delete analyses[duplicate.id];
  }
  return changed;
}
function dedupeTeam(team){
  if(!team||!Array.isArray(team.players)||team.players.length<2)return 0;
  const bySource=new Map(),byBio=new Map(),clean=[];
  let removed=0;
  for(const player of team.players){
    const sourceId=String(player?.sourceId||'').trim(),bio=bioKey(player);
    let keeper=sourceId?bySource.get(sourceId):null;
    if(!keeper&&bio){
      const candidate=byBio.get(bio)||null;
      const candidateSource=String(candidate?.sourceId||'').trim();
      if(candidate&&(!sourceId||!candidateSource||sourceId===candidateSource))keeper=candidate;
    }
    if(!keeper){
      clean.push(player);
      if(sourceId)bySource.set(sourceId,player);
      if(bio)byBio.set(bio,player);
      continue;
    }
    mergePlayer(keeper,player);
    const keeperSource=String(keeper?.sourceId||'').trim(),keeperBio=bioKey(keeper);
    if(keeperSource)bySource.set(keeperSource,keeper);
    if(sourceId)bySource.set(sourceId,keeper);
    if(keeperBio)byBio.set(keeperBio,keeper);
    if(bio)byBio.set(bio,keeper);
    removed++;
  }
  if(removed)team.players=clean;
  return removed;
}
function dedupeRosters(){
  if(typeof teams==='undefined'||!Array.isArray(teams))return{removed:0};
  let removed=0;
  teams.forEach(t=>{removed+=dedupeTeam(t)});
  return{removed};
}
function persistCleanup(result,{notify=false}={}){
  if(!result?.removed)return false;
  if(typeof save==='function')save();
  if(typeof render==='function')render();
  if(notify&&typeof msg==='function')msg(result.removed===1?'Doppione rimosso: il giocatore era già presente nella rosa.':`${result.removed} doppioni rimossi dalla rosa.`);
  return true;
}
function applyKnownFixes(){
  let updated=0;
  if(typeof teams==='undefined'||!Array.isArray(teams))return updated;
  teams.forEach(t=>(t.players||[]).forEach(p=>{
    const fix=KNOWN_FIXES[keyOf(p)]||null;
    const canonicalSourceId=String(fix?.sourceId||p.sourceId||'');if(!canonicalSourceId)return;
    let changed=false;
    if(fix?.sourceId&&String(p.sourceId||'')!==fix.sourceId){p.sourceId=fix.sourceId;changed=true;if(typeof analyses!=='undefined')delete analyses[p.id]}
    const canonicalImage=officialImageUrl(p.sourceId)||fix?.image||'';
    if(canonicalImage&&p.image!==canonicalImage){p.image=canonicalImage;changed=true}
    if(changed)updated++;
  }));
  return updated;
}
async function syncRoster({force=false,notify=false}={}){
  if(syncInFlight)return syncInFlight;
  if(!force&&Date.now()-lastSync<10*60e3)return{updated:0,transfers:[],duplicatesRemoved:0};
  if(typeof teams==='undefined'||!Array.isArray(teams))return{updated:0,transfers:[],duplicatesRemoved:0};
  const cleanup=dedupeRosters();
  const knownUpdated=applyKnownFixes();
  if((cleanup.removed||knownUpdated)&&typeof save==='function'){
    save();
    if(typeof render==='function')render();
  }
  const ids=[...new Set(teams.flatMap(t=>(t.players||[]).map(p=>String(p.sourceId||'').trim()).filter(Boolean)))];
  if(!ids.length){
    lastSync=Date.now();
    if(notify&&cleanup.removed&&typeof msg==='function')msg(cleanup.removed===1?'Doppione rimosso: il giocatore era già presente nella rosa.':`${cleanup.removed} doppioni rimossi dalla rosa.`);
    return{updated:knownUpdated+cleanup.removed,transfers:[],duplicatesRemoved:cleanup.removed}
  }
  syncInFlight=(async()=>{
    try{
      const r=await fetch('/api/players?ids='+encodeURIComponent(ids.join(',')),{cache:'no-store'});
      if(!r.ok)throw new Error('sync unavailable');
      const d=await r.json(),by=new Map((d.players||[]).map(p=>[String(p.id),p]));
      let updated=knownUpdated+cleanup.removed;const transfers=[];
      teams.forEach(t=>(t.players||[]).forEach(p=>{
        const fix=KNOWN_FIXES[keyOf(p)]||null;
        const n=by.get(String(p.sourceId||''));if(!n){if(fix&&fix.image&&p.image!==fix.image){p.image=fix.image;updated++}return}
        let changed=false,invalidate=false;
        if(n.club&&n.club!==p.club){transfers.push({name:p.name,from:p.club,to:n.club});p.club=n.club;changed=true;invalidate=true}
        if(n.role&&n.role!==p.role){p.role=n.role;changed=true;invalidate=true}
        const nextImage=officialImageUrl(p.sourceId)||fix?.image||n.image;
        if(nextImage&&nextImage!==p.image){p.image=nextImage;changed=true}
        if(n.name&&n.name.includes(' ')&&String(p.name||'').split(/\s+/).length<2){p.name=n.name;changed=true}
        if(changed){updated++;if(invalidate&&typeof analyses!=='undefined')delete analyses[p.id]}
      }));
      const afterCleanup=dedupeRosters();
      updated+=afterCleanup.removed;
      if((updated||afterCleanup.removed)&&typeof save==='function'){save();if(typeof render==='function')render()}
      lastSync=Date.now();
      const totalRemoved=cleanup.removed+afterCleanup.removed;
      if(notify&&typeof msg==='function'){
        if(totalRemoved)msg(totalRemoved===1?'Doppione rimosso: il giocatore era già presente nella rosa.':`${totalRemoved} doppioni rimossi dalla rosa.`);
        else if(transfers.length)msg(`Mercato aggiornato: ${transfers.length} trasferiment${transfers.length===1?'o':'i'} rilevat${transfers.length===1?'o':'i'}.`);
      }
      return{updated,transfers,duplicatesRemoved:totalRemoved};
    }finally{syncInFlight=null}
  })();
  return syncInFlight;
}
window.feSyncRoster=syncRoster;
window.feDedupeRoster=dedupeRosters;

persistCleanup(dedupeRosters());

const playerForm=document.querySelector('#playerForm'),originalAdd=playerForm&&playerForm.onsubmit;
if(playerForm&&originalAdd){playerForm.onsubmit=function(e){
  const result=originalAdd.call(this,e);
  const cleanup=dedupeRosters();
  if(cleanup.removed)persistCleanup(cleanup,{notify:true});
  return result;
}}

const button=document.querySelector('#analyze'),original=button&&button.onclick;
if(button&&original){button.onclick=async function(e){
  if((cur()?.players||[]).length){button.disabled=true;button.textContent='Sincronizzazione rosa…';if(typeof msg==='function')msg('Controllo trasferimenti e listone aggiornato…');try{await syncRoster({force:true,notify:true})}catch{}finally{button.disabled=false}}
  try{if(typeof analyses!=='undefined'&&Object.keys(analyses||{}).length)localStorage.setItem('fe-analysis-previous-v1',JSON.stringify(analyses))}catch{}
  return original.call(this,e);
}}
setTimeout(()=>syncRoster({force:true}).catch(()=>{}),100);
})();

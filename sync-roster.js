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
const keyOf=p=>`${String(p?.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}|${String(p?.club||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}`;
function applyKnownFixes(){
  let updated=0;
  if(typeof teams==='undefined'||!Array.isArray(teams))return updated;
  teams.forEach(t=>(t.players||[]).forEach(p=>{
    const fix=KNOWN_FIXES[keyOf(p)];if(!fix)return;
    let changed=false;
    if(fix.sourceId&&String(p.sourceId||'')!==fix.sourceId){p.sourceId=fix.sourceId;changed=true;if(typeof analyses!=='undefined')delete analyses[p.id]}
    if(fix.image&&p.image!==fix.image){p.image=fix.image;changed=true}
    if(changed)updated++;
  }));
  return updated;
}
async function syncRoster({force=false,notify=false}={}){
  if(syncInFlight)return syncInFlight;
  if(!force&&Date.now()-lastSync<10*60e3)return{updated:0,transfers:[]};
  if(typeof teams==='undefined'||!Array.isArray(teams))return{updated:0,transfers:[]};
  const knownUpdated=applyKnownFixes();
  const ids=[...new Set(teams.flatMap(t=>(t.players||[]).map(p=>String(p.sourceId||'').trim()).filter(Boolean)))];
  if(!ids.length){
    if(knownUpdated&&typeof save==='function'){save();if(typeof render==='function')render()}
    lastSync=Date.now();return{updated:knownUpdated,transfers:[]}
  }
  syncInFlight=(async()=>{
    try{
      const r=await fetch('/api/players?ids='+encodeURIComponent(ids.join(',')),{cache:'no-store'});
      if(!r.ok)throw new Error('sync unavailable');
      const d=await r.json(),by=new Map((d.players||[]).map(p=>[String(p.id),p]));
      let updated=knownUpdated;const transfers=[];
      teams.forEach(t=>(t.players||[]).forEach(p=>{
        const fix=KNOWN_FIXES[keyOf(p)]||null;
        const n=by.get(String(p.sourceId||''));if(!n){if(fix&&fix.image&&p.image!==fix.image){p.image=fix.image;updated++}return}
        let changed=false,invalidate=false;
        if(n.club&&n.club!==p.club){transfers.push({name:p.name,from:p.club,to:n.club});p.club=n.club;changed=true;invalidate=true}
        if(n.role&&n.role!==p.role){p.role=n.role;changed=true;invalidate=true}
        const nextImage=fix?.image||n.image;
        if(nextImage&&nextImage!==p.image){p.image=nextImage;changed=true}
        if(n.name&&n.name.includes(' ')&&String(p.name||'').split(/\s+/).length<2){p.name=n.name;changed=true}
        if(changed){updated++;if(invalidate&&typeof analyses!=='undefined')delete analyses[p.id]}
      }));
      if(updated&&typeof save==='function'){save();if(typeof render==='function')render()}
      lastSync=Date.now();
      if(notify&&transfers.length&&typeof msg==='function')msg(`Mercato aggiornato: ${transfers.length} trasferiment${transfers.length===1?'o':'i'} rilevat${transfers.length===1?'o':'i'}.`);
      return{updated,transfers};
    }finally{syncInFlight=null}
  })();
  return syncInFlight;
}
window.feSyncRoster=syncRoster;
const button=document.querySelector('#analyze'),original=button&&button.onclick;
if(button&&original){button.onclick=async function(e){
  if((cur()?.players||[]).length){button.disabled=true;button.textContent='Sincronizzazione rosa…';if(typeof msg==='function')msg('Controllo trasferimenti e listone aggiornato…');try{await syncRoster({force:true,notify:true})}catch{}finally{button.disabled=false}}
  return original.call(this,e);
}}
setTimeout(()=>syncRoster({force:true}).catch(()=>{}),100);
})();
(function(){
let syncInFlight=null,lastSync=0;
async function syncRoster({force=false,notify=false}={}){
  if(syncInFlight)return syncInFlight;
  if(!force&&Date.now()-lastSync<10*60e3)return{updated:0,transfers:[]};
  if(typeof teams==='undefined'||!Array.isArray(teams))return{updated:0,transfers:[]};
  const ids=[...new Set(teams.flatMap(t=>(t.players||[]).map(p=>String(p.sourceId||'').trim()).filter(Boolean)))];
  if(!ids.length){lastSync=Date.now();return{updated:0,transfers:[]}}
  syncInFlight=(async()=>{
    try{
      const r=await fetch('/api/players?ids='+encodeURIComponent(ids.join(',')),{cache:'no-store'});
      if(!r.ok)throw new Error('sync unavailable');
      const d=await r.json(),by=new Map((d.players||[]).map(p=>[String(p.id),p]));
      let updated=0;const transfers=[];
      teams.forEach(t=>(t.players||[]).forEach(p=>{
        const n=by.get(String(p.sourceId||''));if(!n)return;
        let changed=false,invalidate=false;
        if(n.club&&n.club!==p.club){transfers.push({name:p.name,from:p.club,to:n.club});p.club=n.club;changed=true;invalidate=true}
        if(n.role&&n.role!==p.role){p.role=n.role;changed=true;invalidate=true}
        if(n.image&&n.image!==p.image){p.image=n.image;changed=true}
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

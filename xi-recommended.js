(function(){
  const MODULES=[
    {name:'3-4-3',DIF:3,CEN:4,ATT:3},
    {name:'3-5-2',DIF:3,CEN:5,ATT:2},
    {name:'4-3-3',DIF:4,CEN:3,ATT:3},
    {name:'4-4-2',DIF:4,CEN:4,ATT:2},
    {name:'4-5-1',DIF:4,CEN:5,ATT:1},
    {name:'5-3-2',DIF:5,CEN:3,ATT:2},
    {name:'5-4-1',DIF:5,CEN:4,ATT:1}
  ];

  const safe=s=>typeof esc==='function'?esc(s):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pct=p=>Number.isFinite(Number(p))?Math.round(Number(p)):null;

  function imageUrl(p){
    return p.image||p.playerImage||(p.sourceId?`https://content.fantacalcio.it/web/campioncini/21/medium/${encodeURIComponent(p.sourceId)}.png?v=640`:'');
  }

  function lastName(name){
    const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
    return parts.length>1?parts[parts.length-1]:parts[0]||'?';
  }

  function currentPlayers(){
    try{return cur()?.players||[]}catch{return[]}
  }

  function analysisFor(p){
    try{return analyses?.[p.id]||null}catch{return null}
  }

  function scoredPlayers(){
    return currentPlayers().map(p=>{
      const a=analysisFor(p),prob=pct(a?.probability);
      return {...p,analysis:a,prob};
    }).filter(p=>p.prob!==null);
  }

  function byRole(players,role){
    return players.filter(p=>String(p.role||'').toUpperCase()===role)
      .sort((a,b)=>b.prob-a.prob||String(a.name||'').localeCompare(String(b.name||''),'it'));
  }

  function buildCandidate(players,module){
    const por=byRole(players,'POR').slice(0,1),dif=byRole(players,'DIF').slice(0,module.DIF),cen=byRole(players,'CEN').slice(0,module.CEN),att=byRole(players,'ATT').slice(0,module.ATT);
    if(por.length<1||dif.length<module.DIF||cen.length<module.CEN||att.length<module.ATT)return null;
    const eleven=[...por,...dif,...cen,...att];
    const avg=eleven.reduce((s,p)=>s+p.prob,0)/11;
    const floor=Math.min(...eleven.map(p=>p.prob));
    return {module,por,dif,cen,att,eleven,avg,floor};
  }

  function bestXI(players){
    return MODULES.map(m=>buildCandidate(players,m)).filter(Boolean)
      .sort((a,b)=>b.avg-a.avg||b.floor-a.floor)[0]||null;
  }

  function playerNode(p){
    const u=imageUrl(p),status=p.analysis?.status||'';
    return `<div class="xi-player" title="${safe(p.name)} · ${p.prob}%">
      <div class="xi-face">${u?`<img src="${safe(u)}" alt="${safe(p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}<span>${safe((p.name||'?')[0])}</span><b>${p.prob}%</b></div>
      <div class="xi-name">${safe(lastName(p.name))}</div>
      <small>${safe(status)}</small>
    </div>`;
  }

  function row(role,players){
    return `<div class="xi-line xi-${role.toLowerCase()}">${players.map(playerNode).join('')}</div>`;
  }

  function renderXI(){
    const root=document.getElementById('xiRecommended');
    if(!root)return;
    const all=currentPlayers(),scored=scoredPlayers(),best=bestXI(scored);
    if(!all.length){
      root.innerHTML='<div class="xi-empty"><h3>Rosa vuota</h3><p>Aggiungi i giocatori alla tua fantasquadra per creare l’XI consigliato.</p></div>';
      return;
    }
    if(!best){
      const counts=['POR','DIF','CEN','ATT'].map(r=>`${r} ${byRole(scored,r).length}`).join(' · ');
      root.innerHTML=`<div class="xi-empty"><h3>XI non ancora disponibile</h3><p>Servono almeno 11 giocatori analizzati e un modulo valido. Premi <b>Aggiorna la mia Rosa</b> dopo aver completato la rosa.</p><small>${safe(counts)}</small></div>`;
      return;
    }
    const avg=Math.round(best.avg);
    root.innerHTML=`<div class="xi-summary"><div><span>Modulo consigliato</span><b>${best.module.name}</b></div><div><span>Affidabilità XI</span><b>${avg}%</b></div></div>
      <div class="xi-pitch" aria-label="XI consigliato ${best.module.name}">
        <div class="xi-center-circle"></div>
        ${row('att',best.att)}
        ${row('cen',best.cen)}
        ${row('dif',best.dif)}
        ${row('por',best.por)}
      </div>
      <div class="xi-footnote">Formazione scelta automaticamente confrontando i moduli validi e massimizzando la probabilità media di titolarità.</div>`;
  }

  document.querySelectorAll('[data-t="lineup"]').forEach(b=>b.addEventListener('click',()=>setTimeout(renderXI,0)));
  document.getElementById('teamSelect')?.addEventListener('change',()=>setTimeout(renderXI,0));
  document.getElementById('analyze')?.addEventListener('click',()=>setTimeout(renderXI,1200));
  const players=document.getElementById('players');
  if(players)new MutationObserver(()=>{if(!document.getElementById('lineup')?.classList.contains('hidden'))renderXI()}).observe(players,{childList:true});
  window.feRenderRecommendedXI=renderXI;
})();

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
  const CATALOG_URLS=[
    'https://raw.githubusercontent.com/bqit/fantaleghe-api-json/refs/heads/main/players.json',
    'https://cdn.jsdelivr.net/gh/bqit/fantaleghe-api-json@main/players.json'
  ];
  const ROLE_MAP={P:'POR',D:'DIF',C:'CEN',A:'ATT'};
  const safe=s=>typeof esc==='function'?esc(s):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pct=p=>Number.isFinite(Number(p))?Math.round(Number(p)):null;
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  let qualityPromise=null,renderSeq=0;

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
  function percentile(values,value){
    if(!Number.isFinite(value)||!values.length)return 50;
    let lo=0,hi=values.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(values[mid]<=value)lo=mid+1;else hi=mid}
    return Math.max(5,Math.min(100,Math.round((lo/values.length)*100)));
  }
  async function loadQuality(){
    if(qualityPromise)return qualityPromise;
    qualityPromise=(async()=>{
      let rows=[];
      for(const url of CATALOG_URLS){
        try{
          const r=await fetch(url,{cache:'no-store'});
          const j=await r.json();
          if(Array.isArray(j)&&j.length>300){rows=j;break}
        }catch{}
      }
      if(!rows.length)return{byId:new Map(),byKey:new Map(),available:false};
      const byRole={POR:[],DIF:[],CEN:[],ATT:[]};
      for(const x of rows){
        const role=ROLE_MAP[x.position]||'',fvm=Number(x.fvm);
        if(role&&Number.isFinite(fvm)&&fvm>0)byRole[role].push(fvm);
      }
      Object.values(byRole).forEach(a=>a.sort((a,b)=>a-b));
      const byId=new Map(),byKey=new Map();
      for(const x of rows){
        const role=ROLE_MAP[x.position]||'',fvm=Number(x.fvm),quote=Number(x.qt_att);
        if(!role)continue;
        const quality=percentile(byRole[role],fvm);
        const v={quality,fvm:Number.isFinite(fvm)?fvm:null,quote:Number.isFinite(quote)?quote:null};
        byId.set(String(x.id),v);
        byKey.set(`${norm(x.name)}|${norm(x.team)}|${role}`,v);
      }
      return{byId,byKey,available:true};
    })().catch(()=>({byId:new Map(),byKey:new Map(),available:false}));
    return qualityPromise;
  }
  function qualityFor(p,q){
    const role=String(p.role||'').toUpperCase();
    return q.byId.get(String(p.sourceId||''))||q.byKey.get(`${norm(p.name)}|${norm(p.club)}|${role}`)||{quality:50,fvm:null,quote:null};
  }
  function recommendationScore(prob,quality){
    const q=Math.max(0,Math.min(100,Number(quality)||50));
    return prob*(0.70+0.30*(q/100));
  }
  function scoredPlayers(quality){
    return currentPlayers().map(p=>{
      const a=analysisFor(p),prob=pct(a?.probability),q=qualityFor(p,quality),qualityIndex=q.quality;
      return {...p,analysis:a,prob,qualityIndex,fvm:q.fvm,quote:q.quote,xiScore:prob===null?null:recommendationScore(prob,qualityIndex)};
    }).filter(p=>p.prob!==null);
  }
  function byRole(players,role){
    return players.filter(p=>String(p.role||'').toUpperCase()===role)
      .sort((a,b)=>b.xiScore-a.xiScore||b.prob-a.prob||b.qualityIndex-a.qualityIndex||String(a.name||'').localeCompare(String(b.name||''),'it'));
  }
  function buildCandidate(players,module){
    const por=byRole(players,'POR').slice(0,1),dif=byRole(players,'DIF').slice(0,module.DIF),cen=byRole(players,'CEN').slice(0,module.CEN),att=byRole(players,'ATT').slice(0,module.ATT);
    if(por.length<1||dif.length<module.DIF||cen.length<module.CEN||att.length<module.ATT)return null;
    const eleven=[...por,...dif,...cen,...att];
    const avgScore=eleven.reduce((s,p)=>s+p.xiScore,0)/11;
    const avgProb=eleven.reduce((s,p)=>s+p.prob,0)/11;
    const avgQuality=eleven.reduce((s,p)=>s+p.qualityIndex,0)/11;
    const floor=Math.min(...eleven.map(p=>p.prob));
    return {module,por,dif,cen,att,eleven,avgScore,avgProb,avgQuality,floor};
  }
  function bestXI(players){
    return MODULES.map(m=>buildCandidate(players,m)).filter(Boolean)
      .sort((a,b)=>b.avgScore-a.avgScore||b.avgProb-a.avgProb||b.floor-a.floor)[0]||null;
  }
  function playerNode(p){
    const u=imageUrl(p),status=p.analysis?.status||'';
    return `<div class="xi-player" title="${safe(p.name)} · Titolarità ${p.prob}% · Qualità ${p.qualityIndex}/100">
      <div class="xi-face">${u?`<img src="${safe(u)}" alt="${safe(p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}<span>${safe((p.name||'?')[0])}</span><b>${p.prob}%</b></div>
      <div class="xi-name">${safe(lastName(p.name))}</div>
      <small>${safe(status)}</small>
    </div>`;
  }
  function row(role,players){
    return `<div class="xi-line xi-${role.toLowerCase()}">${players.map(playerNode).join('')}</div>`;
  }
  async function renderXI(){
    const root=document.getElementById('xiRecommended');
    if(!root)return;
    const seq=++renderSeq,all=currentPlayers();
    if(!all.length){
      root.innerHTML='<div class="xi-empty"><h3>Rosa vuota</h3><p>Aggiungi i giocatori alla tua fantasquadra per creare l’XI consigliato.</p></div>';
      return;
    }
    root.innerHTML='<div class="xi-empty"><h3>Calcolo XI consigliato…</h3><p>Confronto titolarità e valore Fantacalcio.</p></div>';
    const quality=await loadQuality();
    if(seq!==renderSeq)return;
    const scored=scoredPlayers(quality),best=bestXI(scored);
    if(!best){
      const counts=['POR','DIF','CEN','ATT'].map(r=>`${r} ${byRole(scored,r).length}`).join(' · ');
      root.innerHTML=`<div class="xi-empty"><h3>XI non ancora disponibile</h3><p>Servono almeno 11 giocatori analizzati e un modulo valido. Premi <b>Aggiorna la mia Rosa</b> dopo aver completato la rosa.</p><small>${safe(counts)}</small></div>`;
      return;
    }
    const avgProb=Math.round(best.avgProb),avgQuality=Math.round(best.avgQuality);
    root.innerHTML=`<div class="xi-summary"><div><span>Modulo consigliato</span><b>${best.module.name}</b></div><div><span>Affidabilità XI</span><b>${avgProb}%</b></div></div>
      <div class="xi-pitch" aria-label="XI consigliato ${best.module.name}">
        <div class="xi-center-circle"></div>
        ${row('att',best.att)}
        ${row('cen',best.cen)}
        ${row('dif',best.dif)}
        ${row('por',best.por)}
      </div>
      <div class="xi-footnote">Scelta basata su <b>titolarità + qualità fantacalcistica</b>. Qualità XI ${avgQuality}/100, calcolata dal valore FVM e normalizzata per ruolo${quality.available?'':' (catalogo qualità temporaneamente non disponibile: usata stima neutra)'}.</div>`;
  }
  document.querySelectorAll('[data-t="lineup"]').forEach(b=>b.addEventListener('click',()=>setTimeout(renderXI,0)));
  document.getElementById('teamSelect')?.addEventListener('change',()=>setTimeout(renderXI,0));
  document.getElementById('analyze')?.addEventListener('click',()=>setTimeout(renderXI,1200));
  const players=document.getElementById('players');
  if(players)new MutationObserver(()=>{if(!document.getElementById('lineup')?.classList.contains('hidden'))renderXI()}).observe(players,{childList:true});
  window.feRenderRecommendedXI=renderXI;
})();

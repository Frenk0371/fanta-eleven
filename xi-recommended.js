(function(){
  const MODULES=[
    {name:'5-4-1',DIF:5,CEN:4,ATT:1},
    {name:'4-5-1',DIF:4,CEN:5,ATT:1},
    {name:'5-3-2',DIF:5,CEN:3,ATT:2},
    {name:'4-4-2',DIF:4,CEN:4,ATT:2},
    {name:'3-5-2',DIF:3,CEN:5,ATT:2},
    {name:'4-3-3',DIF:4,CEN:3,ATT:3},
    {name:'3-4-3',DIF:3,CEN:4,ATT:3}
  ];
  const CATALOG_URLS=[
    'https://raw.githubusercontent.com/bqit/fantaleghe-api-json/refs/heads/main/players.json',
    'https://cdn.jsdelivr.net/gh/bqit/fantaleghe-api-json@main/players.json'
  ];
  const ROLE_MAP={P:'POR',D:'DIF',C:'CEN',A:'ATT'};
  const FORMATION_SOURCES=[
    {label:'Fantacalcio',short:'FC',aliases:['fantacalcio.it','fantacalcio']},
    {label:'Sky Sport',short:'SKY',aliases:['sport.sky.it','sky sport']},
    {label:'SOS Fanta',short:'SOS',aliases:['sosfanta.com','sos fanta']},
    {label:'Sport Mediaset',short:'SM',aliases:['sportmediaset.mediaset.it','sport mediaset']},
    {label:'DAZN',short:'DAZN',aliases:['dazn.com','dazn']},
    {label:'Goal',short:'GOAL',aliases:['goal.com','goal']},
    {label:'Gazzetta',short:'GAZ',aliases:['gazzetta.it','gazzetta']}
  ];
  const safe=s=>typeof esc==='function'?esc(s):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pct=p=>Number.isFinite(Number(p))?Math.round(Number(p)):null;
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  let qualityPromise=null,renderSeq=0,selectedModuleName=null,sourceExpanded=false;
  let compareAId=null,compareBId=null,countdownTimer=null;

  function imageUrl(p){
    return p.sourceId?`https://content.fantacalcio.it/web/campioncini/21/medium/${encodeURIComponent(p.sourceId)}.png?v=20260902a`:(p.image||p.playerImage||'');
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
  function candidates(players){
    return MODULES.map(m=>buildCandidate(players,m)).filter(Boolean);
  }
  function bestXI(list){
    return [...list].sort((a,b)=>b.avgScore-a.avgScore||b.avgProb-a.avgProb||b.floor-a.floor)[0]||null;
  }
  function playerNode(p){
    const u=imageUrl(p),status=p.analysis?.status||'';
    return `<div class="xi-player" title="${safe(p.name)} · Titolarità ${p.prob}% · Qualità ${p.qualityIndex}/100">
      <div class="xi-face">${u?`<img src="${safe(u)}" alt="${safe(p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}<span>${safe((p.name||'?')[0])}</span></div>
      <div class="xi-label"><span class="xi-name">${safe(lastName(p.name))}</span><b class="xi-pct">${p.prob}%</b></div>
      <div class="xi-probbar"><i style="width:${Math.max(2,Math.min(100,p.prob))}%"></i></div>
      <small>${safe(status)}</small>
    </div>`;
  }
  function row(role,players){
    return `<div class="xi-line xi-${role.toLowerCase()} xi-count-${players.length}">${players.map(playerNode).join('')}</div>`;
  }
  function modulePicker(valid,auto,selected){
    const validNames=new Set(valid.map(x=>x.module.name));
    return `<div class="xi-module-head"><div><span>Scegli il modulo</span><b>Consigliato: ${auto.module.name}</b></div><small>Puoi confrontare gli XI</small></div>
      <div class="xi-modules">${MODULES.map(m=>{
        const enabled=validNames.has(m.name),isSelected=m.name===selected.module.name,isAuto=m.name===auto.module.name;
        return `<button type="button" data-xi-module="${m.name}" class="${isSelected?'selected ':''}${isAuto?'recommended ':''}" ${enabled?'':'disabled'}><span>${m.name}</span>${isAuto?'<small>consigliato</small>':''}</button>`;
      }).join('')}</div>`;
  }
  function sourceEvidence(analysis,source){
    const evidence=Array.isArray(analysis?.evidence)?analysis.evidence:[];
    return evidence.filter(e=>{
      if(e?.kind==='history')return false;
      const hay=norm(`${e?.source||''} ${e?.url||''}`);
      return source.aliases.some(a=>hay.includes(norm(a)));
    }).sort((a,b)=>(b.used?1:0)-(a.used?1:0)||(b.matchAligned?1:0)-(a.matchAligned?1:0)||Number(b.weight||0)-Number(a.weight||0))[0]||null;
  }
  function sourceVerdict(e){
    if(!e)return{label:'N/D',cls:'na'};
    if(!e.used)return{label:'Non allineata',cls:'stale'};
    const p=Number(e.probability);
    if(!Number.isFinite(p))return{label:'Segnalata',cls:'stale'};
    if(p>=72)return{label:'Titolare',cls:'yes'};
    if(p>=42)return{label:'Ballottaggio',cls:'maybe'};
    if(p<=8)return{label:'Out',cls:'no'};
    return{label:'Panchina',cls:'no'};
  }
  function sourceChip(source,e){
    const verdict=sourceVerdict(e),title=e?`${source.label}: ${verdict.label}${e.reason?` · ${e.reason}`:''}`:`${source.label}: dato non disponibile o non riferito alla prossima gara`;
    const body=`<b>${source.short}</b><span>${verdict.label}</span>`;
    return e?.url?`<a class="source-chip ${verdict.cls}" href="${safe(e.url)}" target="_blank" rel="noopener" title="${safe(title)}">${body}</a>`:`<div class="source-chip ${verdict.cls}" title="${safe(title)}">${body}</div>`;
  }
  function sourceNeedsAttention(player,evidence){
    const used=evidence.filter(e=>e?.used&&Number.isFinite(Number(e.probability)));
    const verdicts=new Set(used.map(e=>sourceVerdict(e).cls));
    return Number(player.prob||0)<72||used.length<2||verdicts.size>1||used.some(e=>Number(e.probability)<72);
  }
  function sourceComparison(players){
    const prepared=[...players].sort((a,b)=>String(a.role||'').localeCompare(String(b.role||''))||Number(b.prob||0)-Number(a.prob||0)).map(p=>{
      const evidence=FORMATION_SOURCES.map(s=>sourceEvidence(p.analysis,s));
      const used=evidence.filter(e=>e?.used).length;
      return {attention:sourceNeedsAttention(p,evidence),html:`<article class="source-player">
        <div class="source-player-head"><div><b>${safe(p.name)}</b><span>${safe(p.role)} · ${safe(p.club)}</span></div><div><strong>${p.prob}%</strong><small>${used}/${FORMATION_SOURCES.length} fonti</small></div></div>
        <div class="source-grid">${FORMATION_SOURCES.map((s,i)=>sourceChip(s,evidence[i])).join('')}</div>
      </article>`};
    });
    const attention=prepared.filter(x=>x.attention),regular=prepared.filter(x=>!x.attention);
    const rows=`${attention.length?attention.map(x=>x.html).join(''):'<div class="source-clear"><b>Nessun dubbio rilevante</b><span>Le fonti disponibili concordano sui giocatori analizzati.</span></div>'}<div class="source-all${sourceExpanded?' open':''}">${regular.map(x=>x.html).join('')}</div>`;
    const toggle=regular.length?`<button type="button" class="source-toggle" data-source-toggle aria-expanded="${sourceExpanded}">${sourceExpanded?'Mostra solo i dubbi':`Mostra tutta la rosa (${prepared.length})`}</button>`:'';
    const updated=players.map(p=>Date.parse(p.analysis?.updatedAt||'')).filter(Number.isFinite).sort((a,b)=>b-a)[0];
    const when=updated?new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(updated)):'—';
    return `<section class="source-compare"><div class="source-title"><div><span>Probabili della tua rosa</span><h3>Confronto fonti</h3></div><small>Aggiornato ${safe(when)}</small></div><p class="source-note">In evidenza solo dubbi, discordanze e copertura insufficiente. <b>N/D</b> significa dato non disponibile; “non allineata” indica un contenuto non riferito alla prossima gara.</p><div class="source-list">${rows}</div>${toggle}</section>`;
  }
  function previousAnalyses(){
    try{return JSON.parse(localStorage.getItem('fe-analysis-previous-v1')||'{}')||{}}catch{return{}}
  }
  function usedFormationEvidence(p){
    return (Array.isArray(p.analysis?.evidence)?p.analysis.evidence:[]).filter(e=>e?.used&&e?.kind==='formazione');
  }
  function probabilityChanges(players){
    const previous=previousAnalyses();
    return players.map(p=>{
      const before=Number(previous[p.id]?.probability),after=Number(p.prob);
      return Number.isFinite(before)&&Number.isFinite(after)?{...p,before,after,delta:after-before}:null;
    }).filter(x=>x&&Math.abs(x.delta)>=6).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
  }
  function firstKickoff(players){
    const now=Date.now();
    const dates=players.map(p=>Date.parse(p.analysis?.nextMatch?.date||'')).filter(Number.isFinite).sort((a,b)=>a-b);
    return dates.find(x=>x>now-6*36e5)||null;
  }
  function countdownText(timestamp){
    if(!timestamp)return 'Da definire';
    const minutes=Math.floor((timestamp-Date.now())/6e4);
    if(minutes<=0)return 'Giornata iniziata';
    const days=Math.floor(minutes/1440),hours=Math.floor((minutes%1440)/60),mins=minutes%60;
    if(days)return `${days}g ${hours}h`;
    if(hours)return `${hours}h ${mins}m`;
    return `${mins} min`;
  }
  function matchdayDashboard(players){
    const changes=probabilityChanges(players);
    const unavailable=players.filter(p=>p.prob<=8||/indisponibile/i.test(p.analysis?.status||''));
    const doubts=players.filter(p=>p.prob>8&&p.prob<66);
    const activeSources=new Set(players.flatMap(p=>usedFormationEvidence(p).map(e=>String(e.source||''))));
    const kickoff=firstKickoff(players);
    const alerts=[];
    changes.slice(0,2).forEach(p=>alerts.push(`<li class="${p.delta<0?'danger':'positive'}"><b>${safe(p.name)}</b><span>${p.delta>0?'\u2191':'\u2193'} ${p.before}% \u2192 ${p.after}% dall'ultimo aggiornamento</span></li>`));
    unavailable.slice(0,2).forEach(p=>alerts.push(`<li class="danger"><b>${safe(p.name)}</b><span>${safe(p.analysis?.status||'Indisponibile')} · ${p.prob}%</span></li>`));
    doubts.filter(p=>!unavailable.some(x=>x.id===p.id)).slice(0,2).forEach(p=>alerts.push(`<li><b>${safe(p.name)}</b><span>${safe(p.analysis?.status||'Da valutare')} · ${p.prob}%</span></li>`));
    const alertCount=new Set([...unavailable,...doubts].map(p=>p.id)).size;
    const kickoffLabel=kickoff?new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(kickoff)):'—';
    return `<section class="matchday-card">
      <div class="matchday-title"><div><span>Centro decisioni</span><h3>La tua giornata</h3></div><small>Prima gara ${safe(kickoffLabel)}</small></div>
      <div class="matchday-stats">
        <div><span>Consegna stimata</span><b data-xi-countdown="${kickoff||''}">${safe(countdownText(kickoff))}</b></div>
        <div><span>Alert rosa</span><b class="${alertCount?'warn':''}">${alertCount}</b></div>
        <div><span>Variazioni</span><b>${changes.length}</b></div>
        <div><span>Fonti attive</span><b>${activeSources.size}/${FORMATION_SOURCES.length}</b></div>
      </div>
      <ul class="matchday-alerts">${alerts.length?alerts.slice(0,4).join(''):'<li class="positive"><b>Nessun allarme rilevante</b><span>Non risultano cali importanti o indisponibilità.</span></li>'}</ul>
    </section>`;
  }
  function ensureComparison(players){
    const valid=new Set(players.map(p=>String(p.id)));
    if(!valid.has(String(compareAId))||!valid.has(String(compareBId))||compareAId===compareBId){
      const pool=players.filter(p=>p.role!=='POR').sort((a,b)=>b.xiScore-a.xiScore);
      let pair=null;
      for(let i=0;i<pool.length&&!pair;i++)for(let j=i+1;j<pool.length;j++)if(pool[i].role===pool[j].role){pair=[pool[i],pool[j]];break}
      pair=pair||pool.slice(0,2);
      compareAId=pair[0]?.id||players[0]?.id||null;
      compareBId=pair[1]?.id||players.find(p=>p.id!==compareAId)?.id||null;
    }
  }
  function compareOption(p,selected){
    return `<option value="${safe(p.id)}" ${p.id===selected?'selected':''}>${safe(p.name)} · ${safe(p.role)}</option>`;
  }
  function comparisonPanel(players){
    ensureComparison(players);
    const a=players.find(p=>p.id===compareAId),b=players.find(p=>p.id===compareBId);
    if(!a||!b)return'';
    const total=Math.max(.01,a.xiScore+b.xiScore),shareA=Math.round(a.xiScore/total*100),shareB=100-shareA;
    const winner=a.xiScore>=b.xiScore?a:b,loser=winner===a?b:a;
    const reason=winner.prob!==loser.prob?`${winner.prob}% di titolarità contro ${loser.prob}%`:`qualità fantacalcistica ${winner.qualityIndex}/100`;
    const opponent=p=>p.analysis?.nextMatch?.opponent?`${p.analysis.nextMatch.homeAway==='Casa'?'vs':'@'} ${p.analysis.nextMatch.opponent}`:'Gara da definire';
    return `<section class="decision-card">
      <div class="section-kicker">Decisione rapida</div><h3>Chi schiero?</h3>
      <div class="compare-selects"><label>Giocatore A<select data-compare="a">${players.map(p=>compareOption(p,compareAId)).join('')}</select></label><span>VS</span><label>Giocatore B<select data-compare="b">${players.map(p=>compareOption(p,compareBId)).join('')}</select></label></div>
      <div class="compare-result"><div><strong>${safe(a.name)}</strong><b>${shareA}</b><span>${a.prob}% titolare · ${safe(opponent(a))}</span></div><div><strong>${safe(b.name)}</strong><b>${shareB}</b><span>${b.prob}% titolare · ${safe(opponent(b))}</span></div></div>
      <p><b>Consiglio Fanta Eleven: ${safe(winner.name)}</b> — ${safe(reason)}. Il verdetto combina titolarità e valore fantacalcistico.</p>
    </section>`;
  }
  function benchPanel(players,shown){
    const starters=new Set(shown.eleven.map(p=>p.id));
    const bench=players.filter(p=>!starters.has(p.id)).sort((a,b)=>b.xiScore-a.xiScore||b.prob-a.prob).slice(0,7);
    if(!bench.length)return'';
    return `<section class="bench-card"><div class="section-kicker">Copertura cambi</div><h3>Ordine panchina consigliato</h3><div class="bench-list">${bench.map((p,i)=>`<div><em>${i+1}</em><span><b>${safe(p.name)}</b><small>${safe(p.role)} · qualità ${p.qualityIndex}/100</small></span><strong>${p.prob}%</strong></div>`).join('')}</div><p>Priorità calcolata con probabilità di voto e qualità fantacalcistica; verifica sempre i limiti di ruolo della tua lega.</p></section>`;
  }
  function startCountdown(){
    clearInterval(countdownTimer);
    const update=()=>document.querySelectorAll('[data-xi-countdown]').forEach(el=>{const ts=Number(el.dataset.xiCountdown);el.textContent=countdownText(ts)});
    update();countdownTimer=setInterval(update,30000);
  }
  function pitch(best){
    return `<div class="xi-stadium">
      <div class="xi-ad xi-ad-top"><span>FANTA ELEVEN</span><span>FANTA ELEVEN</span><span>FANTA ELEVEN</span></div>
      <div class="xi-pitch" aria-label="XI ${best.module.name}">
        <div class="xi-box xi-box-top"></div><div class="xi-goal xi-goal-top"></div>
        <div class="xi-center-circle"></div><div class="xi-center-dot"></div>
        <div class="xi-box xi-box-bottom"></div><div class="xi-goal xi-goal-bottom"></div>
        ${row('att',best.att)}
        ${row('cen',best.cen)}
        ${row('dif',best.dif)}
        ${row('por',best.por)}
      </div>
      <div class="xi-ad xi-ad-bottom"><span>FANTA ELEVEN</span><span>FANTA ELEVEN</span><span>FANTA ELEVEN</span></div>
    </div>`;
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
    const scored=scoredPlayers(quality),valid=candidates(scored),auto=bestXI(valid);
    if(!auto){
      const counts=['POR','DIF','CEN','ATT'].map(r=>`${r} ${byRole(scored,r).length}`).join(' · ');
      root.innerHTML=`<div class="xi-empty"><h3>XI non ancora disponibile</h3><p>Servono almeno 11 giocatori analizzati e un modulo valido. Premi <b>Aggiorna la mia Rosa</b> dopo aver completato la rosa.</p><small>${safe(counts)}</small></div>`;
      return;
    }
    let shown=selectedModuleName?valid.find(x=>x.module.name===selectedModuleName):null;
    if(!shown){shown=auto;selectedModuleName=auto.module.name}
    const avgProb=Math.round(shown.avgProb),avgQuality=Math.round(shown.avgQuality),manual=shown.module.name!==auto.module.name;
    root.innerHTML=`${matchdayDashboard(scored)}
      ${comparisonPanel(scored)}
      ${modulePicker(valid,auto,shown)}
      <div class="xi-summary"><div><span>${manual?'Modulo visualizzato':'Modulo consigliato'}</span><b>${shown.module.name}</b></div><div><span>Affidabilità XI</span><b>${avgProb}%</b></div></div>
      ${pitch(shown)}
      <div class="xi-footnote">XI scelto con <b>titolarità + qualità fantacalcistica</b>. Qualità XI ${avgQuality}/100${manual?` · Il sistema consiglia ${auto.module.name}`:''}${quality.available?'':' · qualità temporaneamente neutra'}.</div>
      ${benchPanel(scored,shown)}
      ${sourceComparison(scored)}`;
    startCountdown();
  }
  document.addEventListener('click',e=>{
    const toggle=e.target.closest?.('[data-source-toggle]');
    if(toggle){sourceExpanded=!sourceExpanded;document.querySelector('.source-all')?.classList.toggle('open',sourceExpanded);toggle.textContent=sourceExpanded?'Mostra solo i dubbi':`Mostra tutta la rosa (${document.querySelectorAll('.source-player').length})`;toggle.setAttribute('aria-expanded',String(sourceExpanded));return}
    const b=e.target.closest?.('[data-xi-module]');
    if(!b||b.disabled)return;
    selectedModuleName=b.dataset.xiModule||null;
    renderXI();
  });
  document.addEventListener('change',e=>{
    const select=e.target.closest?.('[data-compare]');
    if(!select)return;
    if(select.dataset.compare==='a')compareAId=select.value;else compareBId=select.value;
    if(compareAId===compareBId){
      const alternative=currentPlayers().find(p=>p.id!==select.value);
      if(select.dataset.compare==='a')compareBId=alternative?.id||compareBId;else compareAId=alternative?.id||compareAId;
    }
    renderXI();
  });
  document.querySelectorAll('[data-t="lineup"]').forEach(b=>b.addEventListener('click',()=>setTimeout(renderXI,0)));
  document.getElementById('teamSelect')?.addEventListener('change',()=>{selectedModuleName=null;setTimeout(renderXI,0)});
  document.getElementById('analyze')?.addEventListener('click',()=>setTimeout(renderXI,1200));
  const players=document.getElementById('players');
  if(players)new MutationObserver(()=>{if(!document.getElementById('lineup')?.classList.contains('hidden'))renderXI()}).observe(players,{childList:true});
  window.feRenderRecommendedXI=renderXI;
})();

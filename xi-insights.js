(function(){
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const num=v=>Number.isFinite(Number(v))?Number(v):null;
  const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const currentPlayers=()=>{try{return cur()?.players||[]}catch{return[]}};
  const analysisFor=p=>{try{return analyses?.[p.id]||null}catch{return null}};
  const previousAnalyses=()=>{try{return JSON.parse(localStorage.getItem('fe-analysis-previous-v1')||'{}')||{}}catch{return{}}};

  function voteProbability(player,analysis){
    const start=num(analysis?.probability);
    if(start===null)return null;
    const status=String(analysis?.status||'').toLowerCase();
    if(start<=8||/indisponibile|out|squalificat|infortun/.test(status))return Math.round(clamp(start+1,2,9));
    const recent=Array.isArray(analysis?.history?.recent?.matches)?analysis.history.recent.matches:[];
    let benchApps=0,benchOpp=0,apps=0;
    for(const m of recent){
      const mins=Math.max(0,Number(m?.minutes)||0);
      const starter=!!m?.starter;
      const notCalled=m?.status==='not_called';
      if(mins>0)apps++;
      if(!starter){benchOpp++;if(!notCalled&&mins>0)benchApps++}
    }
    const defaults={POR:.05,DIF:.30,CEN:.40,ATT:.48};
    let entry=defaults[String(player?.role||'').toUpperCase()]??.38;
    if(benchOpp>=2)entry=benchApps/benchOpp;
    if(recent.length>=2){
      const appearanceRate=apps/recent.length;
      entry=entry*.7+appearanceRate*.3;
    }
    entry=clamp(entry,.03,.78);
    return Math.round(clamp(start+(100-start)*entry,start,98));
  }

  function trendFor(player,analysis){
    const current=num(analysis?.probability),previous=num(previousAnalyses()[player.id]?.probability);
    if(current===null||previous===null)return null;
    return Math.round(current-previous);
  }

  function trendMarkup(delta){
    if(delta===null)return '<span class="fe-trend neutral">Trend dal prossimo aggiornamento</span>';
    if(delta>=2)return `<span class="fe-trend up">↑ +${delta}%</span>`;
    if(delta<=-2)return `<span class="fe-trend down">↓ ${delta}%</span>`;
    return '<span class="fe-trend neutral">→ stabile</span>';
  }

  function decorateRosterCards(){
    const root=document.getElementById('players');
    if(!root)return;
    const players=currentPlayers(),cards=[...root.querySelectorAll(':scope > .card')];
    cards.forEach((card,i)=>{
      const p=players[i],a=p&&analysisFor(p);
      if(!p||!a||!Number.isFinite(Number(a.probability)))return;
      const vote=voteProbability(p,a),delta=trendFor(p,a);
      const sig=`${p.id}|${vote}|${delta}`;
      let row=card.querySelector('.fe-player-insights');
      if(!row){row=document.createElement('div');row.className='fe-player-insights';card.appendChild(row)}
      if(row.dataset.sig===sig)return;
      row.dataset.sig=sig;
      row.innerHTML=`<span class="fe-vote"><small>Prob. voto stimata</small><b>${vote}%</b></span>${trendMarkup(delta)}`;
    });
  }

  function byId(id){return currentPlayers().find(p=>String(p.id)===String(id))||null}

  function decorateComparison(){
    const card=document.querySelector('#xiRecommended .decision-card');
    if(!card)return;
    const a=byId(card.querySelector('[data-compare="a"]')?.value),b=byId(card.querySelector('[data-compare="b"]')?.value);
    const pairs=[a,b],boxes=[...card.querySelectorAll('.compare-result>div')];
    boxes.forEach((box,i)=>{
      const p=pairs[i],a=p&&analysisFor(p);if(!p||!a)return;
      const vote=voteProbability(p,a),delta=trendFor(p,a);
      let meta=box.querySelector('.fe-compare-insights');
      if(!meta){meta=document.createElement('div');meta.className='fe-compare-insights';box.appendChild(meta)}
      const sig=`${vote}|${delta}`;if(meta.dataset.sig===sig)return;meta.dataset.sig=sig;
      meta.innerHTML=`<span>Voto ${vote}%</span>${delta===null?'':delta>=2?`<b class="up">↑ +${delta}</b>`:delta<=-2?`<b class="down">↓ ${delta}</b>`:'<b>→</b>'}`;
    });
  }

  function latestUpdate(players){
    const times=players.map(p=>Date.parse(analysisFor(p)?.updatedAt||'')).filter(Number.isFinite).sort((a,b)=>b-a);
    return times[0]||null;
  }
  function whenText(ts){
    if(!ts)return 'mai';
    const mins=Math.max(0,Math.round((Date.now()-ts)/60000));
    if(mins<2)return 'adesso';
    if(mins<60)return `${mins} min fa`;
    const h=Math.round(mins/60);return h<24?`${h} h fa`:new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ts));
  }

  function livePanelHTML(players){
    const rows=players.map(p=>{const a=analysisFor(p),prob=num(a?.probability);if(prob===null)return null;return{p,a,prob,vote:voteProbability(p,a),delta:trendFor(p,a)}}).filter(Boolean);
    const changes=rows.filter(x=>x.delta!==null&&Math.abs(x.delta)>=3).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
    const unavailable=rows.filter(x=>x.prob<=8||/indisponibile/i.test(x.a?.status||''));
    const riskVote=rows.filter(x=>x.vote!==null&&x.vote<70&&!unavailable.includes(x));
    const events=[];
    changes.slice(0,3).forEach(x=>events.push(`<li class="${x.delta<0?'danger':'positive'}"><b>${safe(x.p.name)}</b><span>${x.delta>0?'↑':'↓'} ${Math.abs(x.delta)} punti · ${Math.round(x.prob-x.delta)}% → ${x.prob}%</span></li>`));
    unavailable.filter(x=>!changes.includes(x)).slice(0,2).forEach(x=>events.push(`<li class="danger"><b>${safe(x.p.name)}</b><span>${safe(x.a?.status||'Indisponibile')} · titolarità ${x.prob}%</span></li>`));
    const body=events.length?events.join(''):`<li class="positive"><b>Nessuna variazione rilevante</b><span>${rows.some(x=>x.delta!==null)?'Le stime sono stabili rispetto all’ultimo controllo.':'Il trend sarà disponibile dal prossimo aggiornamento della rosa.'}</span></li>`;
    return `<section class="fe-live-card">
      <div class="fe-live-head"><div><span>Ultim’ora</span><h3>Controllo finale</h3></div><small>Aggiornato ${whenText(latestUpdate(players))}</small></div>
      <p class="fe-live-lead">Ti mostra solo ciò che può cambiare davvero la formazione prima della consegna.</p>
      <div class="fe-live-stats"><div><span>Variazioni ≥3</span><b>${changes.length}</b></div><div><span>Rischio voto</span><b>${riskVote.length}</b></div></div>
      <ul class="fe-live-events">${body}</ul>
      <button type="button" class="fe-live-refresh" data-fe-refresh>Controlla adesso</button>
    </section>`;
  }

  function decorateLineup(){
    const root=document.getElementById('xiRecommended');
    if(!root||!root.querySelector('.matchday-card'))return;
    const players=currentPlayers();
    let panel=root.querySelector('.fe-live-card');
    const html=livePanelHTML(players);
    if(!panel){
      const holder=document.createElement('div');holder.innerHTML=html;panel=holder.firstElementChild;
      root.querySelector('.matchday-card')?.insertAdjacentElement('afterend',panel);
    }else{
      const holder=document.createElement('div');holder.innerHTML=html;const fresh=holder.firstElementChild;
      if(panel.innerHTML!==fresh.innerHTML)panel.replaceWith(fresh);
    }
    decorateComparison();
  }

  function refreshAll(){decorateRosterCards();decorateLineup()}

  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-fe-refresh]');
    if(!b)return;
    const analyze=document.getElementById('analyze');
    if(!analyze||analyze.disabled)return;
    b.disabled=true;b.textContent='Controllo in corso…';
    analyze.click();
    setTimeout(()=>{if(document.body.contains(b)){b.disabled=false;b.textContent='Controlla adesso'}},6000);
  });
  document.addEventListener('change',e=>{if(e.target.closest?.('[data-compare]'))setTimeout(decorateComparison,30)});
  document.querySelectorAll('[data-t="xi"],[data-t="lineup"]').forEach(b=>b.addEventListener('click',()=>setTimeout(refreshAll,60)));
  document.getElementById('teamSelect')?.addEventListener('change',()=>setTimeout(refreshAll,80));
  const roster=document.getElementById('players');
  if(roster)new MutationObserver(()=>requestAnimationFrame(refreshAll)).observe(roster,{childList:true});
  const lineup=document.getElementById('xiRecommended');
  if(lineup)new MutationObserver(()=>requestAnimationFrame(refreshAll)).observe(lineup,{childList:true,subtree:true});
  setTimeout(refreshAll,80);
})();

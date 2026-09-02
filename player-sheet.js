(function(){
  const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=n=>Number.isFinite(Number(n))?String(n).replace('.',','):'—';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  let backdrop,sheet,activePlayer,requestSeq=0;
  function currentPlayers(){try{return cur()?.players||[]}catch{return[]}}
  function profileUrl(p){return p.profileUrl||(/^\d+$/.test(String(p.sourceId||''))?`https://www.fantacalcio.it/ricerca?q=${encodeURIComponent(p.name)}`:`https://www.fantacalcio.it/ricerca?q=${encodeURIComponent(p.name)}`)}
  function photo(p,url=''){const src=url||(p.sourceId?`https://content.fantacalcio.it/web/campioncini/21/medium/${encodeURIComponent(p.sourceId)}.png?v=20260902`:p.image||'');return `<div class="fe-sheet-photo">${src?`<img src="${safe(src)}" alt="${safe(p.name)}" referrerpolicy="no-referrer" onerror="this.remove()">`:''}<span>${safe((p.name||'?')[0])}</span></div>`}
  function stat(value,label,cls=''){return `<div class="fe-sheet-stat ${cls}"><b>${safe(value)}</b><span>${safe(label)}</span></div>`}
  function ensure(){
    if(sheet)return;
    backdrop=document.createElement('div');backdrop.className='fe-sheet-backdrop';backdrop.hidden=true;
    sheet=document.createElement('section');sheet.className='fe-player-sheet';sheet.hidden=true;sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','Scheda giocatore');
    document.body.append(backdrop,sheet);backdrop.addEventListener('click',close);sheet.addEventListener('click',e=>{if(e.target.closest('[data-sheet-close]'))close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sheet.hidden)close()});
  }
  function shell(p,body){return `<div class="fe-sheet-grip"></div><button class="fe-sheet-close" data-sheet-close aria-label="Chiudi scheda">×</button><div class="fe-sheet-hero">${photo(p)}<div><h2>${safe(p.name)}</h2><p>${safe(p.role)} · ${safe(p.club)}</p></div></div>${body}`}
  function open(p){
    ensure();activePlayer=p;const seq=++requestSeq;
    sheet.innerHTML=shell(p,'<div class="fe-sheet-loading">Aggiornamento dati Fantacalcio.it…</div>');backdrop.hidden=sheet.hidden=false;document.body.classList.add('fe-sheet-open');requestAnimationFrame(()=>{backdrop.classList.add('open');sheet.classList.add('open')});sheet.querySelector('[data-sheet-close]')?.focus();
    if(!/^\d+$/.test(String(p.sourceId||''))){renderFallback(p);return}
    fetch('/api/player?id='+encodeURIComponent(p.sourceId),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Scheda non disponibile');return d.player}).then(data=>{if(seq===requestSeq)renderData(p,data)}).catch(()=>{if(seq===requestSeq)renderFallback(p)});
  }
  function renderData(p,d){
    const delta=Number.isFinite(d.classicCurrent)&&Number.isFinite(d.classicInitial)?d.classicCurrent-d.classicInitial:null;
    const deltaText=delta===null?'':`<span class="fe-sheet-delta" style="color:${delta>0?'var(--green)':delta<0?'var(--red)':'var(--muted)'}">${delta>0?'+':''}${delta} dall’inizio</span>`;
    const analysis=typeof analyses!=='undefined'?analyses[p.id]:null;
    sheet.innerHTML=`<div class="fe-sheet-grip"></div><button class="fe-sheet-close" data-sheet-close aria-label="Chiudi scheda">×</button><div class="fe-sheet-hero">${photo(p,d.image)}<div><h2>${safe(d.name||p.name)}</h2><p>${safe(p.role)} · ${safe(p.club)} · dati aggiornati</p></div></div><div class="fe-sheet-section"><h3>Valore Fantacalcio.it</h3><div class="fe-sheet-grid">${stat(num(d.classicCurrent),'Quotazione Classic','accent').replace('</div>',deltaText+'</div>')}${stat(num(d.classicFvm),'FVM / 1000')}${stat(num(d.mantraCurrent),'Quotazione Mantra')}</div></div><div class="fe-sheet-section"><h3>Rendimento 2026/27</h3><div class="fe-sheet-grid">${stat(num(d.fantamedia),'Fantamedia','accent')}${stat(num(d.mediaVoto),'Media voto')}${stat(num(d.appearances),'Presenze a voto')}${stat(num(d.goals),'Gol')}${stat(num(d.assists),'Assist')}${stat(num(d.yellowCards),'Ammonizioni')}</div></div>${Number.isFinite(analysis?.probability)?`<div class="fe-sheet-section"><h3>Fanta Eleven</h3><div class="fe-sheet-grid">${stat(analysis.probability+'%','Probabilità titolare','accent')}${stat(analysis.status||'—','Stato')}${stat(Number.isFinite(analysis.rangeLow)?analysis.rangeLow+'–'+analysis.rangeHigh+'%':'—','Intervallo stimato')}</div></div>`:''}<div class="fe-sheet-actions"><a class="official" href="${safe(d.profileUrl||profileUrl(p))}" target="_blank" rel="noopener">Apri scheda completa su Fantacalcio.it ↗</a></div><p class="fe-sheet-note">Quotazioni e statistiche provengono da Fantacalcio.it. La probabilità di titolarità è calcolata da Fanta Eleven.</p>`;
  }
  function renderFallback(p){
    const a=typeof analyses!=='undefined'?analyses[p.id]:null;
    sheet.innerHTML=shell(p,`${Number.isFinite(a?.probability)?`<div class="fe-sheet-section"><h3>Fanta Eleven</h3><div class="fe-sheet-grid">${stat(a.probability+'%','Probabilità titolare','accent')}${stat(a.status||'—','Stato')}${stat(Number.isFinite(a.rangeLow)?a.rangeLow+'–'+a.rangeHigh+'%':'—','Intervallo stimato')}</div></div>`:''}<div class="fe-sheet-actions"><a class="official" href="${safe(profileUrl(p))}" target="_blank" rel="noopener">Cerca su Fantacalcio.it ↗</a></div><p class="fe-sheet-note">I valori ufficiali non sono momentaneamente disponibili nell’app. Puoi consultarli direttamente su Fantacalcio.it.</p>`);
  }
  function close(){if(!sheet||sheet.hidden)return;requestSeq++;backdrop.classList.remove('open');sheet.classList.remove('open');document.body.classList.remove('fe-sheet-open');setTimeout(()=>{backdrop.hidden=sheet.hidden=true},290)}
  function findPlayer(trigger){
    const id=trigger.dataset.playerId;if(id){const p=currentPlayers().find(x=>String(x.id)===String(id));if(p)return p}
    const name=trigger.dataset.playerName||trigger.getAttribute('title')?.split('·')[0]||trigger.querySelector('.name,.xi-name')?.textContent||'';
    const local=currentPlayers().find(p=>norm(p.name)===norm(name)||norm(p.name).endsWith(' '+norm(name)));if(local)return local;
    const sourceId=trigger.dataset.playerSourceId;if(!sourceId)return null;
    return{id:'global-'+sourceId,sourceId,name:trigger.dataset.playerName||name,club:trigger.dataset.playerClub||'',role:trigger.dataset.playerRole||'',image:trigger.dataset.playerImage||'',profileUrl:trigger.dataset.playerProfileUrl||''};
  }
  document.addEventListener('click',e=>{if(e.target.closest('a,button,.del'))return;const trigger=e.target.closest('[data-player-id],[data-player-source-id],.xi-player');if(!trigger)return;const p=findPlayer(trigger);if(p)open(p)});
  document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-player-id],[data-player-source-id],.xi-player')){e.preventDefault();const p=findPlayer(e.target);if(p)open(p)}});
  const mark=()=>{document.querySelectorAll('#players>.card').forEach((node,i)=>{const p=currentPlayers()[i];if(!p)return;node.dataset.playerId=p.id;node.classList.add('fe-player-trigger');node.tabIndex=0;node.setAttribute('role','button');node.setAttribute('aria-label',`Apri scheda di ${p.name}`)});document.querySelectorAll('.xi-player').forEach(node=>{node.classList.add('fe-player-trigger');node.tabIndex=0;node.setAttribute('role','button')})};
  new MutationObserver(mark).observe(document.body,{childList:true,subtree:true});mark();
  window.feOpenPlayerSheet=open;
})();

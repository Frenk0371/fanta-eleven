(function(){
  const PARTICLES=new Set(['de','del','della','dello','dei','degli','di','da','dal','dalla','van','von','der','den','la','le']);

  function loadInsights(){
    if(!document.querySelector('link[data-fe-insights]')){
      const link=document.createElement('link');link.rel='stylesheet';link.href='/xi-insights.css?v=1';link.dataset.feInsights='1';document.head.appendChild(link);
    }
    if(!document.querySelector('script[data-fe-insights]')){
      const script=document.createElement('script');script.src='/xi-insights.js?v=1';script.defer=true;script.dataset.feInsights='1';document.body.appendChild(script);
    }
  }

  function displaySurname(fullName){
    const parts=String(fullName||'').trim().split(/\s+/).filter(Boolean);
    if(parts.length<=1)return parts[0]||'?';
    let i=parts.length-1;
    while(i>0&&PARTICLES.has(parts[i-1].toLowerCase()))i--;
    return parts.slice(i).join(' ');
  }

  function polishComparison(root){
    const card=root?.querySelector?.('.decision-card');
    if(!card)return;
    const result=card.querySelector('.compare-result');
    if(result&&!card.querySelector('.compare-index-note')){
      const note=document.createElement('div');
      note.className='compare-index-note';
      note.innerHTML='<b>Indice scelta Fanta Eleven</b><span>Confronto relativo tra i due giocatori, non probabilità di titolarità.</span>';
      card.insertBefore(note,result);
    }
    result?.querySelectorAll(':scope > div > b').forEach(score=>{
      const raw=String(score.textContent||'').trim().replace(/%/g,'');
      if(/^\d+$/.test(raw))score.textContent=raw+'%';
      score.setAttribute('title','Indice scelta Fanta Eleven');
    });
  }

  function apply(){
    const root=document.getElementById('xiRecommended');
    if(!root)return;
    root.querySelectorAll('.xi-player').forEach(player=>{
      const title=String(player.getAttribute('title')||'');
      const fullName=title.split(' · ')[0].trim();
      const label=player.querySelector('.xi-name');
      if(!label||!fullName)return;
      const surname=displaySurname(fullName);
      if(label.textContent!==surname)label.textContent=surname;
      label.classList.toggle('xi-name-long',surname.length>=9);
      label.classList.toggle('xi-name-xlong',surname.length>=11);
      label.setAttribute('title',fullName);
    });
    polishComparison(root);
  }

  function renderMethod4(){
    const method=document.getElementById('method');
    if(!method)return;
    method.innerHTML=`<div class="panel method fe-method4">
      <div class="method-kicker">COME DECIDE FANTA ELEVEN</div>
      <h3>Metodo 4.0 Decision Engine</h3>
      <p class="method-lead">La percentuale di titolarità non nasce da una singola fonte. Il motore combina segnali indipendenti e riduce il peso dei dati vecchi, duplicati o non riferiti alla prossima gara.</p>
      <div class="method-grid">
        <article class="method-card"><span>01</span><div><b>Probabili formazioni</b><p>Confronta Fantacalcio.it, Sky Sport, SOS Fanta, Sport Mediaset, DAZN, Goal e Gazzetta. Conta soprattutto il consenso tra fonti realmente allineate alla prossima partita.</p></div></article>
        <article class="method-card"><span>02</span><div><b>Storico e minuti</b><p>Presenze da titolare, minuti recenti e continuità aiutano a calibrare il dato editoriale. Lo storico pesa meno quando le probabili formazioni aggiornate sono forti e concordanti.</p></div></article>
        <article class="method-card"><span>03</span><div><b>Qualità fantacalcistica</b><p>Il valore del giocatore serve per scegliere XI e panchina, non per gonfiare artificialmente la probabilità di partire titolare. A parità di rischio viene favorito chi offre più valore fantacalcistico.</p></div></article>
        <article class="method-card"><span>04</span><div><b>Confidenza della stima</b><p>Freschezza, numero di fonti e concordanza determinano quanto fidarsi della percentuale e dell’intervallo stimato. Un’indisponibilità esplicita prevale sui segnali generici in conflitto.</p></div></article>
      </div>
      <div class="method-scale">
        <b>Come leggere la stima</b>
        <div><span><strong>≥84%</strong>Titolare</span><span><strong>66–83%</strong>Favorito</span><span><strong>42–65%</strong>Ballottaggio</span><span><strong>&lt;42%</strong>Panchina</span></div>
      </div>
      <div class="method-choice"><b>Probabilità voto stimata</b><p>È distinta dalla titolarità: stima la possibilità che il giocatore prenda voto anche entrando dalla panchina. Usa titolarità, ruolo e comportamento nelle gare recenti; per i portieri il contributo da subentrante resta quasi nullo.</p></div>
      <div class="method-choice"><b>Trend e Ultim’ora</b><p>Ogni nuovo aggiornamento viene confrontato con quello precedente. Il Controllo finale evidenzia variazioni rilevanti, indisponibilità e giocatori con rischio voto prima della consegna.</p></div>
      <div class="method-choice"><b>Indice scelta</b><p>Nel confronto “Chi schiero?” il risultato 56%–44% è un <strong>indice relativo di preferenza</strong> tra quei due giocatori. Non sostituisce le rispettive probabilità di titolarità, che restano mostrate separatamente.</p></div>
      <div class="method-sources"><span>Fantacalcio.it</span><span>Sky Sport</span><span>SOS Fanta</span><span>Sport Mediaset</span><span>DAZN</span><span>Goal</span><span>Gazzetta</span><span>Storico + minuti</span></div>
    </div>`;
  }

  renderMethod4();
  loadInsights();
  const root=document.getElementById('xiRecommended');
  if(root)new MutationObserver(()=>requestAnimationFrame(apply)).observe(root,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-t="lineup"],[data-xi-module]'))setTimeout(apply,40);
  });
  setTimeout(apply,0);
})();

const fs=require('fs');
const path=require('path');

module.exports=(req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD') return res.status(405).end();
  try{
    const file=path.join(process.cwd(),'index.html');
    let html=fs.readFileSync(file,'utf8');

    // Home: niente hero/landing, priorità alla rosa.
    html=html.replace(
      /<section class="hero"><h2>[\s\S]*?<button id="analyze" class="btn primary">[\s\S]*?<\/button><\/section>/,
      ''
    );
    html=html.replace(
      '<div class="switch"><b>Fantasquadra</b><select id="teamSelect"></select></div>',
      '<div class="switch roster-switch"><select id="teamSelect" aria-label="Fantasquadra"></select><button id="analyze" class="btn primary roster-analyze">Aggiorna la mia Rosa</button></div>'
    );

    // Linguaggio coerente con la rosa.
    html=html.replace(/Aggiorna il mio XI/g,'Aggiorna la mia Rosa');
    html=html.replace('<button data-t="xi" class="on">Il mio XI</button>','<button data-t="xi" class="on">La mia Rosa</button>');
    html=html.replace('<span>media XI</span>','<span>media Rosa</span>');

    // Fantasquadre: azione secondaria più discreta.
    html=html.replace('<button class="btn secondary">Aggiungi squadra</button>','<button class="btn secondary">+ Nuova squadra</button>');

    // Metodo: da paragrafo tecnico a percorso visuale in tre passaggi.
    html=html.replace(
      /<section id="method" class="hidden panel method">[\s\S]*?<\/section>/,
      `<section id="method" class="hidden panel method"><div class="method-version">Metodo 3.2.5 Stable</div><h3>Come nasce la stima</h3><div class="method-flow"><div class="method-step"><span>1</span><div><b>Storico</b><small>Minuti, titolarità, sostituzioni e ultime gare.</small></div></div><div class="method-step"><span>2</span><div><b>Fonti</b><small>Notizie e indicazioni sulla prossima partita.</small></div></div><div class="method-step"><span>3</span><div><b>Stima</b><small>I segnali più recenti pesano di più nel risultato finale.</small></div></div></div><div class="sources"><span>Fantacalcio.it</span><span>Sky Sport</span><span>SOS Fanta</span><span>Storico + minuti</span></div></section>`
    );

    const polishCss=`
.detail{display:none!important}
.roster-switch{gap:10px;margin:18px 0 12px}
.roster-switch #teamSelect{min-height:62px;font-size:23px;font-weight:920;letter-spacing:-.4px;padding-left:18px;border-color:rgba(133,177,218,.42);background:linear-gradient(160deg,rgba(10,27,43,.98),rgba(6,19,31,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 10px 26px rgba(0,0,0,.12)}
.roster-analyze{width:100%;min-height:54px;margin-top:1px;font-size:16.5px;border-radius:16px}
.tabs{top:calc(env(safe-area-inset-top) + 8px);box-shadow:0 14px 36px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.018)}
.players{gap:10px;margin-top:12px}
.card{padding:15px 16px;border-radius:22px}
.meter{margin-top:13px}
.range{margin-top:7px}
.history{margin-top:12px;padding:12px 13px;border-radius:16px}
.hchips{margin-top:8px;gap:7px}
.hchip{padding:8px 9px}
#teamForm{gap:9px}
#teamForm .btn{justify-self:start;width:auto;min-height:46px;padding:0 17px;border-radius:14px;font-size:15px}
#teamList{margin-top:10px}
#teams .panel{padding:18px}
#teams .panel h3{margin-bottom:16px}
.method{padding:18px}
.method-version{display:inline-flex;align-items:center;min-height:30px;padding:0 10px;border-radius:99px;border:1px solid rgba(133,177,218,.22);background:rgba(8,22,36,.78);color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.15px}
.method h3{margin:13px 0 15px;font-size:27px}
.method-flow{display:grid;gap:10px;margin-bottom:16px}
.method-step{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid rgba(133,177,218,.18);border-radius:16px;background:linear-gradient(155deg,rgba(13,31,48,.82),rgba(7,19,31,.76));box-shadow:inset 0 1px 0 rgba(255,255,255,.015)}
.method-step>span{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;border-radius:12px;background:linear-gradient(145deg,rgba(109,240,179,.2),rgba(150,213,255,.14));border:1px solid rgba(109,240,179,.24);font-weight:950;color:#dff8ec}
.method-step b{display:block;font-size:16px;line-height:1.2}
.method-step small{display:block;margin-top:4px;font-size:13px;line-height:1.35;color:var(--muted)}
.method .sources{gap:7px}
.method .sources span{padding:7px 10px;font-size:12.5px}
.msg.toast-done{position:fixed;z-index:80;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));width:min(calc(100% - 26px),560px);margin:0;transform:translateX(-50%);box-shadow:0 16px 42px rgba(0,0,0,.38);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
/* Fail-safe splash: l'app deve diventare visibile anche se iOS congela l'intro. */
@keyframes feSplashFailsafe{to{opacity:0;visibility:hidden;pointer-events:none}}
@keyframes feAppFailsafe{to{opacity:1;transform:none;pointer-events:auto}}
.fe-splash{animation:feSplashFailsafe .01s 2.75s forwards}
body.splashing .app{animation:feAppFailsafe .01s 2.75s forwards}
@media(max-width:430px){
  .roster-switch{margin-top:16px}
  .roster-switch #teamSelect{font-size:22px;min-height:60px}
  .card{padding:14px 15px}
  .history{padding:11px 12px}
  .tabs{border-radius:18px}
  .method{padding:16px}
}
`;
    html=html.replace('</style>',polishCss+'</style>');

    const uiScript=`<script>(function(){
      const forceOpen=()=>{
        try{
          document.body.classList.remove('splashing');
          const splash=document.getElementById('feSplash');
          if(splash){splash.classList.add('out');setTimeout(()=>splash.remove(),220)}
        }catch(e){}
      };
      // Hard timeout indipendente dall'animazione principale.
      setTimeout(forceOpen,2850);
      // Se iOS ripristina la PWA da uno snapshot congelato, apri subito la home.
      window.addEventListener('pageshow',e=>{if(e.persisted)setTimeout(forceOpen,80)});
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(forceOpen,120)});

      const msg=document.getElementById('msg');
      if(msg){
        let hideTimer=null;
        const tune=()=>{
          const done=(msg.textContent||'').trim().startsWith('Analisi completata:');
          if(done&&!msg.classList.contains('hidden')){
            msg.classList.add('toast-done');
            clearTimeout(hideTimer);
            hideTimer=setTimeout(()=>{msg.classList.add('hidden');msg.classList.remove('toast-done')},2800);
          }else if(!done){
            msg.classList.remove('toast-done');
            clearTimeout(hideTimer);
          }
        };
        new MutationObserver(tune).observe(msg,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
        tune();
      }
    })();</script>`;
    html=html.replace('</body>','<script src="/sync-roster.js?v=1"></script><script src="/search-safe.js?v=1"></script>'+uiScript+'</body>');

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma','no-cache');
    if(req.method==='HEAD') return res.status(200).end();
    return res.status(200).send(html);
  }catch(e){
    return res.status(500).send('Fanta Eleven non disponibile.');
  }
};

(function(){
  // Splash minimale: solo il pallone già presente nell'app.
  const style=document.createElement('style');
  style.textContent=`
    .fe-kicker{display:none!important}
    .fe-splash-ball{
      left:calc(50% - 38px)!important;
      top:calc(50% - 38px)!important;
      opacity:0;
      animation:feSoloBall 1.72s .05s cubic-bezier(.16,.7,.18,1) both!important;
    }
    .fe-impact{left:50%!important;top:50%!important;animation:feImpact .32s 1.54s ease-out both!important}
    .fe-flash{animation:feFlash .22s 1.57s ease-out both!important;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.98),rgba(174,238,221,.55) 13%,rgba(150,213,255,.14) 31%,transparent 54%)!important}
    @keyframes feSoloBall{
      0%{opacity:0;transform:translate3d(0,0,-430px) scale(.3) rotate(0deg)}
      9%{opacity:1}
      34%{opacity:1;transform:translate3d(0,0,-80px) scale(.72) rotate(280deg)}
      58%{opacity:1;transform:translate3d(0,0,270px) scale(1.7) rotate(610deg)}
      78%{opacity:1;transform:translate3d(0,0,560px) scale(3.9) rotate(890deg)}
      94%{opacity:1;transform:translate3d(0,0,820px) scale(7.4) rotate(1110deg)}
      100%{opacity:0;transform:translate3d(0,0,990px) scale(11.2) rotate(1220deg)}
    }
    @media(max-width:430px){.fe-splash-ball{left:calc(50% - 35px)!important;top:calc(50% - 35px)!important}}
  `;
  document.head.appendChild(style);

  // Secondo fail-safe locale: l'intro non può impedire l'accesso alla home.
  setTimeout(()=>{
    document.body.classList.remove('splashing');
    const splash=document.getElementById('feSplash');
    if(splash){splash.classList.add('out');setTimeout(()=>splash.remove(),220)}
  },2300);
})();

(function(){
  const input=document.querySelector('#search'),box=document.querySelector('#suggestions'),note=document.querySelector('#note'),add=document.querySelector('#add'),pickedBox=document.querySelector('#picked');
  if(!input||!box||!note||!add||!pickedBox)return;
  let seq=0,controller=null,wait=null;
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const decode=s=>String(s||'').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10))).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ');
  const safe=s=>typeof esc==='function'?esc(decode(s)):decode(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  async function run(q,my){
    if(controller)controller.abort();
    controller=new AbortController();
    note.textContent='Ricerca giocatori…';
    try{
      const r=await fetch('/api/players?q='+encodeURIComponent(q)+'&_='+Date.now(),{cache:'no-store',signal:controller.signal});
      let d={};try{d=await r.json()}catch{}
      if(my!==seq)return;
      let items=r.ok&&Array.isArray(d.players)?d.players:[];
      const nq=norm(q);
      items=items.map(p=>({...p,name:decode(p.name),club:decode(p.club)})).sort((a,b)=>{
        const an=norm(a.name),bn=norm(b.name);
        const ae=an===nq?1:0,be=bn===nq?1:0;
        if(ae!==be)return be-ae;
        const ap=an.startsWith(nq)?1:0,bp=bn.startsWith(nq)?1:0;
        if(ap!==bp)return bp-ap;
        return an.localeCompare(bn,'it');
      }).slice(0,8);
      if(!items.length){
        box.innerHTML='';box.classList.add('hidden');note.textContent='Nessun giocatore trovato.';return;
      }
      box.innerHTML=items.map((p,i)=>`<button type="button" class="suggestion" data-safe-i="${i}"><b>${safe(p.name)}</b><small>${safe(p.role)} · ${safe(p.club)}</small></button>`).join('');
      box.classList.remove('hidden');
      box.querySelectorAll('[data-safe-i]').forEach(b=>b.onclick=()=>{
        picked=items[+b.dataset.safeI];
        pickedBox.innerHTML=`<div><b>${safe(picked.name)}</b><br><small>${safe(picked.role)} · ${safe(picked.club)}</small></div>`;
        pickedBox.classList.remove('hidden');box.classList.add('hidden');add.disabled=false;note.textContent='Giocatore riconosciuto.';
      });
      note.textContent=`${items.length} risultati trovati.`;
    }catch(e){
      if(e?.name==='AbortError'||my!==seq)return;
      box.innerHTML='';box.classList.add('hidden');note.textContent='Catalogo temporaneamente non disponibile.';
    }
  }

  input.oninput=e=>{
    seq++;const my=seq,q=String(e.target.value||'').trim();
    if(controller)controller.abort();clearTimeout(wait);
    picked=null;pickedBox.classList.add('hidden');add.disabled=true;box.innerHTML='';box.classList.add('hidden');
    if(q.length<2){note.textContent='Scrivi almeno 2 lettere.';return}
    wait=setTimeout(()=>run(q,my),180);
  };
})();

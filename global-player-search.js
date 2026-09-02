(function(){
  const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const root=document.getElementById('feGlobalSearch');
  if(!root)return;
  const toggle=root.querySelector('[data-global-search-toggle]');
  const panel=root.querySelector('[data-global-search-panel]');
  const input=root.querySelector('input');
  const results=root.querySelector('[data-global-search-results]');
  const status=root.querySelector('[data-global-search-status]');
  const close=root.querySelector('[data-global-search-close]');
  let controller=null,timer=null,seq=0,items=[];

  function setOpen(open){
    panel.hidden=!open;
    toggle.setAttribute('aria-expanded',String(open));
    root.classList.toggle('open',open);
    if(open)setTimeout(()=>input.focus(),30);
    else{input.value='';items=[];results.innerHTML='';status.textContent='Scrivi almeno 2 lettere.'}
  }
  function render(list){
    items=list;
    results.innerHTML=list.map((p,i)=>`<button type="button" class="fe-search-result" data-search-result="${i}"><span class="fe-search-avatar">${safe((p.name||'?').charAt(0))}</span><span><b>${safe(p.name)}</b><small>${safe(p.role)} · ${safe(p.club)}</small></span><span class="fe-search-chevron" aria-hidden="true">›</span></button>`).join('');
    status.textContent=list.length?`${list.length} ${list.length===1?'giocatore trovato':'giocatori trovati'}.`:'Nessun giocatore trovato.';
  }
  async function search(q,my){
    if(controller)controller.abort();
    controller=new AbortController();
    status.textContent='Ricerca in corso…';results.innerHTML='';
    try{
      const r=await fetch('/api/players?q='+encodeURIComponent(q)+'&_='+Date.now(),{cache:'no-store',signal:controller.signal});
      const d=await r.json();
      if(my!==seq)return;
      if(!r.ok)throw new Error();
      render(Array.isArray(d.players)?d.players.slice(0,8):[]);
    }catch(e){
      if(e?.name==='AbortError'||my!==seq)return;
      status.textContent='Ricerca temporaneamente non disponibile.';
    }
  }
  toggle.addEventListener('click',()=>setOpen(panel.hidden));
  close.addEventListener('click',()=>setOpen(false));
  input.addEventListener('input',()=>{
    clearTimeout(timer);seq++;const my=seq,q=input.value.trim();
    if(controller)controller.abort();items=[];results.innerHTML='';
    if(q.length<2){status.textContent='Scrivi almeno 2 lettere.';return}
    timer=setTimeout(()=>search(q,my),180);
  });
  results.addEventListener('click',e=>{
    const button=e.target.closest('[data-search-result]');
    if(!button)return;
    const p=items[Number(button.dataset.searchResult)];
    if(!p||typeof window.feOpenPlayerSheet!=='function')return;
    setOpen(false);window.feOpenPlayerSheet({...p,id:'global-'+p.id,sourceId:String(p.id)});
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)setOpen(false)});
})();

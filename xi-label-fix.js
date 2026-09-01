(function(){
  const PARTICLES=new Set(['de','del','della','dello','dei','degli','di','da','dal','dalla','van','von','der','den','la','le']);

  function displaySurname(fullName){
    const parts=String(fullName||'').trim().split(/\s+/).filter(Boolean);
    if(parts.length<=1)return parts[0]||'?';
    let i=parts.length-1;
    while(i>0&&PARTICLES.has(parts[i-1].toLowerCase()))i--;
    return parts.slice(i).join(' ');
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
  }

  const root=document.getElementById('xiRecommended');
  if(root)new MutationObserver(()=>requestAnimationFrame(apply)).observe(root,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-t="lineup"],[data-xi-module]'))setTimeout(apply,40);
  });
  setTimeout(apply,0);
})();
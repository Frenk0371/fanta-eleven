(function(){
  const roleOrder={POR:0,DIF:1,CEN:2,ATT:3};
  let scheduled=false;

  function norm(s){return String(s||'').trim().toLowerCase()}

  function savedRoles(){
    const map=new Map();
    try{
      const teams=JSON.parse(localStorage.getItem('fe-teams-v2')||'[]');
      for(const t of Array.isArray(teams)?teams:[]){
        for(const p of Array.isArray(t.players)?t.players:[]){
          const role=String(p.role||'').toUpperCase();
          if(roleOrder[role]!==undefined) map.set(norm(p.name),role);
        }
      }
    }catch{}
    return map;
  }

  function playerName(node){
    const el=node.querySelector('.name')||node.querySelector('b');
    return (el?.textContent||'').trim();
  }

  function visibleRole(node){
    const meta=node.querySelector('.meta')?.textContent||node.querySelector('small')?.textContent||'';
    const m=String(meta).toUpperCase().match(/(^|\s|·)(POR|DIF|CEN|ATT)(?=\s|·|$)/);
    return m?m[2]:'';
  }

  function rank(node,roles){
    const role=roles.get(norm(playerName(node)))||visibleRole(node);
    return roleOrder[role]??9;
  }

  function sortContainer(container,roles){
    if(!container)return;
    const nodes=[...container.children];
    if(nodes.length<2)return;
    const sorted=[...nodes].sort((a,b)=>rank(a,roles)-rank(b,roles)||playerName(a).localeCompare(playerName(b),'it',{sensitivity:'base'}));
    if(nodes.every((n,i)=>n===sorted[i]))return;
    const frag=document.createDocumentFragment();
    sorted.forEach(n=>frag.appendChild(n));
    container.appendChild(frag);
  }

  function run(){
    scheduled=false;
    const roles=savedRoles();
    sortContainer(document.getElementById('players'),roles);
    sortContainer(document.getElementById('roster'),roles);
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(run);
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('pageshow',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
  schedule();
  setTimeout(schedule,300);
  setTimeout(schedule,900);
})();

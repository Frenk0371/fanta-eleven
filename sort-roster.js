(function(){
  const roleOrder={POR:0,DIF:1,CEN:2,ATT:3};
  let scheduled=false;

  function rank(node){
    const text=(node.textContent||'').toUpperCase();
    const match=text.match(/\b(POR|DIF|CEN|ATT)\b/);
    return match ? roleOrder[match[1]] : 9;
  }

  function playerName(node){
    const el=node.querySelector('.name, b');
    return (el?.textContent||'').trim();
  }

  function sortContainer(container){
    if(!container)return;
    const nodes=[...container.children];
    if(nodes.length<2)return;
    const sorted=[...nodes].sort((a,b)=>rank(a)-rank(b)||playerName(a).localeCompare(playerName(b),'it'));
    const already=nodes.every((node,i)=>node===sorted[i]);
    if(already)return;
    const frag=document.createDocumentFragment();
    sorted.forEach(node=>frag.appendChild(node));
    container.appendChild(frag);
  }

  function run(){
    scheduled=false;
    sortContainer(document.getElementById('players'));
    sortContainer(document.getElementById('roster'));
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(run);
  }

  const obs=new MutationObserver(schedule);
  obs.observe(document.body,{childList:true,subtree:true});
  schedule();
})();

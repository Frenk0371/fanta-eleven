const base=require('./history');
const {clamp,text,lines,slug}=require('./common');

function seasonShrink(games,previous=false){
  if(previous){
    if(games>=25)return .98;
    if(games>=18)return .97;
    if(games>=12)return .95;
    if(games>=8)return .92;
    if(games>=5)return .84;
    if(games>=3)return .72;
    if(games===2)return .56;
    return .34;
  }
  if(games>=8)return .88;
  if(games>=5)return .76;
  if(games>=3)return .64;
  if(games===2)return .48;
  return .28;
}

async function seasonSnapshot(p,season,previous=false){
  const id=String(p?.sourceId||'').trim();
  if(!id||!p?.club||!p?.name)return null;
  const url=`https://www.fantacalcio.it/serie-a/squadre/${slug(p.club)}/${slug(p.name)}/${encodeURIComponent(id)}/${season}`;
  const h=await text(url,7000);
  if(!h)return null;
  const plain=lines(h).join(' ');
  const ms=plain.match(/Titolare\s+(\d+)\s*-\s*(\d{1,3})\s*%/i);
  const me=plain.match(/Entrato\s+(\d+)\s*-\s*(\d{1,3})\s*%/i);
  const mu=plain.match(/Inutilizzato\s+(\d+)\s*-\s*(\d{1,3})\s*%/i);
  if(!ms)return null;
  const starts=+ms[1],published=clamp(+ms[2],0,100),subs=me?+me[1]:0,unused=mu?+mu[1]:0;
  let games=starts+subs+unused;
  if(games<1){
    const mv=plain.match(/Partite a voto\s*\|?\s*(\d+)/i);
    games=mv?+mv[1]:0;
  }
  if(games<1)return null;
  const shrink=seasonShrink(games,previous);
  const probability=Math.round(50+(published-50)*shrink);
  return{
    source:`Fantacalcio.it · ${season}`,
    url,
    probability:clamp(probability,previous?5:10,previous?97:92),
    publishedProbability:published,
    weight:previous ? .54 : .62,
    reason:`${season}: ${starts}/${games} titolarità (${published}% pubblicato)`,
    kind:'history',used:true,games,starts,seasonLabel:season
  };
}

function recentObserved(recent){
  const rows=Array.isArray(recent?.matches)?recent.matches:[];
  if(!rows.length)return Number(recent?.probability)||50;
  const weights=[1,.86,.74,.64,.56];
  let a=0,b=0;
  rows.forEach((m,i)=>{
    const w=weights[i]||.5;
    const start=m?.starter?1:0;
    const minutes=clamp(Number(m?.minutes)||0,0,90)/90;
    const availability=m?.status==='not_called'?0:m?.status==='unused'?.05:1;
    const score=(start*.80+minutes*.20)*availability;
    a+=score*w;b+=w;
  });
  return b?clamp(a/b*100,0,100):50;
}

function priorStrength(games){
  return clamp((Number(games)||1)*.25,4,10);
}
function recentStrength(games){
  const g=Math.max(1,Number(games)||1);
  return Math.min(12,g*2.5);
}
function currentStrength(games){
  const g=Math.max(1,Number(games)||1);
  return Math.min(14,g*2.2);
}
function weighted(parts){
  let a=0,b=0;
  for(const x of parts){if(!x||!Number.isFinite(x.p)||!Number.isFinite(x.w)||x.w<=0)continue;a+=x.p*x.w;b+=x.w}
  return b?Math.round(a/b):null;
}

async function historicalBaseline(p,ctx){
  const [recent,current,previous]=await Promise.all([
    base.recentBaseline(p,ctx),
    seasonSnapshot(p,'2026-27',false),
    seasonSnapshot(p,'2025-26',true)
  ]);

  if(!recent&&!current&&!previous)return null;

  let probability=null,effectiveN=1,reason='',url=current?.url||previous?.url||recent?.url||'';

  if(previous&&recent){
    const priorP=clamp(previous.publishedProbability,3,97);
    const recentP=recentObserved(recent);
    const pw=priorStrength(previous.games),rw=recentStrength(recent.games);
    probability=weighted([{p:priorP,w:pw},{p:recentP,w:rw}]);
    effectiveN=Math.min(20,Math.round(pw+rw));
    reason=`Base 2025/26 ${previous.starts}/${previous.games} (${previous.publishedProbability}% titolare) aggiornata con le ultime ${recent.games} gare 2026/27: ${recent.starts}/${recent.games} titolare, ${recent.avgMinutes}' medi.`;
  }else if(previous&&current){
    const priorP=clamp(previous.publishedProbability,3,97),currentP=clamp(current.publishedProbability,3,97);
    const pw=priorStrength(previous.games),cw=currentStrength(current.games);
    probability=weighted([{p:priorP,w:pw},{p:currentP,w:cw}]);
    effectiveN=Math.min(20,Math.round(pw+cw));
    reason=`Base 2025/26 ${previous.starts}/${previous.games} aggiornata con ${current.starts}/${current.games} titolarità nel 2026/27.`;
  }else if(recent&&current){
    const recentP=recentObserved(recent),currentP=clamp(current.publishedProbability,3,97);
    const rw=recentStrength(recent.games),cw=Math.max(2,currentStrength(current.games)*.45);
    probability=weighted([{p:recentP,w:rw},{p:currentP,w:cw}]);
    effectiveN=Math.min(14,Math.round(rw+cw));
    reason=`Prime gare 2026/27: ${recent.starts}/${recent.games} titolare, ${recent.avgMinutes}' medi; storico precedente non disponibile.`;
  }else{
    const h=recent||current||previous;
    if(h===recent)probability=Math.round(50+(recentObserved(recent)-50)*.68);
    else if(Number.isFinite(h.publishedProbability))probability=Math.round(50+(h.publishedProbability-50)*(h===previous ? .96 : .72));
    else probability=h.probability;
    effectiveN=Math.min(h===previous?14:10,Math.max(1,h.games||1));
    reason=h.reason;
  }

  return{
    source:'Storico calibrato 2025/26 + 2026/27 + minuti',
    url,
    probability:clamp(probability,5,97),
    weight:.72,
    reason,
    kind:'history',used:true,
    games:Math.max(recent?.games||0,current?.games||0,previous?.games||0),
    starts:recent?.starts??current?.starts??previous?.starts??0,
    effectiveN,
    season:current||null,
    previousSeason:previous||null,
    recent:recent||null
  };
}

module.exports={...base,historicalBaseline,seasonSnapshot};

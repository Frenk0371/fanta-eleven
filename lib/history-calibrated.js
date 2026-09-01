const base=require('./history');
const {clamp,text,lines,slug}=require('./common');

function seasonShrink(games,previous=false){
  if(previous){
    if(games>=25)return .96;
    if(games>=18)return .93;
    if(games>=12)return .90;
    if(games>=8)return .86;
    if(games>=5)return .76;
    if(games>=3)return .64;
    if(games===2)return .50;
    return .30;
  }
  if(games>=8)return .86;
  if(games>=5)return .72;
  if(games>=3)return .58;
  if(games===2)return .42;
  return .25;
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
    probability:clamp(probability,previous?6:12,previous?96:88),
    publishedProbability:published,
    weight:previous ? .54 : .62,
    reason:`${season}: ${starts}/${games} titolarità (${published}% pubblicato)`,
    kind:'history',used:true,games,starts,seasonLabel:season
  };
}

function recentWeight(games){
  if(games>=5)return .72;
  if(games===4)return .64;
  if(games===3)return .56;
  if(games===2)return .48;
  return .32;
}

function currentWeight(games){
  if(games>=8)return .72;
  if(games>=5)return .62;
  if(games===4)return .56;
  if(games===3)return .48;
  if(games===2)return .36;
  return .24;
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
    const rw=recentWeight(recent.games||1);
    probability=Math.round(previous.probability*(1-rw)+recent.probability*rw);
    effectiveN=Math.min(18,Math.max(4,Math.round((previous.games||1)*.30)+(recent.games||1)*2));
    reason=`${recent.reason}. Base 2025/26: ${previous.starts}/${previous.games} titolarità (${previous.publishedProbability}% pubblicato), peso progressivamente ridotto con l'aumentare delle gare 2026/27.`;
  }else if(previous&&current){
    const cw=currentWeight(current.games||1);
    probability=Math.round(previous.probability*(1-cw)+current.probability*cw);
    effectiveN=Math.min(16,Math.max(4,Math.round((previous.games||1)*.28)+(current.games||1)*2));
    reason=`Stagione corrente ${current.starts}/${current.games}; base 2025/26 ${previous.starts}/${previous.games}.`;
  }else if(recent&&current){
    if((recent.games||0)>=(current.games||0)){
      probability=recent.probability;
      effectiveN=Math.max(1,recent.games||1);
      reason=recent.reason;
    }else{
      const rw=recentWeight(recent.games||1);
      probability=Math.round(current.probability*(1-rw)+recent.probability*rw);
      effectiveN=Math.min(12,Math.max(current.games||1,recent.games||1)+(recent.games||1)*.2);
      reason=`${recent.reason}. Stagione 2026/27 ${current.starts}/${current.games} come cross-check.`;
    }
  }else{
    const h=recent||current||previous;
    probability=h.probability;
    effectiveN=Math.min(previous&&h===previous?14:10,Math.max(1,h.games||1));
    reason=h.reason;
  }

  return{
    source:'Storico calibrato 2025/26 + 2026/27 + minuti',
    url,
    probability:clamp(probability,8,96),
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

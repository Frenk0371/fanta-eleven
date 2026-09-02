const {clamp}=require('./common');

function prelimRange(prob,h){
  if(!Number.isFinite(prob)||!h)return null;
  const p=clamp(prob,2,98)/100;
  const n=Math.max(1,Number(h.effectiveN||h.games||1));
  const sd=Math.sqrt(Math.max(.0001,p*(1-p))/(n+7));
  const margin=1.2816*sd*100;
  return{low:Math.round(clamp(prob-margin,2,98)),high:Math.round(clamp(prob+margin,2,98)),level:n<3?'Molto ampio':n<6?'Ampio':'Moderato'};
}

function editorialRange(prob,confidence,spread,published,hard){
  if(!Number.isFinite(prob))return null;
  if(hard)return{low:1,high:Math.min(9,Math.max(5,prob+3)),level:'Stretto'};
  let base=confidence==='Alta'?7:confidence==='Media'?12:18;
  base+=Math.min(10,(spread||0)/2);
  if(!published)base+=4;
  const margin=clamp(base,6,28);
  return{low:Math.round(clamp(prob-margin,2,98)),high:Math.round(clamp(prob+margin,2,98)),level:margin<=9?'Stretto':margin<=15?'Moderato':'Ampio'};
}

function newer(a,b){
  const ta=Date.parse(a?.date||''),tb=Date.parse(b?.date||'');
  if(isFinite(ta)&&isFinite(tb)&&Math.abs(ta-tb)>36e5)return ta>tb?a:b;
  if(!!a?.used!==!!b?.used)return a.used?a:b;
  if(!!a?.explicit!==!!b?.explicit)return a.explicit?a:b;
  if(!!a?.matchAligned!==!!b?.matchAligned)return a.matchAligned?a:b;
  return Number(a?.weight||0)>=Number(b?.weight||0)?a:b;
}

function dedupeNews(items){
  const m=new Map();
  for(const x of items||[]){
    if(!x)continue;
    const k=String(x.source||x.url||'').toLowerCase();
    if(!k)continue;
    m.set(k,m.has(k)?newer(m.get(k),x):x);
  }
  return[...m.values()];
}

function suppressConflicts(items,hard){
  if(!hard)return items;
  return(items||[]).map(x=>{
    if(!x?.used||x.explicit)return x;
    return{...x,used:false,exclusionReason:'In conflitto con indisponibilit\u00e0 esplicita corrente',reason:`${x.reason||'Segnale editoriale'} \u00b7 escluso per indisponibilit\u00e0 esplicita`};
  });
}

function weightedMean(items){
  let a=0,b=0;
  for(const x of items||[]){
    const p=Number(x?.probability),w=Math.max(.05,Number(x?.weight)||0);
    if(!Number.isFinite(p))continue;
    a+=p*w;b+=w;
  }
  return b?a/b:null;
}

// One inferred probable formation is weak evidence; agreement across sources
// strengthens it. Counting every inferred mention as a fixed 88% vote caused
// unrelated players to converge to the same percentage.
function inferredConsensus(items){
  if(!items.length)return null;
  const unusual=items.filter(x=>Number(x.probability)!==88);
  if(unusual.length)return weightedMean(items);
  const bySources=new Set(items.map(x=>x.source)).size;
  return[null,66,74,81,87,91,94,96][Math.min(7,bySources)];
}

function editorialEstimate(D,N){
  const published=D.filter(x=>x.origin==='published');
  const inferred=D.filter(x=>x.origin!=='published');
  const parts=[];
  const publishedMean=weightedMean(published);
  const inferredMean=inferredConsensus(inferred);
  const newsMean=weightedMean(N);
  if(Number.isFinite(publishedMean))parts.push({probability:publishedMean,weight:1});
  if(Number.isFinite(inferredMean))parts.push({probability:inferredMean,weight:published.length?.55:1});
  if(Number.isFinite(newsMean))parts.push({probability:newsMean,weight:.34});
  return weightedMean(parts);
}

function blendWithHistory(editorial,history,publishedCount,directSources,newsSources){
  const hp=Number(history?.probability);
  if(!Number.isFinite(editorial))return Number.isFinite(hp)?Math.round(hp):null;
  if(!Number.isFinite(hp))return Math.round(editorial);
  let editorialWeight=.42;
  if(publishedCount>=2)editorialWeight=.78;
  else if(publishedCount===1)editorialWeight=.68;
  else if(directSources>=5)editorialWeight=.60;
  else if(directSources>=3)editorialWeight=.54;
  else if(directSources>=2)editorialWeight=.49;
  else if(!directSources&&newsSources>=2)editorialWeight=.45;
  return Math.round(editorial*editorialWeight+hp*(1-editorialWeight));
}

function build(p,directAll,newsAll,ctx,history){
  const newsUnique=dedupeNews(newsAll);
  const rawD=directAll.filter(x=>x?.used),rawN=newsUnique.filter(x=>x?.used);
  const directExplicit=rawD.filter(x=>x.explicit&&x.probability<=8);
  const newsExplicit=rawN.filter(x=>x.explicit&&x.probability<=8);
  const hard=directExplicit.length>0||new Set(newsExplicit.map(x=>x.source)).size>=2;
  const effectiveDirect=suppressConflicts(directAll,hard);
  const effectiveNews=suppressConflicts(newsUnique,hard);
  const D=effectiveDirect.filter(x=>x?.used),N=effectiveNews.filter(x=>x?.used);
  const ds=new Set(D.map(x=>x.source)).size,ns=new Set(N.map(x=>x.source)).size;
  const historyEnough=!!history&&history.games>=1;
  const editorialEnough=ds>=1||ns>=2||hard;
  const published=D.filter(x=>x.origin==='published').length;
  const inferred=D.length-published;
  let prob=null;
  if(editorialEnough||historyEnough){
    const editorial=editorialEnough?editorialEstimate(D,N):null;
    prob=blendWithHistory(editorial,history,published,ds,ns);
  }
  if(hard)prob=Math.min(prob??4,5);

  const dp=D.map(x=>Number(x.probability)).filter(Number.isFinite);
  const spread=dp.length>1?Math.max(...dp)-Math.min(...dp):0;
  if(prob!=null)prob=clamp(prob,2,98);
  let confidence='Insufficiente',phase='Nessuna stima';
  if(prob!=null){
    if(editorialEnough){
      phase=historyEnough?'Editoriale + storico':'Editoriale';
      if(hard)confidence='Alta';
      else if(published>=2&&spread<=25)confidence='Alta';
      else if(published>=1&&ds>=2&&spread<=28)confidence='Media';
      else if(inferred>=3&&spread<=25)confidence='Media';
      else confidence='Bassa';
      if(spread>=40)confidence='Bassa';
    }else if(historyEnough){phase='Preliminare';confidence='Bassa'}
  }

  const range=prob==null?null:(phase==='Preliminare'?prelimRange(prob,history):editorialRange(prob,confidence,spread,published,hard));
  const status=prob==null?'Dati insufficienti':hard?'Indisponibile':prob>=84?'Titolare':prob>=66?'Favorito':prob>=42?'Ballottaggio':'Panchina';
  let summary;
  if(!ctx?.next)summary='Prossima partita non identificata: nessuna percentuale calcolata.';
  else if(prob==null)summary='Le fonti non sono ancora sufficientemente allineate alla prossima partita e lo storico disponibile non basta.';
  else if(hard)summary=`Indisponibilit\u00e0 esplicita confermata da ${directExplicit.length+new Set(newsExplicit.map(x=>x.source)).size} segnalazioni indipendenti. Le indicazioni editoriali in conflitto sono escluse. Intervallo ${range.low}\u2013${range.high}%.`;
  else if(phase==='Preliminare')summary=`Stima preliminare: ${history.reason}. Intervallo ${range.low}\u2013${range.high}%: campione ancora limitato.`;
  else if(spread>=40)summary=`Probabili formazioni discordanti (${Math.min(...dp)}\u2013${Math.max(...dp)}%). Intervallo ${range.low}\u2013${range.high}%.`;
  else summary=`${ds} fonti formazione allineate (${published} percentuali pubblicate, ${inferred} indicazioni di formazione) + ${ns} news recenti${historyEnough?` + storico ${history.starts}/${history.games}`:''}. Intervallo ${range.low}\u2013${range.high}%.`;

  const H=history?[history]:[];
  const evidence=[...effectiveDirect,...effectiveNews,...H].filter(Boolean).sort((a,b)=>(b.used?1:0)-(a.used?1:0)||b.weight-a.weight).slice(0,10);
  return{
    playerId:p.id,playerName:p.name,club:p.club,probability:prob,
    rangeLow:range?.low??null,rangeHigh:range?.high??null,rangeLevel:range?.level||'',
    confidence,status,phase,summary,evidence,nextMatch:ctx?.next||null,
    history:history?{
      games:history.games,starts:history.starts,effectiveN:history.effectiveN||history.games,
      season:history.season?{games:history.season.games,starts:history.season.starts,probability:history.season.probability}:null,
      recent:history.recent?{games:history.recent.games,starts:history.recent.starts,probability:history.recent.probability,avgMinutes:history.recent.avgMinutes??null,matches:history.recent.matches||[]}:null
    }:null,
    updatedAt:new Date().toISOString()
  };
}

module.exports={build};

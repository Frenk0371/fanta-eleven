const {norm,text,json,slug}=require('./common');

const LIST_URLS=[
  'https://raw.githubusercontent.com/bqit/fantaleghe-api-json/refs/heads/main/players.json',
  'https://cdn.jsdelivr.net/gh/bqit/fantaleghe-api-json@main/players.json'
];
const OFFICIAL_URL='https://www.fantacalcio.it/quotazioni-fantacalcio';
const roleMap={P:'POR',D:'DIF',C:'CEN',A:'ATT'};
const clubNames={atalanta:'Atalanta',bologna:'Bologna',cagliari:'Cagliari',como:'Como',fiorentina:'Fiorentina',frosinone:'Frosinone',genoa:'Genoa',inter:'Inter',juventus:'Juventus',lazio:'Lazio',lecce:'Lecce',milan:'Milan',monza:'Monza',napoli:'Napoli',parma:'Parma',roma:'Roma',sassuolo:'Sassuolo',torino:'Torino',udinese:'Udinese',venezia:'Venezia'};
let listCache=null,listAt=0,officialCache=null,officialAt=0,officialHtmlCache='';

const decodeEntities=s=>String(s||'')
  .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16)))
  .replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10)))
  .replace(/&nbsp;/gi,' ')
  .replace(/&amp;/gi,'&')
  .replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'");
const clean=s=>decodeEntities(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
const clubFromSlug=s=>clubNames[norm(s).replace(/\s+/g,'-')]||String(s||'').split('-').map(x=>x?x[0].toUpperCase()+x.slice(1):'').join(' ');
function score(p,q){const n=norm(p.name),qq=norm(q),parts=n.split(' '),last=parts.at(-1)||'';return n===qq?100:last===qq?99:last.startsWith(qq)?96:n.startsWith(qq)?93:n.includes(qq)?82:0}
function profileUrl(p){return p.profileUrl||`https://www.fantacalcio.it/serie-a/squadre/${slug(p.club)}/${slug(p.name)}/${encodeURIComponent(p.id)}/2026-27`}
function validPlayerName(name,fallback=''){
  const n=clean(name),k=norm(n);
  if(!n||!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(n))return clean(fallback);
  if(/^(404|403|500|errore|error|not found|pagina non trovata|pagina inesistente)$/i.test(k))return clean(fallback);
  return n;
}
function inferRole(html){
  const raw=String(html||'');
  const direct=raw.match(/(?:ruolo|position)[^<>]{0,90}(?:>|:|=|\s)[^A-Za-z0-9]{0,10}([PDCA])(?:[^A-Za-z]|$)/i);
  if(direct)return roleMap[String(direct[1]).toUpperCase()]||'';
  const h1=raw.search(/<h1\b/i),body=clean(h1>=0?raw.slice(h1,h1+22000):raw).toLowerCase();
  if(/\b(portiere|goalkeeper)\b/.test(body))return'POR';
  if(/\b(difensore|terzino|braccetto|centrale difensivo)\b/.test(body))return'DIF';
  if(/\b(centrocampista|mediano|mezzala|regista|trequartista)\b/.test(body))return'CEN';
  if(/\b(attaccante|centravanti|punta|ala offensiva|esterno offensivo)\b/.test(body))return'ATT';
  return'';
}
function isCurrentProfile(html){
  const raw=String(html||'');
  return /Profilo calciatore\s*2026\s*[\/-]\s*27/i.test(raw)||/Statistiche\s*2026\s*[\/-]\s*27/i.test(clean(raw));
}
async function loadList(){
  if(listCache&&Date.now()-listAt<30*60e3)return listCache;
  for(const u of LIST_URLS){
    const j=await json(u,6500);
    if(Array.isArray(j)&&j.length>300){
      listCache=j.map(p=>({id:String(p.id),name:clean(p.name),club:clean(p.team),role:roleMap[p.position]||'',image:p.playerImage||'',profileUrl:''})).filter(p=>p.name&&p.club&&p.role);
      listAt=Date.now();return listCache;
    }
  }
  return listCache||[];
}
function parseOfficial(html,includeOutOfGame=false){
  const out=[],seen=new Set();
  const rows=String(html||'').match(/<tr\b[\s\S]*?<\/tr>/gi)||[];
  for(const row of rows){
    if(!includeOutOfGame&&/class=["'][^"']*out-of-game[^"']*["']/i.test(row))continue;
    const m=row.match(/<a\b[^>]*href=["']([^"']*\/serie-a\/squadre\/([^\/"'?#]+)\/([^\/"'?#]+)\/(\d+)(?:\/[^"'?#]*)?)["'][^>]*>([\s\S]*?)<\/a>/i);
    if(!m)continue;
    const id=String(m[4]),name=clean(m[5]);
    if(!id||!name||seen.has(id))continue;
    const club=clubFromSlug(m[2]);
    if(!club)continue;
    const roleCode=String(row.match(/data-filter-role-classic=["']([pdca])["']/i)?.[1]||'').toUpperCase();
    seen.add(id);
    out.push({id,name,club,role:roleMap[roleCode]||'',image:`https://content.fantacalcio.it/web/campioncini/21/medium/${id}.png?v=640`,profileUrl:new URL(m[1],'https://www.fantacalcio.it').href});
  }
  return out;
}
async function loadOfficial(){
  if(officialCache&&Date.now()-officialAt<15*60e3)return officialCache;
  const h=await text(OFFICIAL_URL,8000);
  const parsed=h?parseOfficial(h):[];
  if(parsed.length>100){officialCache=parsed;officialHtmlCache=h;officialAt=Date.now();return officialCache}
  return officialCache||[];
}
async function enrichFromHtml(p,h,existingRole=''){
  const fallbackName=clean(p.name);
  const title=h.match(/<title>\s*([^<]+?)\s*-\s*Profilo calciatore/i),head=h.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
  const candidate=clean(head?.[1]||title?.[1]||''),name=validPlayerName(candidate,fallbackName),role=p.role||existingRole||inferRole(h);
  return{...p,name,club:clean(p.club),role,profileUrl:profileUrl(p)};
}
async function enrich(p,existingRole=''){
  const url=profileUrl(p),h=await text(url,5000),fallbackName=clean(p.name);
  if(!h)return{...p,name:fallbackName,club:clean(p.club),role:p.role||existingRole,profileUrl:url};
  return enrichFromHtml({...p,profileUrl:url},h,existingRole);
}
async function validateCurrent(p,existingRole=''){
  const url=profileUrl(p),h=await text(url,5000);
  if(!h||!isCurrentProfile(h))return null;
  const x=await enrichFromHtml({...p,profileUrl:url},h,existingRole);
  return x.name&&x.club&&x.role?x:null;
}
async function currentExcludedCandidates(q,activeIds){
  if(!officialHtmlCache)return[];
  const candidates=parseOfficial(officialHtmlCache,true)
    .filter(p=>!activeIds.has(p.id)&&score(p,q))
    .sort((a,b)=>score(b,q)-score(a,q))
    .slice(0,8);
  const checked=await Promise.all(candidates.map(p=>validateCurrent(p,p.role)));
  return checked.filter(Boolean);
}
async function searchPlayers(q){
  const [list,official]=await Promise.all([loadList(),loadOfficial()]);
  if(list.length<100&&official.length<100)throw new Error('Player catalog unavailable');

  const legacyById=new Map(list.map(p=>[p.id,p]));
  const activeIds=new Set(official.map(p=>p.id));

  let officialMatches=official.map(p=>{
    const legacy=legacyById.get(p.id)||{};
    return{...legacy,...p,role:p.role||legacy.role||'',image:p.image||legacy.image||''};
  }).map(p=>({p,s:score(p,q)})).filter(x=>x.s).sort((a,b)=>b.s-a.s).slice(0,8).map(x=>x.p);
  officialMatches=await Promise.all(officialMatches.map(p=>enrich(p,p.role)));

  // IMPORTANT: il mirror JSON è già un listone aggiornato e contiene alcuni
  // giocatori che il markup HTML della pagina quotazioni non espone. Prima lo
  // usavamo solo per arricchire i record trovati nell'HTML: così giocatori come
  // Tourè I. (7146) sparivano dalla ricerca pur essendo presenti nel listone.
  const mirrorMatches=list
    .map(p=>({p,s:score(p,q)}))
    .filter(x=>x.s)
    .sort((a,b)=>b.s-a.s)
    .slice(0,12)
    .map(x=>({...x.p,profileUrl:profileUrl(x.p)}));

  const excluded=official.length>=100?await currentExcludedCandidates(q,activeIds):[];
  const byId=new Map();
  for(const p of [...officialMatches,...excluded,...mirrorMatches])if(p&&p.id&&!byId.has(p.id))byId.set(p.id,p);

  return [...byId.values()]
    .filter(p=>p.name&&p.club&&p.role)
    .sort((a,b)=>score(b,q)-score(a,q))
    .slice(0,8);
}
async function syncPlayers(ids){
  const wanted=new Set(ids.map(String)),[list,official]=await Promise.all([loadList(),loadOfficial()]);
  if(list.length<100&&official.length<100)throw new Error('Player catalog unavailable');

  const legacyById=new Map(list.map(p=>[p.id,p])),byId=new Map();
  for(const p of official)if(wanted.has(p.id)){
    const legacy=legacyById.get(p.id)||{};
    byId.set(p.id,{...legacy,...p,role:p.role||legacy.role||'',image:p.image||legacy.image||''});
  }

  if(byId.size<wanted.size&&officialHtmlCache){
    const all=parseOfficial(officialHtmlCache,true);
    const missing=all.filter(p=>wanted.has(p.id)&&!byId.has(p.id));
    const checked=await Promise.all(missing.map(p=>validateCurrent(p,p.role)));
    for(const p of checked.filter(Boolean))byId.set(p.id,p);
  }

  // Ultimo fallback: se l'HTML ufficiale non contiene il record, usa comunque
  // il giocatore presente nel mirror aggiornato del listone. Questo rende anche
  // la sincronizzazione delle rose coerente con la ricerca.
  for(const p of list)if(wanted.has(p.id)&&!byId.has(p.id))byId.set(p.id,{...p,profileUrl:profileUrl(p)});

  return [...byId.values()].map(p=>({...p,name:validPlayerName(p.name,p.name),club:clean(p.club)}));
}
module.exports={searchPlayers,syncPlayers,parseOfficial};

const {norm,text,json,slug}=require('./common');

const LIST_URLS=[
  'https://raw.githubusercontent.com/bqit/fantaleghe-api-json/refs/heads/main/players.json',
  'https://cdn.jsdelivr.net/gh/bqit/fantaleghe-api-json@main/players.json'
];
const OFFICIAL_URL='https://www.fantacalcio.it/quotazioni-fantacalcio';
const roleMap={P:'POR',D:'DIF',C:'CEN',A:'ATT'};
const clubNames={atalanta:'Atalanta',bologna:'Bologna',cagliari:'Cagliari',como:'Como',fiorentina:'Fiorentina',frosinone:'Frosinone',genoa:'Genoa',inter:'Inter',juventus:'Juventus',lazio:'Lazio',lecce:'Lecce',milan:'Milan',monza:'Monza',napoli:'Napoli',parma:'Parma',roma:'Roma',sassuolo:'Sassuolo',torino:'Torino',udinese:'Udinese',venezia:'Venezia'};
const seeds=[{id:'5694',name:'Beto',club:'Fiorentina',role:'ATT',image:'https://content.fantacalcio.it/web/campioncini/21/medium/5694.png?v=640',profileUrl:'https://www.fantacalcio.it/serie-a/squadre/fiorentina/beto/5694/2026-27'}];
let listCache=null,listAt=0,officialCache=null,officialAt=0;

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
function parseOfficial(html){
  const out=[],seen=new Set(),re=/<a\b[^>]*href=["']([^"']*\/serie-a\/squadre\/([^\/"'?#]+)\/([^\/"'?#]+)\/(\d+)(?:\/[^"'?#]*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(String(html||'')))){
    const id=String(m[4]),name=clean(m[5]);
    if(!id||!name||seen.has(id))continue;
    const club=clubFromSlug(m[2]);
    if(!club)continue;
    seen.add(id);
    out.push({id,name,club,role:'',image:`https://content.fantacalcio.it/web/campioncini/21/medium/${id}.png?v=640`,profileUrl:new URL(m[1],'https://www.fantacalcio.it').href});
  }
  for(const p of seeds)if(!seen.has(p.id))out.push({...p});
  return out;
}
async function loadOfficial(){
  if(officialCache&&Date.now()-officialAt<15*60e3)return officialCache;
  const h=await text(OFFICIAL_URL,8000);
  const parsed=h?parseOfficial(h):[];
  if(parsed.length>100){officialCache=parsed;officialAt=Date.now();return officialCache}
  if(!officialCache)officialCache=[...seeds];
  return officialCache;
}
async function enrich(p,existingRole=''){
  const url=profileUrl(p),h=await text(url,5000);
  if(!h)return{...p,name:clean(p.name),club:clean(p.club),role:p.role||existingRole,profileUrl:url};
  const title=h.match(/<title>\s*([^<]+?)\s*-\s*Profilo calciatore/i),head=h.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
  const name=clean(head?.[1]||title?.[1]||p.name),role=p.role||existingRole||inferRole(h);
  return{...p,name:name||clean(p.name),club:clean(p.club),role,profileUrl:url};
}
async function searchPlayers(q){
  const [list,official]=await Promise.all([loadList(),loadOfficial()]);
  const base=list.map(p=>({p,s:score(p,q)})).filter(x=>x.s).sort((a,b)=>b.s-a.s).slice(0,12).map(x=>x.p);
  const off=official.map(p=>({p,s:score(p,q)})).filter(x=>x.s).sort((a,b)=>b.s-a.s).slice(0,12).map(x=>x.p);
  const byId=new Map(base.map(p=>[p.id,{...p}]));
  for(const p of off){const old=byId.get(p.id)||{};byId.set(p.id,{...old,...p,role:old.role||p.role||''})}
  for(const p of seeds)if(score(p,q)){const old=byId.get(p.id)||{};byId.set(p.id,{...old,...p,role:p.role||old.role||''})}
  let merged=[...byId.values()].sort((a,b)=>score(b,q)-score(a,q)).slice(0,8);
  merged=await Promise.all(merged.map(p=>enrich(p,p.role)));
  return merged.filter(p=>p.name&&p.club&&p.role).sort((a,b)=>score(b,q)-score(a,q));
}
async function syncPlayers(ids){
  const wanted=new Set(ids.map(String)),[list,official]=await Promise.all([loadList(),loadOfficial()]);
  const byId=new Map();
  for(const p of list)if(wanted.has(p.id))byId.set(p.id,{...p});
  for(const p of official)if(wanted.has(p.id)){const old=byId.get(p.id)||{};byId.set(p.id,{...old,...p,role:old.role||p.role||''})}
  for(const p of seeds)if(wanted.has(p.id)){const old=byId.get(p.id)||{};byId.set(p.id,{...old,...p,role:p.role||old.role||''})}
  return [...byId.values()].map(p=>({...p,name:clean(p.name),club:clean(p.club)}));
}
module.exports={searchPlayers,syncPlayers};

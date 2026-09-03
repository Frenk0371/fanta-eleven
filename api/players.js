const {searchPlayers,syncPlayers}=require('../lib/catalog');

// Fallback minimo per giocatori attivi che possono non comparire nel markup
// della pagina quotazioni usata dal catalogo. Manteniamo gli stessi ID di
// Fantacalcio così, quando il parser torna a vederli, non si creano duplicati.
const FALLBACK_PLAYERS=[
  {
    id:'6666',
    name:'Adrian Bernabè',
    club:'Parma',
    role:'CEN',
    image:'https://content.fantacalcio.it/web/campioncini/21/medium/6666.png?v=20260903',
    profileUrl:'https://www.fantacalcio.it/serie-a/squadre/parma/bernabe/6666/2026-27'
  }
];

const norm=s=>String(s||'')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g,' ')
  .replace(/\s+/g,' ')
  .trim();

function addSearchFallbacks(players,q){
  const out=[...(Array.isArray(players)?players:[])],seen=new Set(out.map(p=>String(p.id)));
  const nq=norm(q);
  for(const p of FALLBACK_PLAYERS){
    if(seen.has(String(p.id)))continue;
    const hay=norm(`${p.name} ${p.club}`);
    if(nq&&hay.includes(nq))out.push(p);
  }
  return out.slice(0,8);
}

function addIdFallbacks(players,ids){
  const out=[...(Array.isArray(players)?players:[])],seen=new Set(out.map(p=>String(p.id))),wanted=new Set(ids.map(String));
  for(const p of FALLBACK_PLAYERS)if(wanted.has(String(p.id))&&!seen.has(String(p.id)))out.push(p);
  return out;
}

module.exports=async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
  // Evita che durante gli aggiornamenti del listone Vercel continui a servire
  // per minuti una ricerca vecchia.
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({error:'Metodo non consentito'});
  const q=String(req.query?.q||'').trim(),idsRaw=String(req.query?.ids||'').trim();
  try{
    if(idsRaw){
      const ids=[...new Set(idsRaw.split(',').map(x=>x.trim()).filter(Boolean))].slice(0,120);
      const players=addIdFallbacks(await syncPlayers(ids),ids);
      return res.status(200).json({players,source:'fantacalcio-active-list-sync',count:players.length});
    }
    if(q.length<2)return res.status(200).json({players:[]});
    const players=addSearchFallbacks(await searchPlayers(q),q);
    return res.status(200).json({players,source:'fantacalcio-active-list',count:players.length});
  }catch(e){
    // Anche se il catalogo remoto è temporaneamente indisponibile, i fallback
    // noti restano ricercabili invece di mostrare un falso "nessun giocatore".
    const players=q.length>=2?addSearchFallbacks([],q):[];
    if(players.length)return res.status(200).json({players,source:'fallback-current-list',count:players.length});
    return res.status(503).json({error:'Catalogo temporaneamente non disponibile'});
  }
};

const {searchPlayers,syncPlayers}=require('../lib/catalog');

module.exports=async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({error:'Metodo non consentito'});
  const q=String(req.query?.q||'').trim(),idsRaw=String(req.query?.ids||'').trim();
  try{
    if(idsRaw){
      const ids=[...new Set(idsRaw.split(',').map(x=>x.trim()).filter(Boolean))].slice(0,120);
      const players=await syncPlayers(ids);
      res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=900');
      return res.status(200).json({players,source:'fantacalcio-active-list-sync',count:players.length});
    }
    if(q.length<2)return res.status(200).json({players:[]});
    const players=await searchPlayers(q);
    res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({players,source:'fantacalcio-active-list',count:players.length});
  }catch(e){
    return res.status(503).json({error:'Catalogo temporaneamente non disponibile'});
  }
};

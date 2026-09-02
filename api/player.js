const {playerProfile}=require('../lib/player-profile');

module.exports=async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method!=='GET')return res.status(405).json({error:'Metodo non consentito'});
  const id=String(req.query?.id||'').trim();
  if(!/^\d+$/.test(id))return res.status(400).json({error:'Giocatore non valido'});
  try{
    const player=await playerProfile(id);
    if(!player)return res.status(404).json({error:'Scheda Fantacalcio.it non disponibile'});
    res.setHeader('Cache-Control','public, s-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({player,source:'Fantacalcio.it'});
  }catch{
    return res.status(503).json({error:'Dati Fantacalcio.it temporaneamente non disponibili'});
  }
};

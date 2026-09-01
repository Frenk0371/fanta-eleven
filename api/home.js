const fs=require('fs');
const path=require('path');

module.exports=(req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD') return res.status(405).end();
  try{
    const file=path.join(process.cwd(),'index.html');
    let html=fs.readFileSync(file,'utf8');
    html=html.replace('</style>','.detail{display:none!important}</style>');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=3600');
    if(req.method==='HEAD') return res.status(200).end();
    return res.status(200).send(html);
  }catch(e){
    return res.status(500).send('Fanta Eleven non disponibile.');
  }
};

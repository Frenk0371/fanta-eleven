const fs=require('fs');
const path=require('path');

module.exports=(req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD') return res.status(405).end();
  try{
    const file=path.join(process.cwd(),'index.html');
    let html=fs.readFileSync(file,'utf8');
    html=html.replace(/Aggiorna il mio XI/g,'Aggiorna la mia Rosa');
    html=html.replace('</style>','.detail{display:none!important}</style>');
    html=html.replace('</body>','<script src="/sync-roster.js?v=1"></script><script src="/search-safe.js?v=1"></script></body>');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');
    if(req.method==='HEAD') return res.status(200).end();
    return res.status(200).send(html);
  }catch(e){
    return res.status(500).send('Fanta Eleven non disponibile.');
  }
};

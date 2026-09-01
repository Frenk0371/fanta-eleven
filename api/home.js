const fs=require('fs');
const path=require('path');

module.exports=(req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD') return res.status(405).end();
  try{
    const file=path.join(process.cwd(),'index.html');
    let html=fs.readFileSync(file,'utf8');
    html=html.replace(
      /<section class="hero"><h2>[\s\S]*?<button id="analyze" class="btn primary">[\s\S]*?<\/button><\/section>/,
      '<section class="hero hero-compact"><button id="analyze" class="btn primary">Aggiorna la mia Rosa</button></section>'
    );
    html=html.replace(/Aggiorna il mio XI/g,'Aggiorna la mia Rosa');
    html=html.replace('<button data-t="xi" class="on">Il mio XI</button>','<button data-t="xi" class="on">La mia Rosa</button>');
    html=html.replace('</style>',`.detail{display:none!important}.hero.hero-compact{padding:0;margin:14px 0;background:transparent;border:0;box-shadow:none;overflow:visible}.hero.hero-compact:before,.hero.hero-compact:after{display:none}.hero.hero-compact .btn{width:100%;min-height:56px}</style>`);
    html=html.replace('</body>','<script src="/sync-roster.js?v=1"></script><script src="/search-safe.js?v=1"></script></body>');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma','no-cache');
    if(req.method==='HEAD') return res.status(200).end();
    return res.status(200).send(html);
  }catch(e){
    return res.status(500).send('Fanta Eleven non disponibile.');
  }
};

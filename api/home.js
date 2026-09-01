const fs=require('fs');
const path=require('path');

module.exports=(req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD') return res.status(405).end();
  try{
    const file=path.join(process.cwd(),'index.html');
    let html=fs.readFileSync(file,'utf8');
    html=html.replace(
      /<section class="hero"><h2>[\s\S]*?<button id="analyze" class="btn primary">[\s\S]*?<\/button><\/section>/,
      ''
    );
    html=html.replace(
      '<div class="switch"><b>Fantasquadra</b><select id="teamSelect"></select></div>',
      '<div class="switch roster-switch"><b>Fantasquadra</b><select id="teamSelect"></select><button id="analyze" class="btn primary roster-analyze">Aggiorna la mia Rosa</button></div>'
    );
    html=html.replace(/Aggiorna il mio XI/g,'Aggiorna la mia Rosa');
    html=html.replace('<button data-t="xi" class="on">Il mio XI</button>','<button data-t="xi" class="on">La mia Rosa</button>');
    html=html.replace('</style>',`.detail{display:none!important}.roster-switch{gap:10px;margin-top:22px}.roster-switch>b{font-size:16px}.roster-switch #teamSelect{min-height:60px;font-size:21px;font-weight:850;letter-spacing:-.25px;padding-left:18px}.roster-analyze{width:100%;min-height:56px;margin-top:2px;font-size:17px}.fe-splash{display:none!important}body.splashing{overflow:auto!important}body.splashing .app{opacity:1!important;transform:none!important;pointer-events:auto!important}</style>`);
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

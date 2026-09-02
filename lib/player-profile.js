const {text}=require('./common');

const QUOTES_URL='https://www.fantacalcio.it/quotazioni-fantacalcio';
let quotesCache=null,quotesAt=0;

const decode=s=>String(s||'')
  .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16)))
  .replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10)))
  .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'");
const clean=s=>decode(String(s||'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
const number=s=>{const n=Number(String(s||'').trim().replace(',','.'));return Number.isFinite(n)?n:null};
const value=(html,label)=>{
  const re=new RegExp(`<meta\\s+itemprop=["']name description["']\\s+content=["']${label}["'][\\s\\S]{0,420}?<meta\\s+itemprop=["']value["']\\s+content=["']([^"']*)`, 'i');
  return number(html.match(re)?.[1]);
};
const tableValue=(html,label)=>{
  const re=new RegExp(`<th[^>]*itemprop=["']name description["'][^>]*>\\s*${label}\\s*</th>[\\s\\S]{0,260}?<td[^>]*itemprop=["']value["'][^>]*class=["'][^"']*value[^"']*["'][^>]*>\\s*([^<]+)`, 'i');
  return number(clean(html.match(re)?.[1]));
};

function parseQuotes(html){
  const out=new Map(),rows=String(html||'').match(/<tr\b[^>]*class=["'][^"']*player-row[^"']*["'][\s\S]*?<\/tr>/gi)||[];
  for(const row of rows){
    if(/class=["'][^"']*out-of-game[^"']*["']/i.test(row))continue;
    const link=row.match(/href=["'](https?:\/\/www\.fantacalcio\.it\/serie-a\/squadre\/([^\/"']+)\/([^\/"']+)\/(\d+)[^"']*)["']/i);
    if(!link)continue;
    const cell=cls=>number(clean(row.match(new RegExp(`<td[^>]*class=["'][^"']*${cls}[^"']*["'][^>]*>([\\s\\S]*?)<\\/td>`,'i'))?.[1]));
    const name=clean(row.match(/<th[^>]*class=["'][^"']*player-name[^"']*["'][^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i)?.[1]);
    out.set(String(link[4]),{id:String(link[4]),name,profileUrl:link[1],classicInitial:cell('player-classic-initial-price'),classicCurrent:cell('player-classic-current-price'),classicFvm:cell('player-classic-fvm'),mantraInitial:cell('player-mantra-initial-price'),mantraCurrent:cell('player-mantra-current-price'),mantraFvm:cell('player-mantra-fvm')});
  }
  return out;
}

async function quotes(){
  if(quotesCache&&Date.now()-quotesAt<15*60e3)return quotesCache;
  const html=await text(QUOTES_URL,12000),parsed=parseQuotes(html);
  if(parsed.size>100){quotesCache=parsed;quotesAt=Date.now()}
  return quotesCache||parsed;
}

async function playerProfile(id){
  const quote=(await quotes()).get(String(id));
  if(!quote)return null;
  const html=await text(quote.profileUrl,10000);
  const title=clean(html.match(/<h1[^>]*itemprop=["']name["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1])||quote.name;
  const image=html.match(/<img[^>]*(?:itemprop=["']image["']|class=["'][^"']*player[^"']*image)[^>]*src=["']([^"']+)/i)?.[1]||`https://content.fantacalcio.it/web/campioncini/21/medium/${encodeURIComponent(id)}.png?v=20260902`;
  return {...quote,name:title,image,mediaVoto:value(html,'Media voto'),fantamedia:value(html,'FantaMedia'),appearances:tableValue(html,'Partite a voto'),goals:tableValue(html,'Gol'),assists:tableValue(html,'Assist'),yellowCards:tableValue(html,'Ammonizioni'),redCards:tableValue(html,'Espulsioni'),updatedAt:new Date().toISOString()};
}

module.exports={playerProfile,parseQuotes};

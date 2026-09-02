const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/<[^>]+>/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const aliases=n=>{const p=norm(n).split(' ').filter(Boolean);return [...new Set([norm(n),p.at(-1)].filter(x=>x&&x.length>2))]};
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
async function text(url,ms=8000){const c=new AbortController(),to=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{headers:{'user-agent':UA,'accept-language':'it-IT,it;q=.9'},signal:c.signal});return r.ok?await r.text():''}catch{return''}finally{clearTimeout(to)}}
async function json(url,ms=7000){const c=new AbortController(),to=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{headers:{'user-agent':UA,'accept-language':'it-IT,it;q=.9'},signal:c.signal});return r.ok?await r.json():null}catch{return null}finally{clearTimeout(to)}}
function lines(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<(br|\/p|\/li|\/div|\/section|\/article|\/h[1-6]|\/tr|\/td)>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)}
const slug=s=>norm(s).replace(/\s+/g,'-');
module.exports={norm,clamp,aliases,text,json,lines,slug};

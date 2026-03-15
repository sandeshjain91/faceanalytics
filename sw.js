const CACHE='face-analytics-v2', CDN_CACHE='face-analytics-cdn-v2';
const CDN_ORIGINS=['cdn.jsdelivr.net','fonts.googleapis.com','fonts.gstatic.com','cdn.tailwindcss.com'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','./index.html','./manifest.json'])).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==CDN_CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(CDN_ORIGINS.some(o=>url.hostname.includes(o))){
    e.respondWith(caches.open(CDN_CACHE).then(async c=>{const r=await c.match(e.request);if(r)return r;const res=await fetch(e.request);if(res.ok)c.put(e.request,res.clone());return res;}));
    return;
  }
  if(url.pathname==='/'||url.pathname.endsWith('.html')||url.pathname.endsWith('.json')){
    e.respondWith(fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r;}).catch(()=>caches.match(e.request)));
  }
});

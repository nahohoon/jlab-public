/* J_LAB Public Service Worker v2.0.0 */
const CACHE = "jlab-public-v2-0-0";
const CORE  = ["./","./manifest.json","./icon-192.png","./icon-512.png","./apple-touch-icon.png"];

self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).catch(()=>null)));});

self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE?caches.delete(k):null))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET") return;
  const url=new URL(req.url);
  if(!url.hostname.includes("nahohoon.github.io")) return;
  if(req.mode==="navigate"||/\.(html|js|css)$/.test(url.pathname)){
    e.respondWith(fetch(req).then(res=>{caches.open(CACHE).then(c=>c.put(req,res.clone()));return res;}).catch(()=>caches.match(req).then(c=>c||caches.match("./"))));
    return;
  }
  e.respondWith(caches.match(req).then(c=>{if(c)return c;return fetch(req).then(res=>{caches.open(CACHE).then(ch=>ch.put(req,res.clone()));return res;});}));
});

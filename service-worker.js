// Very small offline cache
const CACHE = "b2journey-v1";
const ASSETS = [
  "index.html","style.css","app.js",
  "vocabulary.html","comprehension.html","listening.html","speaking.html","phrases.html","goals.html","calendar.html","data.html",
  "data/phrases.json","data/prompts.json","data/news_summaries.json","data/listening_exercises.json","data/dictation.json"
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate', e=>{
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', e=>{
  e.respondWith(
    caches.match(e.request).then(r=> r || fetch(e.request).then(res=>{
      const copy = res.clone();
      caches.open(CACHE).then(c=>c.put(e.request, copy)).catch(()=>{});
      return res;
    }).catch(()=> caches.match('index.html')))
  );
});

/* Only public, non-financial resources are cached. No offline mutation queue. */
const CACHE='treeti-public-v2';
const PUBLIC=['/offline.html','/icons/treeti-192.png','/icons/treeti-512.png','/icons/treeti-maskable-512.png','/icons/treeti-apple.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('ahd-public-')||key.startsWith('treeti-public-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(async()=>await caches.match('/offline.html')||Response.error()));
  }else if(PUBLIC.includes(url.pathname)){
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
  }
});
/* Notifications carry a short generic line and a path; the record itself is only ever fetched after sign-in. */
self.addEventListener('push',event=>{
  let data={};try{data=event.data?event.data.json():{};}catch{}
  const path=typeof data.url==='string'&&data.url.startsWith('/')&&!data.url.startsWith('//')?data.url:'/app';
  event.waitUntil(self.registration.showNotification(typeof data.title==='string'?data.title:'treeti',{body:typeof data.body==='string'?data.body:'There is an update on one of your agreements.',icon:'/icons/treeti-192.png',badge:'/icons/treeti-192.png',tag:typeof data.tag==='string'?data.tag:undefined,data:{path}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=new URL((event.notification.data&&event.notification.data.path)||'/app',self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
    for(const client of windows){if(new URL(client.url).origin===self.location.origin&&'focus' in client){if('navigate' in client)await client.navigate(url).catch(()=>{});return client.focus();}}
    return self.clients.openWindow(url);
  }));
});

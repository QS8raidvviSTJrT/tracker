self.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open("doortracker").then((cache) => {
        return cache.addAll(["/", "/index.html", "/styles.css", "/app.js"]);
      })
    );
  });
  
  self.addEventListener("fetch", (event) => {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  });
  

// Change this to your repository name
var GHPATH = '';
 
// Choose a different app prefix name
var APP_PREFIX = 'dt';
 
// The version of the cache. Every time you change any of the files
// you need to change this version (version_01, version_02…). 
// If you don't change the version, the service worker will give your
// users the old files!
var VERSION = 'version_10';
 
// The files to make available for offline use. make sure to add 
// others to this list
var URLS = [    
  `${GHPATH}/`,
  `${GHPATH}/index.html`,
  `${GHPATH}/styles.css`,
  `${GHPATH}/app.js`,
  `${GHPATH}/map.js`,
  `${GHPATH}/manifest.json`,
  `${GHPATH}/images/180.png`,
  `${GHPATH}/images/512.png`,
  `${GHPATH}/images/favicon.ico`,
  `${GHPATH}/images/favicon-16x16.png`,
  `${GHPATH}/images/favicon-32x32.png`,
  `${GHPATH}/images/favicon-96x96.png`,
  `${GHPATH}/images/favicon-128x128.png`,
  `${GHPATH}/images/favicon-192x192.png`,
  `${GHPATH}/images/favicon-512x512.png`,
  `${GHPATH}/images/favicon-180.png`,
  `${GHPATH}/images/favicon-512.png`,
  `${GHPATH}/images/favicon-16.png`,
  `${GHPATH}/images/favicon-32.png`,
  `${GHPATH}/images/favicon-96.png`,
  `${GHPATH}/images/favicon-128.png`,
  `${GHPATH}/images/favicon-180.png`,
  `${GHPATH}/images/favicon-512.png`,
  `${GHPATH}/images/favicon-16.png`,
  `${GHPATH}/images/favicon-32.png`,
  `${GHPATH}/images/favicon-96.png`,
]
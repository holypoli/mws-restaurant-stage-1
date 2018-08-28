/*
* Sevice worker file all caching happens here
*/
const staticCacheName = "restaurant-cache-v3";
const imgCacheName = "images-cache-v1";

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(staticCacheName).then(cache => {
      return cache.addAll([
        // "restaurant.html",
        // "index.html",
        "/",
        "css/styles.css",
        "css/restaurant.css",
        "js/main.js",
        "js/restaurant_info.js",
        "js/dbhelper.js",
        // "manifest.json",
        "https://fonts.gstatic.com/s/raleway/v12/1Ptrg8zYS_SKggPNwOIpWqZPANqczVs.woff2"
      ]);
    })
  );
});

self.addEventListener("activate", event => {
  console.log("activate new service worker");

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (
            cacheName.startsWith("restaurant-") &&
            cacheName !== staticCacheName
          ) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener("fetch", event => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.pathname.startsWith("/responsive-img/")) {
    caches.open(imgCacheName).then(cache => {
      cache.match(event.request.url).then(response => {
        return (
          response ||
          fetch(event.request).then(serverResponse => {
            cache.put(event.request.url, serverResponse.clone());
            return serverResponse;
          })
        );
      });
    });
  }

  event.respondWith(
    caches.match(requestUrl.pathname).then(response => {
      return response || fetch(event.request);
    })
  );
});

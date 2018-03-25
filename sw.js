/*
* Sevice worker file all caching happens here
*/
const staticCacheName = 'restaurant-cache-v0'

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(staticCacheName).then((cache) => {
            return cache.addAll([
                'restaurant.html',
                'index.html',
                'css/styles.css',
                'js/main.js',
                'js/restaurant_info.js',
                'js/dbhelper.js',
                'https://fonts.gstatic.com/s/raleway/v12/1Ptrg8zYS_SKggPNwOIpWqZPANqczVs.woff2'
            ]);
        })
    )
})
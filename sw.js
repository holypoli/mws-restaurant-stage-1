/*
* Sevice worker file all caching happens here
*/
const staticCacheName = 'restaurant-cache-v1'

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(staticCacheName).then((cache) => {
            return cache.addAll([
                'restaurant.html',
                'index.html',
                'css/styles.css',
                'css/restaurant.css',
                'js/main.js',
                'js/restaurant_info.js',
                'js/dbhelper.js',
                'data/restaurants.json',
                'img/1.jpg',
                'img/2.jpg',
                'img/3.jpg',
                'img/4.jpg',
                'img/5.jpg',
                'img/6.jpg',
                'img/7.jpg',
                'img/8.jpg',
                'img/9.jpg',
                'img/10.jpg',
                'https://fonts.gstatic.com/s/raleway/v12/1Ptrg8zYS_SKggPNwOIpWqZPANqczVs.woff2'
            ]);
        })
    )
})

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    
    if (requestUrl.origin === location.origin) {
        event.respondWith(
            caches.match(requestUrl.pathname).then(response => {
                return response || fetch(event.request);
            })
        )
    }
})
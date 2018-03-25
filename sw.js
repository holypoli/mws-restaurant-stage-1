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
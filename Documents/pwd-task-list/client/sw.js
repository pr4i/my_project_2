const CACHE_NAME = 'smart-todo-v1';
const DYNAMIC_CACHE_NAME = 'dynamic-content-v1';

// Статические ресурсы для кэширования (App Shell)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Кэширование App Shell');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Активация и очистка старых кэшей
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                        console.log('Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Стратегия кэширования: Cache First для статики, Network First для данных
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // Пропускаем запросы к API
    if (requestUrl.pathname.startsWith('/subscribe') || 
        requestUrl.pathname.startsWith('/unsubscribe') ||
        requestUrl.pathname.startsWith('/send-notification')) {
        return;
    }

    // Для статических ресурсов используем Cache First
    if (STATIC_ASSETS.includes(requestUrl.pathname)) {
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
        );
        return;
    }

    // Для остальных запросов - Network First
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Кэшируем только успешные ответы
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(DYNAMIC_CACHE_NAME)
                        .then(cache => cache.put(event.request, responseToCache));
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {
        title: 'Умный список задач',
        body: 'У вас новое уведомление',
        icon: '/icons/icon-192.png'
    };

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            vibrate: [200, 100, 200]
        })
    );
});

// Обработка клика по уведомлению
self.addEventListener('push', (event) => {
    const data = event.data.json();
    console.log('Получено push-уведомление:', data);

    self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icons/icon-192.png'
    });
});
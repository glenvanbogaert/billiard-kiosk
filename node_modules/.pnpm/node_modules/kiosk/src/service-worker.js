import { build, files, version } from '$service-worker';

const CACHE_NAME = `billiard-kiosk-${version}`;
const IMAGE_CACHE_NAME = `billiard-images-${version}`;

const ASSETS = [
    ...build, 
    ...files  
];

self.addEventListener('install', (event) => {
    async function addFilesToCache() {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(ASSETS);
    }
    event.waitUntil(addFilesToCache());
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    async function deleteOldCaches() {
        for (const key of await caches.keys()) {
            if (key !== CACHE_NAME && key !== IMAGE_CACHE_NAME) {
                await caches.delete(key);
            }
        }
    }
    event.waitUntil(deleteOldCaches());
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    if (url.pathname.includes('/images/')) {
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) return cachedResponse;

                try {
                    const fetchResponse = await fetch(event.request);
                    cache.put(event.request, fetchResponse.clone());
                    return fetchResponse;
                } catch (e) {
                    return new Response('Offline image not cached', { status: 503 });
                }
            })
        );
        return;
    }

    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response(JSON.stringify({ error: 'Offline' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) return response;
            return fetch(event.request);
        })
    );
});

const CACHE_NAME = 'worktracker-cache-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll([OFFLINE_URL])
    })(),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      )
    })(),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return
  if (!request.url.startsWith(self.location.origin)) return

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached

      try {
        const response = await fetch(request)
        if (response && response.status === 200 && response.type === 'basic') {
          cache.put(request, response.clone())
        }
        return response
      } catch (error) {
        const offlineResponse = await cache.match(OFFLINE_URL)
        if (offlineResponse) return offlineResponse
        throw error
      }
    }),
  )
})

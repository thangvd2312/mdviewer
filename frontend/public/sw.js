// viewmd service worker: makes the site installable as an app and keeps it usable on a bad connection.
// - Pages: always from the network (so a deploy shows up at once); offline, a small "you're offline" page.
// - /assets/*: hashed file names never change, so they're served from the cache after the first load.
// - The API and other sites are never touched.
const VERSION = 'v1'
const SHELL = `viewmd-shell-${VERSION}`
const ASSETS = 'viewmd-assets'
const MAX_ASSETS = 120

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/offline.html', '/icon-192.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith('viewmd-shell-') && key !== SHELL) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS)
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) {
          await cache.put(req, res.clone())
          const keys = await cache.keys()
          // Old builds' files pile up; drop the oldest ones.
          for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(k)
        }
        return res
      })(),
    )
  }
})

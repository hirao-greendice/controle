importScripts("./asset-cache-config.js");

const config = globalThis.CONTROL_ASSET_CACHE;
const cacheName = `${config.cachePrefix}${config.version}`;
const allAssets = [...config.coreAssets, ...config.mediaAssets];
const assetUrls = new Set(
  allAssets.map((asset) => new URL(asset, self.registration.scope).href),
);
const networkFirstUrls = new Set(
  config.coreAssets.map((asset) => new URL(asset, self.registration.scope).href),
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      await Promise.all(
        config.coreAssets.map(async (asset) => {
          const request = new Request(
            new URL(asset, self.registration.scope).href,
            { cache: "reload" },
          );
          const response = await fetch(request);
          if (!response.ok) throw new Error(`Failed to cache ${asset}`);
          await cache.put(request, response);
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith(config.cachePrefix) &&
              name !== cacheName,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  if (!assetUrls.has(url.href)) return;

  event.respondWith(
    networkFirstUrls.has(url.href)
      ? networkFirst(request)
      : cacheFirst(request),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackAsset = null) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached =
      (await cache.match(request)) ||
      (fallbackAsset
        ? await cache.match(new URL(fallbackAsset, self.registration.scope).href)
        : null);
    if (cached) return cached;
    throw error;
  }
}

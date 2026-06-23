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

  if (request.headers.has("range")) {
    event.respondWith(rangeResponse(request));
    return;
  }

  event.respondWith(
    networkFirstUrls.has(url.href)
      ? networkFirst(request)
      : cacheFirst(request),
  );
});

async function rangeResponse(request) {
  const cache = await caches.open(cacheName);
  const fullRequest = new Request(request.url, {
    cache: "default",
    credentials: "same-origin",
  });
  let response = await cache.match(fullRequest);

  if (!response) {
    response = await fetch(fullRequest);
    if (!response.ok) return response;
    await cache.put(fullRequest, response.clone());
  }

  const bytes = await response.arrayBuffer();
  const range = request.headers.get("range");
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range ?? "");
  if (!match) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${bytes.byteLength}`,
      },
    });
  }

  const requestedStart = match[1] === "" ? null : Number(match[1]);
  const requestedEnd = match[2] === "" ? null : Number(match[2]);
  let start;
  let end;

  if (requestedStart === null) {
    const suffixLength = Math.min(requestedEnd ?? 0, bytes.byteLength);
    start = bytes.byteLength - suffixLength;
    end = bytes.byteLength - 1;
  } else {
    start = requestedStart;
    end = Math.min(requestedEnd ?? bytes.byteLength - 1, bytes.byteLength - 1);
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start >= bytes.byteLength ||
    end < start
  ) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${bytes.byteLength}`,
      },
    });
  }

  const headers = new Headers(response.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Content-Range", `bytes ${start}-${end}/${bytes.byteLength}`);

  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    statusText: "Partial Content",
    headers,
  });
}

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

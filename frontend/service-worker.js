// Note, location of this file must be in root, it cannot handle requests correctly otherwise.

// Extra log prints
const DEBUG = false;

// Our registered caches name.
const CACHE_NAME = "restaurants-v1";
const RUNTIME = "runtime";

// All the resources we will request to be cached.
const CACHE_URLS = [
	"/index.html",
	"/manifest.json",
	"/restaurant.html",
	"/restaurant.html?id=1",
	"/restaurant.html?id=2",
	"/restaurant.html?id=3",
	"/restaurant.html?id=4",
	"/restaurant.html?id=5",
	"/restaurant.html?id=6",
	"/restaurant.html?id=7",
	"/restaurant.html?id=8",
	"/restaurant.html?id=9",
	"/restaurant.html?id=10",
	"/css/styles.css",
	"/js/dbhelper.js",
	"/js/main.js",
	"/js/restaurant_info.js",
	"/data/restaurants.json",
	"/img/1.webp",
	"/img/2.webp",
	"/img/3.webp",
	"/img/4.webp",
	"/img/5.webp",
	"/img/6.webp",
	"/img/7.webp",
	"/img/8.webp",
	"/img/9.webp",
	"/img/10.webp",
];

// Serviceworker install event.
self.addEventListener("install", (event) => {
	try {
		if(DEBUG) console.log("Serviceworker installing...");
		event.waitUntil(new Promise(async function(resolve, reject) {
			var cacheTemp = await caches.open(CACHE_NAME);
			var curCacheUrl = "";
			try {
				for(var ii = 0; ii < CACHE_URLS.length; ii++) {
					curCacheUrl = CACHE_URLS[ii];
					await cacheTemp.add(curCacheUrl);
				}
			} catch(e) { console.log("Registration failed for: ", curCacheUrl, e); }
			await self.skipWaiting();
			resolve();
		}));
	} catch(e) { console.log(e); }
});

// Serviceworker activate event.
self.addEventListener("activate", (event) => {
	try {
		if(DEBUG) console.log("Serviceworker activated.");
		event.waitUntil(new Promise(async function(resolve, reject) {
			var cacheKeys = await caches.keys();
			const currentCaches = [CACHE_NAME, RUNTIME];
			var obsoleteCaches = cacheKeys.filter(cacheName => !currentCaches.includes(cacheName));
			await Promise.all(obsoleteCaches.map(cacheToDelete => {
				return caches.delete(cacheToDelete);
			}));
			await self.clients.claim();
			resolve();
		}));
	} catch(e) { console.log(e); }
});

// Serviceworker fetch event.
self.addEventListener("fetch", (event) => {
	try {
		if(DEBUG) console.log("fetch", event.request.url);

		if (event.request.url.startsWith(self.location.origin)) {
			event.respondWith(async function() {
				try {
					var cachedResponse = await caches.match(event.request);
					
					if (cachedResponse) {
						if(DEBUG) console.log("fetch response, primary cache for:", event.request.url, cachedResponse);
					} else {
						var runtimeCache = await caches.open(RUNTIME);
						cachedResponse = await fetch(event.request);
						if(cachedResponse) {
							await runtimeCache.put(event.request, cachedResponse.clone());
							if(DEBUG) console.log("fetch response, runtime cache for:", event.request.url, cachedResponse);
						} else {
							if(DEBUG) console.log("fetch failed.");
						}
					}
					//console.log(event.eventPhase);
					return cachedResponse;
				} catch(e) { console.log(e); }
			}());
		} else {
			if(DEBUG) console.log("\tIgnoring cache of cross-domain requests.");
		}
	} catch(e) { console.log(e); }
});

self.addEventListener("message", async (event) => {
	try {
		if(DEBUG) console.log("message");
	} catch(e) { console.log(e); }
});

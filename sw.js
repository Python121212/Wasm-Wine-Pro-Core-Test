// sw.js - PWAキャッシュ ＆ ヘッダー自己偽装の融合版

const CACHE_NAME = "wasm-wine-pwa-v1";
const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./manifest.json",
    "./main-worker.js",
    "./jit-worker.js"
];

// ① PWAの必須条件：アプリ起動時にコアファイルをローカルにキャッシュ
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

// 起動時に古いキャッシュを掃除
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ② 通信のインターセプト ＆ ヘッダー強制インジェクション
self.addEventListener("fetch", (event) => {
    if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") return;

    event.respondWith(
        // まずネットワークから最新の取得を試み、ダメならローカルキャッシュから返す（PWA化）
        fetch(event.request)
            .catch(() => caches.match(event.request))
            .then((response) => {
                if (!response || response.status === 0) return response;

                // 応答ヘッダーをコピーし、SharedArrayBuffer解放用のヘッダーを注入
                const newHeaders = new Headers(response.headers);
                newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
                newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });
            })
    );
});

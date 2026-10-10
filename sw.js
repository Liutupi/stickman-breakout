// 火柴人：突围行动 · 离线缓存
// 策略：页面 / 脚本 / 样式“联网优先”，保证每次都拿到最新版；断网时用缓存。
// 图片“缓存优先 + 后台更新”。音乐（mp3）按需流式加载，不进缓存。
const CACHE = 'stickman-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './assets/icons/icon-192.png', './assets/title-key-art-guomu.webp'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;                 // 字体等外部资源交给浏览器
    if (req.headers.has('range') || /\.(mp3|m4a|ogg|wav)$/i.test(url.pathname)) return;
    if (/version\.json$/.test(url.pathname)) return;          // 版本检查直连服务器，不进缓存

    const isAsset = /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname);
    if (isAsset) {
        e.respondWith(caches.open(CACHE).then(async cache => {
            const hit = await cache.match(req);
            const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
            return hit || fresh;
        }));
        return;
    }

    // no-cache：每次都向服务器确认是否有新版（有 ETag 时没变化只传很少数据），发布后立刻生效
    e.respondWith(
        fetch(req, { cache: 'no-cache' }).then(res => {
            if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
            return res;
        }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(r => r || caches.match('./index.html')))
    );
});

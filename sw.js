/* ══════════════════════════════════════════════
   J_LAB Public Lite — Service Worker v2.3.0
   GitHub Pages: nahohoon.github.io/jlab-public/
══════════════════════════════════════════════ */
const CACHE_NAME = 'jlab-public-v2.3';
const BASE = '/jlab-public/';

/* 앱 셸 핵심 파일 — 오프라인 기본 제공 */
const CORE_FILES = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'config.js',
  BASE + 'script.js',
  BASE + 'style.css',
  BASE + 'style_additions.css',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  BASE + 'apple-touch-icon.png',
];

/* ── install: 핵심 파일 선캐시 ── */
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(CORE_FILES.map(url =>
        cache.add(url).catch(() => null)          // 개별 실패 무시
      ))
    )
  );
});

/* ── activate: 구버전 캐시 전부 삭제 ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── fetch: Network-First(HTML/JS/CSS) + Cache-First(이미지 등) ── */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* 같은 도메인(GitHub Pages)만 처리 */
  if (url.hostname !== 'nahohoon.github.io') return;

  /* Google Fonts / Apps Script는 캐시하지 않고 네트워크 직통 */
  if (url.hostname.includes('fonts.g') ||
      url.hostname.includes('script.google')) return;

  const isNav = req.mode === 'navigate';
  const isShell = /\.(html|js|css|json)$/.test(url.pathname);

  if (isNav || isShell) {
    /* Network-First: 최신 파일 우선, 실패 시 캐시 폴백 */
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(c => c || caches.match(BASE + 'index.html'))
        )
    );
  } else {
    /* Cache-First: 아이콘·이미지 등 */
    e.respondWith(
      caches.match(req).then(c => {
        if (c) return c;
        return fetch(req).then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(ch => ch.put(req, res.clone()));
          }
          return res;
        });
      })
    );
  }
});

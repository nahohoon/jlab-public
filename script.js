/**
 * J_LAB Public Lite — script.js
 * 일반회원 배포용 (v1.0.0)
 *
 * ══════════════════════════════════════════════════════
 * ★ 보안 정책 ★
 * 이 파일은 일반회원용입니다. 아래 API는 절대 호출하지 않습니다.
 *   - getMembers          (회원 목록)
 *   - getMemberDetail     (회원 상세정보)
 *   - getUnpaidMembers    (미납자 목록)
 *   - updateFeeStatus     (납부 상태 변경)
 *   - getEventAttend      (행사 참석 현황)
 *   - saveEventAttend     (참석/납부 체크)
 *   - getEventAttendSummary (참석 요약)
 *   - getDashboard        (관리자 대시보드 — 회원수/회비정보 포함)
 *
 * 허용 API:
 *   - getNotices          (공지사항)
 *   - getEventList        (행사 목록)
 *   - getSponsorNotices   (찬조 전광판)
 *   - getPhotoGallery     (사진갤러리)
 * ══════════════════════════════════════════════════════
 */

'use strict';

/* ─────────────────────────────────────────
   전역 상태
───────────────────────────────────────── */
const STATE = {
  currentPage: 'dashboard',
  notices: [],
  events: [],
  sponsors: [],
  photos: [],
  photoGroups: [],
  currentPhotoGroup: null,
  currentPhotoIdx: 0,
  allPhotos: [],       // 전체 사진 (모달 탐색용)
  allPhotoIdx: 0,
  loaded: {
    notices: false,
    events: false,
    sponsors: false,
    photos: false
  }
};

/* ─────────────────────────────────────────
   DOM 헬퍼
───────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const cfg = () => window.JLAB_CONFIG || {};

/* ─────────────────────────────────────────
   API 호출 — 공개 함수만
───────────────────────────────────────── */
async function apiCall(action, params = {}) {
  const url = cfg().API_URL;
  if (!url || url.includes('YOUR_SCRIPT_ID')) {
    throw new Error('config.js에서 API_URL을 설정해 주세요.');
  }
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${url}?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* 허용된 공개 API 래퍼 */
const API = {
  getNotices:       () => apiCall('getNotices'),
  getEventList:     () => apiCall('getEventList'),
  getSponsorNotices: () => apiCall('getSponsorNotices'),
  getPhotoGallery:  () => apiCall('getPhotoGallery'),
};

/* ─────────────────────────────────────────
   유틸
───────────────────────────────────────── */
function showToast(msg, type = 'info') {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast-${type} toast-show`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('toast-show'), 3000);
}

function formatDate(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function isActive(val) {
  if (val === undefined || val === null || val === '') return true; // 값 없으면 표시
  const v = String(val).trim().toLowerCase();
  return ['y', 'yes', 'true', '1'].includes(v);
}

/**
 * Google Drive 공유 링크를 썸네일 URL로 변환
 * https://drive.google.com/file/d/파일ID/view?... → https://drive.google.com/thumbnail?id=파일ID&sz=w1200
 */
function driveToThumb(url, size = 'w1200') {
  if (!url) return '';
  // 이미 thumbnail 형식이면 그대로
  if (url.includes('drive.google.com/thumbnail')) return url;
  // /file/d/{ID}/ 형식 추출
  const m = url.match(/\/file\/d\/([^/?#]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=${size}`;
  // open?id={ID} 형식
  const m2 = url.match(/[?&]id=([^&]+)/);
  if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=${size}`;
  return url;
}

/* ─────────────────────────────────────────
   찬조 전광판
───────────────────────────────────────── */
let tickerTimer = null;

function renderTicker(sponsors) {
  const wrap = document.querySelector('.sponsor-ticker-wrap');
  if (!wrap) return;
  const active = sponsors.filter(s => isActive(s.is_active || s['is_active']));
  if (!active.length) {
    wrap.innerHTML = '<div class="ticker-empty">등록된 찬조 감사 문구가 없습니다.</div>';
    return;
  }
  const msgs = active.map(s => s.notice_message || s['notice_message'] || '').filter(Boolean);
  const track = wrap.querySelector('.ticker-track') || document.createElement('div');
  track.className = 'ticker-track';
  // 메시지를 2배로 복사해 무한 스크롤 구현
  track.innerHTML = [...msgs, ...msgs].map(m => `<span class="ticker-item">🎉 ${m}</span>`).join('');
  if (!wrap.contains(track)) wrap.appendChild(track);
  // 애니메이션 리셋
  track.style.animation = 'none';
  requestAnimationFrame(() => {
    track.style.animation = '';
  });
}

/* ─────────────────────────────────────────
   대시보드 렌더
───────────────────────────────────────── */
async function renderDashboard() {
  const el = $('content');
  el.innerHTML = `<div class="pg-loading"><div class="pg-spinner"></div><p class="pg-loading-txt">불러오는 중...</p></div>`;

  // 데이터 병렬 로드
  const [sponsors, notices, events, photos] = await Promise.allSettled([
    STATE.loaded.sponsors ? Promise.resolve(STATE.sponsors) : API.getSponsorNotices(),
    STATE.loaded.notices  ? Promise.resolve(STATE.notices)  : API.getNotices(),
    STATE.loaded.events   ? Promise.resolve(STATE.events)   : API.getEventList(),
    STATE.loaded.photos   ? Promise.resolve(STATE.photos)   : API.getPhotoGallery(),
  ]);

  if (sponsors.status === 'fulfilled') { STATE.sponsors = sponsors.value?.data || sponsors.value || []; STATE.loaded.sponsors = true; }
  if (notices.status === 'fulfilled')  { STATE.notices  = notices.value?.data  || notices.value  || []; STATE.loaded.notices  = true; }
  if (events.status === 'fulfilled')   { STATE.events   = events.value?.data   || events.value   || []; STATE.loaded.events   = true; }
  if (photos.status === 'fulfilled')   { STATE.photos   = photos.value?.data   || photos.value   || []; STATE.loaded.photos   = true; }

  const greeting = cfg().GREETING || '안녕하세요, J_LAB 회원여러분. 화이팅^^';
  const noticeLimit = cfg().NOTICE_LIMIT || 5;

  // 다가오는 행사 (오늘 이후)
  const today = new Date(); today.setHours(0,0,0,0);
  const upcomingEvents = (STATE.events || [])
    .filter(e => {
      const d = new Date(e.event_date || e['행사일'] || e['event_date'] || '');
      return !isNaN(d) && d >= today;
    })
    .sort((a,b) => new Date(a.event_date||a['행사일']||'') - new Date(b.event_date||b['행사일']||''))
    .slice(0, 5);

  // 최근 공지 (notices_master 날짜 역순)
  const recentNotices = [...(STATE.notices || [])]
    .sort((a,b) => new Date(b.reg_date||b['등록일']||b['reg_date']||'') - new Date(a.reg_date||a['등록일']||a['reg_date']||''))
    .slice(0, noticeLimit);

  // 최근 사진 3장 (is_active=Y)
  const activePhotos = (STATE.photos || []).filter(p => isActive(p.is_active || p['is_active']));
  const recentPhotos = activePhotos.slice(0, 3);

  el.innerHTML = `
    <!-- 인사말 -->
    <section class="dash-greeting-section">
      <div class="dash-greeting-card">
        <div class="dash-greeting-icon">👋</div>
        <div class="dash-greeting-text">${greeting}</div>
      </div>
    </section>

    <!-- 찬조 감사 전광판 -->
    <section class="dash-section">
      <div class="dash-section-header">
        <h2 class="dash-section-title">🎉 찬조 감사 전광판</h2>
      </div>
      <div class="sponsor-ticker-wrap">
        <div class="ticker-track"></div>
      </div>
    </section>

    <!-- 최근 공지사항 -->
    <section class="dash-section">
      <div class="dash-section-header">
        <h2 class="dash-section-title">📢 최근 공지사항</h2>
        <button class="dash-more-btn" data-page="notices">전체보기</button>
      </div>
      <div class="dash-notice-list">
        ${recentNotices.length ? recentNotices.map(n => {
          const isImportant = String(n.is_important||n['중요여부']||'').toLowerCase() === 'y';
          const title = n.title || n['제목'] || '';
          const regDate = formatDate(n.reg_date || n['등록일'] || '');
          return `<div class="dash-notice-item" data-notice-id="${n.notice_id||n['공지ID']||''}">
            ${isImportant ? '<span class="badge-important">중요</span>' : ''}
            <span class="notice-title">${title}</span>
            <span class="notice-date">${regDate}</span>
          </div>`;
        }).join('') : '<div class="empty-msg">등록된 공지사항이 없습니다.</div>'}
      </div>
    </section>

    <!-- 다가오는 행사 -->
    <section class="dash-section">
      <div class="dash-section-header">
        <h2 class="dash-section-title">📅 다가오는 행사</h2>
        <button class="dash-more-btn" data-page="events">전체보기</button>
      </div>
      <div class="dash-event-list">
        ${upcomingEvents.length ? upcomingEvents.map(e => {
          const name   = e.event_name || e['행사명'] || '';
          const date   = formatDate(e.event_date || e['행사일'] || '');
          const place  = e.place || e['장소'] || '';
          const fee    = e.fee || e['참가비'] || '';
          const note   = e.note || e['비고'] || '';
          return `<div class="dash-event-item">
            <div class="event-name">${name}</div>
            <div class="event-meta">
              ${date ? `<span>📅 ${date}</span>` : ''}
              ${place ? `<span>📍 ${place}</span>` : ''}
              ${fee ? `<span>💰 ${fee}</span>` : ''}
              ${note ? `<span class="event-note">${note}</span>` : ''}
            </div>
          </div>`;
        }).join('') : '<div class="empty-msg">예정된 행사가 없습니다.</div>'}
      </div>
    </section>

    <!-- 사진갤러리 바로가기 -->
    <section class="dash-section">
      <div class="dash-section-header">
        <h2 class="dash-section-title">📷 사진갤러리</h2>
        <button class="dash-more-btn" data-page="gallery">전체보기</button>
      </div>
      ${recentPhotos.length ? `
      <div class="dash-photo-grid">
        ${recentPhotos.map(p => {
          const imgUrl = driveToThumb(p.photo_url || p['사진URL'] || p['photo_url'] || '', 'w400');
          const caption = p.caption || p['설명'] || p['caption'] || '';
          return `<div class="dash-photo-item">
            <img src="${imgUrl}" alt="${caption}" loading="lazy"
              onerror="this.parentElement.innerHTML='<div class=\\'photo-error\\'>사진을 불러올 수 없습니다.<br>공유 권한을 확인해 주세요.</div>'"/>
          </div>`;
        }).join('')}
      </div>` : `<div class="dash-gallery-btn-wrap">
        <button class="btn btn-outline" data-page="gallery">📷 갤러리 바로가기</button>
      </div>`}
    </section>
  `;

  // 찬조 전광판 렌더
  renderTicker(STATE.sponsors);

  // 공지사항 클릭 이벤트
  el.querySelectorAll('.dash-notice-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.noticeId;
      const notice = STATE.notices.find(n => String(n.notice_id||n['공지ID']||'') === id);
      if (notice) openNoticeModal(notice);
    });
  });

  // 더보기 / 갤러리 바로가기 버튼
  el.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  syncStatus(true);
}

/* ─────────────────────────────────────────
   공지사항 페이지
───────────────────────────────────────── */
async function renderNotices() {
  const el = $('content');
  el.innerHTML = `<div class="pg-loading"><div class="pg-spinner"></div><p class="pg-loading-txt">불러오는 중...</p></div>`;

  if (!STATE.loaded.notices) {
    try {
      const res = await API.getNotices();
      STATE.notices = res?.data || res || [];
      STATE.loaded.notices = true;
    } catch(e) {
      el.innerHTML = `<div class="error-msg">공지사항을 불러오지 못했습니다.<br><small>${e.message}</small></div>`;
      return;
    }
  }

  const sorted = [...STATE.notices].sort((a,b) =>
    new Date(b.reg_date||b['등록일']||'') - new Date(a.reg_date||a['등록일']||'')
  );

  el.innerHTML = `
    <div class="page-header-section">
      <h2 class="page-title-text">📢 공지사항</h2>
    </div>
    <div class="notice-full-list">
      ${sorted.length ? sorted.map(n => {
        const isImportant = String(n.is_important||n['중요여부']||'').toLowerCase() === 'y';
        const title   = n.title || n['제목'] || '';
        const regDate = formatDate(n.reg_date || n['등록일'] || '');
        const content = n.content || n['내용'] || '';
        return `<div class="notice-card" data-notice-id="${n.notice_id||n['공지ID']||''}">
          <div class="notice-card-hdr">
            ${isImportant ? '<span class="badge-important">중요</span>' : ''}
            <span class="notice-card-title">${title}</span>
            <span class="notice-card-date">${regDate}</span>
          </div>
          <div class="notice-card-preview">${String(content).replace(/<[^>]+>/g,'').slice(0,80)}${content.length>80?'…':''}</div>
        </div>`;
      }).join('') : '<div class="empty-msg">등록된 공지사항이 없습니다.</div>'}
    </div>
  `;

  el.querySelectorAll('.notice-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.noticeId;
      const notice = STATE.notices.find(n => String(n.notice_id||n['공지ID']||'') === id);
      if (notice) openNoticeModal(notice);
    });
  });
}

function openNoticeModal(notice) {
  const title   = notice.title || notice['제목'] || '';
  const content = notice.content || notice['내용'] || '';
  const regDate = formatDate(notice.reg_date || notice['등록일'] || '');
  const isImportant = String(notice.is_important || notice['중요여부'] || '').toLowerCase() === 'y';

  $('noticeModalTitle').innerHTML = `${isImportant ? '<span class="badge-important">중요</span> ' : ''}${title}`;
  $('noticeModalBody').innerHTML = `
    <div class="notice-modal-date">📅 ${regDate}</div>
    <div class="notice-modal-content">${content.replace(/\n/g,'<br>')}</div>
  `;
  $('noticeModalOverlay').classList.add('modal-open');
}

function closeNoticeModal() {
  $('noticeModalOverlay').classList.remove('modal-open');
}

/* ─────────────────────────────────────────
   행사안내 페이지
───────────────────────────────────────── */
async function renderEvents() {
  const el = $('content');
  el.innerHTML = `<div class="pg-loading"><div class="pg-spinner"></div><p class="pg-loading-txt">불러오는 중...</p></div>`;

  if (!STATE.loaded.events) {
    try {
      const res = await API.getEventList();
      STATE.events = res?.data || res || [];
      STATE.loaded.events = true;
    } catch(e) {
      el.innerHTML = `<div class="error-msg">행사 정보를 불러오지 못했습니다.<br><small>${e.message}</small></div>`;
      return;
    }
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const sorted = [...STATE.events].sort((a,b) =>
    new Date(a.event_date||a['행사일']||'') - new Date(b.event_date||b['행사일']||'')
  );
  const upcoming = sorted.filter(e => new Date(e.event_date||e['행사일']||'') >= today);
  const past     = sorted.filter(e => new Date(e.event_date||e['행사일']||'') < today).reverse();

  const renderEventCard = (e) => {
    const name   = e.event_name || e['행사명'] || '';
    const date   = formatDate(e.event_date || e['행사일'] || '');
    const place  = e.place || e['장소'] || '';
    const fee    = e.fee || e['참가비'] || '';
    const note   = e.note || e['비고'] || '';
    const isPast = new Date(e.event_date||e['행사일']||'') < today;
    return `<div class="event-card${isPast ? ' event-past' : ''}">
      <div class="event-card-name">${name}${isPast ? ' <span class="badge-past">종료</span>' : ''}</div>
      <div class="event-card-meta">
        ${date  ? `<div class="event-meta-row"><span class="event-meta-icon">📅</span><span>${date}</span></div>` : ''}
        ${place ? `<div class="event-meta-row"><span class="event-meta-icon">📍</span><span>${place}</span></div>` : ''}
        ${fee   ? `<div class="event-meta-row"><span class="event-meta-icon">💰</span><span>${fee}</span></div>` : ''}
        ${note  ? `<div class="event-meta-row"><span class="event-meta-icon">📝</span><span>${note}</span></div>` : ''}
      </div>
    </div>`;
  };

  el.innerHTML = `
    <div class="page-header-section">
      <h2 class="page-title-text">📅 행사안내</h2>
    </div>
    ${upcoming.length ? `
    <div class="event-section-label">예정된 행사 (${upcoming.length}건)</div>
    <div class="event-list">${upcoming.map(renderEventCard).join('')}</div>` : ''}
    ${past.length ? `
    <div class="event-section-label past-label">지난 행사</div>
    <div class="event-list">${past.slice(0,10).map(renderEventCard).join('')}</div>` : ''}
    ${!upcoming.length && !past.length ? '<div class="empty-msg">등록된 행사가 없습니다.</div>' : ''}
  `;
}

/* ─────────────────────────────────────────
   사진갤러리 페이지
───────────────────────────────────────── */
async function renderGallery() {
  const el = $('content');
  el.innerHTML = `<div class="pg-loading"><div class="pg-spinner"></div><p class="pg-loading-txt">불러오는 중...</p></div>`;

  if (!STATE.loaded.photos) {
    try {
      const res = await API.getPhotoGallery();
      STATE.photos = res?.data || res || [];
      STATE.loaded.photos = true;
    } catch(e) {
      el.innerHTML = `<div class="error-msg">갤러리를 불러오지 못했습니다.<br><small>${e.message}</small></div>`;
      return;
    }
  }

  const active = (STATE.photos || []).filter(p => isActive(p.is_active || p['is_active']));
  if (!active.length) {
    el.innerHTML = `<div class="page-header-section"><h2 class="page-title-text">📷 사진갤러리</h2></div><div class="empty-msg">등록된 사진이 없습니다.</div>`;
    return;
  }

  // 날짜별 그룹핑
  const groups = {};
  active.forEach(p => {
    const dateKey = String(p.event_date || p['행사일'] || p['event_date'] || p.upload_date || p['업로드일'] || '기타').slice(0,10);
    if (!groups[dateKey]) groups[dateKey] = { date: dateKey, title: p.event_name||p['행사명']||'', photos: [] };
    groups[dateKey].photos.push(p);
  });
  const sortedGroups = Object.values(groups).sort((a,b) => b.date.localeCompare(a.date));

  // 전체 사진 목록 (모달 탐색용)
  STATE.allPhotos = active;

  el.innerHTML = `
    <div class="page-header-section">
      <h2 class="page-title-text">📷 사진갤러리</h2>
      <span class="gallery-count">${active.length}장</span>
    </div>
    ${sortedGroups.map(g => `
    <div class="gallery-group">
      <div class="gallery-group-header">
        <span class="gallery-group-date">${g.date !== '기타' ? formatDate(g.date) : ''}</span>
        <span class="gallery-group-title">${g.title}</span>
        <span class="gallery-group-count">${g.photos.length}장</span>
      </div>
      <div class="gallery-grid">
        ${g.photos.map((p, gi) => {
          const thumb = driveToThumb(p.photo_url || p['사진URL'] || '', 'w400');
          const fullUrl = driveToThumb(p.photo_url || p['사진URL'] || '', 'w1200');
          const caption = p.caption || p['설명'] || '';
          const globalIdx = STATE.allPhotos.indexOf(p);
          return `<div class="gallery-item" data-idx="${globalIdx}" data-full="${fullUrl}" data-caption="${caption}" data-date="${g.date}" data-title="${g.title || ''}">
            <img src="${thumb}" alt="${caption}" loading="lazy"
              onerror="this.closest('.gallery-item').innerHTML='<div class=\\'photo-error-thumb\\'>사진을 불러올 수 없습니다.<br>공유 권한을 확인해 주세요.</div>'"/>
            ${caption ? `<div class="gallery-caption">${caption}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`).join('')}
  `;

  // 사진 클릭 이벤트
  el.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.idx, 10);
      openPhotoModal(idx);
    });
  });
}

/* ─────────────────────────────────────────
   사진 모달
───────────────────────────────────────── */
function openPhotoModal(idx) {
  STATE.allPhotoIdx = idx;
  showPhotoInModal(idx);
  $('photoModalOverlay').classList.add('modal-open');
  document.body.classList.add('modal-body-lock');
}

function showPhotoInModal(idx) {
  const photos = STATE.allPhotos;
  if (!photos || !photos.length) return;
  const p = photos[idx];
  const fullUrl = driveToThumb(p.photo_url || p['사진URL'] || '', 'w1200');
  const caption = p.caption || p['설명'] || '';
  const dateKey = String(p.event_date || p['행사일'] || p.upload_date || '').slice(0,10);
  const title   = p.event_name || p['행사명'] || '';

  const imgEl = $('photoModalImg');
  imgEl.src = '';
  imgEl.alt = caption;
  imgEl.src = fullUrl;
  imgEl.onerror = () => { imgEl.style.display='none'; };
  imgEl.onload  = () => { imgEl.style.display=''; };

  $('photoModalTitle').textContent = title;
  $('photoModalCaption').textContent = caption;
  $('photoModalDate').textContent = dateKey ? formatDate(dateKey) : '';
  $('photoModalCount').textContent = `${idx + 1} / ${photos.length}`;
}

function closePhotoModal() {
  $('photoModalOverlay').classList.remove('modal-open');
  document.body.classList.remove('modal-body-lock');
}

function photoModalPrev() {
  if (!STATE.allPhotos.length) return;
  STATE.allPhotoIdx = (STATE.allPhotoIdx - 1 + STATE.allPhotos.length) % STATE.allPhotos.length;
  showPhotoInModal(STATE.allPhotoIdx);
}

function photoModalNext() {
  if (!STATE.allPhotos.length) return;
  STATE.allPhotoIdx = (STATE.allPhotoIdx + 1) % STATE.allPhotos.length;
  showPhotoInModal(STATE.allPhotoIdx);
}

/* ─────────────────────────────────────────
   네비게이션
───────────────────────────────────────── */
function navigateTo(page) {
  STATE.currentPage = page;

  // 사이드바 active
  document.querySelectorAll('.nav-item, .bnav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // 헤더 타이틀
  const titles = { dashboard: '대시보드', notices: '공지사항', events: '행사안내', gallery: '사진갤러리' };
  const bcs    = { dashboard: '홈 / 대시보드', notices: '홈 / 공지사항', events: '홈 / 행사안내', gallery: '홈 / 사진갤러리' };
  const titleEl = $('pageTitle'), bcEl = $('pageBc');
  if (titleEl) titleEl.textContent = titles[page] || page;
  if (bcEl)    bcEl.textContent    = bcs[page] || '';

  // 사이드바 닫기 (모바일)
  closeSidebar();

  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'notices':   renderNotices();   break;
    case 'events':    renderEvents();    break;
    case 'gallery':   renderGallery();   break;
  }
}

/* ─────────────────────────────────────────
   사이드바
───────────────────────────────────────── */
function openSidebar() {
  $('sidebar').classList.add('sidebar-open');
  $('sidebarOverlay').classList.add('overlay-show');
}
function closeSidebar() {
  $('sidebar').classList.remove('sidebar-open');
  $('sidebarOverlay').classList.remove('overlay-show');
}
function toggleSidebar() {
  $('sidebar').classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
}

/* ─────────────────────────────────────────
   동기화 상태 표시
───────────────────────────────────────── */
function syncStatus(ok) {
  const dot  = document.querySelector('.sync-dot');
  const text = $('syncText');
  if (!dot || !text) return;
  if (ok) {
    dot.style.background = '#22c55e';
    text.textContent = '연결됨';
  } else {
    dot.style.background = '#ef4444';
    text.textContent = '연결 실패';
  }
}

/* ─────────────────────────────────────────
   이벤트 바인딩
───────────────────────────────────────── */
function bindEvents() {
  // 메뉴 토글
  const menuToggle = $('menuToggle');
  if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);

  // 사이드바 오버레이 클릭
  const overlay = $('sidebarOverlay');
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // 새로고침
  const btnRefresh = $('btnRefresh');
  if (btnRefresh) btnRefresh.addEventListener('click', () => {
    STATE.loaded = { notices: false, events: false, sponsors: false, photos: false };
    navigateTo(STATE.currentPage);
    showToast('새로고침 완료');
  });

  // 사이드바 / 하단 탭 네비게이션
  document.querySelectorAll('.nav-item, .bnav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // 사진 모달 닫기
  const photoClose = $('photoModalClose');
  if (photoClose) photoClose.addEventListener('click', closePhotoModal);
  const photoOverlay = $('photoModalOverlay');
  if (photoOverlay) photoOverlay.addEventListener('click', (e) => {
    if (e.target === photoOverlay) closePhotoModal();
  });

  // 사진 이전/다음
  const prevBtn = $('photoModalPrev');
  const nextBtn = $('photoModalNext');
  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); photoModalPrev(); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); photoModalNext(); });

  // 키보드
  document.addEventListener('keydown', (e) => {
    if ($('photoModalOverlay').classList.contains('modal-open')) {
      if (e.key === 'ArrowLeft')  { photoModalPrev(); }
      if (e.key === 'ArrowRight') { photoModalNext(); }
      if (e.key === 'Escape')     { closePhotoModal(); }
    }
    if ($('noticeModalOverlay').classList.contains('modal-open')) {
      if (e.key === 'Escape') closeNoticeModal();
    }
  });

  // 공지 모달 닫기
  const noticeClose = $('noticeModalClose');
  if (noticeClose) noticeClose.addEventListener('click', closeNoticeModal);
  const noticeOverlay = $('noticeModalOverlay');
  if (noticeOverlay) noticeOverlay.addEventListener('click', (e) => {
    if (e.target === noticeOverlay) closeNoticeModal();
  });

  // 스와이프 (터치)
  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX;
    if ($('photoModalOverlay').classList.contains('modal-open')) {
      if (diff > 60)  photoModalPrev();
      if (diff < -60) photoModalNext();
    }
  }, { passive: true });

  // 브랜드 정보 반영
  const c = cfg();
  const brandName = document.getElementById('brandOrgName');
  const brandSub  = document.getElementById('brandOrgSub');
  const headerPill = document.getElementById('headerOrgPill');
  if (brandName && c.ORG_NAME) brandName.textContent = c.ORG_NAME;
  if (brandSub  && c.ORG_SUB)  brandSub.textContent  = c.ORG_SUB;
  if (headerPill && c.ORG_NAME) headerPill.textContent = c.ORG_NAME;
}

/* ─────────────────────────────────────────
   PWA Service Worker 등록
───────────────────────────────────────── */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('[J_LAB Public] SW 등록 완료'))
      .catch((e) => console.warn('[J_LAB Public] SW 등록 실패:', e));
  }
}

/* ─────────────────────────────────────────
   초기화
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const c = cfg();
  if (!c.API_URL || c.API_URL.includes('YOUR_SCRIPT_ID')) {
    $('content').innerHTML = `
      <div style="padding:40px 20px;text-align:center">
        <div style="font-size:2rem;margin-bottom:12px">⚙️</div>
        <div style="font-weight:700;font-size:1.1rem;color:#0a1628;margin-bottom:8px">API URL 설정이 필요합니다</div>
        <div style="font-size:.9rem;color:#64748b">config.js 파일에서 <strong>API_URL</strong>을 Apps Script 배포 URL로 변경해 주세요.</div>
      </div>`;
    syncStatus(false);
    return;
  }

  bindEvents();
  registerSW();
  navigateTo('dashboard');
});

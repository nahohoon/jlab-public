/**
 * J_LAB Public Lite — script.js v2.0.0
 * 일반회원 배포용 (관리자용 jlab-members 디자인 기반)
 *
 * ★ 보안 정책: 아래 API는 절대 호출하지 않음
 *   금지: getMembers, getMemberDetail, getDashboard,
 *         getUnpaidMembers, getFeeHistory, updateFeeStatus,
 *         getEventAttend, getEventAttendSummary, saveEventAttend,
 *         getEventAttendV2, saveEventAttendV2
 *
 * ★ 허용 API: getNotices, getEventList, getSponsorNotices, getPhotoGallery
 *
 * ★ 응답 형식 자동인식 (pickRows 함수로 통합 처리)
 */
'use strict';

/* ─── 전역 상태 ─── */
const S = {
  page: 'dashboard',
  notices: [], events: [], sponsors: [], photos: [],
  allPhotos: [], photoIdx: 0,
  loaded: { notices: false, events: false, sponsors: false, photos: false }
};

/* ─── DOM 헬퍼 ─── */
const $  = id => document.getElementById(id);
const cfg = () => window.JLAB_CONFIG || {};

/* ─── 응답 키 자동인식 ─── */
function pickRows(res, key) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res[key])) return res[key];
  // 객체 내 배열 키 자동 탐색
  for (const k of Object.keys(res)) {
    if (Array.isArray(res[k]) && res[k].length >= 0) return res[k];
  }
  return [];
}

/* ─── API 호출 (허용된 공개 함수만) ─── */
async function apiCall(action) {
  const url = cfg().API_URL;
  if (!url || url.includes('YOUR_SCRIPT_ID')) throw new Error('API_URL 미설정');
  const r = await fetch(`${url}?action=${action}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* 공개 API 래퍼 — 금지 API는 이 파일에 존재하지 않음 */
const API = {
  notices:  () => apiCall('getNotices'),
  events:   () => apiCall('getEventList'),
  sponsors: () => apiCall('getSponsorNotices'),
  photos:   () => apiCall('getPhotoGallery'),
};

/* ─── 유틸 ─── */

/**
 * 한국어 날짜 문자열을 포함한 다양한 형식의 날짜를 Date 객체로 변환
 * 지원 형식: "2026년 5월 14일", "2026-05-14", "2026/05/14", Date 객체 등
 */
function parseEventDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  const str = String(value).trim();
  // 한국어 날짜: "2026년 5월 14일"
  const m = str.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // 일반 날짜 문자열
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

/** 날짜를 YYYY.MM.DD 형식으로 포맷 (한국어 날짜 포함) */
function fmt(v) {
  if (!v) return '';
  const d = parseEventDate(v);
  if (!d) return String(v);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}
function isActive(v) {
  if (v === undefined || v === null || v === '') return true;
  return ['y','yes','true','1'].includes(String(v).trim().toLowerCase());
}
function driveThumb(url, sz='w1200') {
  if (!url) return '';
  if (url.includes('drive.google.com/thumbnail')) return url;
  const m = url.match(/\/file\/d\/([^/?#]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=${sz}`;
  const m2 = url.match(/[?&]id=([^&]+)/);
  if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=${sz}`;
  return url;
}
function get(obj, ...keys) {
  for (const k of keys) { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]; }
  return '';
}
function showToast(msg, type='info') {
  const el = $('toast'); if (!el) return;
  el.textContent = msg;
  el.className = `toast-${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(()=>el.classList.remove('show'), 3000);
}

/* ─── 데이터 로드 헬퍼 ─── */
async function ensure(key, apiKey, apiFn) {
  if (S.loaded[key]) return;
  const res = await apiFn();
  S[key] = pickRows(res, apiKey);
  S.loaded[key] = true;
}

/* ════════════════════════════════════════
   대시보드
════════════════════════════════════════ */
async function renderDashboard() {
  const el = $('content');
  el.innerHTML = `<div class="pg-loading"><div class="pg-spinner"></div><p class="pg-loading-txt">불러오는 중...</p></div>`;

  try {
    await Promise.allSettled([
      ensure('sponsors','sponsors', API.sponsors),
      ensure('notices', 'notices',  API.notices),
      ensure('events',  'events',   API.events),
      ensure('photos',  'photos',   API.photos),
    ]);
  } catch(e) { /* 부분 실패 허용 */ }

  const greetLine1 = cfg().GREETING_L1 || '안녕하세요,';
  const greetLine2 = cfg().GREETING_L2 || `${cfg().ORG_NAME||'J_LAB'} 회원 여러분`;
  const greetLine3 = cfg().GREETING_L3 || '오늘도 화이팅입니다^^';
  const noticeLimit = cfg().NOTICE_LIMIT || 5;

  // 다가오는 행사 — parseEventDate()로 한국어 날짜 형식 포함 처리
  const today = new Date(); today.setHours(0,0,0,0);
  const upcomingEvt = (S.events||[])
    .map(e=>({...e, _d: parseEventDate(get(e,'event_date','date','행사일','행사일자','이벤트일'))}))
    .filter(e=> e._d !== null && e._d >= today)
    .sort((a,b)=>a._d-b._d).slice(0,5);

  // 최근 공지
  const recentNotices = [...(S.notices||[])]
    .sort((a,b)=> new Date(get(b,'reg_date','등록일','created_at','date')||0) - new Date(get(a,'reg_date','등록일','created_at','date')||0))
    .slice(0, noticeLimit);

  // 활성 사진 (최근 4장 — 썸네일 미리보기용)
  const activePhotos = (S.photos||[]).filter(p=>isActive(get(p,'is_active','활성','active'))).slice(0,4);

  // 활성 찬조
  const activeSponsors = (S.sponsors||[]).filter(s=>isActive(get(s,'is_active','활성','active')));

  el.innerHTML = `
<div class="dash-page">

  <!-- 인사말 -->
  <div class="dash-greeting">
    <div class="dash-greeting-inner">
      <div class="dash-greeting-icon">👋</div>
      <div class="dash-greeting-text-wrap">
        <div class="dash-greeting-lines">
          <div class="greet-line greet-line-1">${greetLine1}</div>
          <div class="greet-line greet-line-2">${greetLine2}</div>
          <div class="greet-line greet-line-3">${greetLine3}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 찬조 감사 전광판 -->
  ${activeSponsors.length ? `
  <div class="ticker-wrap" id="sponsorTickerWrap">
    <div class="ticker-label">🎉 찬조</div>
    <div class="ticker-track">
      <div class="ticker-text" id="tickerText"></div>
    </div>
  </div>` : ''}

  <!-- PC 2열 중단: 공지 + 행사 -->
  <div class="dash-mid-grid">

    <!-- 최근 공지사항 -->
    <div class="dash-sec">
      <div class="dash-sec-hdr">
        <span class="dash-sec-lbl">📢 최근 공지사항</span>
        <button class="dash-more" data-page="notices">전체보기 →</button>
      </div>
      <div class="notice-list">
        ${recentNotices.length ? recentNotices.map(n=>{
          const title   = get(n,'title','제목','공지제목');
          const body    = get(n,'content','내용','body','text');
          const regDate = fmt(get(n,'reg_date','등록일','created_at','date'));
          const isImp   = String(get(n,'is_important','중요여부','important')||'').toLowerCase()==='y';
          const id      = get(n,'notice_id','id','공지ID');
          const preview = String(body||'').replace(/<[^>]+>/g,'').trim();
          return `<div class="notice-item" data-nid="${id}" style="cursor:pointer">
            <div class="notice-block">
              ${isImp?'<span class="notice-badge badge-imp">중요</span>':''}
              <span class="notice-title">${title}</span>
              ${preview?`<span class="notice-preview">${preview}</span>`:''}
              <span class="notice-date">${regDate}</span>
            </div>
          </div>`;
        }).join('') : '<div class="empty-row">등록된 공지사항이 없습니다.</div>'}
      </div>
    </div>

    <!-- 다가오는 행사 -->
    <div class="dash-sec">
      <div class="dash-sec-hdr">
        <span class="dash-sec-lbl">📅 다가오는 행사</span>
        <button class="dash-more" data-page="events">전체보기 →</button>
      </div>
      ${upcomingEvt.length ? `<div class="event-cards">
        ${upcomingEvt.map(e=>{
          const name  = get(e,'event_name','name','행사명','이벤트명');
          const date  = fmt(get(e,'event_date','date','행사일','행사일자','이벤트일'));
          const place = get(e,'place','venue','장소','location');
          const fee   = get(e,'fee','참가비','amount','participation_fee');
          const note  = get(e,'note','비고','memo','remarks');
          return `<div class="event-card pub-event-card">
            <div class="pub-event-name">${name}</div>
            <div class="pub-event-meta">
              ${date  ?`<span>📅 ${date}</span>`:''}
              ${place ?`<span>📍 ${place}</span>`:''}
              ${fee   ?`<span>💰 ${fee}</span>`:''}
              ${note  ?`<span>📝 ${note}</span>`:''}
            </div>
          </div>`;
        }).join('')}
      </div>` : '<div class="empty-row">예정된 행사가 없습니다.</div>'}
    </div>

  </div><!-- /.dash-mid-grid -->

  <!-- 사진갤러리 미리보기 -->
  <div class="dash-sec">
    <div class="dash-sec-hdr">
      <span class="dash-sec-lbl">📷 사진갤러리</span>
      <button class="dash-more" data-page="gallery">전체보기 →</button>
    </div>
    ${activePhotos.length ? `
    <div class="dash-photo-grid">
      ${activePhotos.map((p,i)=>{
        const thumb = driveThumb(get(p,'photo_url','사진URL','image_url','url'),'w400');
        const cap   = get(p,'caption','설명','title','photo_title');
        return `<div class="dash-photo-card" data-gidx="${i}">
          <img src="${thumb}" alt="${cap}" loading="lazy"
            onerror="this.closest('.dash-photo-card').classList.add('img-err');this.style.display='none'"/>
          <div class="img-err-msg"><span>사진을 불러올 수 없습니다.<br><small>공유 권한 확인</small></span></div>
        </div>`;
      }).join('')}
    </div>` : `<div class="dash-gallery-cta"><button class="btn btn-outline btn-sm" data-page="gallery">📷 갤러리 보러가기</button></div>`}
  </div>

</div>`;

  // 찬조 전광판 설정
  if (activeSponsors.length) {
    const msgs = activeSponsors.map(s=>get(s,'notice_message','문구','message','content','sponsor_message')).filter(Boolean);
    startTicker(msgs);
  }

  // 이벤트 연결
  el.querySelectorAll('[data-nid]').forEach(el2=>{
    el2.addEventListener('click',()=>{
      const n = S.notices.find(x=>String(get(x,'notice_id','id','공지ID'))===el2.dataset.nid);
      if(n) openNoticeModal(n);
    });
  });
  // 대시보드 사진 클릭 → 사진갤러리 이동
  el.querySelectorAll('.dash-photo-card[data-gidx]').forEach(card=>{
    card.addEventListener('click',()=>navigateTo('gallery'));
  });
  el.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigateTo(b.dataset.page)));

  setSyncOk(true);
}

/* ─── 찬조 전광판 ─── */
let _tickerRaf = null;
function startTicker(msgs) {
  const tickerEl = $('tickerText'); if(!tickerEl) return;
  const full = [...msgs,...msgs].map(m=>`🎉 ${m}`).join('   ✦   ');
  tickerEl.textContent = full;
  tickerEl.style.transform = 'translateX(0)';
  let pos = 0;
  const halfW = tickerEl.scrollWidth / 2;
  function step() {
    pos -= 0.6;
    if (Math.abs(pos) >= halfW) pos = 0;
    tickerEl.style.transform = `translateX(${pos}px)`;
    _tickerRaf = requestAnimationFrame(step);
  }
  if(_tickerRaf) cancelAnimationFrame(_tickerRaf);
  _tickerRaf = requestAnimationFrame(step);
}

/* ════════════════════════════════════════
   공지사항 페이지
════════════════════════════════════════ */
async function renderNotices() {
  const el = $('content');
  el.innerHTML = `<div class="pg-loading"><div class="pg-spinner"></div></div>`;
  try { await ensure('notices','notices',API.notices); } catch(e) {
    el.innerHTML = `<div class="empty-row error-row">공지사항 로드 실패: ${e.message}</div>`; return;
  }
  const sorted = [...S.notices].sort((a,b)=>
    new Date(get(b,'reg_date','등록일','created_at','date')||0) - new Date(get(a,'reg_date','등록일','created_at','date')||0));

  el.innerHTML = `
<div class="pg-header">
  <h2 class="pg-title">📢 공지사항</h2>
  <span class="pg-count">${sorted.length}건</span>
</div>
<div class="notice-list">
  ${sorted.length ? sorted.map(n=>{
    const title   = get(n,'title','제목','공지제목');
    const body    = get(n,'content','내용','body','text');
    const regDate = fmt(get(n,'reg_date','등록일','created_at','date'));
    const isImp   = String(get(n,'is_important','중요여부','important')||'').toLowerCase()==='y';
    const id      = get(n,'notice_id','id','공지ID');
    const preview = String(body||'').replace(/<[^>]+>/g,'').slice(0,80);
    return `<div class="notice-item notice-item-full" data-nid="${id}" style="cursor:pointer">
      <div class="notice-block">
        ${isImp?'<span class="notice-badge badge-imp">중요</span>':''}
        <span class="notice-title">${title}</span>
        <span class="notice-body">${preview}${body&&body.length>80?'…':''}</span>
        <span class="notice-date">${regDate}</span>
      </div>
    </div>`;
  }).join('') : '<div class="empty-row">등록된 공지사항이 없습니다.</div>'}
</div>`;

  el.querySelectorAll('[data-nid]').forEach(card=>{
    card.addEventListener('click',()=>{
      const n = S.notices.find(x=>String(get(x,'notice_id','id','공지ID'))===card.dataset.nid);
      if(n) openNoticeModal(n);
    });
  });
}

/* ─── 공지 상세 모달 ─── */
function openNoticeModal(n) {
  const title   = get(n,'title','제목','공지제목');
  const body    = get(n,'content','내용','body','text');
  const regDate = fmt(get(n,'reg_date','등록일','created_at','date'));
  const isImp   = String(get(n,'is_important','중요여부','important')||'').toLowerCase()==='y';
  $('nmTitle').innerHTML = `${isImp?'<span class="notice-badge badge-imp">중요</span> ':''}${title}`;
  $('nmMeta').textContent = `📅 ${regDate}`;
  $('nmBody').innerHTML = `<div class="nm-content">${String(body||'').replace(/\n/g,'<br>')}</div>`;
  $('noticeModalOverlay').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeNoticeModal() {
  $('noticeModalOverlay').classList.remove('open');
  document.body.style.overflow='';
}

/* ════════════════════════════════════════
   행사안내 페이지
════════════════════════════════════════ */
async function renderEvents() {
  const el = $('content');
  el.innerHTML = `<div class="pg-loading"><div class="pg-spinner"></div></div>`;
  try { await ensure('events','events',API.events); } catch(e) {
    el.innerHTML = `<div class="empty-row error-row">행사 정보 로드 실패: ${e.message}</div>`; return;
  }
  const today = new Date(); today.setHours(0,0,0,0);
  // parseEventDate()로 한국어 날짜 형식 포함 처리
  const allEvt = (S.events||[]).map(e=>({...e, _d: parseEventDate(get(e,'event_date','date','행사일','행사일자','이벤트일'))}));
  const upcoming = allEvt.filter(e=> e._d !== null && e._d >= today).sort((a,b)=>a._d-b._d);
  const past     = allEvt.filter(e=> e._d !== null && e._d <  today).sort((a,b)=>b._d-a._d).slice(0,10);

  const cardHTML = (e, isPast=false) => {
    const name  = get(e,'event_name','name','행사명','이벤트명');
    const date  = fmt(get(e,'event_date','date','행사일','행사일자','이벤트일'));
    const place = get(e,'place','venue','장소','location');
    const fee   = get(e,'fee','참가비','amount','participation_fee');
    const note  = get(e,'note','비고','memo','remarks');
    return `<div class="event-card pub-event-card${isPast?' event-past':''}">
      <div class="pub-event-name">${name}${isPast?'<span class="badge-past">종료</span>':''}</div>
      <div class="pub-event-meta">
        ${date  ?`<span>📅 ${date}</span>`:''}
        ${place ?`<span>📍 ${place}</span>`:''}
        ${fee   ?`<span>💰 ${fee}</span>`:''}
        ${note  ?`<span>📝 ${note}</span>`:''}
      </div>
    </div>`;
  };

  el.innerHTML = `
<div class="pg-header">
  <h2 class="pg-title">📅 행사안내</h2>
  <span class="pg-count">${(S.events||[]).length}건</span>
</div>
${upcoming.length?`<div class="sec-label sec-upcoming">예정 행사 (${upcoming.length}건)</div><div class="event-cards">${upcoming.map(e=>cardHTML(e,false)).join('')}</div>`:''}
${past.length?`<div class="sec-label sec-past" style="margin-top:24px">지난 행사</div><div class="event-cards">${past.map(e=>cardHTML(e,true)).join('')}</div>`:''}
${!upcoming.length&&!past.length?'<div class="empty-row">등록된 행사가 없습니다.</div>':''}
`;
}

/* ════════════════════════════════════════
   사진갤러리 페이지
════════════════════════════════════════ */
async function renderGallery() {
  const el = $('content');
  el.innerHTML = `<div class="pg-loading"><div class="pg-spinner"></div></div>`;
  try { await ensure('photos','photos',API.photos); } catch(e) {
    el.innerHTML = `<div class="empty-row error-row">갤러리 로드 실패: ${e.message}</div>`; return;
  }
  const active = (S.photos||[]).filter(p=>isActive(get(p,'is_active','활성','active')));
  if(!active.length){ el.innerHTML=`<div class="pg-header"><h2 class="pg-title">📷 사진갤러리</h2></div><div class="empty-row">등록된 사진이 없습니다.</div>`; return; }

  // 날짜별 그룹핑
  const groups = {};
  active.forEach(p=>{
    const dateKey = String(get(p,'event_date','행사일','upload_date','업로드일','date','created_at')||'기타').slice(0,10);
    const eventName = get(p,'event_name','행사명','event','album','album_name')||'';
    if(!groups[dateKey]) groups[dateKey]={date:dateKey, title:eventName, photos:[]};
    groups[dateKey].photos.push(p);
  });
  const sortedGroups = Object.values(groups).sort((a,b)=>b.date.localeCompare(a.date));

  S.allPhotos = active;

  el.innerHTML = `
<div class="pg-header">
  <h2 class="pg-title">📷 사진갤러리</h2>
  <span class="pg-count">${active.length}장</span>
</div>
<div class="gallery-page">
  ${sortedGroups.map(g=>`
  <div class="gal-date-group">
    <div class="gal-date-label">
      ${g.date!=='기타'?fmt(g.date):''}
      ${g.title?`<span style="font-weight:500;color:var(--n700)">${g.title}</span>`:''}
      <span class="gal-date-count">${g.photos.length}장</span>
    </div>
    <div class="event-photo-grid gal-grid">
      ${g.photos.map(p=>{
        const thumb = driveThumb(get(p,'photo_url','사진URL','image_url','url'),'w400');
        const full  = driveThumb(get(p,'photo_url','사진URL','image_url','url'),'w1200');
        const cap   = get(p,'caption','설명','title','photo_title');
        const idx   = S.allPhotos.indexOf(p);
        return `<div class="event-photo-card" data-gidx="${idx}">
          <div class="event-photo-img-wrap">
            <img class="event-photo-img" src="${thumb}" alt="${cap}" loading="lazy"
              onerror="this.closest('.event-photo-img-wrap').classList.add('img-error');this.style.display='none'"/>
            <div class="ep-overlay"><span class="ep-zoom-icon">🔍</span></div>
            <div class="img-error-msg">사진을 불러올 수 없습니다.<br><span>공유 권한을 확인해 주세요.</span></div>
          </div>
          ${cap?`<div class="event-photo-caption">${cap}</div>`:''}
          ${g.date!=='기타'?`<div class="event-photo-date">${fmt(g.date)}</div>`:''}
        </div>`;
      }).join('')}
    </div>
  </div>`).join('')}
</div>`;

  el.querySelectorAll('[data-gidx]').forEach(card=>{
    card.addEventListener('click',()=>openPhotoModal(parseInt(card.dataset.gidx,10)));
  });
}

/* ─── 사진 모달 ─── */
function openPhotoModal(idx) {
  S.photoIdx = idx;
  _showPhoto(idx);
  $('photoModalOverlay').classList.add('open');
  document.body.style.overflow='hidden';
}
function _showPhoto(idx) {
  const p = S.allPhotos[idx]; if(!p) return;
  const full  = driveThumb(get(p,'photo_url','사진URL','image_url','url'),'w1200');
  const cap   = get(p,'caption','설명','title','photo_title');
  const title = get(p,'event_name','행사명','event','album','album_name');
  const date  = fmt(get(p,'event_date','행사일','upload_date','업로드일','date','created_at'));
  const img = $('photoModalImg');
  img.style.opacity='0'; img.src=''; img.src=full;
  img.onload = ()=>{img.style.opacity='1';};
  img.onerror = ()=>{img.style.opacity='0.3';};
  $('photoModalTitle').textContent   = title;
  $('photoModalCaption').textContent = cap;
  $('photoModalDate').textContent    = date;
  $('photoModalCount').textContent   = `${idx+1} / ${S.allPhotos.length}`;
}
function closePhotoModal() {
  $('photoModalOverlay').classList.remove('open');
  document.body.style.overflow='';
}
function photoNav(dir) {
  const len = S.allPhotos.length; if(!len) return;
  S.photoIdx = (S.photoIdx + dir + len) % len;
  _showPhoto(S.photoIdx);
}

/* ════════════════════════════════════════
   네비게이션
════════════════════════════════════════ */
const PAGE_META = {
  dashboard: { title:'대시보드',   bc:'홈 / 대시보드'   },
  notices:   { title:'공지사항',   bc:'홈 / 공지사항'   },
  events:    { title:'행사안내',   bc:'홈 / 행사안내'   },
  gallery:   { title:'사진갤러리', bc:'홈 / 사진갤러리' },
};
function navigateTo(page) {
  if(!PAGE_META[page]) return;
  S.page = page;
  // 네비 active
  document.querySelectorAll('.nav-item,.bnav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  // 헤더
  const m = PAGE_META[page];
  $('pageTitle').textContent = m.title;
  $('pageBc').textContent    = m.bc;
  // 사이드바 닫기
  closeSidebar();
  // 전광판 정리
  if(page!=='dashboard' && _tickerRaf) { cancelAnimationFrame(_tickerRaf); _tickerRaf=null; }
  // 렌더
  ({dashboard:renderDashboard,notices:renderNotices,events:renderEvents,gallery:renderGallery})[page]();
}

/* ─── 사이드바 ─── */
function openSidebar()  { $('sidebar').classList.add('open');  $('sidebarOverlay').classList.add('show'); }
function closeSidebar() { $('sidebar').classList.remove('open');$('sidebarOverlay').classList.remove('show'); }

/* ─── 동기화 상태 ─── */
function setSyncOk(ok) {
  const dot=$('syncDot'), txt=$('syncText');
  if(!dot||!txt) return;
  dot.style.background = ok ? '#22c55e' : '#ef4444';
  txt.textContent = ok ? '연결됨' : '연결 실패';
}

/* ─── 이벤트 바인딩 ─── */
function bindAll() {
  $('menuToggle').addEventListener('click', ()=> $('sidebar').classList.contains('open')?closeSidebar():openSidebar());
  $('sidebarOverlay').addEventListener('click', closeSidebar);
  $('btnRefresh').addEventListener('click', ()=>{
    S.loaded={notices:false,events:false,sponsors:false,photos:false};
    navigateTo(S.page); showToast('새로고침 완료','success');
  });

  // 네비
  document.querySelectorAll('.nav-item,.bnav-item').forEach(b=>b.addEventListener('click',()=>navigateTo(b.dataset.page)));

  // 공지 모달
  $('nmClose').addEventListener('click', closeNoticeModal);
  $('noticeModalOverlay').addEventListener('click',e=>{if(e.target===$('noticeModalOverlay'))closeNoticeModal();});

  // 사진 모달
  $('photoModalClose').addEventListener('click', closePhotoModal);
  $('photoModalPrev').addEventListener('click', e=>{e.stopPropagation();photoNav(-1);});
  $('photoModalNext').addEventListener('click', e=>{e.stopPropagation();photoNav(1);});
  $('photoModalOverlay').addEventListener('click',e=>{if(e.target===$('photoModalOverlay'))closePhotoModal();});

  // 키보드
  document.addEventListener('keydown',e=>{
    if($('photoModalOverlay').classList.contains('open')){
      if(e.key==='ArrowLeft')photoNav(-1);
      if(e.key==='ArrowRight')photoNav(1);
      if(e.key==='Escape')closePhotoModal();
    }
    if($('noticeModalOverlay').classList.contains('open')&&e.key==='Escape')closeNoticeModal();
  });

  // 터치 스와이프
  let tx=0;
  document.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;},{passive:true});
  document.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-tx;
    if($('photoModalOverlay').classList.contains('open')){
      if(dx>60)photoNav(-1); if(dx<-60)photoNav(1);
    }
  },{passive:true});

  // 브랜드 정보
  const c=cfg();
  if(c.ORG_NAME){ ['brandOrgName','headerOrgPill'].forEach(id=>{const e=$( id);if(e)e.textContent=c.ORG_NAME;}); }
  if(c.ORG_SUB){ const e=$('brandOrgSub');if(e)e.textContent=c.ORG_SUB; }
  if(c.VERSION){ const e=$('versionBadge');if(e)e.textContent='v'+c.VERSION; }
}

/* ─── PWA 서비스워커 등록 ─── */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('[J_LAB Public] SW 등록 완료', reg.scope);
      })
      .catch(e => console.warn('[J_LAB Public] SW 등록 실패', e));
  }
}

/* ─── PWA 설치 버튼 제어 ─── */
let _deferredPrompt = null;   // beforeinstallprompt 이벤트 보관
const PWA_DISMISS_KEY = 'jlab_pwa_banner_dismissed';

function _showInstallButtons() {
  ['pwaInstallBtn','pwaInstallHeader','pwaInstallSidebar'].forEach(id => {
    const el = $(id); if (el) el.style.display = '';
  });
  const banner = $('pwaInstallBanner');
  if (banner && !sessionStorage.getItem(PWA_DISMISS_KEY)) {
    banner.style.display = '';
    banner.classList.add('pwa-banner-show');
  }
}
function _hideInstallButtons() {
  ['pwaInstallBtn','pwaInstallHeader','pwaInstallSidebar'].forEach(id => {
    const el = $(id); if (el) el.style.display = 'none';
  });
  const banner = $('pwaInstallBanner');
  if (banner) { banner.style.display = 'none'; banner.classList.remove('pwa-banner-show'); }
}

function initPWA() {
  /* ① Android/Chrome — beforeinstallprompt 이벤트 수신 */
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredPrompt = e;
    _showInstallButtons();
  });

  /* ② 설치 완료 시 버튼 숨김 */
  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    _hideInstallButtons();
    showToast('📲 J_LAB 앱이 홈 화면에 추가되었습니다!');
  });

  /* ③ 설치 버튼 클릭 핸들러 공통 */
  async function doInstall() {
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    if (outcome === 'accepted') { _deferredPrompt = null; _hideInstallButtons(); }
  }

  /* ④ 각 버튼 이벤트 바인딩 */
  ['pwaInstallBtn','pwaInstallHeader','pwaInstallSidebar'].forEach(id => {
    const el = $(id); if (el) el.addEventListener('click', doInstall);
  });

  /* ⑤ 배너 닫기 버튼 */
  const bannerClose = $('pwaInstallClose');
  if (bannerClose) bannerClose.addEventListener('click', () => {
    sessionStorage.setItem(PWA_DISMISS_KEY, '1');
    _hideInstallButtons();
  });

  /* ⑥ iOS Safari — beforeinstallprompt 미지원 시 수동 안내 배너 */
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandalone = window.navigator.standalone === true ||
                          window.matchMedia('(display-mode: standalone)').matches;
  const manualBanner = $('pwaManualBanner');

  if (isIOS && !isInStandalone && manualBanner) {
    if (!sessionStorage.getItem(PWA_DISMISS_KEY + '_ios')) {
      manualBanner.style.display = '';
      manualBanner.classList.add('pwa-banner-show');
    }
  }

  const manualClose = $('pwaManualClose');
  if (manualClose) manualClose.addEventListener('click', () => {
    sessionStorage.setItem(PWA_DISMISS_KEY + '_ios', '1');
    if (manualBanner) { manualBanner.style.display = 'none'; manualBanner.classList.remove('pwa-banner-show'); }
  });
}

/* ─── 초기화 ─── */
document.addEventListener('DOMContentLoaded',()=>{
  const c=cfg();
  if(!c.API_URL||c.API_URL.includes('YOUR_SCRIPT_ID')) {
    $('content').innerHTML=`<div class="pg-loading"><div style="font-size:2rem">⚙️</div><p>config.js의 API_URL을<br>Apps Script 배포 URL로 변경해 주세요.</p></div>`;
    setSyncOk(false); return;
  }
  bindAll();
  registerSW();
  initPWA();
  navigateTo('dashboard');
});

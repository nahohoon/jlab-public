/**
 * J_LAB Public Lite — script.js
 * 응답형식 자동호환 수정본
 */

'use strict';

const STATE = {
  currentPage: 'dashboard',
  notices: [],
  events: [],
  sponsors: [],
  photos: [],
  loaded: {
    notices: false,
    events: false,
    sponsors: false,
    photos: false
  }
};

const $ = (id) => document.getElementById(id);
const cfg = () => window.JLAB_CONFIG || {};

/* -----------------------------
   API
----------------------------- */
async function apiCall(action, params = {}) {
  const url = cfg().API_URL;
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${url}?${qs}`);
  return res.json();
}

/* 핵심 수정 */
function pickRows(res, key) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res[key])) return res[key];
  return [];
}

const API = {
  getNotices: async () => pickRows(await apiCall('getNotices'), 'notices'),
  getEventList: async () => pickRows(await apiCall('getEventList'), 'events'),
  getSponsorNotices: async () => pickRows(await apiCall('getSponsorNotices'), 'sponsors'),
  getPhotoGallery: async () => pickRows(await apiCall('getPhotoGallery'), 'photos')
};

/* -----------------------------
   공통
----------------------------- */
function formatDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return v;
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function pageTitle(t) {
  const el = $('pageTitle');
  if (el) el.textContent = t;
}

/* -----------------------------
   대시보드
----------------------------- */
async function renderDashboard() {
  const el = $('content');
  el.innerHTML = `<div style="padding:40px;text-align:center">불러오는 중...</div>`;

  try {
    const [notices, events, sponsors, photos] = await Promise.all([
      API.getNotices(),
      API.getEventList(),
      API.getSponsorNotices(),
      API.getPhotoGallery()
    ]);

    STATE.notices = notices;
    STATE.events = events;
    STATE.sponsors = sponsors;
    STATE.photos = photos;

    el.innerHTML = `
      <div style="padding:20px">
        <h2>${cfg().GREETING || '안녕하세요 J_LAB 회원여러분. 화이팅^^'}</h2>

        <h3 style="margin-top:30px">📢 최근 공지</h3>
        ${notices.slice(0,5).map(n => `
          <div style="padding:10px;border-bottom:1px solid #ddd">
            ${n.title || ''}
          </div>
        `).join('') || '공지 없음'}

        <h3 style="margin-top:30px">📅 행사안내</h3>
        ${events.slice(0,5).map(e => `
          <div style="padding:10px;border-bottom:1px solid #ddd">
            ${(e.event_name || '')} ${formatDate(e.event_date || '')}
          </div>
        `).join('') || '행사 없음'}

        <h3 style="margin-top:30px">🎉 찬조 감사</h3>
        ${sponsors.slice(0,5).map(s => `
          <div style="padding:6px 0">${s.notice_message || ''}</div>
        `).join('') || '등록 없음'}
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div style="padding:40px;color:red">데이터 연결 실패</div>`;
  }
}

/* -----------------------------
   공지사항
----------------------------- */
async function renderNotices() {
  pageTitle('공지사항');
  const el = $('content');
  const rows = await API.getNotices();

  el.innerHTML = `
    <div style="padding:20px">
      ${rows.map(n => `
        <div style="padding:15px;border-bottom:1px solid #ddd">
          <b>${n.title || ''}</b><br>
          <small>${formatDate(n.date || n.reg_date || '')}</small><br>
          ${n.body || n.content || ''}
        </div>
      `).join('')}
    </div>
  `;
}

/* -----------------------------
   행사안내
----------------------------- */
async function renderEvents() {
  pageTitle('행사안내');
  const el = $('content');
  const rows = await API.getEventList();

  el.innerHTML = `
    <div style="padding:20px">
      ${rows.map(r => `
        <div style="padding:15px;border-bottom:1px solid #ddd">
          <b>${r.event_name || ''}</b><br>
          ${formatDate(r.event_date || '')}
        </div>
      `).join('')}
    </div>
  `;
}

/* -----------------------------
   갤러리
----------------------------- */
async function renderGallery() {
  pageTitle('사진갤러리');
  const el = $('content');
  const rows = await API.getPhotoGallery();

  el.innerHTML = `
    <div style="padding:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
      ${rows.map(r => `
        <img src="${r.photo_url || ''}" style="width:100%;border-radius:8px">
      `).join('')}
    </div>
  `;
}

/* -----------------------------
   이동
----------------------------- */
function navigateTo(page) {
  STATE.currentPage = page;

  if (page === 'dashboard') renderDashboard();
  if (page === 'notices') renderNotices();
  if (page === 'events') renderEvents();
  if (page === 'gallery') renderGallery();
}

/* -----------------------------
   시작
----------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  navigateTo('dashboard');
});

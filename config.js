/**
 * J_LAB Public Lite — config.js v2.0.0
 * 일반회원 배포용 설정
 *
 * [설정 방법]
 * API_URL: Apps Script 배포 URL을 그대로 유지하세요.
 * 기존 관리자용 API_URL을 그대로 사용합니다.
 *
 * ★ 이 파일에서 호출 가능한 action:
 *   getNotices / getEventList / getSponsorNotices / getPhotoGallery
 *
 * ★ 절대 호출하지 않는 action:
 *   getMembers / getMemberDetail / getDashboard / getUnpaidMembers
 *   getFeeHistory / updateFeeStatus / getEventAttend / getEventAttendSummary
 *   saveEventAttend / getEventAttendV2 / saveEventAttendV2
 */

window.JLAB_CONFIG = {

  /* ════════ 필수 설정 — Apps Script 배포 URL ════════ */
  API_URL: 'https://script.google.com/macros/s/AKfycbxAekzspUqmZsE1TLGhIVVQSEdHYtvFzdHIPgtCfNq14lXGi7MmlHtCuL5-JMnHrWE/exec',

  /* ════════ 조직 정보 ════════ */
  ORG_NAME : 'J_LAB',
  ORG_SUB  : '회원 안내',
  ORG_YEAR : '2025',

  /* ════════ 대시보드 인사말 ════════ */
  GREETING : '안녕하세요, J_LAB 회원여러분. 화이팅^^',

  /* ════════ 최근 공지 표시 수 ════════ */
  NOTICE_LIMIT: 5,

  /* ════════ 내부 설정 ════════ */
  VERSION : '2.0.0',
  MODE    : 'public'   /* 'public' — 민감정보 API 완전 차단 */
};

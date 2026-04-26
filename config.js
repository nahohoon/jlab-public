/**
 * J_LAB Public Lite — config.js
 * 일반회원 배포용 설정 파일
 *
 * [설정 방법]
 * 1. Google Apps Script 열기 (관리자용과 동일한 스크립트 사용 가능)
 * 2. 배포 → 배포 관리 → URL 복사
 * 3. 아래 API_URL에 붙여넣기 후 저장
 * 4. GitHub jlab-public 저장소에 push → 완료
 *
 * ★ 일반회원용은 공개 함수(getNotices, getEventList, getSponsorNotices,
 *    getPhotoGallery)만 호출합니다.
 * ★ 회원정보, 회비정보, 미납정보 API는 절대 호출하지 않습니다.
 */

window.JLAB_CONFIG = {

  /* ════════════════════════════════════
     ★ 필수 설정 (이것만 바꾸세요)
  ════════════════════════════════════ */
  API_URL: 'https://script.google.com/macros/s/AKfycbxAekzspUqmZsE1TLGhIVVQSEdHYtvFzdHIPgtCfNq14lXGi7MmlHtCuL5-JMnHrWE/exec',

  /* ════════════════════════════════════
     조직 정보
  ════════════════════════════════════ */
  ORG_NAME  : 'J_LAB',
  ORG_SUB   : '회원 안내',
  ORG_YEAR  : '2025',

  /* ════════════════════════════════════
     대시보드 인사말
  ════════════════════════════════════ */
  GREETING: '안녕하세요, J_LAB 회원여러분. 화이팅^^',

  /* ════════════════════════════════════
     대시보드 최근 공지 표시 개수
  ════════════════════════════════════ */
  NOTICE_LIMIT: 5,

  /* ════════════════════════════════════
     내부 설정 (변경 불필요)
  ════════════════════════════════════ */
  VERSION: '1.0.0',
  MODE: 'public'  // 'public' 모드 — 민감정보 API 비활성화
};

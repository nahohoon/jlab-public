# J_LAB Public Lite — 일반회원 배포용

**버전**: v1.0.0  
**배포 주소**: https://nahohoon.github.io/jlab-public/

---

## 개요

J_LAB 일반회원 배포용 Lite 버전입니다.  
개인정보, 회비정보, 미납자 정보가 **완전히 제거**된 공개용 버전으로, 카카오톡 링크 공유 후 홈 화면 앱 설치까지 지원합니다.

---

## 파일 구조

```
jlab-public/
├─ index.html          # SPA 셸 (4개 화면)
├─ script.js           # 앱 로직 (공개 API만 호출)
├─ style.css           # 메인 스타일 (다크네이비 + 골드)
├─ style_additions.css # 추가 스타일
├─ config.js           # ★ API URL 설정 파일 (이것만 수정)
├─ manifest.json       # PWA 홈화면 설치 설정
├─ sw.js               # 오프라인 캐시 Service Worker
├─ icon-192.png        # PWA 아이콘 192×192
├─ icon-512.png        # PWA 아이콘 512×512
└─ apple-touch-icon.png # iOS 홈 화면 아이콘
```

---

## 설정 방법

### 1. config.js 수정

```js
window.JLAB_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/여기에붙여넣기/exec', // ★ 필수
  ORG_NAME: 'J_LAB',
  GREETING: '안녕하세요, J_LAB 회원여러분. 화이팅^^',
};
```

### 2. GitHub 저장소 생성 및 배포

1. GitHub에 `jlab-public` 저장소 생성
2. 이 폴더의 모든 파일 업로드
3. Settings → Pages → Branch: main → Save
4. 1~2분 후 `https://nahohoon.github.io/jlab-public/` 접속

---

## 제공 기능

| 기능 | 설명 |
|------|------|
| 대시보드 | 인사말, 찬조 전광판, 최근 공지, 다가오는 행사, 사진 미리보기 |
| 공지사항 | 전체 목록 + 클릭 시 상세 보기 |
| 행사안내 | 행사명, 날짜, 장소, 참가비, 비고 (참석/납부 체크 없음) |
| 사진갤러리 | 날짜별 정리, 클릭 확대, Google Drive 썸네일 변환 |
| PWA | 홈 화면 설치, 오프라인 캐시 |

---

## 보안 — 제거된 기능

일반회원용에서는 아래 항목이 **완전 제거**되었습니다.

- 회원관리 / 회원 상세정보
- 회원 연락처, 이메일, 주소, 특이사항
- 회비관리 / 납부 여부 / 미납 현황
- 행사 참석/납부 체크 기능
- 관리자 입력/수정 버튼
- 아래 API 호출 차단:
  - `getMembers`, `getMemberDetail`, `getUnpaidMembers`
  - `updateFeeStatus`, `getEventAttend`, `saveEventAttend`
  - `getEventAttendSummary`, `getDashboard`

---

## 사용하는 Google Sheets 시트

| 시트명 | 설명 |
|--------|------|
| NOTICE_MASTER | 공지사항 |
| EVENT_MASTER | 행사 목록 |
| SPONSOR_NOTICE | 찬조 감사 전광판 |
| PHOTO_GALLERY | 사진갤러리 |

> 아래 시트는 **읽지 않습니다**: MEMBER_MASTER, EVENT_ATTEND, EVENT_ATTEND_V2, FEE_HISTORY

---

## Apps Script 수정 사항

기존 `Code.gs`를 수정하지 않아도 됩니다.  
기존 공개 함수(`getNotices`, `getEventList`, `getSponsorNotices`, `getPhotoGallery`)를 그대로 사용합니다.

---

## PWA 설치 안내

### iOS (Safari)
> 사이트 접속 → 공유 버튼(□↑) → 홈 화면에 추가

### Android (Chrome)
> 사이트 접속 → 주소창 우측 설치 아이콘 클릭 또는 메뉴 → 앱 설치

---

## 관련 저장소

- **관리자용**: https://github.com/nahohoon/jlab-members
- **일반회원용**: https://github.com/nahohoon/jlab-public (이 저장소)

---

*Built with Google Apps Script + GitHub Pages*

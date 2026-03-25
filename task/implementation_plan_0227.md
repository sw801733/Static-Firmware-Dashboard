# 정적 코드 검증 정기 펌웨어 대시보드

React + TypeScript + Vite로 프론트엔드 전용 정적 코드 검증 대시보드를 구축한다. 엑셀 파싱, IndexedDB 저장, 회차 비교 등 모든 로직을 브라우저에서 처리한다.

## Proposed Changes

### Phase 1 — Project Scaffolding

#### [NEW] Vite + React + TS 프로젝트 초기화

```
npx -y create-vite@latest ./ --template react-ts
npm install xlsx recharts @tanstack/react-table idb react-router-dom
npm install -D @types/react-router-dom
```

디렉터리 구조:

```
src/
├── components/       # UI 컴포넌트
│   ├── layout/       # Sidebar, Header
│   ├── upload/       # UploadWizard, FileDropZone
│   ├── overview/     # KPICards, RulesetTable, TopNChart
│   ├── compare/      # CompareView, NewRules, DeltaTable, Summary
│   ├── hotspot/      # HotspotView, FileRanking
│   └── common/       # RuleDetailDrawer, Badge, CopyButton
├── services/         # IndexedDB, Excel 파싱
│   ├── db.ts         # IndexedDB (idb wrapper)
│   ├── excelParser.ts
│   └── normalizer.ts
├── hooks/            # Custom React hooks
├── types/            # TypeScript 인터페이스
├── fixtures/         # 더미 JSON 데이터
├── App.tsx
├── main.tsx
└── index.css
```

---

### Phase 2 — Core Infrastructure

#### [NEW] `src/types/index.ts`
모든 TypeScript 인터페이스 정의:
- `Session` (id, analysisId, createdAt, rulesetNames[])
- `RulesetReport` (sessionId, ruleset, summary, rules[], files[])
- `RuleSummary`, `FileSummary`
- `Reference` (규칙명, 유형분류, 정당화의견)

#### [NEW] `src/services/db.ts`
idb 라이브러리로 IndexedDB 래핑:
- DB: `fwDashboard`, stores: `sessions`, `rulesetReports`, `references`
- CRUD: `saveSession`, `getSessions`, `getSession`, `deleteSession`
- `saveRulesetReports`, `getRulesetReportsBySession`
- `saveReferences`, `getReferences`

#### [NEW] `src/services/normalizer.ts`
`normalizeRuleName(rule: string): string`:
- trim → 연속 공백 1칸 → toUpperCase → 콜론·하이픈 통합 치환

#### [NEW] `src/services/excelParser.ts`
SheetJS(`xlsx`)로 엑셀 파싱:
- `parseProjectSummary(file: File): Promise<ParsedReport>`  
  → Summary/RuleSet/Rule/File 시트 각각 파싱
- `parseReference(file: File): Promise<Reference[]>`  
  → 룰셋별 시트 순회, 규칙명·유형분류·정당화의견 추출

#### [NEW] `src/fixtures/`
더미 JSON으로 2개 회차(#1, #2) × 4 룰셋 데이터, 레퍼런스 데이터.

---

### Phase 3 — Upload & Session Management

#### [NEW] `src/components/upload/UploadWizard.tsx`
- Step 1: Analysis ID 입력(예: "#1")
- Step 2: Project_Summary Report 파일 다중 업로드 (드래그&드롭)
- Step 3: 파싱 → 룰셋 자동 추출 → 미리보기 → IndexedDB 저장

#### [NEW] `src/components/upload/ReferenceUpload.tsx`
- 위배 유형 분류 파일 업로드 (전역 1회)
- 기존 레퍼런스 있으면 덮어쓰기 확인

#### [NEW] Session 목록 페이지
- 저장된 회차 목록 (카드 형태)
- 회차 선택 → Overview로 이동
- 회차 삭제 기능

---

### Phase 4 — Overview Dashboard

#### [NEW] `src/components/overview/OverviewPage.tsx`
- **KPI Cards**: Total Files / Analyzed Files / Total Functions / LOC (합계)
- **Ruleset Table**: 룰셋별 Remaining / Suppressed (TanStack Table, 정렬)
- **Rule Top 10**: Remaining 기준 상위 10 규칙 (바 차트 + 테이블)
- **File Top 10**: Remaining 기준 상위 10 파일 (바 차트 + 테이블)
- 모든 규칙 셀 클릭 시 → RuleDetailDrawer 오픈

---

### Phase 5 — Compare View

#### [NEW] `src/components/compare/ComparePage.tsx`
- 기본: 최신 회차 vs 직전 회차 (드롭다운으로 변경 가능)
- **New Rules**: 이전 회차에 없고 이번 회차에 등장한 Rule 목록
- **Increased Rules**: Remaining 증가 (Δ 표시, 빨간색)
- **Decreased Rules**: Remaining 감소 (Δ 표시, 초록색)
- **Auto Analysis Summary**: 핵심 변화를 요약하는 보고용 문장 자동 생성 + 복사 버튼
- **Root Cause Guess**: 규칙이 다수 파일에서 동시 증가/특정 파일 집중/억제 급증 등 패턴 기반 추정

---

### Phase 6 — Hotspot View

#### [NEW] `src/components/hotspot/HotspotPage.tsx`
- 파일별 Remaining Top N 랭킹 (바 차트 + 테이블)
- 파일별 Rule 수 Top N 랭킹
- 파일 클릭 시 → 해당 파일의 규칙 요약 표시 (모달/패널)

---

### Phase 7 — Rule Detail Drawer

#### [NEW] `src/components/common/RuleDetailDrawer.tsx`
- 오른쪽 사이드 패널 (슬라이드 인)
- 규칙명 표시
- 현재 회차 Remaining/Suppressed
- 비교 회차 Remaining/Suppressed (있으면)
- 레퍼런스 매칭 결과 (유형 분류, 정당화 의견)
- 매칭 없으면 "작성 필요" 배지 표시

---

### Phase 8 — UI Polish

- 다크 모드 기본 테마 (전문적인 대시보드 느낌)
- 사이드바 네비게이션 (Sessions / Overview / Compare / Hotspot)
- 반응형 레이아웃
- 부드러운 전환 애니메이션
- git 단계별 커밋

---

## Verification Plan

### Automated Tests
- `npm run build` — TypeScript 컴파일 에러 없음 확인
- `npm run dev` — 개발 서버 정상 구동 확인

### Browser Verification (각 Phase마다)
1. **Phase 2**: 더미 데이터로 IndexedDB CRUD 콘솔 테스트
2. **Phase 3**: 실제 / 더미 엑셀 업로드 → 파싱 결과 확인
3. **Phase 4**: Overview 페이지에서 KPI·테이블·차트 렌더링 확인
4. **Phase 5**: 회차 2개 저장 후 Compare 화면에서 Δ 정상 표시 확인
5. **Phase 6**: Hotspot 랭킹 정렬, 파일 클릭 시 요약 표시
6. **Phase 7**: 규칙 클릭 → Drawer 열림, 레퍼런스 매칭 확인
7. **Phase 8**: 전체 UI 리뷰 (브라우저 스크린샷)

### Manual Verification (사용자에게 요청)
- 실제 엑셀 파일을 사용한 업로드 및 비교 테스트

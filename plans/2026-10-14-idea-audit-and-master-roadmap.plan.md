---
plan: 2026-10-14-idea-audit-and-master-roadmap
slug: 2026-10-14-idea-audit-and-master-roadmap
title: "classbook 기존 플랜 실현 여부 전수 대조 및 교시 중앙 배너·교과서 지식 오버레이 마스터 로드맵"
status: done
owner: neohum
risk: medium
created: 2026-10-14
---

## Intent

`classbook` 저장소의 기존 2개 계획서(`plans/*.plan.md`)를 Go 백엔드(`app.go`, `internal/`) 및 React 뷰어(`viewer/src/`) 코드베이스와 전수 대조하여 **구현 완료 / 부분 구현 / 미구현** 여부를 판정하고, **교시 전환 시 화면 전체를 가리지 않는 중앙 컴팩트 과목·쪽수·학습주제 안내 배너**와 **교과서 어휘·기호 반응형 지식 오버레이 및 '다음에 보기' 복습 큐 시스템**을 단계별 실행 계획으로 수립한다.

## 기존 플랜 실현 여부 대조 및 가치 평가

| 번호 | 플랜 파일명 | 판정 | 실제 코드 근거 (`app.go`, `viewer/src/`) | 추가 가치 평가 및 우선순위 |
| --- | --- | --- | --- | --- |
| 1 | `2026-09-30-classbook-1교시-과목-페이지-주제가-가-화면-중앙에-전체-화면을-38cd.plan.md` | **부분 구현** | `viewer/src/components/WeeklyPlanAlertModal.tsx`, `WeeklyPlanScheduleModal.tsx`, `viewer/src/pages/ViewerPage.tsx`, `viewer/src/utils/weeklyPlanParser.ts`에 주간학습안 파싱 및 교시 알림 모달이 구현되어 있으나, 플랜이 요구한 "1교시/교시 시작 시 과목·쪽수·학습주제가 화면 중앙에 전체 화면을 가리지 않는 컴팩트 카드로 뜨고 학생들이 닫기 버튼을 눌러 즉시 닫는" 전용 오버레이 UX 고도화가 필요함 | **최우선 완성 (P1, Quick Win)** — 수업 시작 직후 교사와 학생이 오늘 배울 과목·교과서 쪽수·학습주제를 즉시 확인하고 교과서 해당 쪽으로 바로 이동하거나 한 번의 탭으로 닫을 수 있어 교실 몰입도를 크게 높임 |
| 2 | `2026-09-25-교사가-교과서를-올리면-학생들에게-전달될-때-교과서에-있는-모든-내용에--8114.plan.md` (`interactive-textbook-knowledge-overlay-popup`) | **미구현** | `status: draft`. 현재 `ViewerPage.tsx`와 `ocrOffsetDetector.ts`는 PDF/이미지 페이지 렌더링 및 인쇄 쪽수 오프셋 보정만 수행하며, 페이지 내 어휘·기호·배경지식 핫스팟 오버레이(`KnowledgeOverlayLayer`), 기초 설명/더 알아보기 2단 팝오버, '다음에 보기' 복습 큐(`ReviewQueueDrawer`), 교사용 주석 편집기는 구현되어 있지 않음 | **핵심 전략 기능 (P1, High Value)** — 정적인 PDF 교과서를 상호작용형 디지털 교과서로 격상시키는 핵심 차별화 기능으로, 문해력 격차 해소와 자기주도 복습 루프를 동시에 달성함 |
| 3 | *(신규 발굴)* 교과서 쪽수 연동 자동 북마크 및 학급 질문 핀(Question Pin) | **신규 제안** | `ViewerPage.tsx`에 기본 페이지 이동과 줌 기능만 존재하며 학생이 모르는 부분을 표시해 복습 큐와 연결하는 기능이 없음 | **고부가가치 확장 (P2)** — 지식 오버레이의 '다음에 보기' 큐와 연동하여 학생이 직접 질문 핀을 꽂거나 교사가 핵심 시험/활동 포인트를 강조 표시할 수 있게 확장 |

## Non-goals

- 외부 유료 LLM API에 교과서 전체 PDF를 실시간 업로드하지 않으며, 오프라인/로컬 사전 매칭 및 교사 배포 주석 번들(`.cbk-notes.json`) 방식을 기본으로 한다.
- 기존 PDF/이미지 렌더링 파이프라인(`ViewerPage.tsx`) 및 인쇄 쪽수 오프셋 감지(`ocrOffsetDetector.ts`)의 성능을 저하시키지 않는다.
- 전체 화면을 불투명하게 덮어 교과서 본문 확인을 방해하는 침습적 모달을 지양한다.

## Steps

### Step 1: compact-lesson-topic-center-banner
- Goal: 1교시 시작 및 교시 전환 시 현재 교시·과목명·교과서 쪽수·학습주제를 화면 중앙에 전체 화면을 가리지 않는 비침습적 플로팅 배너 카드로 표시하고, '해당 쪽 바로 펼치기' 및 '닫기(X / ESC)' 버튼으로 즉시 닫을 수 있는 `LessonTopicCenterBanner.tsx`를 구현한다.
- Files: `viewer/src/components/LessonTopicCenterBanner.tsx`, `viewer/src/components/WeeklyPlanAlertModal.tsx`, `viewer/src/pages/ViewerPage.tsx`, `viewer/src/utils/__tests__/lessonTopicBanner.test.ts`
- Acceptance: AC-1: 교시 알림 트리거 시 배경 교과서 화면이 그대로 보이는 상태에서 화면 중앙에 컴팩트 배너(`max-width: 460px`, 블러 글래스 카드)로 교시·과목·쪽수·학습주제가 표시된다. AC-2: 학생이 닫기 버튼(또는 ESC)을 누르면 즉시 닫히며 동일 교시 내 재노출되지 않고, '쪽수 이동' 클릭 시 `ocrOffsetDetector` 보정 페이지로 즉시 점프한다.
- Tests: `npm --prefix viewer test -- --run`
- Risk: low
- Complexity: low
- Agent: codex
- Reviewer: claude

### Step 2: textbook-knowledge-annotation-schema-and-matcher
- Goal: 교과서 페이지별 어휘·기호·배경지식 항목의 정규화 좌표(`bbox`), 기초 설명(`basicSummary`), 심화 설명(`deepDive`), 난이도 태그를 담는 데이터 스키마와, 텍스트/OCR 토큰에서 핵심 학습 용어를 자동 추출·매칭하는 유틸리티 및 Go 저장/로드 바인딩을 구축한다.
- Files: `viewer/src/types/knowledgeOverlay.ts`, `viewer/src/utils/knowledgeTermMatcher.ts`, `viewer/src/utils/__tests__/knowledgeTermMatcher.test.ts`, `app.go`
- Acceptance: AC-1: `KnowledgeAnnotation` 스키마가 페이지 번호, 정규화 영역 좌표(`0.0~1.0`), 용어명, 품사/유형(어휘·수식기호·개념), 기초 설명, 더 알아보기 본문을 검증하고 직렬화/역직렬화한다. AC-2: 페이지 확대·축소·창 크기 변경 시에도 정규화 좌표가 픽셀 오차 없이 캔버스 상대 좌표로 변환된다.
- Tests: `npm --prefix viewer test -- --run viewer/src/utils/__tests__/knowledgeTermMatcher.test.ts`
- Risk: low
- Complexity: medium
- Agent: codex
- Reviewer: claude

### Step 3: interactive-knowledge-overlay-and-popover
- Goal: `ViewerPage.tsx` 상단에 토글 가능한 `KnowledgeOverlayLayer.tsx`와 2단계 지식 팝오버(`KnowledgePopoverCard.tsx`: 기본 한 줄 쉬운 뜻풀이 → '더 알아보기' 아코디언 확장)를 렌더링하여 학생이 교과서 흐름을 잃지 않고 어휘와 기호의 뜻을 즉시 확인하게 한다.
- Files: `viewer/src/components/KnowledgeOverlayLayer.tsx`, `viewer/src/components/KnowledgePopoverCard.tsx`, `viewer/src/pages/ViewerPage.tsx`, `viewer/src/utils/__tests__/knowledgeOverlayUi.test.tsx`
- Acceptance: AC-1: 상단 툴바의 '지식 도움말 켜기/끄기' 토글로 페이지 내 용어 배지 하이라이트를 즉시 표시하거나 숨길 수 있다. AC-2: 하이라이트된 용어 클릭 시 화면 밖으로 잘리지 않는 위치 보정 팝오버가 열리며, 기본 2줄 요약과 '더 알아보기' 심화 설명 전환이 동작한다.
- Tests: `npm --prefix viewer test -- --run viewer/src/utils/__tests__/knowledgeOverlayUi.test.tsx`
- Risk: medium
- Complexity: medium
- Agent: codex
- Reviewer: claude

### Step 4: review-queue-drawer-and-teacher-annotation-editor
- Goal: 학생이 팝오버에서 '다음에 보기'로 담아둔 항목을 모아 복습·완료 체크하고 원래 교과서 쪽으로 점프하는 `ReviewQueueDrawer.tsx`와, 교사가 페이지 위 원하는 영역에 직접 지식 노트를 추가·수정·내보내기할 수 있는 편집 모드를 구현한다.
- Files: `viewer/src/components/ReviewQueueDrawer.tsx`, `viewer/src/components/TeacherAnnotationModal.tsx`, `viewer/src/hooks/useReviewQueue.ts`, `viewer/src/utils/__tests__/reviewQueue.test.ts`
- Acceptance: AC-1: 팝오버의 '다음에 보기 담기' 클릭 시 로컬 스토리지 및 백엔드에 복습 항목이 저장되고, 우측 복습 큐 드로어에서 항목 클릭 시 해당 교과서 페이지와 팝오버 위치로 즉시 이동한다. AC-2: 교사 편집 모드에서 드래그 또는 핀 클릭으로 새 어휘/배경지식 설명을 등록하고 JSON 번들로 내보내기/불러오기가 가능하다.
- Tests: `npm --prefix viewer test -- --run viewer/src/utils/__tests__/reviewQueue.test.ts`
- Risk: medium
- Complexity: medium
- Agent: codex
- Reviewer: claude

## Verification

- `npm --prefix viewer test -- --run` 프론트엔드 전체 단위/컴포넌트 테스트 통과
- `npm --prefix viewer run build` 및 `go test ./...` 빌드·백엔드 검증 통과

## Reviewer topology

- Builder: `codex`
- Reviewer: `claude` (빌더와 독립된 프로바이더가 UI 비침습성, 좌표 정합성, 한국어 줄바꿈 및 접근성 규칙을 검증)

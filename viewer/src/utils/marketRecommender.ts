import type {
    LessonMaterialRef,
    LessonMaterialType,
    PeriodMaterialBinding,
    SelfCheckItem
} from '../types/weeklyPlanMarket';

export const PERIOD_MATERIALS_STORAGE_KEY = 'classbook_period_materials_v1';
export const SELF_CHECK_STORAGE_KEY = 'classbook_self_check_v1';
export const SESSION_TOKEN_STORAGE_KEY = 'classbook_anon_session_v1';

const VALID_MATERIAL_TYPES: Set<LessonMaterialType> = new Set([
    'market_artifact',
    'local_file',
    'web_url',
    'cloud_school_app'
]);

const FORBIDDEN_PII_KEYS = [
    'studentname',
    'studentid',
    'residentnumber',
    'phonenumber',
    'realname',
    'birthdate',
    'rrn',
    'ssn',
    '학번',
    '주민등록번호',
    '실명'
];

const RRN_REGEX = /\b\d{6}[-–\s]?[1-4]\d{6}\b/;
const PHONE_REGEX = /\b01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/;

export const DEFAULT_MARKET_CATALOG: LessonMaterialRef[] = [
    {
        id: 'mkt-kor-dictation-01',
        title: 'AI 받아쓰기 및 낱말 짜임 인터랙티브 활동지',
        type: 'market_artifact',
        subject: '국어',
        grade: 1,
        keywords: ['국어', '글자', '짜임', '받아쓰기', '낱말', '바르게 읽기', '한글'],
        urlOrPath: 'market://all-market/artifacts/kor-dictation-01',
        artifactId: 'kor-dictation-01',
        description: '글자의 짜임과 받침 있는 낱말을 시각적으로 조합하고 연습하는 올마켓 수업 도구',
        autoFullscreen: true
    },
    {
        id: 'mkt-kor-reading-02',
        title: '문단 중심생각 찾기 & 독서 토의 보드',
        type: 'cloud_school_app',
        subject: '국어',
        grade: 3,
        keywords: ['국어', '독서', '중심생각', '문단', '글쓰기', '이야기', '발표', '토의', '바르게 읽기'],
        urlOrPath: 'https://school.edulinker.co.kr/apps/reading-board',
        artifactId: 'kor-reading-02',
        description: '교과서 지문의 핵심 어휘와 중심 문장을 함께 정리하는 교실 칠판 보드',
        autoFullscreen: true
    },
    {
        id: 'mkt-math-fraction-01',
        title: '분수와 소수 시각적 조각 교구 (인터랙티브 분수 막대)',
        type: 'market_artifact',
        subject: '수학',
        grade: 3,
        keywords: ['수학', '분수', '소수', '단위분수', '크기 비교', '조각', '나눗셈'],
        urlOrPath: 'market://all-market/artifacts/math-fraction-bar',
        artifactId: 'math-fraction-01',
        description: '분수의 크기 비교와 덧셈·뺄셈을 원형/막대 모델로 직접 조작하는 수학 교구',
        autoFullscreen: true
    },
    {
        id: 'mkt-math-number-02',
        title: '수 배열표와 덧셈·뺄셈·순서 놀이판',
        type: 'market_artifact',
        subject: '수학',
        grade: 1,
        keywords: ['수학', '순서', '몇 개', '덧셈', '뺄셈', '곱셈', '수 배열', '계산', '숫자'],
        urlOrPath: 'market://all-market/artifacts/math-number-board',
        artifactId: 'math-number-02',
        description: '수의 순서와 덧셈·뺄셈 원리를 블록으로 체험하는 디지털 수 조작 교구',
        autoFullscreen: true
    },
    {
        id: 'mkt-math-geometry-03',
        title: '평면도형 이동·뒤집기·돌리기 칠교판',
        type: 'cloud_school_app',
        subject: '수학',
        grade: 4,
        keywords: ['수학', '도형', '삼각형', '사각형', '원', '칠교', '각도', '이동', '뒤집기'],
        urlOrPath: 'https://school.edulinker.co.kr/apps/geometry-tangram',
        artifactId: 'math-geometry-03',
        description: '도형의 성질과 공간 감각을 기르는 인터랙티브 칠교 및 격자 도형판',
        autoFullscreen: true
    },
    {
        id: 'mkt-soc-map-01',
        title: '우리 고장 백지도 및 디지털 지역 탐방 지도',
        type: 'market_artifact',
        subject: '사회',
        grade: 3,
        keywords: ['사회', '지도', '고장', '방위', '기호', '문화유산', '역사', '지형'],
        urlOrPath: 'market://all-market/artifacts/soc-local-map',
        artifactId: 'soc-map-01',
        description: '우리 고장의 주요 장소와 지도를 기호로 표시하고 탐구하는 사회과 수업 자료',
        autoFullscreen: true
    },
    {
        id: 'mkt-sci-lab-01',
        title: '가상 과학 실험실 & 관찰 기록 보고서 템플릿',
        type: 'market_artifact',
        subject: '과학',
        grade: 4,
        keywords: ['과학', '실험', '관찰', '자석', '물체', '물질', '생물', '태양계', '온도'],
        urlOrPath: 'market://all-market/artifacts/sci-virtual-lab',
        artifactId: 'sci-lab-01',
        description: '실험 안전 수칙 확인과 단계별 실험 결과를 전자칠판에서 즉시 기록하는 도구',
        autoFullscreen: true
    },
    {
        id: 'mkt-eng-phonics-01',
        title: '원어민 발음 찬트 & 영어 상황 대화 역할극 카드',
        type: 'cloud_school_app',
        subject: '영어',
        grade: 3,
        keywords: ['영어', '알파벳', '찬트', '대화', '역할극', '단어', '파닉스', '인사'],
        urlOrPath: 'https://school.edulinker.co.kr/apps/eng-roleplay',
        artifactId: 'eng-phonics-01',
        description: '핵심 영어 표현을 듣고 따라 말하며 퀴즈로 복습하는 멀티미디어 영어 자료',
        autoFullscreen: true
    },
    {
        id: 'mkt-art-music-01',
        title: '디지털 리듬 합주기 & 미술 작품 감상 갤러리',
        type: 'market_artifact',
        subject: '음악',
        keywords: ['음악', '미술', '리듬', '장단', '계이름', '감상', '그리기', '만들기', '표현'],
        urlOrPath: 'market://all-market/artifacts/art-music-studio',
        artifactId: 'art-music-01',
        description: '교실 전체가 함께 박자를 맞추고 작품 활동 과정을 공유하는 예체능 통합 자료',
        autoFullscreen: true
    },
    {
        id: 'mkt-pe-health-01',
        title: '체육 술래놀이 규칙 판 & 모둠 점수 전광판',
        type: 'market_artifact',
        subject: '체육',
        keywords: ['체육', '건강', '안전', '스트레칭', '경쟁', '협동', '놀이', '전광판'],
        urlOrPath: 'market://all-market/artifacts/pe-scoreboard',
        artifactId: 'pe-health-01',
        description: '체육 수업 전 준비운동 가이드 및 모둠별 협동 점수 전광판',
        autoFullscreen: true
    },
    {
        id: 'mkt-morning-timer-01',
        title: '아침 독서·자율활동 집중 타이머 및 오늘의 다짐 보드',
        type: 'cloud_school_app',
        subject: '아침활동',
        keywords: ['아침활동', '아침', '독서', '자율활동', '타이머', '안전', '출결', '하루 시작'],
        urlOrPath: 'https://school.edulinker.co.kr/apps/morning-routine',
        artifactId: 'morning-timer-01',
        description: '아침 독서 시간 안내와 학생 자율 출결·할 일 점검을 돕는 학급 루틴 보드',
        autoFullscreen: true
    },
    {
        id: 'mkt-common-quiz-01',
        title: '클라우드스쿨 실시간 퀴즈·발표자 추첨·활동 타이머',
        type: 'cloud_school_app',
        subject: '공통',
        keywords: ['타이머', '발표', '퀴즈', '활동지', '모둠', '창체', '창의적체험활동', '복습', '정리'],
        urlOrPath: 'https://school.edulinker.co.kr/apps/classroom-toolkit',
        artifactId: 'common-quiz-01',
        description: '모든 교과 수업에서 즉시 활용 가능한 발표 추첨, 모둠 타이머, 형성평가 퀴즈 도구',
        autoFullscreen: true
    }
];

export function validateLessonMaterialRef(ref: unknown): { valid: boolean; reason?: string } {
    if (!ref || typeof ref !== 'object') {
        return { valid: false, reason: '자료 객체가 비어 있거나 올바르지 않습니다.' };
    }
    const candidate = ref as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || !candidate.id.trim()) {
        return { valid: false, reason: '유효한 자료 ID(id)가 필요합니다.' };
    }
    if (typeof candidate.title !== 'string' || !candidate.title.trim()) {
        return { valid: false, reason: '유효한 자료 제목(title)이 필요합니다.' };
    }
    if (typeof candidate.type !== 'string' || !VALID_MATERIAL_TYPES.has(candidate.type as LessonMaterialType)) {
        return { valid: false, reason: '지원하지 않는 자료 유형(type)입니다.' };
    }
    if (typeof candidate.subject !== 'string' || !candidate.subject.trim()) {
        return { valid: false, reason: '유효한 과목명(subject)이 필요합니다.' };
    }
    if (!Array.isArray(candidate.keywords)) {
        return { valid: false, reason: '키워드(keywords) 목록이 배열이어야 합니다.' };
    }
    if (typeof candidate.urlOrPath !== 'string' || !candidate.urlOrPath.trim()) {
        return { valid: false, reason: '유효한 경로 또는 URL(urlOrPath)이 필요합니다.' };
    }
    const trimmedUrl = candidate.urlOrPath.trim().toLowerCase();
    if (trimmedUrl.startsWith('javascript:') || trimmedUrl.startsWith('vbscript:') || trimmedUrl.startsWith('data:text/html')) {
        return { valid: false, reason: '보안상 허용되지 않는 URL 스킴입니다.' };
    }
    return { valid: true };
}

export function validateSelfCheckItem(item: unknown): { valid: boolean; reason?: string } {
    if (!item || typeof item !== 'object') {
        return { valid: false, reason: '셀프체크 항목이 올바르지 않습니다.' };
    }
    const candidate = item as Record<string, unknown>;

    // Strictly reject any PII fields
    for (const key of Object.keys(candidate)) {
        const lowerKey = key.toLowerCase();
        if (FORBIDDEN_PII_KEYS.some(forbidden => lowerKey.includes(forbidden))) {
            return { valid: false, reason: `개인정보(PII) 관련 필드(${key})는 저장할 수 없습니다.` };
        }
    }

    if (typeof candidate.id !== 'string' || !candidate.id.trim()) {
        return { valid: false, reason: '유효한 항목 ID(id)가 필요합니다.' };
    }
    if (typeof candidate.label !== 'string' || !candidate.label.trim()) {
        return { valid: false, reason: '유효한 할 일 내용(label)이 필요합니다.' };
    }
    if (candidate.category !== 'attendance' && candidate.category !== 'task') {
        return { valid: false, reason: '유효하지 않은 카테고리(category)입니다.' };
    }
    if (typeof candidate.completed !== 'boolean') {
        return { valid: false, reason: '완료 여부(completed)는 불리언이어야 합니다.' };
    }
    if (typeof candidate.sessionToken !== 'string' || !candidate.sessionToken.trim()) {
        return { valid: false, reason: '익명 세션 토큰(sessionToken)이 필요합니다.' };
    }

    // Check label & sessionToken for resident number or phone number patterns
    const textToInspect = `${candidate.label} ${candidate.sessionToken}`;
    if (RRN_REGEX.test(textToInspect) || PHONE_REGEX.test(textToInspect)) {
        return { valid: false, reason: '주민등록번호나 전화번호 등 민감 개인정보는 입력할 수 없습니다.' };
    }

    return { valid: true };
}

function normalizeSubjectToken(subject: string): string {
    return (subject || '').trim().replace(/\s+/g, '');
}

export function recommendMarketMaterials(
    subject: string,
    topic: string,
    catalog: LessonMaterialRef[] = DEFAULT_MARKET_CATALOG,
    limit: number = 5
): LessonMaterialRef[] {
    const normSubj = normalizeSubjectToken(subject);
    const cleanTopic = (topic || '').trim().toLowerCase();
    const topicTokens = cleanTopic
        .split(/[\s,./()[\]·~-]+/)
        .map(t => t.trim())
        .filter(t => t.length >= 1);

    const scored = catalog
        .filter(item => validateLessonMaterialRef(item).valid)
        .map((item, idx) => {
            let score = 0;
            const itemSubj = normalizeSubjectToken(item.subject);

            // 1. Subject matching
            if (normSubj && itemSubj) {
                if (normSubj === itemSubj) {
                    score += 30;
                } else if (normSubj.includes(itemSubj) || itemSubj.includes(normSubj)) {
                    score += 22;
                } else if (
                    (normSubj.includes('미술') || normSubj.includes('음악') || normSubj.includes('예체능')) &&
                    item.keywords.some(k => normSubj.includes(k))
                ) {
                    score += 20;
                }
            }
            if (itemSubj === '공통') {
                score += 8;
            }

            // 2. Topic & Keyword matching
            const itemTitleLower = item.title.toLowerCase();
            const itemDescLower = (item.description || '').toLowerCase();
            const itemKeywordsLower = item.keywords.map(k => k.toLowerCase());

            if (cleanTopic) {
                for (const kw of itemKeywordsLower) {
                    if (cleanTopic.includes(kw)) {
                        score += 18;
                    }
                }
                for (const token of topicTokens) {
                    if (token.length < 2 && !['수', '원', '글'].includes(token)) continue;
                    if (itemKeywordsLower.some(kw => kw.includes(token) || token.includes(kw))) {
                        score += 12;
                    }
                    if (itemTitleLower.includes(token)) {
                        score += 10;
                    }
                    if (itemDescLower.includes(token)) {
                        score += 5;
                    }
                }
            }

            return { item, score, idx };
        });

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.idx - b.idx;
    });

    const positive = scored.filter(s => s.score > 0).map(s => s.item);
    if (positive.length > 0) {
        return positive.slice(0, Math.max(1, limit));
    }
    return catalog.slice(0, Math.max(1, limit));
}

export function getPeriodSlotKey(day: string, period: number): string {
    const cleanDay = (day || '월').trim();
    return `${cleanDay}_${period}`;
}

export function getAllPeriodBindings(): Record<string, PeriodMaterialBinding> {
    try {
        if (typeof localStorage === 'undefined') return {};
        const raw = localStorage.getItem(PERIOD_MATERIALS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return parsed as Record<string, PeriodMaterialBinding>;
        }
    } catch (e) {
        console.error('Failed to read period material bindings:', e);
    }
    return {};
}

export function saveAllPeriodBindings(bindings: Record<string, PeriodMaterialBinding>): void {
    try {
        if (typeof localStorage === 'undefined') return;
        const serialized = JSON.stringify(bindings);
        localStorage.setItem(PERIOD_MATERIALS_STORAGE_KEY, serialized);
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            const evt = typeof CustomEvent !== 'undefined'
                ? new CustomEvent('classbook_period_materials_updated', { detail: bindings })
                : ({ type: 'classbook_period_materials_updated', detail: bindings } as unknown as Event);
            window.dispatchEvent(evt);
        }
    } catch (e) {
        console.error('Failed to save period material bindings:', e);
    }
}

export function getPeriodMaterials(day: string, period: number): LessonMaterialRef[] {
    const bindings = getAllPeriodBindings();
    const key = getPeriodSlotKey(day, period);
    return bindings[key]?.materials || [];
}

export function bindMaterialToPeriod(
    day: string,
    period: number,
    subject: string,
    topic: string,
    material: LessonMaterialRef
): PeriodMaterialBinding {
    const validation = validateLessonMaterialRef(material);
    if (!validation.valid) {
        throw new Error(validation.reason || '유효하지 않은 학습 자료입니다.');
    }

    const bindings = getAllPeriodBindings();
    const key = getPeriodSlotKey(day, period);
    const existing = bindings[key];
    const currentMaterials = existing?.materials ? [...existing.materials] : [];

    const existingIdx = currentMaterials.findIndex(m => m.id === material.id);
    if (existingIdx >= 0) {
        currentMaterials[existingIdx] = material;
    } else {
        currentMaterials.push(material);
    }

    const updatedBinding: PeriodMaterialBinding = {
        day: (day || '월').trim(),
        period,
        subject: (subject || existing?.subject || '수업').trim(),
        topic: (topic || existing?.topic || '').trim(),
        materials: currentMaterials,
        updatedAt: new Date().toISOString()
    };

    bindings[key] = updatedBinding;
    saveAllPeriodBindings(bindings);
    return updatedBinding;
}

export function unbindMaterialFromPeriod(
    day: string,
    period: number,
    materialId: string
): PeriodMaterialBinding | null {
    const bindings = getAllPeriodBindings();
    const key = getPeriodSlotKey(day, period);
    const existing = bindings[key];
    if (!existing) return null;

    const filtered = (existing.materials || []).filter(m => m.id !== materialId);
    const updatedBinding: PeriodMaterialBinding = {
        ...existing,
        materials: filtered,
        updatedAt: new Date().toISOString()
    };

    bindings[key] = updatedBinding;
    saveAllPeriodBindings(bindings);
    return updatedBinding;
}

export function getAnonymousSessionToken(): string {
    try {
        if (typeof localStorage !== 'undefined') {
            const existing = localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
            if (existing && existing.trim()) {
                return existing;
            }
            const generated = `anon_cls_${Math.random().toString(36).slice(2, 10)}`;
            localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, generated);
            return generated;
        }
    } catch (e) {}
    return 'anon_cls_default';
}

function createDefaultSelfCheckItems(sessionToken: string): SelfCheckItem[] {
    return [
        {
            id: 'sc-attendance-morning',
            label: '오늘 아침 등교 및 자리 정돈 완료 확인',
            category: 'attendance',
            completed: false,
            sessionToken
        },
        {
            id: 'sc-attendance-safety',
            label: '교실 건강·안전 상태 스스로 점검하기',
            category: 'attendance',
            completed: false,
            sessionToken
        },
        {
            id: 'sc-task-textbook',
            label: '이번 교시 교과서와 필기도구 미리 펼쳐 두기',
            category: 'task',
            completed: false,
            sessionToken
        },
        {
            id: 'sc-task-notice',
            label: '주간학습안내 및 오늘의 과제 확인하기',
            category: 'task',
            completed: false,
            sessionToken
        }
    ];
}

export function getSelfCheckList(): SelfCheckItem[] {
    const token = getAnonymousSessionToken();
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(SELF_CHECK_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const validItems = parsed.filter(it => validateSelfCheckItem(it).valid);
                    if (validItems.length > 0) {
                        return validItems;
                    }
                }
            }
            const defaults = createDefaultSelfCheckItems(token);
            localStorage.setItem(SELF_CHECK_STORAGE_KEY, JSON.stringify(defaults));
            return defaults;
        }
    } catch (e) {
        console.error('Failed to load self check list:', e);
    }
    return createDefaultSelfCheckItems(token);
}

function saveSelfCheckList(items: SelfCheckItem[]): void {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(SELF_CHECK_STORAGE_KEY, JSON.stringify(items));
        }
    } catch (e) {
        console.error('Failed to save self check list:', e);
    }
}

export function toggleSelfCheckItem(id: string): SelfCheckItem[] {
    const list = getSelfCheckList();
    const updated = list.map(item => {
        if (item.id !== id) return item;
        const nextCompleted = !item.completed;
        return {
            ...item,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined
        };
    });
    saveSelfCheckList(updated);
    return updated;
}

export function addSelfCheckTask(
    label: string,
    category: 'attendance' | 'task' = 'task'
): SelfCheckItem[] {
    const cleanLabel = (label || '').trim();
    if (!cleanLabel) {
        throw new Error('할 일 내용을 입력해 주세요.');
    }

    const token = getAnonymousSessionToken();
    const newItem: SelfCheckItem = {
        id: `sc-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: cleanLabel,
        category,
        completed: false,
        sessionToken: token
    };

    const validation = validateSelfCheckItem(newItem);
    if (!validation.valid) {
        throw new Error(validation.reason || '유효하지 않은 셀프체크 항목입니다.');
    }

    const current = getSelfCheckList();
    const updated = [...current, newItem];
    saveSelfCheckList(updated);
    return updated;
}

export function removeSelfCheckItem(id: string): SelfCheckItem[] {
    const current = getSelfCheckList();
    const updated = current.filter(item => item.id !== id);
    saveSelfCheckList(updated);
    return updated;
}

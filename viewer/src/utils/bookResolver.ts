export interface BookInfo {
    id: string;
    title: string;
}

export interface ResolveContext {
    unit?: string;
    rawText?: string;
    topic?: string;
    startPage?: number;
}

/**
 * Detect whether text/context refers to '가' volume or '나' volume of Korean elementary textbooks.
 */
export function detectVolumePreference(text?: string, startPage?: number): '가' | '나' | null {
    if (!text && !startPage) return null;

    const t = text || '';

    // 1. Explicit brackets or parentheses: (나), [나], <나>, 〈나〉
    if (/[\(\[<〈]\s*나\s*[\)\]>〉]/.test(t)) return '나';
    if (/[\(\[<〈]\s*가\s*[\)\]>〉]/.test(t)) return '가';

    // 2. Specific volume keywords like '국어나', '1-2나', '나권'
    if (/(?:국어|1-[12]|2-[12])\s*[\(\[]?\s*나(?=[^\w가-힣]|$)/.test(t) || /(?:^|[^\w가-힣])나\s*권(?=[^\w가-힣]|$)/.test(t) || t.includes('나권')) {
        return '나';
    }
    if (/(?:국어|1-[12]|2-[12])\s*[\(\[]?\s*가(?=[^\w가-힣]|$)/.test(t) || /(?:^|[^\w가-힣])가\s*권(?=[^\w가-힣]|$)/.test(t) || t.includes('가권')) {
        return '가';
    }

    // 3. Unit number inspection: Units 6-12 are '나', Units 1-5 are '가'
    const unitM = /(?:^|[^\d])(\d{1,2})\s*[\.\)]|(?:^|[^\d])(\d{1,2})\s*단원/.exec(t);
    if (unitM) {
        const uNum = parseInt(unitM[1] || unitM[2], 10);
        if (uNum >= 6 && uNum <= 12) return '나';
        if (uNum >= 1 && uNum <= 5) return '가';
    }

    // 4. Page number heuristic: cumulative page numbers >= 140 indicate '나' volume
    if (typeof startPage === 'number' && startPage >= 140) {
        return '나';
    }

    return null;
}

/**
 * Detect semester: '1-1', '1-2', '2-1', '2-2', etc.
 */
export function detectSemesterPreference(text?: string): string | null {
    if (!text) return null;
    const m = /(?:^|[^\w])([1-6]\s*[-_]\s*[12])(?=[^\w]|$)/.exec(text);
    if (m) {
        return m[1].replace(/\s+/g, '').replace('_', '-');
    }
    if (text.includes('2학기')) return '-2';
    if (text.includes('1학기')) return '-1';
    return null;
}

/**
 * Pick the best matching book from a list of candidates based on volume ('가'/'나') and semester ('1-1'/'1-2').
 */
function pickBestBook(
    candidates: BookInfo[],
    volPref: '가' | '나' | null,
    semPref: string | null,
    isActivity: boolean
): BookInfo {
    if (candidates.length === 1) return candidates[0];

    let filtered = candidates;

    // Filter activity vs non-activity
    if (!isActivity) {
        const nonAct = filtered.filter(b => !b.title.includes('활동') && !b.title.includes('익힘') && !b.id.includes('활동') && !b.id.includes('익힘'));
        if (nonAct.length > 0) filtered = nonAct;
    } else {
        const act = filtered.filter(b => b.title.includes('활동') || b.title.includes('익힘') || b.id.includes('활동') || b.id.includes('익힘'));
        if (act.length > 0) filtered = act;
    }
    if (filtered.length === 1) return filtered[0];

    // Filter by semester if specified
    if (semPref) {
        const semMatches = filtered.filter(b => b.id.includes(semPref) || b.title.includes(semPref));
        if (semMatches.length > 0) filtered = semMatches;
    }
    if (filtered.length === 1) return filtered[0];

    // Filter by volume ('가' vs '나')
    if (volPref === '나') {
        const naMatches = filtered.filter(b => b.id.includes('나') && !b.id.includes('가'));
        if (naMatches.length > 0) return naMatches[0];
        const naEnds = filtered.filter(b => b.id.replace(/\.pdf$/i, '').endsWith('나'));
        if (naEnds.length > 0) return naEnds[0];
    } else if (volPref === '가') {
        const gaMatches = filtered.filter(b => b.id.includes('가') && !b.id.includes('나'));
        if (gaMatches.length > 0) return gaMatches[0];
        const gaEnds = filtered.filter(b => b.id.replace(/\.pdf$/i, '').endsWith('가'));
        if (gaEnds.length > 0) return gaEnds[0];
    }

    // Date-based fallback: second semester and late months -> '나'
    const nowM = new Date().getMonth() + 1;
    if (nowM >= 9 || nowM <= 1) {
        const secondSem = filtered.filter(b => b.id.includes('-2') || b.id.includes('2학기'));
        if (secondSem.length > 0) {
            if (nowM >= 11 || nowM <= 1) {
                const naSub = secondSem.find(b => b.id.includes('나'));
                if (naSub) return naSub;
            }
            const gaSub = secondSem.find(b => b.id.includes('가'));
            if (gaSub) return gaSub;
            return secondSem[0];
        }
    }

    return filtered[0];
}

export function resolveBookForSubject(
    subject: string,
    preferredBookId?: string,
    availableBooks: BookInfo[] = [],
    context?: ResolveContext
): BookInfo | null {
    if (!availableBooks || availableBooks.length === 0) return null;

    const norm = (s: string) => s.toLowerCase().replace(/[\s\-_().]/g, '');

    const combinedContext = `${context?.unit || ''} ${context?.rawText || ''} ${context?.topic || ''} ${preferredBookId || ''} ${subject || ''}`;
    const volPref = detectVolumePreference(combinedContext, context?.startPage);
    const semPref = detectSemesterPreference(combinedContext);
    const isActivity = (subject.includes('활동') || subject.includes('익힘') || combinedContext.includes('활동') || combinedContext.includes('익힘')) &&
                       (subject.includes('국어') || subject.includes('수학') || combinedContext.includes('국어') || combinedContext.includes('수학'));

    // 1. Exact or normalized match with preferredBookId
    if (preferredBookId) {
        const cleanPref = preferredBookId.replace(/\.pdf$/i, '').trim();
        const normPref = norm(cleanPref);

        // If preferredBookId already has a direct match
        const exact = availableBooks.find(b => {
            const bClean = b.id.replace(/\.pdf$/i, '').trim();
            return bClean === cleanPref || norm(bClean) === normPref || norm(b.title) === normPref;
        });
        if (exact) {
            // But if preferredBookId is generic like "국어1-2" without volume, and we have volPref
            if (volPref && (!cleanPref.includes('가') && !cleanPref.includes('나'))) {
                const volCandidate = availableBooks.find(b => {
                    const bClean = b.id.replace(/\.pdf$/i, '').trim();
                    return bClean.startsWith(cleanPref) && bClean.includes(volPref);
                });
                if (volCandidate) return volCandidate;
            }
            return exact;
        }

        // Substring / base-stem match for preferredBookId
        // e.g. "국어1-2나" -> preserve volume preference!
        const basePref = normPref.replace(/[0-9]+(-[0-9]+)?/g, '').replace(/[가나]/g, '');
        if (basePref.length >= 2) {
            const baseMatches = availableBooks.filter(b => {
                const bNorm = norm(b.id.replace(/\.pdf$/i, ''));
                const tNorm = norm(b.title.replace(/\.pdf$/i, ''));
                return bNorm.includes(basePref) || tNorm.includes(basePref);
            });
            if (baseMatches.length > 0) {
                return pickBestBook(baseMatches, volPref, semPref, isActivity);
            }
        }
    }

    const cleanSubject = (subject || preferredBookId || '').trim();
    if (!cleanSubject) return null;
    const normSubject = norm(cleanSubject);

    // 2. Direct string inclusion (normalized)
    // e.g. cleanSubject = "국어" -> matches "국어1-2가", "국어1-2나", etc.
    const directMatches = availableBooks.filter(b => {
        const bNorm = norm(b.id.replace(/\.pdf$/i, ''));
        const tNorm = norm(b.title.replace(/\.pdf$/i, ''));
        return bNorm.includes(normSubject) || tNorm.includes(normSubject) || normSubject.includes(bNorm);
    });

    if (directMatches.length > 0) {
        return pickBestBook(directMatches, volPref, semPref, isActivity);
    }

    // 3. Subject aliases for Korean elementary curriculum
    const aliases: Record<string, string[]> = {
        '국어': ['국어', '국활', '국어활동'],
        '국어활동': ['국어활동', '국활', '국어'],
        '국활': ['국어활동', '국어'],
        '수학': ['수학', '수익', '수학익힘'],
        '수학익힘': ['수학익힘', '수익', '수학'],
        '수익': ['수학익힘', '수학'],
        '바른생활': ['하루', '바생', '바른생활', '학교', '봄'],
        '슬기로운생활': ['하루', '슬생', '슬기로운생활', '사람들', '여름', '가을'],
        '즐거운생활': ['하루', '즐생', '즐거운생활', '탐험', '가을', '겨울'],
        '바생': ['하루', '바른생활', '학교', '봄'],
        '슬생': ['하루', '슬기로운생활', '사람들', '여름', '가을'],
        '즐생': ['하루', '즐거운생활', '탐험', '가을', '겨울'],
        '봄': ['봄', '학교', '바른생활', '하루'],
        '여름': ['여름', '사람들', '슬기로운생활', '하루'],
        '가을': ['가을', '탐험', '즐거운생활', '하루'],
        '겨울': ['겨울', '탐험', '하루'],
        '학교': ['학교', '봄', '바른생활', '하루'],
        '사람들': ['사람들', '여름', '슬기로운생활', '하루'],
        '탐험': ['탐험', '가을', '즐거운생활', '하루'],
        '하루': ['하루', '바른생활', '슬기로운생활', '즐거운생활', '학교', '봄'],
    };

    const related = aliases[cleanSubject] || [];
    const aliasMatches: BookInfo[] = [];
    for (const rel of related) {
        const found = availableBooks.filter(b => b.title.includes(rel) || b.id.includes(rel));
        for (const fb of found) {
            if (!aliasMatches.some(m => m.id === fb.id)) {
                aliasMatches.push(fb);
            }
        }
    }
    if (aliasMatches.length > 0) {
        return pickBestBook(aliasMatches, volPref, semPref, isActivity);
    }

    return null;
}

/**
 * Checks if a subject string refers to elementary 1-2 integrated subjects:
 * 바른생활, 슬기로운생활, 즐거운생활, 바생, 슬생, 즐생, 통합 등
 */
export function isIntegratedSubject(subject?: string): boolean {
    if (!subject) return false;
    const clean = subject.replace(/[\s\-_()]/g, '');
    return /^(바른생활|슬기로운생활|즐거운생활|바생|슬생|즐생|통합교과|통합)$/.test(clean) ||
           clean.includes('바른생활') || clean.includes('슬기로운생활') || clean.includes('즐거운생활') ||
           clean.includes('바생') || clean.includes('슬생') || clean.includes('즐생');
}

/**
 * Returns the textbook file/book name for display as the subject name,
 * specifically converting integrated subjects (바생, 슬생, 즐생) to their
 * real textbook file name (e.g. "학교1-1", "사람들1-1", "탐험1-1", "하루" etc.).
 */
export function getDisplaySubjectName(
    subject?: string,
    matchedBookId?: string,
    availableBooks: BookInfo[] = [],
    rawText?: string,
    topicText?: string
): string {
    const rawSubj = (subject || '').trim();
    if (!rawSubj) {
        return matchedBookId ? matchedBookId.replace(/\.pdf$/i, '').trim() : '수업';
    }

    // If it's NOT an integrated subject (e.g. 국어, 수학, 도덕, 아침활동 등), keep original subject
    if (!isIntegratedSubject(rawSubj)) {
        return rawSubj;
    }

    // 1. If matchedBookId is already available and not 'blank', use it!
    if (matchedBookId && matchedBookId !== 'blank') {
        const cleanBookId = matchedBookId.replace(/\.pdf$/i, '').trim();
        if (!isIntegratedSubject(cleanBookId)) {
            return cleanBookId;
        }
    }

    // 2. Try resolving with availableBooks
    if (availableBooks && availableBooks.length > 0) {
        const resolved = resolveBookForSubject(rawSubj, matchedBookId, availableBooks, {
            rawText,
            topic: topicText
        });
        if (resolved && !isIntegratedSubject(resolved.id)) {
            return resolved.id.replace(/\.pdf$/i, '').trim();
        }
    }

    // 3. Scan rawText and topicText for integrated theme textbook names
    // 1-2 grade curriculum themes: 학교, 사람들, 탐험, 하루, 봄, 여름, 가을, 겨울, 세상, 마을, 이웃, 우리나라, 세계
    const combined = `${rawText || ''} ${topicText || ''}`;
    const themes = ['학교', '사람들', '탐험', '하루', '봄', '여름', '가을', '겨울', '세상', '마을', '이웃', '우리나라', '세계'];
    for (const theme of themes) {
        if (combined.includes(theme)) {
            const matchInBooks = availableBooks.find(b => b.id.includes(theme) || b.title.includes(theme));
            if (matchInBooks) {
                return matchInBooks.id.replace(/\.pdf$/i, '').trim();
            }
            return theme;
        }
    }

    return rawSubj;
}

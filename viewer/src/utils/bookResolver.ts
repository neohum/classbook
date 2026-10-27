export interface BookInfo {
    id: string;
    title: string;
    numPages?: number;
    pageOffset?: number;
    startPrintedPage?: number;
    endPrintedPage?: number;
}

export interface ResolveContext {
    unit?: string;
    rawText?: string;
    topic?: string;
    startPage?: number;
}

/**
 * Returns the effective printed page range for a textbook.
 */
export function getBookPrintedRange(book: BookInfo): { start: number; end: number } {
    let start = book.startPrintedPage || 0;
    let end = book.endPrintedPage || 0;

    const offset = typeof book.pageOffset === 'number' ? book.pageOffset : 0;
    const numPages = typeof book.numPages === 'number' ? book.numPages : 0;

    if (start <= 0) {
        if (offset < 0) {
            start = 1 - offset;
        } else {
            start = 1;
        }
    }

    if (end <= 0) {
        if (numPages > 0) {
            end = numPages - offset;
        } else {
            // Heuristic based on book title/ID
            const clean = `${book.id} ${book.title}`;
            if (clean.includes('나') && !clean.includes('가')) {
                start = 140;
                end = 280;
            } else {
                start = 1;
                end = 140;
            }
        }
    }

    return { start, end };
}

/**
 * Detect whether text/context refers to '가' volume or '나' volume of Korean elementary textbooks.
 */
export function detectVolumePreference(text?: string, startPage?: number): '가' | '나' | null {
    const t = text || '';

    // 1. Page number heuristic: cumulative page numbers >= 140 indicate '나' volume
    if (typeof startPage === 'number' && startPage >= 140) {
        return '나';
    }

    // 2. Explicit brackets or parentheses: (나), [나], <나>, 〈나〉
    if (/[\(\[<〈]\s*나\s*[\)\]>〉]/.test(t)) return '나';
    if (/[\(\[<〈]\s*가\s*[\)\]>〉]/.test(t)) return '가';

    // 3. Specific volume keywords like '국어나', '1-2나', '나권'
    if (/(?:국어|1-[12]|2-[12])\s*[\(\[]?\s*나(?=[^\w가-힣]|$)/.test(t) || /(?:^|[^\w가-힣])나\s*권(?=[^\w가-힣]|$)/.test(t) || t.includes('나권')) {
        return '나';
    }
    if (/(?:국어|1-[12]|2-[12])\s*[\(\[]?\s*가(?=[^\w가-힣]|$)/.test(t) || /(?:^|[^\w가-힣])가\s*권(?=[^\w가-힣]|$)/.test(t) || t.includes('가권')) {
        return '가';
    }

    // 4. Unit number inspection: Units 6-12 are '나', Units 1-5 are '가'
    const unitM = /(?:^|[^\d])(\d{1,2})\s*[\.\)]|(?:^|[^\d])(\d{1,2})\s*단원/.exec(t);
    if (unitM) {
        const uNum = parseInt(unitM[1] || unitM[2], 10);
        if (uNum >= 6 && uNum <= 12) return '나';
        if (uNum >= 1 && uNum <= 5) return '가';
    }

    // 5. Page number < 140 and > 0 heuristic -> '가'
    if (typeof startPage === 'number' && startPage > 0 && startPage < 140) {
        return '가';
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
 * Pick the best matching book from a list of candidates based on page range, volume ('가'/'나') and semester ('1-1'/'1-2').
 */
function pickBestBook(
    candidates: BookInfo[],
    volPref: '가' | '나' | null,
    semPref: string | null,
    isActivity: boolean,
    targetPage?: number
): BookInfo {
    if (candidates.length === 1) return candidates[0];

    let filtered = candidates;

    // 1. Filter activity vs non-activity
    if (!isActivity) {
        const nonAct = filtered.filter(b => !b.title.includes('활동') && !b.title.includes('익힘') && !b.id.includes('활동') && !b.id.includes('익힘'));
        if (nonAct.length > 0) filtered = nonAct;
    } else {
        const act = filtered.filter(b => b.title.includes('활동') || b.title.includes('익힘') || b.id.includes('활동') || b.id.includes('익힘'));
        if (act.length > 0) filtered = act;
    }
    if (filtered.length === 1) return filtered[0];

    // 2. Strict printed page range match: if targetPage is specified, find the book whose range covers targetPage!
    if (typeof targetPage === 'number' && targetPage > 0) {
        const rangeMatches = filtered.filter(b => {
            const range = getBookPrintedRange(b);
            return targetPage >= range.start && targetPage <= range.end;
        });
        if (rangeMatches.length > 0) {
            filtered = rangeMatches;
            if (filtered.length === 1) return filtered[0];
        }
    }

    // 3. Filter by semester if specified or current date semester fallback
    const nowM = new Date().getMonth() + 1;
    const currentSem = (nowM >= 8 || nowM <= 1) ? '-2' : '-1';
    const effectiveSem = semPref || currentSem;
    if (effectiveSem) {
        const semMatches = filtered.filter(b => b.id.includes(effectiveSem) || b.title.includes(effectiveSem) || (effectiveSem === '-2' && b.id.includes('2학기')) || (effectiveSem === '-1' && b.id.includes('1학기')));
        if (semMatches.length > 0) filtered = semMatches;
    }
    if (filtered.length === 1) return filtered[0];

    // 4. Filter by volume ('가' vs '나')
    if (volPref === '나') {
        const naMatches = filtered.filter(b => b.id.includes('나') && !b.id.includes('가'));
        if (naMatches.length > 0) {
            filtered = naMatches;
        } else {
            const naEnds = filtered.filter(b => b.id.replace(/\.pdf$/i, '').endsWith('나'));
            if (naEnds.length > 0) filtered = naEnds;
        }
    } else if (volPref === '가') {
        const gaMatches = filtered.filter(b => b.id.includes('가') && !b.id.includes('나'));
        if (gaMatches.length > 0) {
            filtered = gaMatches;
        } else {
            const gaEnds = filtered.filter(b => b.id.replace(/\.pdf$/i, '').endsWith('가'));
            if (gaEnds.length > 0) filtered = gaEnds;
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

    const targetPage = typeof context?.startPage === 'number' && context.startPage > 0 ? context.startPage : undefined;
    const combinedContext = `${context?.unit || ''} ${context?.rawText || ''} ${context?.topic || ''} ${preferredBookId || ''} ${subject || ''}`;
    const volPref = detectVolumePreference(combinedContext, targetPage);
    const semPref = detectSemesterPreference(combinedContext);
    const isActivity = (subject.includes('활동') || subject.includes('익힘') || combinedContext.includes('활동') || combinedContext.includes('익힘')) &&
                       (subject.includes('국어') || subject.includes('수학') || combinedContext.includes('국어') || combinedContext.includes('수학'));

    // 1. Exact or normalized match with preferredBookId
    if (preferredBookId) {
        const cleanPref = preferredBookId.replace(/\.pdf$/i, '').trim();
        const normPref = norm(cleanPref);

        // If preferredBookId is generic like "국어1-2" or "국어" without specific volume
        const isGenericWithoutVol = !cleanPref.includes('가') && !cleanPref.includes('나');

        if (!isGenericWithoutVol) {
            const exact = availableBooks.find(b => {
                const bClean = b.id.replace(/\.pdf$/i, '').trim();
                return bClean === cleanPref || norm(bClean) === normPref || norm(b.title) === normPref;
            });
            if (exact) return exact;
        } else {
            // Find books matching generic prefix e.g. "국어1-2" -> candidates ["국어1-2가", "국어1-2나"]
            const candidates = availableBooks.filter(b => {
                const bClean = b.id.replace(/\.pdf$/i, '').trim();
                return bClean.startsWith(cleanPref) || norm(bClean).startsWith(normPref);
            });
            if (candidates.length > 0) {
                return pickBestBook(candidates, volPref, semPref, isActivity, targetPage);
            }
        }

        // Substring / base-stem match for preferredBookId
        const basePref = normPref.replace(/[0-9]+(-[0-9]+)?/g, '').replace(/[가나]/g, '');
        if (basePref.length >= 2) {
            const baseMatches = availableBooks.filter(b => {
                const bNorm = norm(b.id.replace(/\.pdf$/i, ''));
                const tNorm = norm(b.title.replace(/\.pdf$/i, ''));
                return bNorm.includes(basePref) || tNorm.includes(basePref);
            });
            if (baseMatches.length > 0) {
                return pickBestBook(baseMatches, volPref, semPref, isActivity, targetPage);
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
        return pickBestBook(directMatches, volPref, semPref, isActivity, targetPage);
    }

    // 3. Subject aliases for Korean elementary curriculum
    const aliases: Record<string, string[]> = {
        '국어': ['국어', '국활', '국어활동'],
        '국어활동': ['국어활동', '국활', '국어'],
        '국활': ['국어활동', '국어'],
        '수학': ['수학', '수익', '수학익힘'],
        '수학익힘': ['수학익힘', '수익', '수학'],
        '수익': ['수학익힘', '수학'],
        '바른생활': ['약속', '하루', '바생', '바른생활', '학교', '봄', '상상'],
        '슬기로운생활': ['약속', '하루', '슬생', '슬기로운생활', '사람들', '여름', '가을', '이야기'],
        '즐거운생활': ['약속', '하루', '즐생', '즐거운생활', '탐험', '가을', '겨울'],
        '바생': ['약속', '하루', '바른생활', '학교', '봄', '상상'],
        '슬생': ['약속', '하루', '슬기로운생활', '사람들', '여름', '가을', '이야기'],
        '즐생': ['약속', '하루', '즐거운생활', '탐험', '가을', '겨울'],
        '봄': ['봄', '학교', '바른생활', '하루'],
        '여름': ['여름', '사람들', '슬기로운생활', '하루'],
        '가을': ['가을', '탐험', '즐거운생활', '하루'],
        '겨울': ['겨울', '탐험', '하루'],
        '상상': ['상상', '바른생활', '하루'],
        '이야기': ['이야기', '슬기로운생활', '하루'],
        '약속': ['약속', '즐거운생활', '바른생활', '슬기로운생활', '하루'],
        '학교': ['학교', '봄', '바른생활', '하루'],
        '사람들': ['사람들', '여름', '슬기로운생활', '하루'],
        '탐험': ['탐험', '가을', '즐거운생활', '하루'],
        '하루': ['하루', '바른생활', '슬기로운생활', '즐거운생활', '학교', '봄'],
    };

    let related = aliases[cleanSubject] || [];
    const themes = ['학교', '사람들', '탐험', '약속', '봄', '여름', '가을', '겨울', '세상', '마을', '이웃', '우리나라', '세계', '상상', '이야기', '하루'];
    for (const th of themes) {
        if (combinedContext.includes(th)) {
            related = [th, ...related.filter(r => r !== th)];
            break;
        }
    }

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
        return pickBestBook(aliasMatches, volPref, semPref, isActivity, targetPage);
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

    // 0. If rawText or topicText explicitly specifies a theme (e.g. '약속'),
    // prioritize that theme over a default/fallback matchedBookId (such as '하루')
    const combined = `${rawText || ''} ${topicText || ''}`;
    const themes = ['학교', '사람들', '탐험', '약속', '봄', '여름', '가을', '겨울', '세상', '마을', '이웃', '우리나라', '세계', '상상', '이야기', '하루'];
    for (const theme of themes) {
        if (combined.includes(theme)) {
            const matchInBooks = availableBooks.find(b => b.id.includes(theme) || b.title.includes(theme));
            if (matchInBooks) {
                return matchInBooks.id.replace(/\.pdf$/i, '').trim();
            }
            return theme;
        }
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

    return rawSubj;
}

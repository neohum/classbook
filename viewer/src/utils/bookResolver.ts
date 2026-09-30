export interface BookInfo {
    id: string;
    title: string;
}

export function resolveBookForSubject(
    subject: string,
    preferredBookId?: string,
    availableBooks: BookInfo[] = []
): BookInfo | null {
    if (!availableBooks || availableBooks.length === 0) return null;

    const norm = (s: string) => s.toLowerCase().replace(/[\s\-_().]/g, '');

    // 1. Exact or normalized match with preferredBookId
    if (preferredBookId) {
        const cleanPref = preferredBookId.replace(/\.pdf$/i, '').trim();
        const normPref = norm(cleanPref);
        const exact = availableBooks.find(b => {
            const bClean = b.id.replace(/\.pdf$/i, '').trim();
            return bClean === cleanPref || norm(bClean) === normPref || norm(b.title) === normPref;
        });
        if (exact) return exact;

        // 1-1. Substring / base-stem match for preferredBookId
        // e.g. "하루" -> matches "하루1-2", "국어1-1가" -> matches "국어1-2가", "수학1-1" -> matches "수학1-2"
        const basePref = normPref.replace(/[0-9]+(-[0-9]+)?/g, '').replace(/[가나]/g, '');
        if (basePref.length >= 2) {
            const baseMatches = availableBooks.filter(b => {
                const bNorm = norm(b.id.replace(/\.pdf$/i, ''));
                const tNorm = norm(b.title.replace(/\.pdf$/i, ''));
                return bNorm.includes(basePref) || tNorm.includes(basePref);
            });
            if (baseMatches.length > 0) {
                // If base is "국어" or "수학", prioritize non-활동 / non-익힘 unless specified
                if (!normPref.includes("활동") && !normPref.includes("익힘")) {
                    const primary = baseMatches.find(b => !b.title.includes("활동") && !b.title.includes("익힘") && !b.id.includes("활동") && !b.id.includes("익힘"));
                    if (primary) return primary;
                }
                return baseMatches[0];
            }
        }
    }

    const cleanSubject = (subject || preferredBookId || '').trim();
    if (!cleanSubject) return null;
    const normSubject = norm(cleanSubject);

    // 2. Direct string inclusion (normalized)
    // e.g. cleanSubject = "국어" -> matches "국어1-2가", "국어1-1가", etc.
    const directMatches = availableBooks.filter(b => {
        const bNorm = norm(b.id.replace(/\.pdf$/i, ''));
        const tNorm = norm(b.title.replace(/\.pdf$/i, ''));
        return bNorm.includes(normSubject) || tNorm.includes(normSubject) || normSubject.includes(bNorm);
    });

    if (directMatches.length > 0) {
        // If subject is "국어", prioritize books without "활동" unless subject has "활동"
        if (!cleanSubject.includes("활동") && !cleanSubject.includes("익힘")) {
            const primary = directMatches.find(b => !b.title.includes("활동") && !b.title.includes("익힘") && !b.id.includes("활동") && !b.id.includes("익힘"));
            if (primary) return primary;
        }
        return directMatches[0];
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
    for (const rel of related) {
        const found = availableBooks.find(b => b.title.includes(rel) || b.id.includes(rel));
        if (found) return found;
    }

    return null;
}

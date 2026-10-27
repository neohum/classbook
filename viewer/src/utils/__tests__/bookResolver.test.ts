import { getDisplaySubjectName, resolveBookForSubject, isIntegratedSubject } from '../bookResolver';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

describe('bookResolver integrated subjects and 약속 theme', () => {
    it('isIntegratedSubject correctly identifies integrated subjects', () => {
        expect(isIntegratedSubject('즐거운생활')).toBe(true);
        expect(isIntegratedSubject('즐생')).toBe(true);
        expect(isIntegratedSubject('바생')).toBe(true);
        expect(isIntegratedSubject('슬생')).toBe(true);
        expect(isIntegratedSubject('국어')).toBe(false);
        expect(isIntegratedSubject('수학')).toBe(false);
    });

    it('prioritizes explicit theme "약속" over default matchedBookId "하루"', () => {
        // Even if matchedBookId was defaulted to "하루", if topic/raw specifies "약속", display name must be "약속"
        const displayName = getDisplaySubjectName(
            '즐생',
            '하루',
            [],
            '즐생 1. 약속을 지켜요',
            '약속을 지켜요'
        );
        expect(displayName).toBe('약속');
    });

    it('prioritizes "약속" book when available in availableBooks', () => {
        const books = [
            { id: '하루1-2.pdf', title: '하루 1-2' },
            { id: '약속1-2.pdf', title: '약속 1-2' }
        ];
        const displayName = getDisplaySubjectName(
            '즐거운생활',
            '하루',
            books,
            '즐거운생활 약속',
            '약속 노래 부르기'
        );
        expect(displayName).toBe('약속1-2');
    });

    it('resolves book for subject with context topic containing "약속"', () => {
        const books = [
            { id: '하루1-2.pdf', title: '하루 1-2' },
            { id: '약속1-2.pdf', title: '약속 1-2' }
        ];
        const resolved = resolveBookForSubject('즐생', undefined, books, {
            topic: '약속을 지켜요',
            rawText: '즐생 약속'
        });
        expect(resolved).not.toBe(null);
        expect(resolved?.id).toBe('약속1-2.pdf');
    });

    it('keeps original subject for non-integrated subjects', () => {
        expect(getDisplaySubjectName('국어', '국어1-1가', [])).toBe('국어');
        expect(getDisplaySubjectName('수학', '수학1-1', [])).toBe('수학');
    });
});

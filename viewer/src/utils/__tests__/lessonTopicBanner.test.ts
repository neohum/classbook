import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LessonTopicCenterBanner, {
    createLessonDismissKey,
    formatLessonPageLabel,
    isLessonBannerDismissed,
    markLessonBannerDismissed,
    resolvePhysicalPageWithOffset
} from '../../components/LessonTopicCenterBanner';
import WeeklyPlanAlertModal from '../../components/WeeklyPlanAlertModal';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

describe('Step 1: LessonTopicCenterBanner & WeeklyPlanAlertModal', () => {
    it('AC-1: renders compact center floating banner (max-width: 460px, glass card) with period, subject, page, and topic without blocking background', () => {
        const html = renderToStaticMarkup(
            React.createElement(LessonTopicCenterBanner, {
                isOpen: true,
                lesson: {
                    periodName: '1교시',
                    periodTime: '09:00 ~ 09:40',
                    subject: '국어',
                    pageStr: '42~45쪽',
                    startPage: 42,
                    endPage: 45,
                    topic: '문단의 중심생각을 찾고 내 생각 말하기',
                    matchedBookId: '국어1-2가'
                },
                pageOffset: 2,
                totalPages: 160,
                onClose: () => {},
                onJumpToPage: () => {}
            })
        );

        expect(html).toContain('max-width:460px');
        expect(html).toContain('pointer-events-none');
        expect(html).toContain('backdrop-blur-xl');
        expect(html).toContain('1교시');
        expect(html).toContain('국어');
        expect(html).toContain('42~45쪽');
        expect(html).toContain('문단의 중심생각을 찾고 내 생각 말하기');
        expect(html).toContain('해당 쪽 바로 펼치기 (42~45쪽)');
        expect(html).toContain('닫힘');
    });

    it('AC-1: WeeklyPlanAlertModal delegates active class start (isRestTime=false) to LessonTopicCenterBanner by default', () => {
        const html = renderToStaticMarkup(
            React.createElement(WeeklyPlanAlertModal, {
                isOpen: true,
                isRestTime: false,
                periodName: '2교시',
                periodTime: '09:50 ~ 10:30',
                item: {
                    period: 2,
                    subject: '수학',
                    matchedBookId: '수학1-2',
                    topic: '분수의 덧셈과 뺄셈 알아보기',
                    pageStr: '68쪽',
                    startPage: 68,
                    endPage: 69,
                    raw: '수학 68쪽'
                } as any,
                onClose: () => {},
                onGoToBook: () => {}
            })
        );

        expect(html).toContain('lesson-topic-center-banner-card');
        expect(html).toContain('max-width:460px');
        expect(html).toContain('수학');
        expect(html).toContain('68쪽');
        expect(html).toContain('분수의 덧셈과 뺄셈 알아보기');
    });

    it('AC-2: prevents re-showing the banner within the same period after dismissal', () => {
        const key1 = createLessonDismissKey('2026-10-14', '1교시', '국어', 42);
        const key2 = createLessonDismissKey('2026-10-14', '2교시', '수학', 68);

        expect(isLessonBannerDismissed(key1)).toBe(false);
        markLessonBannerDismissed(key1);
        expect(isLessonBannerDismissed(key1)).toBe(true);
        expect(isLessonBannerDismissed(key2)).toBe(false);
    });

    it('AC-2: resolves target physical page accurately with ocrOffsetDetector offset and bounds', () => {
        // Printed page 42 with +3 cover offset -> physical page 45
        expect(resolvePhysicalPageWithOffset(42, 3, 150)).toBe(45);

        // When OCR detection result is provided, prefers detected offset
        const ocrResult = {
            detected: true,
            physicalPage: 10,
            printedPage: 6,
            offset: 4,
            confidenceMsg: 'detected'
        };
        expect(resolvePhysicalPageWithOffset(42, 2, 150, ocrResult)).toBe(46);

        // Clamps within [1, totalPages]
        expect(resolvePhysicalPageWithOffset(200, 5, 120)).toBe(120);
        expect(resolvePhysicalPageWithOffset(1, -5, 120)).toBe(1);
    });

    it('formats lesson page label cleanly for single page, range, or activity lessons', () => {
        expect(
            formatLessonPageLabel({
                periodName: '1교시',
                subject: '국어',
                startPage: 15,
                endPage: 18
            })
        ).toBe('15~18쪽');

        expect(
            formatLessonPageLabel({
                periodName: '3교시',
                subject: '창체',
                startPage: 0
            })
        ).toBe('활동 중심 수업');
    });
});

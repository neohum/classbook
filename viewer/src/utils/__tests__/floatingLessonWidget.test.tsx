import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FloatingLessonWidget, {
    formatFullscreenActionLabel,
    calculateSelfCheckProgress
} from '../../components/FloatingLessonWidget';
import { DEFAULT_MARKET_CATALOG } from '../marketRecommender';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

describe('Step 3: FloatingLessonWidget UI & Helpers', () => {
    it('AC-1: formats 1-click fullscreen lesson button label and calculates self-check progress accurately', () => {
        const label = formatFullscreenActionLabel(2, '2교시', '수학');
        expect(label).toBe('2교시: 수학 학습자료 전체화면 열기');

        const morningLabel = formatFullscreenActionLabel(0, '', '아침독서');
        expect(morningLabel).toBe('아침활동: 아침독서 학습자료 전체화면 열기');

        const progress = calculateSelfCheckProgress([
            { id: '1', label: '출결 확인', category: 'attendance', completed: true, sessionToken: 'anon_1' },
            { id: '2', label: '교과서 준비', category: 'task', completed: false, sessionToken: 'anon_1' }
        ]);
        expect(progress.completedCount).toBe(1);
        expect(progress.totalCount).toBe(2);
        expect(progress.percent).toBe(50);
    });

    it('AC-2: renders floating trigger badge and 수업 자료 tab with 1-click fullscreen button and Flaticon UIcons', () => {
        const html = renderToStaticMarkup(
            React.createElement(FloatingLessonWidget, {
                currentDay: '월',
                currentPeriod: 2,
                currentPeriodName: '2교시',
                subject: '수학',
                topic: '분수의 크기 비교',
                activeMaterials: [DEFAULT_MARKET_CATALOG[2]],
                initialOpen: true,
                initialTab: 'materials',
                onOpenFullscreenLesson: () => {}
            })
        );

        expect(html).toContain('floating-lesson-widget');
        expect(html).toContain('bound-materials-badge');
        expect(html).toContain('[2교시: 수학 학습자료 전체화면 열기]');
        expect(html).toContain(DEFAULT_MARKET_CATALOG[2].title);
        expect(html).toContain('올마켓 맞춤 추천 자료');
        expect(html).toContain('수업 시작 시 자동 전체화면 전환');
        expect(html).toContain('fi fi-rr-');
        expect(html).not.toContain('<svg');
    });

    it('AC-3: renders 셀프체크 tab with autonomous attendance & task checklist and zero PII fields', () => {
        const html = renderToStaticMarkup(
            React.createElement(FloatingLessonWidget, {
                currentDay: '월',
                currentPeriod: 1,
                currentPeriodName: '1교시',
                subject: '국어',
                topic: '글자의 짜임',
                activeMaterials: [],
                initialOpen: true,
                initialTab: 'selfcheck',
                onOpenFullscreenLesson: () => {}
            })
        );

        expect(html).toContain('selfcheck-tab-panel');
        expect(html).toContain('우리 반 자율 셀프체크 달성률');
        expect(html).toContain('오늘의 출결 확인');
        expect(html).toContain('오늘 해야 할 일');
        expect(html).toContain('학생 개인정보(실명·학번 등)를 수집하지 않는 익명 학급 자율 점검표입니다.');
        expect(html).not.toContain('<svg');
    });
});

import {
    evaluateLessonScheduleTick,
    getLessonSchedulerConfig,
    saveLessonSchedulerConfig,
    LESSON_START_EVENT,
    LESSON_PRE_START_EVENT
} from '../lessonScheduler';
import { DEFAULT_SCHEDULE } from '../../components/ScheduleConfigModal';
import { DEFAULT_MARKET_CATALOG } from '../marketRecommender';
import type { PeriodMaterialBinding } from '../../types/weeklyPlanMarket';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

describe('Step 2: Lesson Scheduler Tick Evaluator & Config', () => {
    const sampleBindings: Record<string, PeriodMaterialBinding> = {
        '월_1': {
            day: '월',
            period: 1,
            subject: '국어',
            topic: '글자의 짜임',
            materials: [DEFAULT_MARKET_CATALOG[0]],
            updatedAt: '2026-10-22T08:00:00Z'
        },
        '월_2': {
            day: '월',
            period: 2,
            subject: '수학',
            topic: '분수의 크기 비교',
            materials: [DEFAULT_MARKET_CATALOG[2]],
            updatedAt: '2026-10-22T08:00:00Z'
        }
    };

    it('AC-1: emits PRE_START alert 1 minute before period start without duplicate firing', () => {
        const triggered = new Set<string>();
        // 1교시 starts at 09:00 -> 1 minute before is 08:59
        const nowPre = new Date(2026, 9, 22, 8, 59, 0);
        const tick1 = evaluateLessonScheduleTick(nowPre, DEFAULT_SCHEDULE, sampleBindings, '월', triggered);

        expect(tick1.triggerType).toBe('PRE_START');
        expect(tick1.eventName).toBe(LESSON_PRE_START_EVENT);
        expect(tick1.alertMessage).toContain('1교시');
        expect(tick1.alertMessage).toContain('1분 전');

        // Calling again within the same minute should not re-trigger
        const tick2 = evaluateLessonScheduleTick(nowPre, DEFAULT_SCHEDULE, sampleBindings, '월', triggered);
        expect(tick2.triggerType).toBe(null);
    });

    it('AC-2: emits PERIOD_START (LESSON_START_EVENT) at exact period start and resolves activeMaterials', () => {
        const triggered = new Set<string>();
        // 2교시 starts at 09:50
        const nowStart = new Date(2026, 9, 22, 9, 50, 0);
        const tick = evaluateLessonScheduleTick(
            nowStart,
            DEFAULT_SCHEDULE,
            sampleBindings,
            '월',
            triggered,
            { autoFullscreen: true }
        );

        expect(tick.triggerType).toBe('PERIOD_START');
        expect(tick.eventName).toBe(LESSON_START_EVENT);
        expect(tick.currentPeriod).toBe(2);
        expect(tick.currentPeriodName).toBe('2교시');
        expect(tick.activeMaterials).toHaveLength(1);
        expect(tick.activeMaterials[0].id).toBe(DEFAULT_MARKET_CATALOG[2].id);
        expect(tick.shouldEnterFullscreen).toBe(true);
    });

    it('AC-3: persists and loads LessonSchedulerConfig (autoAlert & autoFullscreen)', () => {
        const initial = getLessonSchedulerConfig();
        expect(initial.autoAlert).toBe(true);
        expect(initial.autoFullscreen).toBe(true);

        const updated = saveLessonSchedulerConfig({ autoFullscreen: false });
        expect(updated.autoFullscreen).toBe(false);
        expect(getLessonSchedulerConfig().autoFullscreen).toBe(false);
    });
});

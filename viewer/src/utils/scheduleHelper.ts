import { type ScheduleItem, isLunchSchedule, isBreakSchedule, parsePeriodFromName } from '../components/ScheduleConfigModal';
import { main } from '../../wailsjs/go/models';
import { DEFAULT_MORNING_TOPICS } from '../components/WeeklyPlanScheduleModal';

export interface CurrentClassStatus {
    isRestTime: boolean;
    periodName: string;
    periodTime: string;
    customMessage: string;
    // Current period item (if in class)
    item: main.WeeklyPlanItem | null;
    // Upcoming period item (for break time / prep time / lunch time)
    nextItem: main.WeeklyPlanItem | null;
    nextPeriodName: string;
    nextPeriodTime: string;
    targetDay: string;
}

export function getCurrentClassStatus(
    now: Date = new Date(),
    schedules: ScheduleItem[],
    plan: main.WeeklyPlanResult | null
): CurrentClassStatus {
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];
    const targetDay = (dayOfWeek === '일' || dayOfWeek === '토') ? '월' : dayOfWeek;
    const dayItems = plan?.schedule?.[targetDay] || [];

    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${hh}:${mm}`;

    if (!schedules || schedules.length === 0) {
        return {
            isRestTime: false,
            periodName: '수업',
            periodTime: currentTimeStr,
            customMessage: '시간표 설정이 필요합니다.',
            item: null,
            nextItem: null,
            nextPeriodName: '',
            nextPeriodTime: '',
            targetDay
        };
    }

    // Sort schedules chronologically by startTime
    const sorted = [...schedules].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    // Helper to find weekly plan item for a given period number
    const findPlanItem = (pNum: number): main.WeeklyPlanItem | null => {
        if (pNum === 0) {
            const found = dayItems.find(it => it.period === 0);
            if (found) return found;
            const defTopic = DEFAULT_MORNING_TOPICS[targetDay] || '아침 자율 독서 및 활동';
            return {
                period: 0,
                subject: '아침활동',
                matchedBookId: 'blank',
                startPage: 0,
                endPage: 0,
                pageStr: '',
                topic: defTopic,
                raw: `아침활동 ${defTopic}`
            };
        }
        if (pNum > 0) {
            const found = dayItems.find(it => it.period === pNum);
            if (found) return found;
        }
        return null;
    };

    // Helper to find next regular class period starting from index `fromIdx`
    const findNextClassSchedule = (fromIdx: number): { sched: ScheduleItem; item: main.WeeklyPlanItem | null } | null => {
        for (let j = fromIdx; j < sorted.length; j++) {
            const s = sorted[j];
            const p = s.period !== undefined ? s.period : parsePeriodFromName(s.name, j + 1);
            if (p >= 0 && !isLunchSchedule(s.name) && !isBreakSchedule(s.name)) {
                return {
                    sched: s,
                    item: findPlanItem(p)
                };
            }
        }
        return null;
    };

    // 1. Before the first schedule of the day
    if (currentTimeStr < sorted[0].startTime) {
        const next = findNextClassSchedule(0);
        const nextSched = next?.sched || sorted[0];
        const nextP = nextSched.period !== undefined ? nextSched.period : 1;
        const nextTitle = nextSched.name || (nextP === 0 ? '아침활동' : `${nextP}교시`);
        return {
            isRestTime: true,
            periodName: '등교 및 수업 준비 시간',
            periodTime: `~ ${sorted[0].startTime}`,
            customMessage: '등교 시간입니다. 하루 일과와 수업을 미리 준비해 주세요!',
            item: null,
            nextItem: next?.item || null,
            nextPeriodName: nextTitle,
            nextPeriodTime: `${nextSched.startTime} ~ ${nextSched.endTime}`,
            targetDay
        };
    }

    // 2. Iterate through sorted schedules
    for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i];
        const pNum = s.period !== undefined ? s.period : parsePeriodFromName(s.name, i + 1);
        const isLunch = isLunchSchedule(s.name) || pNum === -1;
        const isBreak = isBreakSchedule(s.name) || pNum === -2;

        // Inside this schedule's active duration: startTime <= current < endTime
        if (currentTimeStr >= s.startTime && currentTimeStr < s.endTime) {
            if (isLunch) {
                const next = findNextClassSchedule(i + 1);
                const nextTitle = next ? (next.sched.name || `${next.sched.period}교시`) : '5교시';
                return {
                    isRestTime: true,
                    periodName: s.name || '점심시간',
                    periodTime: `${s.startTime} ~ ${s.endTime}`,
                    customMessage: s.startMessage || '점심시간입니다. 즐겁고 맛있는 식사 시간 되세요!',
                    item: null,
                    nextItem: next?.item || null,
                    nextPeriodName: nextTitle,
                    nextPeriodTime: next ? `${next.sched.startTime} ~ ${next.sched.endTime}` : '',
                    targetDay
                };
            }
            if (isBreak) {
                const next = findNextClassSchedule(i + 1);
                const nextTitle = next ? (next.sched.name || `${next.sched.period}교시`) : '5교시';
                return {
                    isRestTime: true,
                    periodName: s.name || '5분 준비시간',
                    periodTime: `${s.startTime} ~ ${s.endTime}`,
                    customMessage: s.startMessage || '5교시 시작 5분 전입니다. 수업 준비를 해주세요.',
                    item: null,
                    nextItem: next?.item || null,
                    nextPeriodName: nextTitle,
                    nextPeriodTime: next ? `${next.sched.startTime} ~ ${next.sched.endTime}` : '',
                    targetDay
                };
            }

            // Normal class (period 0, 1, 2, 3, 4, 5, 6...)
            const curItem = findPlanItem(pNum);
            const periodTitle = s.name || (pNum === 0 ? '아침활동' : `${pNum}교시`);
            return {
                isRestTime: false,
                periodName: periodTitle,
                periodTime: `${s.startTime} ~ ${s.endTime}`,
                customMessage: s.startMessage || `${periodTitle} 수업을 시작합니다.`,
                item: curItem,
                nextItem: null,
                nextPeriodName: '',
                nextPeriodTime: '',
                targetDay
            };
        }

        // Between this schedule and next schedule: s.endTime <= current < next.startTime
        if (i < sorted.length - 1) {
            const nextSched = sorted[i + 1];
            if (currentTimeStr >= s.endTime && currentTimeStr < nextSched.startTime) {
                const nextClass = findNextClassSchedule(i + 1);
                const nextTitle = nextClass ? (nextClass.sched.name || `${nextClass.sched.period}교시`) : nextSched.name;
                return {
                    isRestTime: true,
                    periodName: `${s.name || `${pNum}교시`} 쉬는 시간`,
                    periodTime: `${s.endTime} ~ ${nextSched.startTime}`,
                    customMessage: s.restMessage || '쉬는 시간입니다. 잠시 휴식을 취하고 다음 수업을 준비하세요.',
                    item: null,
                    nextItem: nextClass?.item || null,
                    nextPeriodName: nextTitle,
                    nextPeriodTime: nextClass ? `${nextClass.sched.startTime} ~ ${nextClass.sched.endTime}` : `${nextSched.startTime} ~ ${nextSched.endTime}`,
                    targetDay
                };
            }
        }
    }

    // 3. After the last schedule of the day
    const lastSched = sorted[sorted.length - 1];
    return {
        isRestTime: true,
        periodName: '일과 종료 (방과후)',
        periodTime: `${lastSched.endTime} ~`,
        customMessage: lastSched.restMessage || '오늘의 모든 수업 일과가 종료되었습니다. 수고 많으셨습니다!',
        item: null,
        nextItem: null,
        nextPeriodName: '',
        nextPeriodTime: '',
        targetDay
    };
}

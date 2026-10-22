import {
    type ScheduleItem,
    isLunchSchedule,
    isBreakSchedule,
    parsePeriodFromName
} from '../components/ScheduleConfigModal';
import type {
    LessonMaterialRef,
    LessonSchedulerConfig,
    PeriodMaterialBinding
} from '../types/weeklyPlanMarket';
import { getPeriodSlotKey } from './marketRecommender';

export const LESSON_SCHEDULER_CONFIG_KEY = 'classbook_lesson_scheduler_config_v1';
export const LESSON_START_EVENT = 'LESSON_START_EVENT';
export const LESSON_PRE_START_EVENT = 'LESSON_PRE_START_EVENT';

export interface LessonScheduleTickResult {
    triggerType: 'PRE_START' | 'PERIOD_START' | null;
    eventName: typeof LESSON_START_EVENT | typeof LESSON_PRE_START_EVENT | null;
    triggerKey: string | null;
    alertMessage: string | null;
    shouldEnterFullscreen: boolean;
    currentPeriod: number | null;
    currentPeriodName: string;
    activeMaterials: LessonMaterialRef[];
    upcomingPeriod: number | null;
    upcomingPeriodName: string;
    upcomingMaterials: LessonMaterialRef[];
    nextTriggeredKeys: Set<string>;
}

const DEFAULT_SCHEDULER_CONFIG: LessonSchedulerConfig = {
    autoAlert: true,
    autoFullscreen: true
};

export function getLessonSchedulerConfig(): LessonSchedulerConfig {
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(LESSON_SCHEDULER_CONFIG_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    autoAlert: typeof parsed.autoAlert === 'boolean' ? parsed.autoAlert : DEFAULT_SCHEDULER_CONFIG.autoAlert,
                    autoFullscreen: typeof parsed.autoFullscreen === 'boolean' ? parsed.autoFullscreen : DEFAULT_SCHEDULER_CONFIG.autoFullscreen
                };
            }
        }
    } catch (e) {}
    return { ...DEFAULT_SCHEDULER_CONFIG };
}

export function saveLessonSchedulerConfig(
    partial: Partial<LessonSchedulerConfig>
): LessonSchedulerConfig {
    const current = getLessonSchedulerConfig();
    const updated: LessonSchedulerConfig = {
        ...current,
        ...partial
    };
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(LESSON_SCHEDULER_CONFIG_KEY, JSON.stringify(updated));
        }
    } catch (e) {}
    return updated;
}

function parseTimeToMinutes(timeStr: string): number | null {
    if (!timeStr) return null;
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return null;
    const hh = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    if (isNaN(hh) || isNaN(mm)) return null;
    return hh * 60 + mm;
}

function formatDateYMD(now: Date): string {
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function evaluateLessonScheduleTick(
    now: Date,
    schedules: ScheduleItem[],
    bindings: Record<string, PeriodMaterialBinding>,
    currentDayLabel: string,
    prevTriggeredKeys: Set<string>,
    options?: { autoFullscreen?: boolean; autoAlert?: boolean }
): LessonScheduleTickResult {
    const nextTriggeredKeys = new Set<string>(prevTriggeredKeys);
    const day = (currentDayLabel || '월').trim();
    const dateKey = formatDateYMD(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const config = getLessonSchedulerConfig();
    const autoFullscreen = options?.autoFullscreen ?? config.autoFullscreen;

    let triggerType: 'PRE_START' | 'PERIOD_START' | null = null;
    let eventName: typeof LESSON_START_EVENT | typeof LESSON_PRE_START_EVENT | null = null;
    let triggerKey: string | null = null;
    let alertMessage: string | null = null;
    let shouldEnterFullscreen = false;

    let currentPeriod: number | null = null;
    let currentPeriodName = '';
    let activeMaterials: LessonMaterialRef[] = [];

    let upcomingPeriod: number | null = null;
    let upcomingPeriodName = '';
    let upcomingMaterials: LessonMaterialRef[] = [];

    if (!schedules || schedules.length === 0) {
        return {
            triggerType,
            eventName,
            triggerKey,
            alertMessage,
            shouldEnterFullscreen,
            currentPeriod,
            currentPeriodName,
            activeMaterials,
            upcomingPeriod,
            upcomingPeriodName,
            upcomingMaterials,
            nextTriggeredKeys
        };
    }

    const sorted = [...schedules].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i];
        const pNum = s.period !== undefined ? s.period : parsePeriodFromName(s.name, i + 1);
        if (pNum < 0 || isLunchSchedule(s.name) || isBreakSchedule(s.name)) {
            continue;
        }

        const startMin = parseTimeToMinutes(s.startTime);
        const endMin = parseTimeToMinutes(s.endTime);
        if (startMin === null || endMin === null) continue;

        const periodLabel = s.name || (pNum === 0 ? '아침활동' : `${pNum}교시`);
        const slotKey = getPeriodSlotKey(day, pNum);
        const slotBinding = bindings[slotKey];
        const slotMaterials = slotBinding?.materials || [];

        // Check active period (startMin <= nowMinutes < endMin)
        if (nowMinutes >= startMin && nowMinutes < endMin) {
            currentPeriod = pNum;
            currentPeriodName = periodLabel;
            activeMaterials = slotMaterials;
        }

        // Check next upcoming period
        if (upcomingPeriod === null && startMin > nowMinutes) {
            upcomingPeriod = pNum;
            upcomingPeriodName = periodLabel;
            upcomingMaterials = slotMaterials;
        }

        // 1. Check 1 minute before period start (PRE_START)
        if (nowMinutes === startMin - 1) {
            const preKey = `${dateKey}_PRE_${day}_${pNum}_${s.startTime}`;
            if (!nextTriggeredKeys.has(preKey)) {
                nextTriggeredKeys.add(preKey);
                prevTriggeredKeys.add(preKey);
                triggerType = 'PRE_START';
                eventName = LESSON_PRE_START_EVENT;
                triggerKey = preKey;
                const subjText = slotBinding?.subject ? ` (${slotBinding.subject})` : '';
                alertMessage = `${periodLabel}${subjText} 수업 시작 1분 전입니다. 학습자료를 준비해 주세요.`;
            }
        }

        // 2. Check exact period start (PERIOD_START)
        if (nowMinutes === startMin) {
            const startKey = `${dateKey}_START_${day}_${pNum}_${s.startTime}`;
            if (!nextTriggeredKeys.has(startKey)) {
                nextTriggeredKeys.add(startKey);
                prevTriggeredKeys.add(startKey);
                triggerType = 'PERIOD_START';
                eventName = LESSON_START_EVENT;
                triggerKey = startKey;
                const subjText = slotBinding?.subject ? ` (${slotBinding.subject})` : '';
                alertMessage = s.startMessage || `${periodLabel}${subjText} 수업을 시작합니다.`;
                shouldEnterFullscreen = Boolean(autoFullscreen);
            }
        }
    }

    return {
        triggerType,
        eventName,
        triggerKey,
        alertMessage,
        shouldEnterFullscreen,
        currentPeriod,
        currentPeriodName,
        activeMaterials,
        upcomingPeriod,
        upcomingPeriodName,
        upcomingMaterials,
        nextTriggeredKeys
    };
}

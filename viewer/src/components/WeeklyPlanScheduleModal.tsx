import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Calendar, FolderOpen, Upload, BookOpen, Clock, ArrowRight, 
    CheckCircle2, FileText, RotateCw, Plus, 
    Trash2, Edit2, Square, Save, Check, LayoutGrid, List,
    ChevronLeft, ChevronRight, Sparkles
} from 'lucide-react';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import { main } from '../../wailsjs/go/models';
import { 
    SelectWatchFolderDialog, 
    SelectWeeklyPlanFileDialog, 
    ReanalyzeWeeklyPlan,
    SaveWeeklyPlan,
    GetTextbooks,
    GetWeeklyPlanList,
    GetWeeklyPlanByPath
} from '../../wailsjs/go/main/App';
import HwpHtmlViewerModal from './HwpHtmlViewerModal';
import ErrorBoundary from './ErrorBoundary';
import { resolveBookForSubject } from '../utils/bookResolver';
import { getStoredSchedule, isLunchSchedule, isBreakSchedule, parsePeriodFromName, type ScheduleItem } from './ScheduleConfigModal';

interface Props {
    isOpen: boolean;
    plan: main.WeeklyPlanResult | null;
    watchFolder: string;
    onClose: () => void;
    onPlanUpdated: (newPlan: main.WeeklyPlanResult) => void;
    onWatchFolderChanged: (newFolder: string) => void;
    onGoToBook: (bookId: string, pageNumber: number, item?: any) => void;
    onGoToBlank?: (subject: string, topic: string, period?: number) => void;
}

const DAY_LABELS = ['월', '화', '수', '목', '금'];

export const DEFAULT_MORNING_TOPIC = '아침 독서 및 자율활동';
export const DEFAULT_MORNING_TOPICS: Record<string, string> = {
    '월': DEFAULT_MORNING_TOPIC,
    '화': DEFAULT_MORNING_TOPIC,
    '수': DEFAULT_MORNING_TOPIC,
    '목': DEFAULT_MORNING_TOPIC,
    '금': DEFAULT_MORNING_TOPIC
};

const formatDayDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
    }
    return dateStr;
};

interface EditFormState {
    isNew: boolean;
    day: string;
    index?: number;
    period: number;
    subject: string;
    matchedBookId: string;
    startPage: number;
    pageStr: string;
    topic: string;
    isBlankScreen: boolean;
    applyToAllDays?: boolean;
}

export default function WeeklyPlanScheduleModal(props: Props) {
    if (!props.isOpen) return null;

    return (
        <ErrorBoundary fallbackTitle="주학습 계획안 화면을 불러오는 중 오류가 발생했습니다">
            <WeeklyPlanScheduleModalContent {...props} />
        </ErrorBoundary>
    );
}

function WeeklyPlanScheduleModalContent({
    isOpen,
    plan: initialPlan,
    watchFolder,
    onClose,
    onPlanUpdated,
    onWatchFolderChanged,
    onGoToBook,
    onGoToBlank
}: Props) {
    // Fallback to localStorage if plan is null or empty
    const effectivePlan: main.WeeklyPlanResult | null = useMemo(() => {
        if (initialPlan && initialPlan.schedule && Object.keys(initialPlan.schedule).length > 0) {
            return initialPlan;
        }
        try {
            const stored = localStorage.getItem('classbook_weekly_plan_db');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.schedule) return parsed;
            }
        } catch (e) {
            console.error("Failed to parse cached plan from localStorage:", e);
        }
        return initialPlan;
    }, [initialPlan]);

    const todayIndex = new Date().getDay(); // 0 is Sun, 1 is Mon...
    const initialDay = (todayIndex >= 1 && todayIndex <= 5) ? DAY_LABELS[todayIndex - 1] : '월';
    const [selectedDay, setSelectedDay] = useState<string>(initialDay);
    const [viewMode, setViewMode] = useState<'grid' | 'daily'>('grid');
    const [isLoading, setIsLoading] = useState(false);
    const [isReanalyzing, setIsReanalyzing] = useState(false);
    const [isHwpHtmlViewerOpen, setIsHwpHtmlViewerOpen] = useState(false);
    const [availableBooks, setAvailableBooks] = useState<main.Textbook[]>([]);
    const [storedSchedules, setStoredSchedules] = useState<ScheduleItem[]>(() => getStoredSchedule());
    const [planList, setPlanList] = useState<main.WeeklyPlanSummary[]>([]);

    const fetchPlanList = async () => {
        try {
            const list = await GetWeeklyPlanList();
            if (list) setPlanList(list);
        } catch (e) {
            console.error("Failed to fetch weekly plan list:", e);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchPlanList();
        }
    }, [isOpen, watchFolder]);

    useEffect(() => {
        const handleListChanged = () => {
            fetchPlanList();
        };
        EventsOn('weekly-plans-list-changed', handleListChanged);
        return () => {
            EventsOff('weekly-plans-list-changed');
        };
    }, []);

    const currentPlanIndex = useMemo(() => {
        if (!effectivePlan || planList.length === 0) return -1;
        return planList.findIndex(p => 
            (effectivePlan.filePath && p.filePath === effectivePlan.filePath) ||
            p.title === effectivePlan.title
        );
    }, [effectivePlan, planList]);

    const hasPrevPlan = currentPlanIndex > 0;
    const hasNextPlan = currentPlanIndex >= 0 && currentPlanIndex < planList.length - 1;
    const isViewingTodayPlan = useMemo(() => {
        if (currentPlanIndex >= 0 && planList[currentPlanIndex]) {
            return Boolean(planList[currentPlanIndex].isCurrent);
        }
        if (effectivePlan?.startDate && effectivePlan?.endDate) {
            const todayStr = new Date().toISOString().slice(0, 10);
            return todayStr >= effectivePlan.startDate && todayStr <= effectivePlan.endDate;
        }
        return false;
    }, [currentPlanIndex, planList, effectivePlan]);

    const handleSelectPlan = async (filePath: string) => {
        if (!filePath || isLoading) return;
        setIsLoading(true);
        try {
            const res = await GetWeeklyPlanByPath(filePath);
            if (res && res.success) {
                onPlanUpdated(res);
            }
        } catch (e: any) {
            console.error("Failed to load plan by path:", e);
            alert(`주학습계획안을 불러오는 중 오류가 발생했습니다: ${e.message || e}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrevPlan = () => {
        if (hasPrevPlan) {
            handleSelectPlan(planList[currentPlanIndex - 1].filePath);
        }
    };

    const handleNextPlan = () => {
        if (hasNextPlan) {
            handleSelectPlan(planList[currentPlanIndex + 1].filePath);
        }
    };

    const handleTodayPlan = () => {
        const todayPlan = planList.find(p => p.isCurrent);
        if (todayPlan) {
            handleSelectPlan(todayPlan.filePath);
        } else if (planList.length > 0) {
            handleSelectPlan(planList[0].filePath);
        }
    };

    useEffect(() => {
        const updateScheds = () => {
            setStoredSchedules(getStoredSchedule());
        };
        window.addEventListener('classbook_schedule_updated', updateScheds);
        return () => window.removeEventListener('classbook_schedule_updated', updateScheds);
    }, []);

    const schedulePeriods = useMemo(() => {
        interface GridPeriodItem {
            period: number;
            name: string;
            time: string;
            isLunch: boolean;
            isBreak: boolean;
            orderVal: number;
        }

        const periodList: GridPeriodItem[] = [];
        const seenPeriods = new Set<number>();

        // 1. Process storedSchedules
        storedSchedules.forEach((s) => {
            const isLunch = isLunchSchedule(s.name) || s.period === -1;
            const isBreak = !isLunch && (isBreakSchedule(s.name) || s.period === -2);

            const p = isLunch ? -1 : (isBreak ? -2 : (s.period !== undefined ? s.period : parsePeriodFromName(s.name)));
            if (seenPeriods.has(p)) return;
            seenPeriods.add(p);

            const timeStr = (s.startTime && s.endTime) ? `${s.startTime}~${s.endTime}` : (s.startTime || '');

            let orderVal = p;
            if (p === 0) orderVal = 0;
            else if (isLunch) orderVal = 4.5;
            else if (isBreak) orderVal = 4.8;
            else if (p > 0) orderVal = p;

            periodList.push({
                period: p,
                name: s.name || (p === 0 ? '아침활동' : (isLunch ? '점심시간' : (isBreak ? '5분 준비시간' : `${p}교시`))),
                time: timeStr,
                isLunch,
                isBreak,
                orderVal
            });
        });

        // Ensure morning activity (period 0) exists
        if (!seenPeriods.has(0)) {
            const morningSched = storedSchedules.find(s => s.period === 0 || s.name.includes('아침'));
            const morningTimeStr = morningSched 
                ? ((morningSched.startTime && morningSched.endTime) ? `${morningSched.startTime}~${morningSched.endTime}` : (morningSched.startTime || '')) 
                : '08:40~09:00';
            periodList.push({
                period: 0,
                name: morningSched?.name || '아침활동',
                time: morningTimeStr,
                isLunch: false,
                isBreak: false,
                orderVal: 0
            });
            seenPeriods.add(0);
        }

        // Ensure lunch break (period -1) exists
        if (!seenPeriods.has(-1)) {
            const lunchSched = storedSchedules.find(s => isLunchSchedule(s.name) || s.period === -1);
            const lunchTimeStr = lunchSched
                ? ((lunchSched.startTime && lunchSched.endTime) ? `${lunchSched.startTime}~${lunchSched.endTime}` : (lunchSched.startTime || ''))
                : '12:10~12:55';
            periodList.push({
                period: -1,
                name: lunchSched?.name || '점심시간',
                time: lunchTimeStr,
                isLunch: true,
                isBreak: false,
                orderVal: 4.5
            });
            seenPeriods.add(-1);
        }

        // Ensure 5-minute prep break (period -2) exists
        if (!seenPeriods.has(-2)) {
            const prepSched = storedSchedules.find(s => !isLunchSchedule(s.name) && (isBreakSchedule(s.name) || s.period === -2));
            const prepTimeStr = prepSched
                ? ((prepSched.startTime && prepSched.endTime) ? `${prepSched.startTime}~${prepSched.endTime}` : (prepSched.startTime || ''))
                : '12:55~13:00';
            periodList.push({
                period: -2,
                name: prepSched?.name || '5분 준비시간',
                time: prepTimeStr,
                isLunch: false,
                isBreak: true,
                orderVal: 4.8
            });
            seenPeriods.add(-2);
        }

        // Add any teachable periods from effectivePlan (1~6교시)
        if (effectivePlan?.schedule) {
            Object.values(effectivePlan.schedule).forEach(dayItems => {
                dayItems.forEach(item => {
                    const p = item.period !== undefined ? item.period : 1;
                    if (p > 0 && !seenPeriods.has(p)) {
                        seenPeriods.add(p);
                        periodList.push({
                            period: p,
                            name: `${p}교시`,
                            time: '',
                            isLunch: false,
                            isBreak: false,
                            orderVal: p
                        });
                    }
                });
            });
        }

        // Fallback default: ensure periods 1 to 6 exist
        [1, 2, 3, 4, 5, 6].forEach(p => {
            if (!seenPeriods.has(p)) {
                seenPeriods.add(p);
                periodList.push({
                    period: p,
                    name: `${p}교시`,
                    time: '',
                    isLunch: false,
                    isBreak: false,
                    orderVal: p
                });
            }
        });

        return periodList.sort((a, b) => a.orderVal - b.orderVal);
    }, [storedSchedules, effectivePlan]);

    // Edit/Add Form State
    const [editingItem, setEditingItem] = useState<EditFormState | null>(null);

    // Quick Blank Screen Quick Open Modal/Input State
    const [showQuickBlank, setShowQuickBlank] = useState(false);
    const [quickBlankSubject, setQuickBlankSubject] = useState('활동 수업');
    const [quickBlankTopic, setQuickBlankTopic] = useState('');

    // Fetch installed textbooks
    useEffect(() => {
        if (isOpen) {
            GetTextbooks().then(books => {
                if (books) setAvailableBooks(books);
            }).catch(console.error);
        }
    }, [isOpen]);

    // Database persistence helper: saves to backend JSON file and localStorage
    const persistPlan = async (updatedPlan: main.WeeklyPlanResult) => {
        try {
            await SaveWeeklyPlan(updatedPlan);
        } catch (e) {
            console.error("Failed to save plan to backend DB:", e);
        }
        try {
            localStorage.setItem('classbook_weekly_plan_db', JSON.stringify(updatedPlan));
        } catch (e) {
            console.error("Failed to save plan to localStorage:", e);
        }
        onPlanUpdated(updatedPlan);
    };

    const handleSelectFolder = async () => {
        try {
            const folder = await SelectWatchFolderDialog();
            if (folder) {
                onWatchFolderChanged(folder);
            }
        } catch (err: any) {
            alert(`폴더 선택 오류: ${err.message || err}`);
        }
    };

    const handleSelectFile = async () => {
        try {
            setIsLoading(true);
            const res = await SelectWeeklyPlanFileDialog();
            if (res && res.success) {
                await persistPlan(res);
                alert(`주학습계획안이 성공적으로 분석되었습니다!\n(${res.title})\n\n[원본 문서 보기] 버튼으로 서식 원본도 즉시 확인하실 수 있습니다.`);
            } else if (res && !res.success) {
                alert(`주학습계획안 데이터 분석에 일부 오류가 있었으나, [원본 문서 보기] 버튼으로 원본 문서를 열람하실 수 있습니다.`);
            }
        } catch (err: any) {
            alert(`파일 분석 오류: ${err.message || err}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReanalyze = async () => {
        try {
            setIsReanalyzing(true);
            const res = await ReanalyzeWeeklyPlan();
            if (res && res.success) {
                await persistPlan(res);
                alert(`최신 분석 알고리즘(rhwp)으로 주학습계획안을 다시 분석하였습니다!\n(${res.title})`);
            } else {
                alert("재인식 결과 데이터 분석에 실패했습니다. 파일을 다시 올려주세요.");
            }
        } catch (err: any) {
            alert(`재인식 오류: ${err.message || err}`);
        } finally {
            setIsReanalyzing(false);
        }
    };

    // Helper: get sanitized list for a given day
    const getSanitizedDayItems = (day: string): main.WeeklyPlanItem[] => {
        const rawItems = (effectivePlan?.schedule ? effectivePlan.schedule[day] || [] : [])
            .filter(it => it.period !== -1 && it.period !== -2 && !isLunchSchedule(it.subject || ''));

        const grouped = new Map<number, main.WeeklyPlanItem[]>();
        for (const itm of rawItems) {
            const p = itm.period !== undefined ? itm.period : 1;
            if (!grouped.has(p)) grouped.set(p, []);
            grouped.get(p)!.push(itm);
        }

        const mergedList: main.WeeklyPlanItem[] = [];

        // Always ensure morning activity (period 0) is present for all weekdays
        if (!grouped.has(0)) {
            const defaultTopic = DEFAULT_MORNING_TOPICS[day] || '아침 자율 독서 및 활동';
            mergedList.push({
                period: 0,
                subject: '아침활동',
                matchedBookId: 'blank',
                startPage: 0,
                endPage: 0,
                pageStr: '',
                topic: defaultTopic,
                raw: `아침활동 ${defaultTopic}`
            });
        }

        const sortedPeriods = Array.from(grouped.keys()).sort((a, b) => a - b);

        for (const p of sortedPeriods) {
            const list = grouped.get(p)!;
            if (list.length === 1) {
                mergedList.push(list[0]);
                continue;
            }

            let bestSubject = '';
            for (const itm of list) {
                const s = (itm.subject || '').trim();
                if (s && s !== '학습') { bestSubject = s; break; }
            }
            if (!bestSubject) {
                for (const itm of list) {
                    const s = (itm.subject || '').trim();
                    if (s) { bestSubject = s; break; }
                }
            }
            if (!bestSubject) bestSubject = p === 0 ? '아침활동' : '학습';

            let bestBookId = '';
            for (const itm of list) {
                const b = (itm.matchedBookId || '').trim();
                if (b) { bestBookId = b; break; }
            }

            let bestPageStr = '';
            let bestStartPage = 0;
            let bestEndPage = 0;
            for (const itm of list) {
                if (itm.pageStr || (itm.startPage && itm.startPage > 0)) {
                    bestPageStr = itm.pageStr || '';
                    bestStartPage = itm.startPage || 0;
                    bestEndPage = itm.endPage || 0;
                    break;
                }
            }

            let bestTopic = '';
            const candidates: { isUnit: boolean; len: number; text: string }[] = [];
            for (const itm of list) {
                const t = (itm.topic || '').trim();
                if (!t || t === bestSubject || t === '학습' || t === '수업') continue;
                if (/^\d+[\s~-]+\d+.*$/.test(t)) continue;
                const isUnit = /^\d+\./.test(t);
                candidates.push({ isUnit, len: t.length, text: t });
            }

            if (candidates.length > 0) {
                candidates.sort((a, b) => {
                    if (a.isUnit !== b.isUnit) return a.isUnit ? 1 : -1;
                    return b.len - a.len;
                });
                bestTopic = candidates[0].text;
            } else {
                for (const itm of list) {
                    const t = (itm.topic || '').trim();
                    if (t && !/^\d+[\s~-]+\d+.*$/.test(t)) { bestTopic = t; break; }
                }
                if (!bestTopic) bestTopic = p === 0 ? (DEFAULT_MORNING_TOPICS[day] || '아침 자율 독서 및 활동') : bestSubject;
            }

            mergedList.push({
                period: p,
                subject: bestSubject,
                matchedBookId: bestBookId,
                startPage: bestStartPage,
                endPage: bestEndPage,
                pageStr: bestPageStr,
                topic: bestTopic,
                raw: list.map(i => i.raw || '').filter(Boolean).join(' ')
            });
        }

        mergedList.sort((a, b) => (a.period !== undefined ? a.period : 0) - (b.period !== undefined ? b.period : 0));
        return mergedList;
    };

    const currentDayItems = useMemo(() => {
        return getSanitizedDayItems(selectedDay);
    }, [effectivePlan, selectedDay]);

    // Open item editor for adding
    const handleStartAdd = (targetDay: string = selectedDay, targetPeriod?: number) => {
        if (targetPeriod === -1 || targetPeriod === -2) return;
        const isMorning = targetPeriod === 0;
        const dayItems = getSanitizedDayItems(targetDay);
        const nextPeriod = targetPeriod !== undefined ? targetPeriod : (dayItems.length > 0 
            ? Math.max(...dayItems.map(i => i.period !== undefined ? i.period : 0)) + 1 
            : 1);
        setEditingItem({
            isNew: true,
            day: targetDay,
            period: nextPeriod,
            subject: isMorning ? '아침활동' : '창체',
            matchedBookId: isMorning ? 'blank' : (availableBooks.length > 0 ? availableBooks[0].id : ''),
            startPage: isMorning ? 0 : 1,
            pageStr: '',
            topic: isMorning ? DEFAULT_MORNING_TOPIC : '',
            isBlankScreen: isMorning,
            applyToAllDays: isMorning
        });
    };

    // Open item editor for editing
    const handleStartEdit = (targetDay: string, idx: number, itm: main.WeeklyPlanItem) => {
        const isMorning = itm.period === 0;
        const isBlank = isMorning || itm.matchedBookId === 'blank' || (!itm.matchedBookId && !itm.startPage && !itm.pageStr);
        setEditingItem({
            isNew: false,
            day: targetDay,
            index: idx,
            period: itm.period !== undefined ? itm.period : (idx + 1),
            subject: itm.subject || (isMorning ? '아침활동' : (isBlank ? '활동' : '국어')),
            matchedBookId: itm.matchedBookId || (isBlank ? 'blank' : (availableBooks.length > 0 ? availableBooks[0].id : '')),
            startPage: isBlank ? 0 : (itm.startPage || 1),
            pageStr: itm.pageStr || (itm.startPage ? `${itm.startPage}쪽` : ''),
            topic: itm.topic || (isMorning ? DEFAULT_MORNING_TOPIC : ''),
            isBlankScreen: isBlank,
            applyToAllDays: isMorning
        });
    };

    // Quick bulk setup for morning activities across all weekdays
    const handleOpenMorningActivityBulk = () => {
        const sched = effectivePlan?.schedule || {};
        const monItem = (sched['월'] || []).find(it => it.period === 0);
        setEditingItem({
            isNew: !monItem,
            day: '월',
            period: 0,
            subject: '아침활동',
            matchedBookId: 'blank',
            startPage: 0,
            pageStr: '',
            topic: monItem?.topic || DEFAULT_MORNING_TOPIC,
            isBlankScreen: true,
            applyToAllDays: true
        });
    };

    // Delete item
    const handleDeleteItem = async (targetDay: string, targetPeriod: number) => {
        if (!effectivePlan) return;
        if (!window.confirm(`${targetDay}요일 ${targetPeriod}교시 수업을 계획안에서 삭제하시겠습니까?`)) return;

        const updatedSchedule = { ...effectivePlan.schedule };
        const dayList = (updatedSchedule[targetDay] || []).filter(
            it => it.period !== targetPeriod
        );
        updatedSchedule[targetDay] = dayList;

        const updatedPlan: main.WeeklyPlanResult = {
            ...effectivePlan,
            schedule: updatedSchedule
        };
        await persistPlan(updatedPlan);
    };

    // Save edited or new item
    const handleSaveEdit = async (openImmediately = false) => {
        if (!editingItem) return;

        const targetPlan: main.WeeklyPlanResult = effectivePlan ? { ...effectivePlan } : {
            success: true,
            title: "주학습 계획안",
            filePath: "",
            schedule: { "월": [], "화": [], "수": [], "목": [], "금": [] }
        };

        const updatedSchedule = { ...(targetPlan.schedule || {}) };
        const isMorning = Number(editingItem.period) === 0;
        const applyToAll = isMorning && Boolean(editingItem.applyToAllDays);

        const newItem: main.WeeklyPlanItem = {
            period: Number(editingItem.period),
            subject: editingItem.subject.trim() || (isMorning ? "아침활동" : (editingItem.isBlankScreen ? "활동" : "수업")),
            matchedBookId: editingItem.isBlankScreen ? "blank" : editingItem.matchedBookId,
            startPage: editingItem.isBlankScreen ? 0 : Number(editingItem.startPage || 1),
            endPage: editingItem.isBlankScreen ? 0 : Number(editingItem.startPage || 1),
            pageStr: editingItem.isBlankScreen ? "" : (editingItem.pageStr ? editingItem.pageStr : `${editingItem.startPage || 1}쪽`),
            topic: editingItem.topic.trim(),
            raw: `${editingItem.subject} ${editingItem.topic}`
        };

        const targetDays = applyToAll ? DAY_LABELS : [editingItem.day];
        for (const d of targetDays) {
            const dayList = (updatedSchedule[d] || []).filter(
                it => (it.period !== undefined ? it.period : 1) !== Number(editingItem.period)
            );
            dayList.push({ ...newItem });
            dayList.sort((a, b) => (a.period !== undefined ? a.period : 0) - (b.period !== undefined ? b.period : 0));
            updatedSchedule[d] = dayList;
        }

        const updatedPlan: main.WeeklyPlanResult = {
            ...targetPlan,
            schedule: updatedSchedule
        };

        await persistPlan(updatedPlan);
        setEditingItem(null);

        if (openImmediately) {
            onClose();
            if (newItem.matchedBookId === 'blank') {
                if (onGoToBlank) {
                    onGoToBlank(newItem.subject, newItem.topic, newItem.period);
                }
            } else {
                let books = availableBooks;
                if (!books || books.length === 0) {
                    try {
                        books = (await GetTextbooks()) || [];
                    } catch (e) { }
                }
                const resolved = resolveBookForSubject(newItem.subject, newItem.matchedBookId, books);
                const targetBookId = resolved ? resolved.id : (newItem.matchedBookId || newItem.subject);
                if (resolved || !onGoToBlank) {
                    onGoToBook(targetBookId, newItem.startPage || 1, newItem);
                } else {
                    onGoToBlank(newItem.subject, newItem.topic, newItem.period);
                }
            }
        }
    };

    // Quick open blank screen
    const handleLaunchQuickBlank = () => {
        setShowQuickBlank(false);
        onClose();
        if (onGoToBlank) {
            onGoToBlank(quickBlankSubject || "활동 수업", quickBlankTopic || "");
        }
    };

    const handleOpenItem = async (item: main.WeeklyPlanItem) => {
        const isBlank = item.matchedBookId === 'blank' || (!item.matchedBookId && !item.startPage && !item.pageStr);
        onClose();
        if (isBlank) {
            if (onGoToBlank) {
                onGoToBlank(item.subject, item.topic, item.period);
            }
            return;
        }

        let books = availableBooks;
        if (!books || books.length === 0) {
            try {
                books = (await GetTextbooks()) || [];
                if (books && books.length > 0) setAvailableBooks(books);
            } catch (e) {
                console.error("Failed to load textbooks in handleOpenItem:", e);
            }
        }

        const targetPage = item.startPage || 1;
        const resolved = resolveBookForSubject(item.subject, item.matchedBookId, books);
        const targetBookId = resolved ? resolved.id : (item.matchedBookId || item.subject);

        if (resolved) {
            onGoToBook(targetBookId, targetPage, item);
        } else {
            // 일치하는 전자 교과서가 없는 경우 (창체, 자율활동, 전담 교과 등) 빈화면 모드로 표시
            if (onGoToBlank) {
                onGoToBlank(item.subject, item.topic, item.period);
            } else {
                onGoToBook(targetBookId, targetPage, item);
            }
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in">
                <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full overflow-hidden flex flex-col max-h-[94vh]">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-violet-600 text-white rounded-2xl shadow-md shadow-violet-500/20 shrink-0">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-800">
                                        {effectivePlan?.title || "주학습 계획안"}
                                    </h2>
                                    {effectivePlan?.weekRange && (
                                        <span className="px-2.5 py-0.5 bg-violet-100 text-violet-700 text-xs font-bold rounded-lg border border-violet-200">
                                            {effectivePlan.weekRange}
                                        </span>
                                    )}
                                    {isViewingTodayPlan && (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-extrabold rounded-md flex items-center gap-1 border border-emerald-300">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            이번 주 (오늘 기준)
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400">
                                    주간 시간표를 한눈에 확인하고 교과서 또는 빈 화면 활동 수업으로 바로 이동할 수 있습니다.
                                </p>
                            </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* View Mode Switcher: Grid vs Daily */}
                            <div className="flex bg-slate-200/80 p-0.5 rounded-xl border border-slate-300/60 text-xs">
                                <button
                                    onClick={() => { setViewMode('grid'); setEditingItem(null); }}
                                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                        viewMode === 'grid'
                                            ? 'bg-white text-violet-700 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="주간 전체 시간표를 표(Table) 형태로 한눈에 봅니다"
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    <span>주간 시간표</span>
                                </button>
                                <button
                                    onClick={() => { setViewMode('daily'); setEditingItem(null); }}
                                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                        viewMode === 'daily'
                                            ? 'bg-white text-violet-700 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="요일별 상세 수업 목록을 확인하고 수정합니다"
                                >
                                    <List className="w-3.5 h-3.5" />
                                    <span>요일별 상세</span>
                                </button>
                            </div>

                            {/* 빈화면 바로 열기 버튼 */}
                            <button
                                onClick={() => setShowQuickBlank(true)}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors border border-emerald-200 cursor-pointer shadow-xs"
                                title="교과서 없이 빈 화면(칠판/화이트보드)에 내용을 띄우고 바로 수업을 시작합니다"
                            >
                                <Square className="w-3.5 h-3.5 text-emerald-600" />
                                <span>빈화면 열기</span>
                            </button>

                            {/* HWP 원본 미리보기 버튼 */}
                            <button
                                onClick={() => setIsHwpHtmlViewerOpen(true)}
                                className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                                title="한글(HWP/HWPX) 원본 양식 서식 그대로 미리보기"
                            >
                                <FileText className="w-4 h-4" />
                                <span>원본 문서 미리보기</span>
                            </button>

                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                                title="닫기"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Week Navigation Toolbar (이전 주안 / 다음 주안 / 아침활동 일괄 설정 바) */}
                    <div className="bg-slate-100 px-6 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                        {/* Left: Previous / Current / Next Week Plan Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={handlePrevPlan}
                                disabled={!hasPrevPlan || isLoading}
                                className="px-3 py-1.5 bg-white hover:bg-violet-50 text-slate-700 hover:text-violet-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-700 rounded-xl font-bold flex items-center gap-1.5 border border-slate-300 shadow-2xs transition-all cursor-pointer disabled:cursor-not-allowed"
                                title="이전 주차 주학습계획안으로 이동"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span>이전 주안</span>
                            </button>

                            <button
                                onClick={handleTodayPlan}
                                disabled={isLoading}
                                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border shadow-2xs transition-all cursor-pointer ${
                                    isViewingTodayPlan
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-white hover:bg-emerald-50 text-emerald-700 border-slate-300'
                                }`}
                                title="오늘(이번 주) 주학습계획안으로 바로 이동"
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>이번 주 (오늘)</span>
                            </button>

                            <button
                                onClick={handleNextPlan}
                                disabled={!hasNextPlan || isLoading}
                                className="px-3 py-1.5 bg-white hover:bg-violet-50 text-slate-700 hover:text-violet-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-700 rounded-xl font-bold flex items-center gap-1.5 border border-slate-300 shadow-2xs transition-all cursor-pointer disabled:cursor-not-allowed"
                                title="다음 주차 주학습계획안으로 이동"
                            >
                                <span>다음 주안</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>

                            {/* Dropdown Selector for All Available Weeks */}
                            {planList.length > 0 && (
                                <select
                                    value={effectivePlan?.filePath || ''}
                                    onChange={(e) => handleSelectPlan(e.target.value)}
                                    disabled={isLoading}
                                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 text-xs focus:ring-2 focus:ring-violet-500 cursor-pointer shadow-2xs max-w-[220px] truncate"
                                    title="원하는 주차의 계획안으로 바로 이동"
                                >
                                    {planList.map((p, idx) => (
                                        <option key={p.filePath || idx} value={p.filePath}>
                                            {p.title} {p.isCurrent ? '★ (이번 주)' : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Right: Morning Activity Bulk Setup Button */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleOpenMorningActivityBulk}
                                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl font-bold flex items-center gap-1.5 border border-amber-300 shadow-2xs transition-colors cursor-pointer"
                                title="월~금 모든 요일의 아침활동을 동일하게 일괄 등록하거나 개별 설정합니다"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                <span>아침활동 일괄 설정</span>
                            </button>
                        </div>
                    </div>

                    {/* Sub Control Bar: Watch folder & File upload */}
                    <div className="bg-slate-100/80 px-6 py-2 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-slate-600 truncate max-w-xs sm:max-w-md">
                            <span className="font-semibold text-slate-700 shrink-0">감시 폴더:</span>
                            <span className="truncate bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 text-slate-800 font-mono text-[11px]" title={watchFolder}>
                                {watchFolder || "지정되지 않음"}
                            </span>
                            <button
                                onClick={handleSelectFolder}
                                className="shrink-0 px-2 py-0.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <FolderOpen className="w-3 h-3" />
                                <span>변경</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleReanalyze}
                                disabled={isReanalyzing || isLoading}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                title="현재 주학습계획안 파일을 다시 인식합니다"
                            >
                                <RotateCw className={`w-3 h-3 ${isReanalyzing ? 'animate-spin' : ''}`} />
                                <span>{isReanalyzing ? "재인식 중..." : "다시 분석(rhwp)"}</span>
                            </button>

                            <button
                                onClick={handleSelectFile}
                                disabled={isLoading || isReanalyzing}
                                className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <Upload className="w-3 h-3" />
                                <span>{isLoading ? "분석 중..." : "HWP 파일 올리기"}</span>
                            </button>
                        </div>
                    </div>

                    {/* View Mode 1: Daily Tab View Header */}
                    {viewMode === 'daily' && (
                        <div className="px-6 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between gap-2">
                            <div className="flex gap-1.5 flex-1">
                                {DAY_LABELS.map((day) => {
                                    const count = getSanitizedDayItems(day).length;
                                    const isSelected = selectedDay === day;
                                    const dateStr = effectivePlan?.weekDates?.[day];
                                    const dateLabel = formatDayDate(dateStr);
                                    return (
                                        <button
                                            key={day}
                                            onClick={() => {
                                                setSelectedDay(day);
                                                setEditingItem(null);
                                            }}
                                            className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                                isSelected
                                                    ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                            }`}
                                        >
                                            <span>{day}요일{dateLabel ? ` (${dateLabel})` : ''}</span>
                                            {count > 0 && (
                                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                                    isSelected ? "bg-white/30 text-white" : "bg-slate-200 text-slate-600"
                                                }`}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => handleStartAdd(selectedDay)}
                                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                                title="현재 요일에 새 수업 또는 빈 화면 활동을 추가합니다"
                            >
                                <Plus className="w-4 h-4" />
                                <span>수업 추가</span>
                            </button>
                        </div>
                    )}

                    {/* Main Content Area */}
                    <div className="p-6 overflow-y-auto space-y-4 flex-grow bg-slate-50/40">
                        {/* Inline Edit / Add Form (Visible in both views when active) */}
                        {editingItem && (
                            <div className="p-5 bg-violet-50/90 border-2 border-violet-400 rounded-3xl shadow-lg mb-4 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-violet-200/70">
                                    <span className="font-extrabold text-base text-violet-900">
                                        {editingItem.isNew 
                                            ? `[${editingItem.day}요일 ${editingItem.period === 0 ? '아침활동' : `${editingItem.period}교시`}] 새 수업/활동 등록` 
                                            : `[${editingItem.day}요일 ${editingItem.period === 0 ? '아침활동' : `${editingItem.period}교시`}] 활동 내용 수정`}
                                    </span>

                                    {/* Mode Toggle: 교과서 vs 빈화면 */}
                                    <div className="flex bg-white p-1 rounded-xl border border-violet-200 shadow-xs">
                                        <button
                                            type="button"
                                            onClick={() => setEditingItem({ ...editingItem, isBlankScreen: false })}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                                !editingItem.isBlankScreen
                                                    ? 'bg-violet-600 text-white shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <BookOpen className="w-3.5 h-3.5" />
                                            <span>교과서 선택</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingItem({ ...editingItem, isBlankScreen: true })}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                                editingItem.isBlankScreen
                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <Square className="w-3.5 h-3.5" />
                                            <span>빈 화면 활동</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                    {/* Period */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            교시 / 시간
                                        </label>
                                        <select
                                            value={editingItem.period}
                                            onChange={(e) => setEditingItem({ ...editingItem, period: parseInt(e.target.value, 10) })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                        >
                                            {schedulePeriods
                                                .filter(p => !p.isLunch && !p.isBreak && p.period >= 0)
                                                .map(({ period: p, name, time }) => (
                                                    <option key={p} value={p}>{p === 0 ? '아침활동' : name} {time ? `(${time})` : ''}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Subject / Activity Name */}
                                    <div className={editingItem.isBlankScreen ? "sm:col-span-2" : ""}>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            교과/활동명
                                        </label>
                                        <input
                                            type="text"
                                            value={editingItem.subject}
                                            onChange={(e) => setEditingItem({ ...editingItem, subject: e.target.value })}
                                            placeholder={editingItem.isBlankScreen ? "예: 창체, 자율, 안전, 학급활동" : "예: 국어, 수학, 하루"}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                        />
                                    </div>

                                    {/* Textbook Select (If not blank screen) */}
                                    {!editingItem.isBlankScreen && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                연결할 교과서
                                            </label>
                                            <select
                                                value={editingItem.matchedBookId}
                                                onChange={(e) => setEditingItem({ ...editingItem, matchedBookId: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                            >
                                                {availableBooks.length === 0 && !editingItem.matchedBookId && (
                                                    <option value="">교과서 없음</option>
                                                )}
                                                {editingItem.matchedBookId && !availableBooks.some(b => b.id === editingItem.matchedBookId) && (
                                                    <option value={editingItem.matchedBookId}>{editingItem.matchedBookId}</option>
                                                )}
                                                {availableBooks.map(b => (
                                                    <option key={b.id} value={b.id}>{b.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* Page Input (If not blank screen) */}
                                {!editingItem.isBlankScreen && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                시작 쪽수
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={editingItem.startPage || 1}
                                                onChange={(e) => setEditingItem({ 
                                                    ...editingItem, 
                                                    startPage: parseInt(e.target.value, 10) || 1,
                                                    pageStr: `${e.target.value}쪽`
                                                })}
                                                placeholder="예: 24"
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                쪽수 표기 문구 (선택)
                                            </label>
                                            <input
                                                type="text"
                                                value={editingItem.pageStr}
                                                onChange={(e) => setEditingItem({ ...editingItem, pageStr: e.target.value })}
                                                placeholder="예: 24~27쪽"
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Display Content / Topic */}
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        {editingItem.isBlankScreen 
                                            ? "빈 화면에 표시할 내용 (학습 안내 / 과제)" 
                                            : "표시할 학습 주제 / 활동 내용"}
                                    </label>
                                    <input
                                        type="text"
                                        value={editingItem.topic}
                                        onChange={(e) => setEditingItem({ ...editingItem, topic: e.target.value })}
                                        placeholder={editingItem.isBlankScreen 
                                            ? "예: 도서관 방문 후 읽고 싶은 책 1권 대출하기" 
                                            : "예: 순서를 알아봐요 (몇 개일까요)"}
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    />
                                </div>

                                {editingItem.period === 0 && (
                                    <div className="mb-4 p-3 bg-violet-50/90 border border-violet-200 rounded-2xl flex items-center justify-between">
                                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={editingItem.applyToAllDays !== false}
                                                onChange={(e) => setEditingItem({ ...editingItem, applyToAllDays: e.target.checked })}
                                                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold text-violet-900">
                                                월~금 모든 요일에 동일하게 일괄 적용
                                            </span>
                                        </label>
                                        <span className="text-[11px] font-bold text-violet-600">
                                            {editingItem.applyToAllDays !== false ? "모든 요일 일괄 적용" : `${editingItem.day}요일만 개별 수정`}
                                        </span>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingItem(null)}
                                        className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs border border-slate-300 transition-colors cursor-pointer"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSaveEdit(false)}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                                    >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>저장</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSaveEdit(true)}
                                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>저장 후 바로 수업 열기</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* VIEW 1: Weekly Timetable Full Grid (주간 시간표 전체 보기) */}
                        {viewMode === 'grid' && (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-left table-fixed">
                                        <thead>
                                            <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 text-xs font-bold">
                                                <th className="w-16 py-3 px-2 text-center text-slate-500 font-extrabold border-r border-slate-200/80">교시</th>
                                                {DAY_LABELS.map(day => {
                                                    const count = getSanitizedDayItems(day).length;
                                                    const dateStr = effectivePlan?.weekDates?.[day];
                                                    const dateLabel = formatDayDate(dateStr);
                                                    return (
                                                        <th key={day} className="py-2.5 px-3 text-center border-r last:border-r-0 border-slate-200/80">
                                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-black text-sm text-slate-800">{day}요일</span>
                                                                    {count > 0 && (
                                                                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-violet-100 text-violet-700">
                                                                            {count}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {dateLabel && (
                                                                    <span className="text-[11px] font-bold text-slate-400">
                                                                        {dateLabel}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 text-xs">
                                            {schedulePeriods.map(({ period, name, time, isLunch, isBreak }) => {
                                                if (isLunch) {
                                                    return (
                                                        <tr key={`lunch-${period}`} className="bg-amber-50/30 hover:bg-amber-50/60 transition-colors">
                                                            {/* 교시 Label: 점심시간 */}
                                                            <td className="py-2.5 px-2 text-center font-black text-amber-800 bg-amber-100/70 border-r border-amber-200/80 select-none">
                                                                <div className="flex flex-col items-center">
                                                                    <span className="text-xs sm:text-sm font-extrabold text-amber-900 bg-amber-200/90 px-2.5 py-0.5 rounded-lg border border-amber-300 shadow-2xs">
                                                                        {name}
                                                                    </span>
                                                                    {time && (
                                                                        <span className="text-[10px] text-amber-700 font-mono font-medium tracking-tight mt-0.5">
                                                                            {time}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Days (Mon - Fri): ALWAYS EMPTY SLOT (빈칸) */}
                                                            {DAY_LABELS.map(day => (
                                                                <td key={day} className="p-2 border-r last:border-r-0 border-amber-200/50 align-middle text-center bg-amber-50/20">
                                                                    <div className="h-16 rounded-xl border border-dashed border-amber-300/80 bg-amber-50/50 flex items-center justify-center text-amber-700/80 select-none">
                                                                        <span className="text-xs font-bold tracking-wide">점심시간 (급식)</span>
                                                                    </div>
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    );
                                                }

                                                if (isBreak) {
                                                    return (
                                                        <tr key={`break-${period}`} className="bg-sky-50/20 hover:bg-sky-50/50 transition-colors">
                                                            {/* 교시 Label: 5분 준비시간 */}
                                                            <td className="py-2.5 px-2 text-center font-black text-sky-800 bg-sky-100/70 border-r border-sky-200/80 select-none">
                                                                <div className="flex flex-col items-center">
                                                                    <span className="text-xs sm:text-sm font-extrabold text-sky-900 bg-sky-200/90 px-2 py-0.5 rounded-lg border border-sky-300 shadow-2xs">
                                                                        {name}
                                                                    </span>
                                                                    {time && (
                                                                        <span className="text-[10px] text-sky-700 font-mono font-medium tracking-tight mt-0.5">
                                                                            {time}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Days (Mon - Fri): ALWAYS EMPTY SLOT (빈칸) */}
                                                            {DAY_LABELS.map(day => (
                                                                <td key={day} className="p-2 border-r last:border-r-0 border-sky-200/50 align-middle text-center bg-sky-50/10">
                                                                    <div className="h-14 rounded-xl border border-dashed border-sky-300/80 bg-sky-50/40 flex items-center justify-center text-sky-700/80 select-none">
                                                                        <span className="text-xs font-bold tracking-wide">5분 준비시간 (수업 준비)</span>
                                                                    </div>
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    );
                                                }

                                                return (
                                                    <tr key={period} className="hover:bg-slate-50/60 transition-colors">
                                                        {/* 교시 Label */}
                                                        <td className="py-2.5 px-2 text-center font-black text-violet-700 bg-slate-50/80 border-r border-slate-200/80 select-none">
                                                            <div className="flex flex-col items-center">
                                                                <span className={`text-xs sm:text-sm font-extrabold leading-tight ${period === 0 ? 'text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-lg border border-amber-300/60' : 'text-violet-900'}`}>
                                                                    {period === 0 ? '아침활동' : name}
                                                                </span>
                                                                {time && (
                                                                    <span className="text-[10px] text-slate-400 font-mono font-medium tracking-tight mt-0.5">
                                                                        {time}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                    {/* Days (Mon - Fri) */}
                                                    {DAY_LABELS.map(day => {
                                                        const items = getSanitizedDayItems(day);
                                                        const item = items.find(it => (it.period !== undefined ? it.period : 1) === period);

                                                        if (!item) {
                                                            return (
                                                                <td key={day} className="p-2 border-r last:border-r-0 border-slate-200/80 align-top group">
                                                                    <div 
                                                                        onClick={() => handleStartAdd(day, period)}
                                                                        className="h-20 rounded-xl border border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/30 flex items-center justify-center text-slate-300 hover:text-violet-600 cursor-pointer transition-all"
                                                                        title={`${day}요일 ${period}교시 추가하기`}
                                                                    >
                                                                        <Plus className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-transform" />
                                                                    </div>
                                                                </td>
                                                            );
                                                        }

                                                        const isBlank = item.matchedBookId === 'blank' || (!item.matchedBookId && !item.startPage && !item.pageStr);

                                                        return (
                                                            <td key={day} className="p-2 border-r last:border-r-0 border-slate-200/80 align-top">
                                                                <div className="h-full min-h-[92px] p-2.5 rounded-xl bg-slate-50/80 hover:bg-violet-50/60 border border-slate-200/80 hover:border-violet-300 transition-all flex flex-col justify-between group shadow-2xs hover:shadow-xs">
                                                                    <div>
                                                                        {/* Top badges */}
                                                                        <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                                                                            <span className="font-extrabold text-xs text-slate-900 group-hover:text-violet-900 transition-colors">
                                                                                {item.subject}
                                                                            </span>
                                                                            {isBlank ? (
                                                                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                                                                                    빈화면
                                                                                </span>
                                                                            ) : item.pageStr ? (
                                                                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-violet-100 text-violet-700 rounded font-mono">
                                                                                    {item.pageStr}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>

                                                                        {/* Topic */}
                                                                        {item.topic ? (
                                                                            <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug">
                                                                                {item.topic}
                                                                            </p>
                                                                        ) : (
                                                                            <p className="text-[11px] text-slate-400 italic">
                                                                                내용 미입력
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    {/* Action footer */}
                                                                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/60">
                                                                        <button
                                                                            onClick={() => handleStartEdit(day, items.indexOf(item), item)}
                                                                            className="text-[10px] text-slate-400 hover:text-violet-600 font-bold flex items-center gap-0.5 cursor-pointer"
                                                                            title="수정"
                                                                        >
                                                                            <Edit2 className="w-3 h-3" />
                                                                            <span>수정</span>
                                                                        </button>

                                                                        <button
                                                                            onClick={() => handleOpenItem(item)}
                                                                            className="px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                                                            title={isBlank ? "빈화면 수업 열기" : `${item.startPage || 1}쪽 열기`}
                                                                        >
                                                                            {isBlank ? <Square className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                                                                            <span>열기</span>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* VIEW 2: Daily Detailed List (요일별 상세 목록) */}
                        {viewMode === 'daily' && (
                            <>
                                {currentDayItems.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 shadow-xs">
                                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                                        <p className="text-base font-semibold text-slate-700">{selectedDay}요일에 등록된 수업 계획이 없습니다.</p>
                                        <p className="text-xs mt-1 text-slate-400 mb-4">
                                            상단의 [수업 추가]를 눌러 직접 등록하거나 [HWP 파일 올리기]로 주학습계획안을 등록해보세요.
                                        </p>
                                        <button
                                            onClick={() => handleStartAdd(selectedDay)}
                                            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>{selectedDay}요일 수업 추가하기</span>
                                        </button>
                                    </div>
                                ) : (
                                    currentDayItems.map((item, idx) => {
                                        const isBlank = item.matchedBookId === 'blank' || (!item.matchedBookId && !item.startPage && !item.pageStr);

                                        return (
                                            <div
                                                key={idx}
                                                className="p-4 bg-white hover:bg-violet-50/50 border border-slate-200 hover:border-violet-300 rounded-2xl transition-all flex items-center justify-between gap-4 group shadow-xs hover:shadow-sm"
                                            >
                                                <div className="flex items-center gap-3.5 min-w-0">
                                                    {/* 교시 뱃지 */}
                                                    <div className={`w-11 h-11 rounded-xl shadow-xs border flex flex-col items-center justify-center shrink-0 transition-colors ${
                                                        item.period === 0
                                                            ? 'bg-amber-50 group-hover:bg-amber-100/70 border-amber-300'
                                                            : 'bg-slate-50 group-hover:bg-white border-slate-200 group-hover:border-violet-300'
                                                    }`}>
                                                        <span className={`text-[10px] font-bold leading-none ${item.period === 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                            {item.period === 0 ? "활동" : "교시"}
                                                        </span>
                                                        <span className={`text-base font-black leading-none mt-0.5 ${
                                                            item.period === 0 ? "text-amber-700 text-xs" : "text-violet-600"
                                                        }`}>
                                                            {item.period === 0 ? "아침" : item.period}
                                                        </span>
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <h4 className="text-base font-bold text-slate-900 group-hover:text-violet-900 transition-colors">
                                                                {item.subject}
                                                            </h4>

                                                            {isBlank ? (
                                                                <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200 flex items-center gap-1">
                                                                    <Square className="w-3 h-3 text-emerald-600" />
                                                                    <span>빈 화면 활동</span>
                                                                </span>
                                                            ) : (
                                                                <div className="flex items-center gap-1">
                                                                    {item.matchedBookId && (
                                                                        <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                                                                            {item.matchedBookId}
                                                                        </span>
                                                                    )}
                                                                    {item.pageStr && (
                                                                        <span className="text-[11px] font-bold px-2 py-0.5 bg-violet-100 text-violet-700 rounded-md">
                                                                            {item.pageStr}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {item.topic ? (
                                                            <p className="text-xs text-slate-600 font-medium truncate max-w-md">
                                                                {item.topic}
                                                            </p>
                                                        ) : (
                                                            <p className="text-xs text-slate-400 italic">
                                                                {isBlank ? "표시할 내용 미입력" : "학습 내용 미입력"}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        onClick={() => handleStartEdit(selectedDay, idx, item)}
                                                        className="p-2 text-slate-400 hover:text-violet-700 hover:bg-violet-100 rounded-xl transition-colors cursor-pointer"
                                                        title="이 교시 내용 수정"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteItem(selectedDay, item.period !== undefined ? item.period : 1)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                                        title="이 교시 항목 삭제"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>

                                                    <button
                                                        onClick={() => handleOpenItem(item)}
                                                        className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 text-white ${
                                                            isBlank ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-violet-600 hover:bg-violet-700'
                                                        }`}
                                                        title={isBlank ? "빈화면 수업 열기" : `${item.startPage || 1}쪽 열기`}
                                                    >
                                                        {isBlank ? <Square className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                                                        <span>{isBlank ? "빈화면 열기" : `${item.startPage || 1}쪽 열기`}</span>
                                                        <ArrowRight className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>입력 및 수정한 모든 계획안 내용은 기본 DB에 안전하게 자동 저장·유지됩니다.</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsHwpHtmlViewerOpen(true)}
                                className="px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-700 font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                                <FileText className="w-3.5 h-3.5 text-violet-600" />
                                <span>원본 문서 미리보기</span>
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Blank Screen Dialog */}
            {showQuickBlank && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                                    <Square className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">빈 화면 수업 바로 열기</h3>
                            </div>
                            <button
                                onClick={() => setShowQuickBlank(false)}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3 mb-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    수업/활동명
                                </label>
                                <input
                                    type="text"
                                    value={quickBlankSubject}
                                    onChange={(e) => setQuickBlankSubject(e.target.value)}
                                    placeholder="예: 창체, 자율활동, 안전교육"
                                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    빈 화면에 표시할 내용 (과제/안내)
                                </label>
                                <textarea
                                    rows={3}
                                    value={quickBlankTopic}
                                    onChange={(e) => setQuickBlankTopic(e.target.value)}
                                    placeholder="예: 1. 모둠별 역할 정하기&#10;2. 도서관 다녀와서 독후감 작성하기"
                                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => setShowQuickBlank(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleLaunchQuickBlank}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                            >
                                <Square className="w-3.5 h-3.5" />
                                <span>빈 화면 열기</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* rhwp 기반 HWP 원본 HTML 뷰어 모달 */}
            <HwpHtmlViewerModal
                isOpen={isHwpHtmlViewerOpen}
                onClose={() => setIsHwpHtmlViewerOpen(false)}
                filePath={effectivePlan?.filePath}
                docTitle={effectivePlan?.title}
                onPlanUpdated={(newPlan) => {
                    persistPlan(newPlan);
                }}
            />
        </>
    );
}

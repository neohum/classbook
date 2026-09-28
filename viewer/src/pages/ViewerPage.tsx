import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Home, Loader2, Maximize, Minimize, PenTool, X, Eraser, Trash2, Square, Clock, Play, Pause, Bell, BellOff, Octagon, Settings, CalendarDays, Plus, BookOpen, Minus, Calendar, Coffee, Sparkles } from 'lucide-react';
import { WindowFullscreen, WindowUnfullscreen, WindowIsFullscreen, Quit, WindowMinimise, EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import { StartDrag, GetAppVersion, CheckForUpdate, GetLatestWeeklyPlan, GetWatchFolder, UpdateBookOffset, GetTextbooks } from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';
import WeeklyPlanAlertModal from '../components/WeeklyPlanAlertModal';
import WeeklyPlanScheduleModal from '../components/WeeklyPlanScheduleModal';
import { resolveBookForSubject } from '../utils/bookResolver';

export interface ScheduleItem {
    id: string;
    period?: number;
    name: string;
    startTime: string;
    endTime: string;
    startMessage: string;
    restMessage: string;
}

const defaultSchedule: ScheduleItem[] = [
    { id: '1', period: 1, name: '1교시', startTime: '09:00', endTime: '09:40', startMessage: '1교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '2', period: 2, name: '2교시', startTime: '09:50', endTime: '10:30', startMessage: '2교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '3', period: 3, name: '3교시', startTime: '10:40', endTime: '11:20', startMessage: '3교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '4', period: 4, name: '4교시', startTime: '11:30', endTime: '12:10', startMessage: '4교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '5', period: 5, name: '5교시', startTime: '13:00', endTime: '13:40', startMessage: '5교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '6', period: 6, name: '6교시', startTime: '13:50', endTime: '14:30', startMessage: '6교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
];

let sharedAudioContext: AudioContext | null = null;
const initAudioContext = () => {
    try {
        if (!sharedAudioContext) {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            if (Ctx) {
                sharedAudioContext = new Ctx();
            }
        }
        if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume();
        }
    } catch (e) {
        console.error("Audio init failed:", e);
    }
};

let activeAudioNodes: any[] = [];
let alarmTimeout: ReturnType<typeof setTimeout> | null = null;

const stopAllAudio = () => {
    activeAudioNodes.forEach(node => {
        try {
            if (node.stop) node.stop();
        } catch (e) { }
    });
    activeAudioNodes = [];
    if (alarmTimeout) {
        clearTimeout(alarmTimeout);
        alarmTimeout = null;
    }
};

const playBeep = (loop: boolean) => {
    stopAllAudio();
    try {
        const ctx = sharedAudioContext;
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        const scheduleBeeps = () => {
            let startTime = ctx.currentTime;
            for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();
                osc.connect(gainNode);
                gainNode.connect(ctx.destination);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, startTime);

                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
                gainNode.gain.linearRampToValueAtTime(0, startTime + 0.3);

                osc.start(startTime);
                osc.stop(startTime + 0.3);

                activeAudioNodes.push(osc);
                startTime += 0.4;
            }
            if (loop) {
                alarmTimeout = setTimeout(scheduleBeeps, Math.max(100, (startTime - ctx.currentTime) * 1000 + 500));
            }
        };
        scheduleBeeps();
    } catch (e) {
        console.error("Audio play failed:", e);
    }
};

const playMusic = (loop: boolean) => {
    stopAllAudio();
    try {
        const ctx = sharedAudioContext;
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        const notes = [
            { freq: 261.63, dur: 0.2 },
            { freq: 329.63, dur: 0.2 },
            { freq: 392.00, dur: 0.2 },
            { freq: 523.25, dur: 0.4 },
            { freq: 392.00, dur: 0.2 },
            { freq: 329.63, dur: 0.2 },
            { freq: 261.63, dur: 0.6 },
        ];

        const scheduleMusic = () => {
            let startTime = ctx.currentTime;
            for (const note of notes) {
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();
                osc.connect(gainNode);
                gainNode.connect(ctx.destination);

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(note.freq, startTime);

                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
                gainNode.gain.linearRampToValueAtTime(0, startTime + note.dur - 0.05);

                osc.start(startTime);
                osc.stop(startTime + note.dur);

                activeAudioNodes.push(osc);
                startTime += note.dur;
            }
            if (loop) {
                alarmTimeout = setTimeout(scheduleMusic, Math.max(100, (startTime - ctx.currentTime) * 1000 + 500));
            }
        };
        scheduleMusic();
    } catch (e) {
        console.error("Audio play failed:", e);
    }
};

function PageRenderer({ bookId, pageNumber, scale }: { bookId: string, pageNumber: number, scale: number }) {
    const [isRendered, setIsRendered] = useState(false);
    const [imgUrl, setImgUrl] = useState('');

    useEffect(() => {
        setIsRendered(false);
        const url = `/book/images/${bookId}/page_${pageNumber}.jpg`;
        const img = new Image();
        img.src = url;
        img.onload = () => {
            setImgUrl(url);
            setIsRendered(true);
        };
        img.onerror = () => {
            console.error(`Failed to load page ${pageNumber} for`, bookId);
        };
    }, [bookId, pageNumber]);

    return (
        <div className="relative shadow-xl bg-white flex-shrink-0 h-full flex flex-col items-center justify-center overflow-hidden">
            {!isRendered && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 animate-pulse min-w-[300px]">
                    <Loader2 className="w-12 h-12 text-slate-300 animate-spin" />
                </div>
            )}
            {imgUrl && (
                <img
                    src={imgUrl}
                    alt={`Page ${pageNumber}`}
                    className={`block object-contain transition-all duration-300 h-full ${isRendered ? 'opacity-100' : 'opacity-0'}`}
                    style={{
                        width: scale > 1 ? `${scale * 100}%` : 'auto',
                        height: scale > 1 ? 'auto' : '100%',
                        maxWidth: 'none',
                        maxHeight: '100%'
                    }}
                />
            )}
        </div>
    );
}

export default function ViewerPage() {
    const { bookId } = useParams<{ bookId: string }>();
    const [searchParams] = useSearchParams();
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [numPages, setNumPages] = useState<number>(0);
    const [inputPage, setInputPage] = useState<string>("1");
    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const scale = 1.0;

    // Page Offset sync
    const [pageOffset, setPageOffset] = useState<number>(0);

    // Weekly Plan States
    const [currentPlan, setCurrentPlan] = useState<main.WeeklyPlanResult | null>(null);
    const currentPlanRef = useRef<main.WeeklyPlanResult | null>(null);
    const [watchFolder, setWatchFolder] = useState<string>('');
    const [isWeeklyPlanModalOpen, setIsWeeklyPlanModalOpen] = useState<boolean>(false);

    // Unified Alert Data (Class Start & Rest Time)
    const [alertData, setAlertData] = useState<{
        isOpen: boolean;
        isRestTime: boolean;
        periodName: string;
        periodTime: string;
        customMessage: string;
        item: main.WeeklyPlanItem | null;
    }>({
        isOpen: false,
        isRestTime: false,
        periodName: '',
        periodTime: '',
        customMessage: '',
        item: null
    });

    // Toast Message
    const [toastMessage, setToastMessage] = useState<string>('');
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const showToast = (msg: string) => {
        setToastMessage(msg);
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => setToastMessage(''), 3500);
    };

    useEffect(() => {
        currentPlanRef.current = currentPlan;
    }, [currentPlan]);

    useEffect(() => {
        if (bookId) {
            const saved = localStorage.getItem(`pageOffset_${bookId}`);
            if (saved !== null) {
                setPageOffset(parseInt(saved, 10));
            } else {
                setPageOffset(0);
            }
        }
    }, [bookId]);

    // Load initial weekly plan and watch folder
    useEffect(() => {
        GetLatestWeeklyPlan().then(plan => {
            if (plan && plan.success) {
                setCurrentPlan(plan);
                currentPlanRef.current = plan;

                // If startAlert param is present in URL, trigger alert modal
                if (searchParams.get('startAlert') === 'true') {
                    const now = new Date();
                    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];
                    const targetDay = (dayOfWeek === '일' || dayOfWeek === '토') ? '월' : dayOfWeek;
                    const dayItems = plan.schedule[targetDay] || [];
                    const currentScheds = getStoredSchedule();

                    const hh = now.getHours().toString().padStart(2, '0');
                    const mm = now.getMinutes().toString().padStart(2, '0');
                    const currentTimeStr = `${hh}:${mm}`;

                    let activePeriod = 1;
                    let activeSched = currentScheds[0];
                    for (let i = 0; i < currentScheds.length; i++) {
                        const s = currentScheds[i];
                        const pNum = s.period || parseInt(s.name.replace(/[^0-9]/g, ''), 10) || (i + 1);
                        if (currentTimeStr >= s.startTime && currentTimeStr <= s.endTime) {
                            activePeriod = pNum;
                            activeSched = s;
                            break;
                        } else if (currentTimeStr < s.startTime) {
                            activePeriod = pNum;
                            activeSched = s;
                            break;
                        } else if (currentTimeStr > s.endTime) {
                            activePeriod = pNum;
                            activeSched = s;
                        }
                    }

                    let targetItem = dayItems.find(it => it.period === activePeriod);
                    if (!targetItem && dayItems.length > 0) {
                        targetItem = dayItems[activePeriod - 1] || dayItems[0];
                    }

                    if (targetItem) {
                        setAlertData({
                            isOpen: true,
                            isRestTime: false,
                            periodName: activeSched?.name || `${activePeriod}교시`,
                            periodTime: activeSched ? `${activeSched.startTime} ~ ${activeSched.endTime}` : '',
                            customMessage: activeSched?.startMessage || `${activePeriod}교시 수업을 시작합니다! 자리에 앉아주세요.`,
                            item: targetItem
                        });
                    }
                }
            }
        }).catch(console.error);

        GetWatchFolder().then(folder => {
            if (folder) setWatchFolder(folder);
        }).catch(console.error);

        const handlePlanUpdate = (plan: main.WeeklyPlanResult) => {
            if (plan && plan.success) {
                setCurrentPlan(plan);
                currentPlanRef.current = plan;
                applyWeeklyPlanNow(plan);
            }
        };

        const handleScheduleUpdate = () => {
            setSchedules(getStoredSchedule());
        };
        window.addEventListener('classbook_schedule_updated', handleScheduleUpdate);

        EventsOn('weekly-plan-updated', handlePlanUpdate);
        return () => {
            EventsOff('weekly-plan-updated');
            window.removeEventListener('classbook_schedule_updated', handleScheduleUpdate);
        };
    }, [bookId, numPages, pageOffset, searchParams]);

    const handleOffsetChange = (newPrintedPage: number) => {
        if (isNaN(newPrintedPage)) return;
        const newOffset = currentPage - newPrintedPage;
        setPageOffset(newOffset);
        if (bookId) {
            localStorage.setItem(`pageOffset_${bookId}`, newOffset.toString());
            UpdateBookOffset(bookId, newOffset).catch(console.error);
        }
    };

    const getPrintedPage = (pageIndex: number | null) => {
        if (pageIndex === null) return null;
        const printed = pageIndex - pageOffset;
        return printed <= 0 ? `앞 ${pageIndex}` : printed.toString();
    };

    const navigate = useNavigate();
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Drawing State
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    const activePointersRef = React.useRef<{ [key: number]: { x: number, y: number } }>({});
    const [color, setColor] = useState('#ef4444'); // Default Red
    const [lineWidth, setLineWidth] = useState(4);
    const [isEraser, setIsEraser] = useState(false);
    const [isWhiteboard, setIsWhiteboard] = useState(false);

    // Visual Viewport State
    const [vp, setVp] = useState({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight, scale: 1 });

    useEffect(() => {
        const updateVP = () => {
            if (window.visualViewport) {
                setVp({
                    x: window.visualViewport.offsetLeft,
                    y: window.visualViewport.offsetTop,
                    w: window.visualViewport.width,
                    h: window.visualViewport.height,
                    scale: window.visualViewport.scale
                });
            }
        };
        window.visualViewport?.addEventListener('resize', updateVP);
        window.visualViewport?.addEventListener('scroll', updateVP);
        updateVP();
        return () => {
            window.visualViewport?.removeEventListener('resize', updateVP);
            window.visualViewport?.removeEventListener('scroll', updateVP);
        };
    }, []);

    // Touch swipe navigation
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchEndX, setTouchEndX] = useState<number | null>(null);

    // Settings state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [appVersion, setAppVersion] = useState("");

    // Book Info State
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);    // Timer State
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
    const [customTimerMinutes, setCustomTimerMinutes] = useState("");
    const timerIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const [isSoundEnabled, setIsSoundEnabled] = useState(true);
    const [alarmType, setAlarmType] = useState<'beep' | 'music'>('beep');
    const [alarmLoop, setAlarmLoop] = useState(false);
    const [isAlarmRinging, setIsAlarmRinging] = useState(false);

    // Schedule State
    const [schedules, setSchedules] = useState<ScheduleItem[]>(() => {
        try {
            const saved = localStorage.getItem('classbook_schedule_v3');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) { }
        return defaultSchedule;
    });

    useEffect(() => {
        try {
            localStorage.setItem('classbook_schedule_v3', JSON.stringify(schedules));
        } catch (e) { }
    }, [schedules]);

    const [isScheduleEnabled, setIsScheduleEnabled] = useState(true);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const lastTriggeredMinuteRef = React.useRef("");

    const isSoundEnabledRef = React.useRef(isSoundEnabled);
    const alarmTypeRef = React.useRef(alarmType);
    const alarmLoopRef = React.useRef(alarmLoop);
    const isScheduleEnabledRef = React.useRef(isScheduleEnabled);

    useEffect(() => {
        isSoundEnabledRef.current = isSoundEnabled;
        alarmTypeRef.current = alarmType;
        alarmLoopRef.current = alarmLoop;
        isScheduleEnabledRef.current = isScheduleEnabled;
    }, [isSoundEnabled, alarmType, alarmLoop, isScheduleEnabled]);

    const openSettings = async () => {
        try {
            const version = await GetAppVersion();
            setAppVersion(version);
        } catch (e) { console.error(e); }
        setIsSettingsOpen(true);
    };

    const applyWeeklyPlanNow = async (plan: main.WeeklyPlanResult) => {
        if (!plan || !plan.success || !plan.schedule) return;

        const now = new Date();
        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];
        const targetDay = (dayOfWeek === '일' || dayOfWeek === '토') ? '월' : dayOfWeek;
        const dayItems = plan.schedule[targetDay] || [];
        if (dayItems.length === 0) return;

        const hh = now.getHours().toString().padStart(2, '0');
        const mm = now.getMinutes().toString().padStart(2, '0');
        const currentTimeStr = `${hh}:${mm}`;

        // Find active or upcoming period
        let activePeriod = 1;
        for (const s of schedules) {
            const pNum = s.period || parseInt(s.name.replace(/[^0-9]/g, ''), 10) || 1;
            if (currentTimeStr >= s.startTime && currentTimeStr <= s.endTime) {
                activePeriod = pNum;
                break;
            } else if (currentTimeStr < s.startTime) {
                activePeriod = pNum;
                break;
            } else if (currentTimeStr > s.endTime) {
                activePeriod = pNum;
            }
        }

        const targetItem = dayItems.find(it => it.period === activePeriod) || dayItems[0];
        if (targetItem) {
            const targetPage = targetItem.startPage || 1;
            const books = (await GetTextbooks()) || [];
            const resolved = resolveBookForSubject(targetItem.subject, targetItem.matchedBookId, books);

            if (resolved) {
                showToast(`주학습계획안 반영: ${targetDay}요일 ${targetItem.period}교시 [${resolved.title} ${targetPage}쪽]으로 이동합니다.`);
                if (resolved.id === bookId) {
                    const physical = Math.min(Math.max(1, targetPage + pageOffset), numPages);
                    setCurrentPage(physical);
                    setInputPage(targetPage.toString());
                } else {
                    navigate(`/viewer/${encodeURIComponent(resolved.id)}?targetPage=${targetPage}`);
                }
            } else {
                showToast(`주학습계획안: ${targetDay}요일 ${targetItem.period}교시 [${targetItem.subject} ${targetPage}쪽] 일치하는 교재를 찾지 못했습니다.`);
            }
        }
    };

    useEffect(() => {
        const checkSchedule = () => {
            const now = new Date();
            const h = now.getHours().toString().padStart(2, '0');
            const m = now.getMinutes().toString().padStart(2, '0');
            const currentTimeStr = `${h}:${m}`;

            if (lastTriggeredMinuteRef.current === currentTimeStr) return;
            if (!isScheduleEnabledRef.current) return;

            const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];

            for (let i = 0; i < schedules.length; i++) {
                const item = schedules[i];
                const periodNum = item.period || parseInt(item.name.replace(/[^0-9]/g, ''), 10) || (i + 1);

                if (item.startTime === currentTimeStr) {
                    lastTriggeredMinuteRef.current = currentTimeStr;
                    if (isSoundEnabledRef.current) {
                        initAudioContext();
                        if (alarmTypeRef.current === 'beep') playBeep(alarmLoopRef.current);
                        else playMusic(alarmLoopRef.current);
                    }

                    let planItem: main.WeeklyPlanItem | null = null;
                    if (currentPlanRef.current?.schedule && dayOfWeek !== '일' && dayOfWeek !== '토') {
                        const dayItems = currentPlanRef.current.schedule[dayOfWeek] || [];
                        planItem = dayItems.find(it => it.period === periodNum) || dayItems[periodNum - 1] || dayItems[0] || null;
                    }

                    // 수업 시작 시: 과목 페이지가 자동으로 뜨도록 즉시 이동!
                    if (planItem) {
                        const targetPage = planItem.startPage || 1;
                        GetTextbooks().then(books => {
                            const resolved = resolveBookForSubject(planItem!.subject, planItem!.matchedBookId, books || []);
                            if (resolved) {
                                if (resolved.id === bookId) {
                                    const physical = Math.min(Math.max(1, targetPage + pageOffset), numPages);
                                    setCurrentPage(physical);
                                    setInputPage(targetPage.toString());
                                } else {
                                    navigate(`/viewer/${encodeURIComponent(resolved.id)}?targetPage=${targetPage}`);
                                }
                            }
                        });
                    }

                    setAlertData({
                        isOpen: true,
                        isRestTime: false,
                        periodName: item.name || `${periodNum}교시`,
                        periodTime: `${item.startTime} ~ ${item.endTime}`,
                        customMessage: item.startMessage || `${periodNum}교시 수업을 시작합니다! 자리에 앉아주세요.`,
                        item: planItem
                    });

                    if (isTimerModalOpen) setIsTimerModalOpen(false);
                    if (isScheduleModalOpen) setIsScheduleModalOpen(false);
                    return;
                } else if (item.endTime === currentTimeStr) {
                    lastTriggeredMinuteRef.current = currentTimeStr;
                    if (isSoundEnabledRef.current) {
                        initAudioContext();
                        if (alarmTypeRef.current === 'beep') playBeep(alarmLoopRef.current);
                        else playMusic(alarmLoopRef.current);
                    }

                    // 수업 마칠 때 (쉬는 시간 시작): "쉬는 시간입니다" 기본 문구
                    setAlertData({
                        isOpen: true,
                        isRestTime: true,
                        periodName: item.name || `${periodNum}교시`,
                        periodTime: item.endTime,
                        customMessage: item.restMessage || "쉬는 시간입니다",
                        item: null
                    });

                    if (isTimerModalOpen) setIsTimerModalOpen(false);
                    if (isScheduleModalOpen) setIsScheduleModalOpen(false);
                    return;
                }
            }
        };

        const interval = setInterval(checkSchedule, 1000);
        return () => clearInterval(interval);
    }, [schedules, isTimerModalOpen, isScheduleModalOpen, bookId, pageOffset, numPages, navigate]);

    useEffect(() => {
        if (isTimerRunning) {
            timerIntervalRef.current = setInterval(() => {
                setTimerSeconds(prev => {
                    const next = prev - 1;
                    if (next <= 0) {
                        setIsTimerRunning(false);
                        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                        if (isSoundEnabledRef.current) {
                            setIsAlarmRinging(true);
                            if (alarmTypeRef.current === 'beep') {
                                playBeep(alarmLoopRef.current);
                            } else {
                                playMusic(alarmLoopRef.current);
                            }
                        }
                        return 0;
                    }
                    return next;
                });
            }, 1000);
        } else {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
        return () => {
        };
    }, [isTimerRunning]);

    // Auto-close alarm after 30 seconds if uncanceled
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        if (isAlarmRinging) {
            timeout = setTimeout(() => {
                setIsAlarmRinging(false);
                setScheduleAlarmMessage("");
                stopAllAudio();
            }, 30000);
        }
        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [isAlarmRinging]);

    const startTimer = (minutes: number) => {
        setTimerSeconds(minutes * 60);
        setIsTimerRunning(true);
        if (isSoundEnabledRef.current) initAudioContext();
    };

    const stopTimer = () => {
        setIsTimerRunning(false);
        setTimerSeconds(0);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setIsAlarmRinging(false);
        setScheduleAlarmMessage("");
        stopAllAudio();
    };

    const toggleTimerRunning = () => {
        if (timerSeconds > 0) {
            setIsTimerRunning(!isTimerRunning);
            if (!isTimerRunning && isSoundEnabledRef.current) {
                initAudioContext();
            }
        }
    };

    const handleCustomTimerStart = (e: React.FormEvent) => {
        e.preventDefault();
        const mins = parseInt(customTimerMinutes, 10);
        if (!isNaN(mins) && mins > 0) {
            startTimer(mins);
            setCustomTimerMinutes("");
        }
    };

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const renderTimerModal = () => {
        if (!isTimerModalOpen && !isAlarmRinging) return null;

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
                {isAlarmRinging ? (
                    <div className="flex flex-col items-center justify-center gap-8 bg-slate-800/95 border border-violet-500/50 p-16 rounded-[3rem] shadow-[0_0_50px_rgba(139,92,246,0.3)] backdrop-blur-md">
                        <Bell className="w-32 h-32 text-violet-400 animate-bounce" />
                        <span className="text-5xl font-bold text-white mb-4 text-center max-w-xl">{scheduleAlarmMessage || "타이머 종료!"}</span>
                        <button onClick={() => {
                            setIsAlarmRinging(false);
                            setScheduleAlarmMessage("");
                            stopAllAudio();
                        }} className="px-16 py-6 bg-violet-600 hover:bg-violet-700 text-white text-3xl rounded-3xl font-bold shadow-[0_0_30px_rgba(139,92,246,0.6)] transition-all transform hover:scale-105">
                            확인 및 알림 끄기
                        </button>
                    </div>
                ) : (
                    <div className="bg-slate-800/95 border border-slate-600 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 w-[50vw] max-w-2xl min-h-[50vh]">
                        <div className="flex flex-col w-full gap-4 mb-6">
                            <div className="flex w-full items-center justify-between">
                                <span className="text-white text-2xl font-bold flex items-center gap-2">
                                    <Clock className="w-8 h-8 text-violet-400" /> 타이머 설정
                                </span>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => {
                                            const nextState = !isSoundEnabled;
                                            setIsSoundEnabled(nextState);
                                            if (nextState) initAudioContext();
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors font-medium border ${isSoundEnabled ? 'bg-violet-600/20 text-violet-300 border-violet-500/50' : 'bg-slate-800 text-slate-400 border-slate-600 hover:text-white hover:bg-slate-700'}`}
                                        title="알림음 켜기/끄기"
                                    >
                                        {isSoundEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                                        <span>{isSoundEnabled ? '소리 켜짐' : '소리 꺼짐'}</span>
                                    </button>
                                    <button onClick={() => setIsTimerModalOpen(false)} className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-700">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Additional Audio Settings */}
                            {isSoundEnabled && !isTimerRunning && timerSeconds === 0 && (
                                <div className="flex flex-col sm:flex-row items-center gap-4 w-full bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 justify-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 font-medium whitespace-nowrap ml-2">소리 종류:</span>
                                        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                                            <button onClick={() => setAlarmType('beep')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${alarmType === 'beep' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>전자음</button>
                                            <button onClick={() => setAlarmType('music')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${alarmType === 'music' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>음악</button>
                                        </div>
                                    </div>
                                    <div className="hidden sm:block w-px h-6 bg-slate-700 mx-2" />
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 font-medium whitespace-nowrap">반복:</span>
                                        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                                            <button onClick={() => setAlarmLoop(false)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${!alarmLoop ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>한 번만</button>
                                            <button onClick={() => setAlarmLoop(true)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${alarmLoop ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>계속 울림</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!isTimerRunning && timerSeconds === 0 ? (
                            <div className="flex flex-col w-full gap-6">
                                <div className="flex w-full gap-4">
                                    <button onClick={() => startTimer(1)} className="flex-1 py-6 bg-slate-700 hover:bg-violet-600 text-white text-2xl rounded-2xl transition-all font-semibold shadow-lg">1분</button>
                                    <button onClick={() => startTimer(3)} className="flex-1 py-6 bg-slate-700 hover:bg-violet-600 text-white text-2xl rounded-2xl transition-all font-semibold shadow-lg">3분</button>
                                    <button onClick={() => startTimer(5)} className="flex-1 py-6 bg-slate-700 hover:bg-violet-600 text-white text-2xl rounded-2xl transition-all font-semibold shadow-lg">5분</button>
                                </div>
                                <form onSubmit={handleCustomTimerStart} className="flex w-full gap-4">
                                    <input
                                        type="number"
                                        min="1"
                                        value={customTimerMinutes}
                                        onChange={e => setCustomTimerMinutes(e.target.value)}
                                        placeholder="원하는 시간(분) 입력"
                                        className="flex-1 bg-slate-900 border border-slate-700 text-white text-2xl rounded-2xl px-6 py-4 outline-none focus:border-violet-500 w-full"
                                    />
                                    <button type="submit" className="px-8 py-4 bg-violet-600 hover:bg-violet-700 text-white text-2xl rounded-2xl transition-all font-semibold shadow-lg whitespace-nowrap">시작</button>
                                </form>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center w-full flex-1 justify-center space-y-12 my-6">
                                <div className="text-[10rem] leading-none font-bold text-violet-400 font-mono tracking-tighter drop-shadow-lg tabular-nums">
                                    {formatTime(timerSeconds)}
                                </div>
                                <div className="flex gap-6 w-full max-w-md">
                                    <button onClick={toggleTimerRunning} className="flex-1 flex items-center justify-center gap-3 py-6 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl transition-all shadow-lg text-2xl">
                                        {isTimerRunning ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                                        <span className="font-bold">{isTimerRunning ? '일시정지' : '계속'}</span>
                                    </button>
                                    <button onClick={stopTimer} className="flex-1 flex items-center justify-center gap-3 py-6 bg-red-900/50 hover:bg-red-600 text-red-100 hover:text-white rounded-2xl transition-all border border-red-800/50 shadow-lg text-2xl">
                                        <Octagon className="w-8 h-8" />
                                        <span className="font-bold">종료</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderScheduleModal = () => {
        if (!isScheduleModalOpen) return null;

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col p-6 sm:p-8 w-full max-w-4xl max-h-[90vh]">
                    <div className="flex w-full items-center justify-between mb-6 pb-4 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-violet-600/20 text-violet-400 rounded-2xl border border-violet-500/30">
                                <CalendarDays className="w-7 h-7" />
                            </div>
                            <div>
                                <h2 className="text-white text-2xl font-black">시종 시간 및 알림 문구 설정</h2>
                                <p className="text-xs text-slate-400">교시별 시간 및 시작/쉬는 시간에 표시될 알림 문구를 직접 입력하고 관리합니다.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsScheduleEnabled(!isScheduleEnabled)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-semibold border ${isScheduleEnabled ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-600/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                                title="시종 알림 켜기/끄기"
                            >
                                {isScheduleEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                                <span>{isScheduleEnabled ? '시종 알림 켜짐' : '시종 알림 꺼짐'}</span>
                            </button>
                            <button
                                onClick={() => setIsScheduleModalOpen(false)}
                                className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-800"
                                title="닫기"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar flex-1 mb-4">
                        {schedules.map((schedule, idx) => (
                            <div key={schedule.id} className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-md flex flex-col gap-3">
                                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-1">
                                        <span className="w-7 h-7 rounded-lg bg-violet-900/50 border border-violet-700/50 text-violet-300 font-bold text-sm flex items-center justify-center">
                                            {idx + 1}
                                        </span>
                                        <input
                                            type="text"
                                            value={schedule.name}
                                            onChange={(e) => {
                                                setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, name: e.target.value } : s));
                                            }}
                                            className="bg-slate-900 text-white font-bold text-lg px-3 py-1.5 rounded-xl border border-slate-700 focus:border-violet-500 outline-none w-36"
                                            placeholder="이름 (예: 1교시)"
                                        />
                                        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                            <input
                                                type="time"
                                                value={schedule.startTime}
                                                onChange={(e) => {
                                                    setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, startTime: e.target.value } : s));
                                                }}
                                                className="bg-transparent text-white font-mono font-bold outline-none text-sm"
                                            />
                                            <span className="text-slate-500 font-bold">~</span>
                                            <input
                                                type="time"
                                                value={schedule.endTime}
                                                onChange={(e) => {
                                                    setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, endTime: e.target.value } : s));
                                                }}
                                                className="bg-transparent text-white font-mono font-bold outline-none text-sm"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSchedules(prev => prev.filter(s => s.id !== schedule.id))}
                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-colors"
                                        title="이 교시 삭제"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* 문구 설정 행 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-700/40">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
                                            <Bell className="w-3.5 h-3.5" />
                                            수업 시작 알림 문구:
                                        </label>
                                        <input
                                            type="text"
                                            value={schedule.startMessage || ""}
                                            onChange={(e) => {
                                                setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, startMessage: e.target.value } : s));
                                            }}
                                            placeholder="수업 시작 시 화면에 표시될 문구 입력"
                                            className="bg-slate-900 text-slate-200 text-sm px-3 py-2 rounded-xl border border-slate-700 focus:border-violet-500 outline-none placeholder:text-slate-500"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                                            <Coffee className="w-3.5 h-3.5" />
                                            쉬는 시간 알림 문구:
                                        </label>
                                        <input
                                            type="text"
                                            value={schedule.restMessage || ""}
                                            onChange={(e) => {
                                                setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, restMessage: e.target.value } : s));
                                            }}
                                            placeholder="쉬는 시간이 되었을 때 화면에 표시될 문구 입력"
                                            className="bg-slate-900 text-slate-200 text-sm px-3 py-2 rounded-xl border border-slate-700 focus:border-amber-500 outline-none placeholder:text-slate-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                        <button
                            onClick={() => {
                                const newIdx = schedules.length + 1;
                                const newId = Math.random().toString(36).substr(2, 9);
                                setSchedules([
                                    ...schedules,
                                    {
                                        id: newId,
                                        period: newIdx,
                                        name: `${newIdx}교시`,
                                        startTime: '14:40',
                                        endTime: '15:20',
                                        startMessage: `${newIdx}교시 수업을 시작합니다.`,
                                        restMessage: `${newIdx}교시 쉬는 시간입니다.`
                                    }
                                ]);
                            }}
                            className="flex items-center gap-2 px-5 py-3 border border-dashed border-violet-500/50 hover:border-violet-500 hover:bg-violet-500/10 text-violet-300 rounded-xl transition-all font-semibold text-sm"
                        >
                            <Plus className="w-4 h-4" /> 새 교시/일정 추가
                        </button>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    if (confirm('시종 시간표를 기본값으로 되돌리시겠습니까?')) {
                                        setSchedules(defaultSchedule);
                                    }
                                }}
                                className="px-4 py-2.5 text-slate-400 hover:text-slate-200 text-sm transition-colors"
                            >
                                기본값 복원
                            </button>
                            <button
                                onClick={() => setIsScheduleModalOpen(false)}
                                className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl shadow-lg shadow-violet-600/30 transition-all text-sm"
                            >
                                저장 및 닫기
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderInfoModal = () => {
        if (!isInfoModalOpen) return null;

        return (
            <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 pointer-events-auto cursor-pointer"
                onClick={() => setIsInfoModalOpen(false)}
            >
                <div
                    className="relative bg-slate-900/60 border border-violet-500/50 rounded-[4rem] shadow-[0_0_150px_rgba(139,92,246,0.3)] flex flex-col items-center justify-center p-8 sm:p-12 w-[95vw] h-[95vh] max-w-none mx-auto text-center transform transition-all scale-100"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => setIsInfoModalOpen(false)}
                        className="absolute top-6 right-6 sm:top-10 sm:right-10 p-3 sm:p-4 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full transition-colors"
                        title="닫기"
                    >
                        <X className="w-10 h-10 sm:w-14 sm:h-14" />
                    </button>
                    <BookOpen className="w-[12vh] h-[12vh] sm:w-[15vh] sm:h-[15vh] text-violet-400 mb-8 sm:mb-12" />
                    <h2 className="text-[8vw] sm:text-[10vw] font-black text-white mb-10 sm:mb-16 tracking-tight leading-none drop-shadow-2xl break-keep">
                        {bookId}
                    </h2>
                    <div className="flex items-center justify-center gap-6 sm:gap-10 bg-slate-900/50 px-12 py-6 sm:px-24 sm:py-10 rounded-[4rem] border border-slate-700/50">
                        <span className="text-[12vw] sm:text-[16vw] font-bold text-violet-300 leading-none">
                            {getPrintedPage(leftPage)}
                        </span>
                        {rightPage && (
                            <>
                                <span className="text-[12vw] sm:text-[16vw] font-bold text-slate-500 leading-none">/</span>
                                <span className="text-[12vw] sm:text-[16vw] font-bold text-violet-300 leading-none">
                                    {getPrintedPage(rightPage)}
                                </span>
                            </>
                        )}
                        <span className="text-[5vw] sm:text-[7vw] font-medium text-slate-400 ml-4 sm:ml-8 mt-auto mb-[2vw] sm:mb-[3vw]">쪽</span>
                    </div>

                    <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 bg-black/40 px-6 py-4 rounded-3xl border border-slate-700 backdrop-blur-md">
                        <span className="text-slate-300 text-base sm:text-xl font-medium">현재 화면의 실제 쪽수는?</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                className="w-20 sm:w-28 bg-slate-800 border-2 border-slate-600 text-white text-center text-xl sm:text-2xl font-bold rounded-xl py-2 focus:border-violet-500 focus:outline-none transition-colors"
                                placeholder="쪽수"
                                value={currentPage - pageOffset}
                                onChange={(e) => handleOffsetChange(parseInt(e.target.value, 10))}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-slate-400 text-base sm:text-xl">쪽입니다</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderTimerButton = (position: 'top' | 'left' | 'right') => {
        const isActive = isTimerModalOpen;
        const isShowingTime = timerSeconds > 0;

        if (position === 'top') {
            return (
                <div className="relative flex items-center gap-2">
                    {!isScheduleModalOpen && (
                        <button
                            onClick={() => setIsScheduleModalOpen(true)}
                            className="p-1.5 sm:p-2 rounded-full border transition-all bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700"
                            title="시종 시간 설정"
                        >
                            <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    )}
                    <button
                        onClick={() => setIsTimerModalOpen(!isTimerModalOpen)}
                        className={`flex items-center gap-1.5 p-1.5 sm:p-2 rounded-full border transition-all ${isActive ? 'bg-violet-600 border-violet-500 text-white' : isShowingTime ? 'bg-slate-800 border-violet-500 text-violet-400 hover:bg-slate-700 hover:text-violet-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'} ${isShowingTime || isActive ? 'px-3 sm:px-4' : ''}`}
                        title="타이머"
                    >
                        <Clock className="w-4 h-4" />
                        {isShowingTime && <span className="text-sm font-bold font-mono tracking-wider">{formatTime(timerSeconds)}</span>}
                    </button>
                </div>
            );
        } else {
            return (
                <div className={`relative flex items-center ${position === 'right' ? 'justify-end' : ''}`}>
                    <button
                        onClick={() => setIsTimerModalOpen(!isTimerModalOpen)}
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto flex-col ${(isActive || isShowingTime) ? 'bg-violet-600/90 text-white' : 'bg-black/40 hover:bg-slate-700/80 text-slate-300 hover:text-white'}`}
                        title="타이머"
                    >
                        <Clock className={isShowingTime ? "w-5 h-5 mb-0.5" : "w-6 h-6"} />
                        {isShowingTime && <span className="text-[11px] font-bold font-mono leading-none tracking-tighter">{formatTime(timerSeconds)}</span>}
                    </button>
                </div>
            );
        }
    }



    const handleHeaderPointerDown = (e: React.PointerEvent<HTMLElement>) => {
        // Prevent drag if touching a button
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('form')) {
            return;
        }

        // Native Windows drag triggered by Go
        StartDrag();
    };

    const toggleDrawingMode = () => {
        setIsDrawingMode(!isDrawingMode);
    };
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const getCoordinateFromPointer = (e: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        return {
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top
        };
    };

    const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingMode) return;

        e.currentTarget.setPointerCapture(e.pointerId);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { offsetX, offsetY } = getCoordinateFromPointer(e, canvas);

        activePointersRef.current[e.pointerId] = { x: offsetX, y: offsetY };

        ctx.beginPath();
        // Dot drawing fallback for immediate taps
        ctx.moveTo(offsetX, offsetY);
        ctx.lineTo(offsetX, offsetY);

        ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : color;
        ctx.lineWidth = isEraser ? 20 : lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.stroke();
    };

    const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingMode) return;
        const pointer = activePointersRef.current[e.pointerId];
        if (!pointer) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { offsetX, offsetY } = getCoordinateFromPointer(e, canvas);

        ctx.beginPath();
        ctx.moveTo(pointer.x, pointer.y);
        ctx.lineTo(offsetX, offsetY);

        ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : color;
        ctx.lineWidth = isEraser ? 20 : lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.stroke();

        activePointersRef.current[e.pointerId] = { x: offsetX, y: offsetY };
    };

    const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingMode) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        delete activePointersRef.current[e.pointerId];
    };

    // Resize canvas to match window
    useEffect(() => {
        const resizeCanvas = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                // Get actual display size
                const rect = canvas.getBoundingClientRect();

                // Set actual internal dimensions to match display dimensions
                // This prevents pixel stretching or coordinate misalignment
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Also call resize when drawing mode toggles in case layout shifted
        if (isDrawingMode) {
            setTimeout(resizeCanvas, 50);
        }

        return () => window.removeEventListener('resize', resizeCanvas);
    }, [isDrawingMode]);

    const toggleFullscreen = async () => {
        try {
            const isFull = await WindowIsFullscreen();
            if (!isFull) {
                WindowFullscreen();
                setIsFullscreen(true);
            } else {
                WindowUnfullscreen();
                setIsFullscreen(false);
            }
        } catch (err) {
            console.error("Wails fullscreen error:", err);
        }
    };

    // Track Escape key to exit fullscreen manually since Wails takes over standard HTML5 behavior
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                WindowUnfullscreen();
                setIsFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen]);

    // Calculate pages to show based on currentPage view (spread)
    const leftPage = currentPage;
    const rightPage = currentPage + 1 <= numPages ? currentPage + 1 : null;

    const handlePageSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = parseInt(inputPage, 10);
        if (!isNaN(parsed)) {
            const physicalPage = parsed + pageOffset;
            if (physicalPage >= 1 && physicalPage <= numPages) {
                setCurrentPage(physicalPage);
            } else {
                setInputPage((currentPage - pageOffset).toString());
            }
        } else {
            setInputPage((currentPage - pageOffset).toString());
        }
    };

    // Auto-sync input when currentPage changes programmatically
    useEffect(() => {
        setInputPage((currentPage - pageOffset).toString());
    }, [currentPage, pageOffset]);

    // Initialize and load PDF metadata
    useEffect(() => {
        if (!bookId) return;

        const loadMetadata = async () => {
            setLoading(true);
            try {
                // Fetch the generated metadata file to know how many pages exist
                const response = await fetch(`/book/images/${bookId}/metadata.json`);
                if (!response.ok) throw new Error("Metadata not found");
                const data = await response.json();

                setNumPages(data.numPages);

                let effectiveOffset = pageOffset;
                if (data.pageOffset !== undefined && data.pageOffset !== null) {
                    effectiveOffset = data.pageOffset;
                    setPageOffset(data.pageOffset);
                    localStorage.setItem(`pageOffset_${bookId}`, data.pageOffset.toString());
                }

                // Check URL param ?targetPage=X
                const targetPageParam = searchParams.get('targetPage');
                if (targetPageParam) {
                    const parsedTarget = parseInt(targetPageParam, 10);
                    if (!isNaN(parsedTarget) && parsedTarget > 0) {
                        const targetPhysical = Math.min(Math.max(1, parsedTarget + effectiveOffset), data.numPages);
                        setCurrentPage(targetPhysical);
                        setInputPage(parsedTarget.toString());
                        return;
                    }
                }

                // Load saved progress if no targetPage param
                const savedPage = localStorage.getItem(`viewer-progress-${bookId}`);
                if (savedPage) {
                    const parsed = parseInt(savedPage, 10);
                    if (!isNaN(parsed) && parsed >= 1 && parsed <= data.numPages) {
                        setCurrentPage(parsed);
                        setInputPage((parsed - effectiveOffset).toString());
                    }
                }
            } catch (error) {
                console.error("Failed to load PDF metadata:", error);
            } finally {
                setLoading(false);
            }
        };

        loadMetadata();
    }, [bookId, searchParams]);

    // Save progress when page changes
    useEffect(() => {
        if (!bookId || numPages === 0) return;
        localStorage.setItem(`viewer-progress-${bookId}`, currentPage.toString());
    }, [bookId, currentPage, numPages]);

    const goToNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, Math.max(1, numPages - 1)));
    };

    const goToPrevPage = () => {
        setCurrentPage(prev => Math.max(1, prev - 1));
    };

    const handleGoToWeeklyBook = (targetBookId: string, targetPrintedPage: number) => {
        stopAllAudio();
        setAlertData(prev => ({ ...prev, isOpen: false }));
        setIsWeeklyPlanModalOpen(false);

        if (targetBookId === bookId || !targetBookId) {
            const physical = Math.min(Math.max(1, targetPrintedPage + pageOffset), numPages);
            setCurrentPage(physical);
            setInputPage(targetPrintedPage.toString());
        } else {
            navigate(`/viewer/${encodeURIComponent(targetBookId)}?targetPage=${targetPrintedPage}`);
        }
    };

    // Swipe Handlers
    const onTouchStartPanel = (e: React.TouchEvent) => {
        if (isDrawingMode) return;
        setTouchEndX(null);
        setTouchStartX(e.targetTouches[0].clientX);
    };

    const onTouchMovePanel = (e: React.TouchEvent) => {
        if (isDrawingMode) return;
        setTouchEndX(e.targetTouches[0].clientX);
    };

    const onTouchEndPanel = () => {
        if (isDrawingMode || touchStartX === null || touchEndX === null) return;

        const distance = touchStartX - touchEndX;
        const minSwipeDistance = 50;

        if (distance > minSwipeDistance) {
            goToNextPage();
        } else if (distance < -minSwipeDistance) {
            goToPrevPage();
        }
        setTouchStartX(null);
        setTouchEndX(null);
    };

    const goBack = () => navigate('/');

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-violet-500 animate-spin mb-4" />
                <p className="text-slate-400 text-lg">교과서를 불러오는 중입니다...</p>
            </div>
        );
    }

    if (numPages === 0) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
                <p className="text-red-400 text-lg mb-4">교과서를 불러올 수 없습니다. 이미지가 렌더링되지 않았을 수 있습니다.</p>
                <button onClick={goBack} className="px-6 py-2 bg-violet-600 rounded-full hover:bg-violet-700 transition">
                    돌아가기
                </button>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-200 flex flex-col font-sans">
            {/* Top Navigation - Subject Name and Page Number ONLY */}
            <header
                onPointerDown={handleHeaderPointerDown}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                className="h-16 flex-shrink-0 border-b border-slate-800 flex items-center justify-center px-4 bg-slate-900/90 backdrop-blur-md z-40 touch-none select-none cursor-move relative"
            >
                <div className="flex items-center gap-4">
                    <span className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow">
                        {bookId || '교과서'}
                    </span>
                    <span className="text-violet-400 font-extrabold text-xl sm:text-2xl select-none">|</span>
                    <form onSubmit={handlePageSubmit} className="flex items-center gap-1.5 bg-slate-800/90 px-3.5 py-1.5 rounded-full border border-slate-700/80 shadow-inner">
                        <input
                            type="number"
                            min="1"
                            max={numPages}
                            value={inputPage}
                            onChange={(e) => setInputPage(e.target.value)}
                            onBlur={handlePageSubmit}
                            className="bg-transparent text-violet-300 font-black text-2xl sm:text-3xl w-16 text-center outline-none"
                            aria-label="이동할 쪽수"
                        />
                        <span className="text-lg sm:text-xl font-bold text-slate-300 select-none">쪽</span>
                        <span className="text-xs text-slate-500 select-none ml-1">/ {numPages}</span>
                    </form>
                    {rightPage && (
                        <span className="text-sm font-semibold text-slate-400 hidden md:inline ml-2">
                            ({getPrintedPage(leftPage)} ~ {getPrintedPage(rightPage)}쪽 펼침)
                        </span>
                    )}
                </div>
            </header>

            <main
                className="flex-1 w-full relative overflow-hidden flex items-center justify-center bg-slate-900"
                onTouchStart={onTouchStartPanel}
                onTouchMove={onTouchMovePanel}
                onTouchEnd={onTouchEndPanel}
            >
                {/* Left Side Controls */}
                <div
                    className="absolute z-50 flex flex-col gap-2.5 items-center pointer-events-auto"
                    style={{
                        left: `${vp.x + 16}px`,
                        top: `${vp.y + vp.h / 2}px`,
                        transform: `translate(0, -50%) scale(${1 / vp.scale})`,
                        transformOrigin: 'left center'
                    }}
                >
                    {/* 이전 페이지 */}
                    <button
                        onClick={goToPrevPage}
                        disabled={currentPage <= 1}
                        className="w-13 h-13 sm:w-14 sm:h-14 bg-slate-900/90 hover:bg-violet-600/90 backdrop-blur disabled:opacity-20 disabled:pointer-events-none text-white rounded-2xl flex items-center justify-center transition-all shadow-xl border border-white/10"
                        title="이전 쪽"
                    >
                        <ChevronLeft className="w-8 h-8 -ml-0.5" />
                    </button>

                    {/* 목록으로 */}
                    <button
                        onClick={goBack}
                        className="w-13 h-13 sm:w-14 sm:h-14 bg-slate-900/90 hover:bg-violet-600 backdrop-blur text-slate-200 hover:text-white rounded-2xl flex flex-col items-center justify-center transition-all shadow-xl border border-white/10 group"
                        title="목록으로"
                    >
                        <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold mt-0.5 leading-none">목록</span>
                    </button>

                    {/* 계획안 */}
                    <button
                        onClick={() => setIsWeeklyPlanModalOpen(true)}
                        className="w-13 h-13 sm:w-14 sm:h-14 bg-slate-900/90 hover:bg-violet-600 backdrop-blur text-violet-300 hover:text-white rounded-2xl flex flex-col items-center justify-center transition-all shadow-xl border border-white/10 group"
                        title="주학습 계획안 보기"
                    >
                        <Calendar className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold mt-0.5 leading-none">계획안</span>
                    </button>

                    {/* 설정 */}
                    <button
                        onClick={openSettings}
                        className="w-13 h-13 sm:w-14 sm:h-14 bg-slate-900/90 hover:bg-violet-600 backdrop-blur text-slate-300 hover:text-white rounded-2xl flex flex-col items-center justify-center transition-all shadow-xl border border-white/10 group"
                        title="설정"
                    >
                        <Settings className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold mt-0.5 leading-none">설정</span>
                    </button>

                    <div className="w-8 h-px bg-slate-700/60 my-0.5" />

                    {/* Info Button */}
                    <button
                        onClick={() => setIsInfoModalOpen(true)}
                        className="w-13 h-13 sm:w-14 sm:h-14 bg-slate-900/90 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-2xl flex items-center justify-center transition-all shadow-xl border border-white/10"
                        title="단원/쪽수 정보"
                    >
                        <BookOpen className="w-6 h-6" />
                    </button>

                    {/* 타이머 */}
                    <button
                        onClick={() => setIsTimerModalOpen(!isTimerModalOpen)}
                        className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center transition-all shadow-xl border border-white/10 ${timerSeconds > 0 || isTimerModalOpen ? 'bg-violet-600 text-white' : 'bg-slate-900/90 hover:bg-slate-700/80 text-slate-300 hover:text-white'}`}
                        title="수업 타이머"
                    >
                        <Clock className={timerSeconds > 0 ? "w-4 h-4 mb-0.5" : "w-6 h-6"} />
                        {timerSeconds > 0 && <span className="text-[10px] font-mono font-bold leading-none">{formatTime(timerSeconds)}</span>}
                    </button>

                    {/* 판서 모드 토글 */}
                    <div className="relative flex items-center">
                        <button
                            onClick={toggleDrawingMode}
                            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl border border-white/10 ${isDrawingMode ? 'bg-violet-600 text-white' : 'bg-slate-900/90 hover:bg-slate-700/80 text-slate-300 hover:text-white'}`}
                            title="판서 모드 토글"
                        >
                            <PenTool className="w-6 h-6" />
                        </button>
                        {isDrawingMode && (
                            <div className="absolute left-[calc(100%+0.5rem)] flex flex-col bg-slate-800/90 backdrop-blur border border-slate-600 rounded-[2rem] py-3 px-1.5 shadow-xl pointer-events-auto items-center gap-2 z-50">
                                <button onClick={() => { setColor('#ef4444'); setIsEraser(false); }} className={`w-5 h-5 rounded-full bg-red-500 border-2 ${color === '#ef4444' && !isEraser ? 'border-white scale-110' : 'border-transparent'} transition-all`} title="빨강" />
                                <button onClick={() => { setColor('#3b82f6'); setIsEraser(false); }} className={`w-5 h-5 rounded-full bg-blue-500 border-2 ${color === '#3b82f6' && !isEraser ? 'border-white scale-110' : 'border-transparent'} transition-all`} title="파랑" />
                                <button onClick={() => { setColor('#eab308'); setIsEraser(false); setLineWidth(12); }} className={`w-5 h-5 rounded-full bg-yellow-500/50 border-2 ${color === '#eab308' && !isEraser ? 'border-white scale-110' : 'border-transparent'} transition-all`} title="형광펜" />
                                <button onClick={() => { setColor('#000000'); setIsEraser(false); setLineWidth(4); }} className={`w-5 h-5 rounded-full bg-black border-2 ${color === '#000000' && !isEraser ? 'border-white scale-110' : 'border-slate-500'} transition-all`} title="검정" />
                                <div className="w-6 h-px bg-slate-600 my-0.5" />
                                <button onClick={() => setIsEraser(true)} className={`p-1.5 rounded-full transition-colors ${isEraser ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`} title="지우개">
                                    <Eraser className="w-4 h-4" />
                                </button>
                                <button onClick={clearCanvas} className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-slate-700 rounded-full transition-colors" title="전체 지우기">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="w-6 h-px bg-slate-600 my-0.5" />
                                <button onClick={() => setIsWhiteboard(!isWhiteboard)} className={`p-1.5 rounded-md transition-colors ${isWhiteboard ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`} title="흰색 배경 켜기/끄기">
                                    <Square className="w-4 h-4 fill-current" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="w-8 h-px bg-slate-700/60 my-0.5" />

                    {/* Window Controls */}
                    <button
                        onClick={WindowMinimise}
                        className="w-11 h-11 bg-slate-900/80 hover:bg-slate-700/80 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-xl border border-white/10"
                        title="최소화"
                    >
                        <Minus className="w-5 h-5" />
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="w-11 h-11 bg-slate-900/80 hover:bg-slate-700/80 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-xl border border-white/10"
                        title={isFullscreen ? "전체화면 종료" : "전체화면 보기"}
                    >
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={Quit}
                        className="w-11 h-11 bg-slate-900/80 hover:bg-red-600/90 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-xl border border-red-500/20"
                        title="프로그램 종료"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Image Spread */}
                <div className="flex items-center justify-center h-full relative z-0">
                    <PageRenderer bookId={bookId!} pageNumber={leftPage} scale={scale} />
                    {rightPage && (
                        <PageRenderer bookId={bookId!} pageNumber={rightPage} scale={scale} />
                    )}
                </div>

                {/* Right Side Controls */}
                <div
                    className="absolute z-50 flex flex-col gap-2.5 items-center pointer-events-auto"
                    style={{
                        left: `${vp.x + vp.w - 16}px`,
                        top: `${vp.y + vp.h / 2}px`,
                        transform: `translate(-100%, -50%) scale(${1 / vp.scale})`,
                        transformOrigin: 'right center'
                    }}
                >
                    {/* 다음 페이지 */}
                    <button
                        onClick={goToNextPage}
                        disabled={rightPage === null || rightPage >= numPages}
                        className="w-13 h-13 sm:w-14 sm:h-14 bg-slate-900/90 hover:bg-violet-600/90 backdrop-blur disabled:opacity-20 disabled:pointer-events-none text-white rounded-2xl flex items-center justify-center transition-all shadow-xl border border-white/10"
                        title="다음 쪽"
                    >
                        <ChevronRight className="w-8 h-8 -mr-0.5" />
                    </button>

                    {/* 목록으로 */}
                    <button
                        onClick={goBack}
                        className="w-13 h-13 sm:w-14 sm:h-14 bg-slate-900/90 hover:bg-violet-600 backdrop-blur text-slate-200 hover:text-white rounded-2xl flex flex-col items-center justify-center transition-all shadow-xl border border-white/10 group"
                        title="목록으로"
                    >
                        <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold mt-0.5 leading-none">목록</span>
                    </button>


                    {/* 계획안 */}
                    <button
                        onClick={() => setIsWeeklyPlanModalOpen(true)}
                        className="w-13 h-13 sm:w-14 sm:h-14 bg-slate-900/90 hover:bg-violet-600 backdrop-blur text-violet-300 hover:text-white rounded-2xl flex flex-col items-center justify-center transition-all shadow-xl border border-white/10 group"
                        title="주학습 계획안 보기"
                    >
                        <Calendar className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold mt-0.5 leading-none">계획안</span>
                    </button>

                    {/* 설정 */}
                    <button
                        onClick={openSettings}
                        className="w-13 h-13 sm:w-14 sm:h-14 bg-slate-900/90 hover:bg-violet-600 backdrop-blur text-slate-300 hover:text-white rounded-2xl flex flex-col items-center justify-center transition-all shadow-xl border border-white/10 group"
                        title="설정"
                    >
                        <Settings className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold mt-0.5 leading-none">설정</span>
                    </button>

                    <div className="w-8 h-px bg-slate-700/60 my-0.5" />

                    {/* Info Button */}
                    <button
                        onClick={() => setIsInfoModalOpen(true)}
                        className="w-13 h-13 sm:w-14 sm:h-14 bg-slate-900/90 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-2xl flex items-center justify-center transition-all shadow-xl border border-white/10"
                        title="단원/페이지 정보"
                    >
                        <BookOpen className="w-6 h-6" />
                    </button>

                    {/* 타이머 */}
                    <button
                        onClick={() => setIsTimerModalOpen(!isTimerModalOpen)}
                        className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center transition-all shadow-xl border border-white/10 ${timerSeconds > 0 || isTimerModalOpen ? 'bg-violet-600 text-white' : 'bg-slate-900/90 hover:bg-slate-700/80 text-slate-300 hover:text-white'}`}
                        title="수업 타이머"
                    >
                        <Clock className={timerSeconds > 0 ? "w-4 h-4 mb-0.5" : "w-6 h-6"} />
                        {timerSeconds > 0 && <span className="text-[10px] font-mono font-bold leading-none">{formatTime(timerSeconds)}</span>}
                    </button>

                    {/* 판서 모드 토글 */}
                    <div className="relative flex items-center justify-end">
                        <button
                            onClick={toggleDrawingMode}
                            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl border border-white/10 ${isDrawingMode ? 'bg-violet-600 text-white' : 'bg-slate-900/90 hover:bg-slate-700/80 text-slate-300 hover:text-white'}`}
                            title="판서 모드 토글"
                        >
                            <PenTool className="w-6 h-6" />
                        </button>
                        {isDrawingMode && (
                            <div className="absolute right-[calc(100%+0.5rem)] flex flex-col bg-slate-800/90 backdrop-blur border border-slate-600 rounded-[2rem] py-3 px-1.5 shadow-xl pointer-events-auto items-center gap-2 z-50">
                                <button onClick={() => { setColor('#ef4444'); setIsEraser(false); }} className={`w-5 h-5 rounded-full bg-red-500 border-2 ${color === '#ef4444' && !isEraser ? 'border-white scale-110' : 'border-transparent'} transition-all`} title="빨강" />
                                <button onClick={() => { setColor('#3b82f6'); setIsEraser(false); }} className={`w-5 h-5 rounded-full bg-blue-500 border-2 ${color === '#3b82f6' && !isEraser ? 'border-white scale-110' : 'border-transparent'} transition-all`} title="파랑" />
                                <button onClick={() => { setColor('#eab308'); setIsEraser(false); setLineWidth(12); }} className={`w-5 h-5 rounded-full bg-yellow-500/50 border-2 ${color === '#eab308' && !isEraser ? 'border-white scale-110' : 'border-transparent'} transition-all`} title="형광펜" />
                                <button onClick={() => { setColor('#000000'); setIsEraser(false); setLineWidth(4); }} className={`w-5 h-5 rounded-full bg-black border-2 ${color === '#000000' && !isEraser ? 'border-white scale-110' : 'border-slate-500'} transition-all`} title="검정" />
                                <div className="w-6 h-px bg-slate-600 my-0.5" />
                                <button onClick={() => setIsEraser(true)} className={`p-1.5 rounded-full transition-colors ${isEraser ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`} title="지우개">
                                    <Eraser className="w-4 h-4" />
                                </button>
                                <button onClick={clearCanvas} className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-slate-700 rounded-full transition-colors" title="전체 지우기">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="w-6 h-px bg-slate-600 my-0.5" />
                                <button onClick={() => setIsWhiteboard(!isWhiteboard)} className={`p-1.5 rounded-md transition-colors ${isWhiteboard ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`} title="흰색 배경 켜기/끄기">
                                    <Square className="w-4 h-4 fill-current" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="w-8 h-px bg-slate-700/60 my-0.5" />

                    {/* Window Controls */}
                    <button
                        onClick={WindowMinimise}
                        className="w-11 h-11 bg-slate-900/80 hover:bg-slate-700/80 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-xl border border-white/10"
                        title="최소화"
                    >
                        <Minus className="w-5 h-5" />
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="w-11 h-11 bg-slate-900/80 hover:bg-slate-700/80 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-xl border border-white/10"
                        title={isFullscreen ? "전체화면 종료" : "전체화면 보기"}
                    >
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={Quit}
                        className="w-11 h-11 bg-slate-900/80 hover:bg-red-600/90 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-xl border border-red-500/20"
                        title="프로그램 종료"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </main>

            {/* Drawing Canvas Overlay */}
            <canvas
                ref={canvasRef}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                onPointerOut={stopDrawing}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
                className={`absolute inset-0 w-full h-full z-40 touch-none select-none ${isDrawingMode ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'} ${isWhiteboard && isDrawingMode ? 'bg-white' : ''}`}
                style={{ display: isDrawingMode ? 'block' : 'none', WebkitTouchCallout: 'none', touchAction: 'none' }}
            />

            {/* Floating Drawing Toolbar */}
            {isDrawingMode && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-full py-2 px-4 shadow-xl pointer-events-auto">
                    {/* Colors */}
                    <button onClick={() => { setColor('#ef4444'); setIsEraser(false); }} className={`w-6 h-6 rounded-full bg-red-500 border-2 ${color === '#ef4444' && !isEraser ? 'border-white scale-110' : 'border-transparent'} transition-all`} title="빨강" />
                    <button onClick={() => { setColor('#3b82f6'); setIsEraser(false); }} className={`w-6 h-6 rounded-full bg-blue-500 border-2 ${color === '#3b82f6' && !isEraser ? 'border-white scale-110' : 'border-transparent'} transition-all`} title="파랑" />
                    <button onClick={() => { setColor('#eab308'); setIsEraser(false); setLineWidth(12); }} className={`w-6 h-6 rounded-full bg-yellow-500/50 border-2 ${color === '#eab308' && !isEraser ? 'border-white scale-110' : 'border-transparent'} transition-all`} title="형광펜" />
                    <button onClick={() => { setColor('#000000'); setIsEraser(false); setLineWidth(4); }} className={`w-6 h-6 rounded-full bg-black border-2 ${color === '#000000' && !isEraser ? 'border-white scale-110' : 'border-slate-500'} transition-all`} title="검정" />

                    <div className="w-px h-6 bg-slate-600 mx-2" />

                    {/* Eraser */}
                    <button
                        onClick={() => setIsEraser(true)}
                        className={`p-1.5 rounded-full transition-colors ${isEraser ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                        title="지우개"
                    >
                        <Eraser className="w-5 h-5" />
                    </button>

                    {/* Clear All */}
                    <button
                        onClick={clearCanvas}
                        className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-slate-700 rounded-full transition-colors ml-1"
                        title="전체 지우기"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>

                    <div className="w-px h-6 bg-slate-600 mx-2" />

                    {/* Whiteboard Mode */}
                    <button
                        onClick={() => setIsWhiteboard(!isWhiteboard)}
                        className={`p-1.5 rounded-md transition-colors ${isWhiteboard ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                        title="흰색 배경 켜기/끄기"
                    >
                        <Square className="w-5 h-5 fill-current" />
                    </button>
                </div>
            )}

            {/* Progress Bar */}
            <div className="h-1.5 bg-slate-800 w-full flex-shrink-0 relative">
                <div
                    className="absolute left-0 top-0 bottom-0 bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.8)] transition-all duration-300 ease-out"
                    style={{ width: `${(Math.max(rightPage || leftPage, 1) / numPages) * 100}%` }}
                />
            </div>

            {/* Timer Modal */}
            {renderTimerModal()}

            {/* Schedule Modal */}
            {renderScheduleModal()}

            {/* Book Info Modal */}
            {renderInfoModal()}

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
                    <div className="bg-slate-800/95 border border-slate-600 rounded-3xl shadow-2xl flex flex-col p-8 w-[90vw] max-w-sm">
                        <div className="flex w-full items-center justify-between mb-6">
                            <span className="text-white text-xl font-bold flex items-center gap-2">
                                <Settings className="w-6 h-6 text-violet-400" /> 설정
                            </span>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                                <span className="text-slate-300 font-medium">현재 버전</span>
                                <span className="text-violet-300 font-mono font-bold bg-violet-900/30 px-3 py-1 rounded-full">v{appVersion || "..."}</span>
                            </div>

                            <button
                                onClick={async () => {
                                    try {
                                        // @ts-ignore
                                        const status = await CheckForUpdate();
                                        if (status.hasUpdate) {
                                            setIsSettingsOpen(false);
                                            // @ts-ignore
                                            if (window.runtime) window.runtime.EventsEmit('update-available', status);
                                        } else if (status.error) {
                                            alert(status.error);
                                        } else {
                                            alert("현재 최신 버전을 사용 중입니다.");
                                        }
                                    } catch (e) {
                                        alert("업데이트 확인 중 오류가 발생했습니다.");
                                    }
                                }}
                                className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white text-lg rounded-2xl transition-all font-semibold shadow-lg"
                            >
                                업데이트 확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Weekly Plan Schedule Modal */}
            <WeeklyPlanScheduleModal
                isOpen={isWeeklyPlanModalOpen}
                plan={currentPlan}
                watchFolder={watchFolder}
                onClose={() => setIsWeeklyPlanModalOpen(false)}
                onPlanUpdated={(newPlan) => {
                    setCurrentPlan(newPlan);
                    currentPlanRef.current = newPlan;
                    applyWeeklyPlanNow(newPlan);
                }}
                onWatchFolderChanged={(newFolder) => setWatchFolder(newFolder)}
                onGoToBook={handleGoToWeeklyBook}
            />

            {/* Unified Class & Rest Alert Modal */}
            <WeeklyPlanAlertModal
                isOpen={alertData.isOpen}
                isRestTime={alertData.isRestTime}
                periodName={alertData.periodName}
                periodTime={alertData.periodTime}
                customMessage={alertData.customMessage}
                item={alertData.item}
                onClose={() => {
                    stopAllAudio();
                    setAlertData(prev => ({ ...prev, isOpen: false }));
                }}
                onGoToBook={handleGoToWeeklyBook}
            />

            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[10001] bg-violet-600/95 text-white px-6 py-3 rounded-full shadow-2xl backdrop-blur-md border border-violet-400/50 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 font-bold text-base pointer-events-none">
                    <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
                    <span>{toastMessage}</span>
                </div>
            )}
        </div>
    );
}

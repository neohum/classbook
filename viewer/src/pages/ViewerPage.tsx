import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Home, Loader2, Maximize, Minimize, PenTool, X, Eraser, Trash2, Square, Clock, Play, Pause, Bell, BellOff, Octagon, Settings, CalendarDays, Plus, BookOpen } from 'lucide-react';
import { WindowFullscreen, WindowUnfullscreen, WindowIsFullscreen, Quit } from '../../wailsjs/runtime/runtime';
import { StartDrag, GetAppVersion, CheckForUpdate } from '../../wailsjs/go/main/App';

interface ScheduleItem {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
}

const defaultSchedule: ScheduleItem[] = [
    { id: '1', name: '등교 및 아침 활동', startTime: '08:40', endTime: '08:55' },
    { id: '2', name: '1교시', startTime: '09:00', endTime: '09:40' },
    { id: '3', name: '2교시', startTime: '09:50', endTime: '10:30' },
    { id: '4', name: '3교시', startTime: '10:40', endTime: '11:20' },
    { id: '5', name: '4교시', startTime: '11:30', endTime: '12:10' },
    { id: '6', name: '점심시간', startTime: '12:10', endTime: '13:00' },
    { id: '7', name: '5교시', startTime: '13:00', endTime: '13:40' },
    { id: '8', name: '6교시', startTime: '13:50', endTime: '14:30' },
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
    const navigate = useNavigate();

    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [inputPage, setInputPage] = useState<string>("1");
    const [loading, setLoading] = useState(true);
    const scale = 1.0;
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
    const [schedules, setSchedules] = useState<ScheduleItem[]>(defaultSchedule);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [scheduleAlarmMessage, setScheduleAlarmMessage] = useState("");
    const lastTriggeredMinuteRef = React.useRef("");

    const isSoundEnabledRef = React.useRef(isSoundEnabled);
    const alarmTypeRef = React.useRef(alarmType);
    const alarmLoopRef = React.useRef(alarmLoop);

    useEffect(() => {
        isSoundEnabledRef.current = isSoundEnabled;
        alarmTypeRef.current = alarmType;
        alarmLoopRef.current = alarmLoop;
    }, [isSoundEnabled, alarmType, alarmLoop]);

    useEffect(() => {
        const checkSchedule = () => {
            const now = new Date();
            const h = now.getHours().toString().padStart(2, '0');
            const m = now.getMinutes().toString().padStart(2, '0');
            const currentTimeStr = `${h}:${m}`;

            if (lastTriggeredMinuteRef.current === currentTimeStr) return;

            for (const item of schedules) {
                if (item.startTime === currentTimeStr) {
                    lastTriggeredMinuteRef.current = currentTimeStr;
                    setScheduleAlarmMessage(`${item.name} 시작 시간입니다!`);
                    setIsAlarmRinging(true);
                    if (isSoundEnabledRef.current) {
                        initAudioContext();
                        if (alarmTypeRef.current === 'beep') playBeep(alarmLoopRef.current);
                        else playMusic(alarmLoopRef.current);
                    }
                    if (isTimerModalOpen) setIsTimerModalOpen(false);
                    if (isScheduleModalOpen) setIsScheduleModalOpen(false);
                    return;
                } else if (item.endTime === currentTimeStr) {
                    lastTriggeredMinuteRef.current = currentTimeStr;
                    setScheduleAlarmMessage(`${item.name} 쉬는 시간입니다!`);
                    setIsAlarmRinging(true);
                    if (isSoundEnabledRef.current) {
                        initAudioContext();
                        if (alarmTypeRef.current === 'beep') playBeep(alarmLoopRef.current);
                        else playMusic(alarmLoopRef.current);
                    }
                    if (isTimerModalOpen) setIsTimerModalOpen(false);
                    if (isScheduleModalOpen) setIsScheduleModalOpen(false);
                    return;
                }
            }
        };

        const interval = setInterval(checkSchedule, 1000);
        return () => clearInterval(interval);
    }, [schedules, isTimerModalOpen, isScheduleModalOpen]);

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
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [isTimerRunning]);

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
        if (isAlarmRinging) return null;

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
                <div className="bg-slate-800/95 border border-slate-600 rounded-3xl shadow-2xl flex flex-col p-8 w-[90vw] max-w-3xl max-h-[85vh]">
                    <div className="flex w-full items-center justify-between mb-6">
                        <span className="text-white text-2xl font-bold flex items-center gap-2">
                            <CalendarDays className="w-8 h-8 text-violet-400" /> 시종 시간표 설정
                        </span>
                        <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-700">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
                        {schedules.map(schedule => (
                            <div key={schedule.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                                <input
                                    type="text"
                                    value={schedule.name}
                                    onChange={(e) => {
                                        setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, name: e.target.value } : s));
                                    }}
                                    className="bg-transparent text-white font-bold text-lg w-full sm:w-40 border-b border-transparent focus:border-violet-500 outline-none transition-colors"
                                    placeholder="이름 (예: 1교시)"
                                />
                                <div className="hidden sm:block w-px h-6 bg-slate-700 mx-2" />
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <input
                                        type="time"
                                        value={schedule.startTime}
                                        onChange={(e) => {
                                            setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, startTime: e.target.value } : s));
                                        }}
                                        className="bg-slate-800 text-white rounded-lg px-3 py-1.5 border border-slate-700 focus:border-violet-500 outline-none flex-1 sm:flex-none"
                                    />
                                    <span className="text-slate-400 font-bold">-</span>
                                    <input
                                        type="time"
                                        value={schedule.endTime}
                                        onChange={(e) => {
                                            setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, endTime: e.target.value } : s));
                                        }}
                                        className="bg-slate-800 text-white rounded-lg px-3 py-1.5 border border-slate-700 focus:border-violet-500 outline-none flex-1 sm:flex-none"
                                    />
                                </div>
                                <button
                                    onClick={() => setSchedules(prev => prev.filter(s => s.id !== schedule.id))}
                                    className="ml-auto p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                                    title="삭제"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => {
                                const newId = Math.random().toString(36).substr(2, 9);
                                setSchedules([...schedules, { id: newId, name: '새 일정', startTime: '00:00', endTime: '00:00' }]);
                            }}
                            className="flex items-center justify-center gap-2 w-full py-4 mt-2 border-2 border-dashed border-slate-700 hover:border-violet-500 hover:bg-violet-500/10 text-slate-400 hover:text-violet-300 rounded-xl transition-all font-medium"
                        >
                            <Plus className="w-5 h-5" /> 새 시간 추가
                        </button>
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
                            {leftPage}
                        </span>
                        {rightPage && (
                            <>
                                <span className="text-[12vw] sm:text-[16vw] font-bold text-slate-500 leading-none">/</span>
                                <span className="text-[12vw] sm:text-[16vw] font-bold text-violet-300 leading-none">
                                    {rightPage}
                                </span>
                            </>
                        )}
                        <span className="text-[5vw] sm:text-[7vw] font-medium text-slate-400 ml-4 sm:ml-8 mt-auto mb-[2vw] sm:mb-[3vw]">쪽</span>
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
        if (!isNaN(parsed) && parsed >= 1 && parsed <= numPages) {
            setCurrentPage(parsed);
        } else {
            // Reset to current if invalid
            setInputPage(currentPage.toString());
        }
    };

    // Auto-sync input when currentPage changes programmatically
    useEffect(() => {
        setInputPage(currentPage.toString());
    }, [currentPage]);

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

                // Load saved progress
                const savedPage = localStorage.getItem(`viewer-progress-${bookId}`);
                if (savedPage) {
                    const parsed = parseInt(savedPage, 10);
                    if (!isNaN(parsed) && parsed >= 1 && parsed <= data.numPages) {
                        setCurrentPage(parsed);
                        setInputPage(parsed.toString()); // Sync input
                    }
                }
            } catch (error) {
                console.error("Failed to load PDF metadata:", error);
            } finally {
                setLoading(false);
            }
        };

        loadMetadata();
    }, [bookId]);

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
            {/* Top Navigation - Custom Title Bar Dragging */}
            <header
                onPointerDown={handleHeaderPointerDown}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                className="h-16 flex-shrink-0 border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 bg-slate-900/80 backdrop-blur-md z-50 touch-none select-none cursor-move"
            >
                <button
                    onClick={goBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                    <Home className="w-5 h-5" />
                    <span className="font-medium hidden sm:inline">목록으로</span>
                </button>

                <div className="flex items-center gap-4 sm:gap-6">
                    <div
                        onClick={() => setIsInfoModalOpen(true)}
                        className="font-semibold text-white tracking-wide text-base sm:text-lg flex items-center cursor-pointer hover:text-violet-400 transition-colors group"
                        title="단원/페이지 정보 보기"
                    >
                        {bookId}
                        <BookOpen className="w-4 h-4 ml-2 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>


                    {/* Page Input Form */}
                    <form onSubmit={handlePageSubmit} className="flex items-center bg-slate-800 rounded-full border border-slate-700 overflow-hidden px-2 py-1 hidden sm:flex">
                        <span className="text-xs text-slate-400 px-2 select-none">쪽:</span>
                        <input
                            type="number"
                            min="1"
                            max={numPages}
                            value={inputPage}
                            onChange={(e) => setInputPage(e.target.value)}
                            onBlur={handlePageSubmit}
                            className="bg-transparent text-white text-sm w-12 text-center outline-none"
                            aria-label="이동할 페이지 입력"
                        />
                        <span className="text-xs text-slate-500 pr-2 select-none">/ {numPages}</span>
                    </form>

                    {renderTimerButton('top')}

                    {/* Pen Tool Launch */}
                    <button
                        onClick={toggleDrawingMode}
                        className={`p-1.5 sm:p-2 rounded-full border transition-colors ${isDrawingMode ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                        title="판서 모드 토글"
                        aria-label="판서 모드 토글"
                    >
                        <PenTool className="w-4 h-4" />
                    </button>

                    {/* Fullscreen Toggle */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-1.5 sm:p-2 bg-slate-800 text-slate-400 hover:text-white rounded-full border border-slate-700 hover:bg-slate-700 transition-colors"
                        aria-label={isFullscreen ? "전체화면 종료" : "전체화면 보기"}
                    >
                        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>

                    {/* Exit Button */}
                    <button
                        onClick={Quit}
                        className="p-1.5 sm:p-2 bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-900/40 rounded-full border border-slate-700 transition-colors ml-2"
                        title="프로그램 종료"
                        aria-label="종료"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Settings Button */}
                    <button
                        onClick={async () => {
                            try {
                                const version = await GetAppVersion();
                                setAppVersion(version);
                            } catch (e) { console.error(e); }
                            setIsSettingsOpen(true);
                        }}
                        className="p-1.5 sm:p-2 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full border border-slate-700 transition-colors ml-2"
                        title="설정"
                        aria-label="설정"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                </div>

                <div className="text-xs sm:text-sm font-medium text-slate-400 bg-slate-800 px-3 py-1 sm:py-1.5 rounded-full border border-slate-700 select-none hidden md:block">
                    <span className="text-white">{leftPage}</span> {rightPage ? <span className="text-slate-500">/ <span className="text-white">{rightPage}</span></span> : ''}
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
                    className="absolute z-50 flex flex-col gap-3"
                    style={{
                        left: `${vp.x + 16}px`,
                        top: `${vp.y + vp.h / 2}px`,
                        transform: `translate(0, -50%) scale(${1 / vp.scale})`,
                        transformOrigin: 'left center'
                    }}
                >
                    <button
                        onClick={goToPrevPage}
                        disabled={currentPage <= 1}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-violet-600/80 backdrop-blur disabled:opacity-0 disabled:pointer-events-none text-white rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto"
                        aria-label="이전 페이지"
                    >
                        <ChevronLeft className="w-8 h-8 -ml-1" />
                    </button>

                    {/* Info Button */}
                    <button
                        onClick={() => setIsInfoModalOpen(true)}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto"
                        title="단원/페이지 정보"
                    >
                        <BookOpen className="w-6 h-6" />
                    </button>

                    {/* Additional Left Controls */}
                    {renderTimerButton('left')}

                    <div className="relative flex items-center">
                        <button
                            onClick={toggleDrawingMode}
                            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto ${isDrawingMode ? 'bg-violet-600/90 text-white' : 'bg-black/40 hover:bg-slate-700/80 text-slate-300 hover:text-white'}`}
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
                    <button
                        onClick={toggleFullscreen}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto"
                        title={isFullscreen ? "전체화면 종료" : "전체화면 보기"}
                    >
                        {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                    </button>
                    <button
                        onClick={Quit}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-red-900/80 text-slate-300 hover:text-red-400 rounded-full flex items-center justify-center transition-all shadow-xl border border-red-500/20 relative z-50 pointer-events-auto mt-2"
                        title="프로그램 종료"
                    >
                        <X className="w-6 h-6" />
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
                    className="absolute z-50 flex flex-col gap-3"
                    style={{
                        left: `${vp.x + vp.w - 16}px`,
                        top: `${vp.y + vp.h / 2}px`,
                        transform: `translate(-100%, -50%) scale(${1 / vp.scale})`,
                        transformOrigin: 'right center'
                    }}
                >
                    <button
                        onClick={goToNextPage}
                        disabled={rightPage === null || rightPage >= numPages}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-violet-600/80 backdrop-blur disabled:opacity-0 disabled:pointer-events-none text-white rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto"
                        aria-label="다음 페이지"
                    >
                        <ChevronRight className="w-8 h-8 -mr-1" />
                    </button>

                    {/* Info Button */}
                    <button
                        onClick={() => setIsInfoModalOpen(true)}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto"
                        title="단원/페이지 정보"
                    >
                        <BookOpen className="w-6 h-6" />
                    </button>

                    {/* Additional Right Controls */}
                    {renderTimerButton('right')}

                    <div className="relative flex items-center justify-end">
                        <button
                            onClick={toggleDrawingMode}
                            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto ${isDrawingMode ? 'bg-violet-600/90 text-white' : 'bg-black/40 hover:bg-slate-700/80 text-slate-300 hover:text-white'}`}
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
                    <button
                        onClick={toggleFullscreen}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto"
                        title={isFullscreen ? "전체화면 종료" : "전체화면 보기"}
                    >
                        {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                    </button>
                    <button
                        onClick={Quit}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-red-900/80 text-slate-300 hover:text-red-400 rounded-full flex items-center justify-center transition-all shadow-xl border border-red-500/20 relative z-50 pointer-events-auto mt-2"
                        title="프로그램 종료"
                    >
                        <X className="w-6 h-6" />
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
                                onClick={() => {
                                    // @ts-ignore
                                    CheckForUpdate(true);
                                }}
                                className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white text-lg rounded-2xl transition-all font-semibold shadow-lg"
                            >
                                업데이트 확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

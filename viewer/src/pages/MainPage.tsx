import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    BookOpen, BookCopy, ArrowRight, X, Maximize, Minimize, 
    Trash2, Plus, Loader2, Calendar, FolderOpen, Upload, 
    SlidersHorizontal, Bell, Sparkles, CheckCircle2, Clock 
} from 'lucide-react';
import { Quit, WindowFullscreen, WindowUnfullscreen, WindowIsFullscreen, EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import { 
    DeleteBook, SelectMultiplePdfsDialog, ReadFileBase64, 
    EnsureBookDirWithOffset, SavePageImage, GetTextbooks, GetAppVersion,
    GetWatchFolder, SelectWatchFolderDialog, GetLatestWeeklyPlan, SelectWeeklyPlanFileDialog
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

import { detectPageNumberFromText, detectPageNumberFromCanvas } from '../utils/ocrOffsetDetector';
import PageOffsetAdjustModal from '../components/PageOffsetAdjustModal';
import WeeklyPlanAlertModal from '../components/WeeklyPlanAlertModal';
import WeeklyPlanScheduleModal from '../components/WeeklyPlanScheduleModal';
import ScheduleConfigModal, { getStoredSchedule, type ScheduleItem } from '../components/ScheduleConfigModal';
import { resolveBookForSubject } from '../utils/bookResolver';

// Configure PDF.js worker using Vite's ?url literal for local bundling
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

function PdfThumbnail({ bookId }: { bookId: string }) {
    const [loading, setLoading] = useState(true);
    const [imgUrl, setImgUrl] = useState('');

    useEffect(() => {
        const url = `/book/images/${bookId}/page_1.jpg`;
        const img = new Image();
        img.src = url;
        img.onload = () => {
            setImgUrl(url);
            setLoading(false);
        };
        img.onerror = () => {
            setLoading(false);
        };
    }, [bookId]);

    return (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <BookCopy className="w-16 h-16 text-white/40 drop-shadow-sm animate-pulse" />
                </div>
            )}
            {imgUrl && (
                <img
                    src={imgUrl}
                    alt={`Cover for ${bookId}`}
                    className={`w-full h-full object-contain p-4 transition-all duration-700 ${loading ? 'opacity-0 scale-95' : 'opacity-100 group-hover:scale-105'}`}
                />
            )}
        </div>
    );
}

export default function MainPage() {
    const navigate = useNavigate();
    const [isFullscreen, setIsFullscreen] = useState(false);

    const [textbooks, setTextbooks] = useState<main.Textbook[]>([]);
    const [isConverting, setIsConverting] = useState(false);
    const [convertProgress, setConvertProgress] = useState({ current: 0, total: 0, title: '', statusText: '' });
    const [appVersion, setAppVersion] = useState<string>('');

    // Weekly Plan States
    const [watchFolder, setWatchFolder] = useState<string>('');
    const [currentPlan, setCurrentPlan] = useState<main.WeeklyPlanResult | null>(null);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

    // Class Alert States
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
    const [alertPeriod, setAlertPeriod] = useState(1);
    const [alertPeriodTime, setAlertPeriodTime] = useState('');
    const [alertItem, setAlertItem] = useState<main.WeeklyPlanItem | null>(null);
    const [alertIsRestTime, setAlertIsRestTime] = useState(false);
    const [alertCustomMessage, setAlertCustomMessage] = useState('');
    const lastAlertTimeRef = useRef<string>('');

    // Persistent Lesson Widget (Shows subject & pages after class start alert closes, until user clicks close)
    const [activeLesson, setActiveLesson] = useState<{
        periodName: string;
        subject: string;
        pageStr: string;
        startPage?: number;
        topic?: string;
        matchedBookId?: string;
    } | null>(null);

    // Schedule Config Modal State
    const [isBellConfigModalOpen, setIsBellConfigModalOpen] = useState(false);
    const [schedules, setSchedules] = useState<ScheduleItem[]>(() => getStoredSchedule());

    // Page Offset Modal State
    const [offsetModalBook, setOffsetModalBook] = useState<{
        id: string;
        title: string;
        numPages: number;
        initialOffset: number;
        detectedOffset: number | null;
    } | null>(null);

    // Toast notification
    const [toastMessage, setToastMessage] = useState<string>('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 4000);
    };

    // Helper: Apply weekly plan to navigate to current period's book and page or show alert
    const applyWeeklyPlan = async (plan: main.WeeklyPlanResult) => {
        if (!plan || !plan.success || !plan.schedule) return;

        const now = new Date();
        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];
        const targetDay = (dayOfWeek === '일' || dayOfWeek === '토') ? '월' : dayOfWeek;
        const dayItems = plan.schedule[targetDay] || [];

        const hh = now.getHours().toString().padStart(2, '0');
        const mm = now.getMinutes().toString().padStart(2, '0');
        const currentTimeStr = `${hh}:${mm}`;

        const currentSchedules = getStoredSchedule();
        if (currentSchedules.length === 0) return;

        let activePeriod = 1;
        let activeSched = currentSchedules[0];

        for (let i = 0; i < currentSchedules.length; i++) {
            const s = currentSchedules[i];
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

        const periodName = activeSched?.name || `${activePeriod}교시`;
        const periodTime = activeSched ? `${activeSched.startTime} ~ ${activeSched.endTime}` : "";

        if (targetItem) {
            const targetPage = targetItem.startPage || 1;
            let currentBooks = textbooks;
            if (!currentBooks || currentBooks.length === 0) {
                currentBooks = (await GetTextbooks()) || [];
                if (currentBooks.length > 0) setTextbooks(currentBooks);
            }

            const resolved = resolveBookForSubject(targetItem.subject, targetItem.matchedBookId, currentBooks);
            if (resolved) {
                showToast(`주학습계획안 반영: ${targetDay}요일 ${periodName} [${resolved.title} ${targetPage}쪽]으로 이동합니다.`);
                setTimeout(() => {
                    navigate(`/viewer/${encodeURIComponent(resolved.id)}?targetPage=${targetPage}&startAlert=true`);
                }, 600);
            } else {
                // 자율활동 또는 교과서가 없는 경우: 교과서 이동 없이 알림 모달만 바로 표시!
                setAlertPeriod(activePeriod);
                setAlertPeriodTime(periodTime);
                setAlertItem(targetItem);
                setAlertIsRestTime(false);
                setAlertCustomMessage(activeSched?.startMessage || `${periodName} [${targetItem.subject}] 수업 시간입니다.`);
                setIsAlertModalOpen(true);
                showToast(`${periodName} [${targetItem.subject}] 교과서가 없는 수업(자율활동 등)입니다. 알림을 표시합니다.`);
            }
        } else {
            // 주안에 해당 교시가 없더라도 시종 시간표에 따라 알림 모달 표시
            setAlertPeriod(activePeriod);
            setAlertPeriodTime(periodTime);
            setAlertItem(null);
            setAlertIsRestTime(false);
            setAlertCustomMessage(activeSched?.startMessage || `${periodName} 수업 시간입니다.`);
            setIsAlertModalOpen(true);
        }
    };

    // Load initial data on mount
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const books = await GetTextbooks();
                if (books) setTextbooks(books);

                const version = await GetAppVersion();
                setAppVersion(version);

                const folder = await GetWatchFolder();
                if (folder) setWatchFolder(folder);

                const plan = await GetLatestWeeklyPlan();
                if (plan && plan.success) {
                    setCurrentPlan(plan);

                    // 앱 시작 시 한 번만 현재 요일 & 시간에 맞춰 해당 교과서 페이지로 자동 진입!
                    const hasNavigated = sessionStorage.getItem('classbook_initial_nav_done');
                    if (!hasNavigated) {
                        sessionStorage.setItem('classbook_initial_nav_done', 'true');
                        setTimeout(() => {
                            applyWeeklyPlan(plan);
                        }, 400);
                    }
                }
            } catch (err) {
                console.error("Failed to load initial data:", err);
            }
        };
        loadInitialData();

        // Listen for weekly plan updates from folder watcher
        const handlePlanUpdate = (plan: main.WeeklyPlanResult) => {
            if (plan && plan.success) {
                setCurrentPlan(plan);
                showToast(`새 주학습계획안이 감지되어 분석되었습니다: ${plan.title}`);
                applyWeeklyPlan(plan);
            }
        };

        // Listen for schedule updates from settings modal
        const handleScheduleUpdate = () => {
            setSchedules(getStoredSchedule());
        };
        window.addEventListener('classbook_schedule_updated', handleScheduleUpdate);

        EventsOn('weekly-plan-updated', handlePlanUpdate);
        return () => {
            EventsOff('weekly-plan-updated');
            window.removeEventListener('classbook_schedule_updated', handleScheduleUpdate);
        };
    }, [navigate]);

    // Time-based Class Alert Checker
    useEffect(() => {
        const checkCurrentClass = async () => {
            if (!currentPlan || !currentPlan.schedule) return;

            const now = new Date();
            const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];
            if (dayOfWeek === '일' || dayOfWeek === '토') return;

            const hh = now.getHours().toString().padStart(2, '0');
            const mm = now.getMinutes().toString().padStart(2, '0');
            const currentTimeStr = `${hh}:${mm}`;

            if (lastAlertTimeRef.current === currentTimeStr) return;

            const currentSchedules = getStoredSchedule();

            // Check if current time matches any period start or end
            for (let i = 0; i < currentSchedules.length; i++) {
                const sched = currentSchedules[i];
                const schedPeriod = sched.period || parseInt(sched.name.replace(/[^0-9]/g, ''), 10) || (i + 1);

                if (sched.startTime === currentTimeStr) {
                    lastAlertTimeRef.current = currentTimeStr;
                    const dayItems = currentPlan.schedule[dayOfWeek] || [];
                    let foundItem = dayItems.find(it => it.period === schedPeriod);
                    if (!foundItem && dayItems.length > 0) {
                        foundItem = dayItems[schedPeriod - 1] || dayItems[0];
                    }

                    const periodTitle = sched.name || `${schedPeriod}교시`;
                    setAlertPeriod(schedPeriod);
                    setAlertPeriodTime(`${sched.startTime} ~ ${sched.endTime}`);
                    setAlertItem(foundItem || null);
                    setAlertIsRestTime(false);
                    setAlertCustomMessage(sched.startMessage || `${periodTitle} 수업을 시작합니다! 자리에 앉아주세요.`);
                    setIsAlertModalOpen(true);

                    // 교과서가 있는 경우에만 뷰어로 자동 이동
                    if (foundItem) {
                        const targetPage = foundItem.startPage || 1;
                        let currentBooks = textbooks;
                        if (!currentBooks || currentBooks.length === 0) {
                            currentBooks = (await GetTextbooks()) || [];
                        }
                        const resolved = resolveBookForSubject(foundItem.subject, foundItem.matchedBookId, currentBooks);
                        if (resolved) {
                            setTimeout(() => {
                                navigate(`/viewer/${encodeURIComponent(resolved.id)}?targetPage=${targetPage}&startAlert=true`);
                            }, 500);
                        } else {
                            showToast(`${periodTitle} [${foundItem.subject}] 교과서가 없는 수업(자율활동 등)입니다. 알림을 표시합니다.`);
                        }
                    }
                    break;
                } else if (sched.endTime === currentTimeStr) {
                    lastAlertTimeRef.current = currentTimeStr;
                    // 마칠 때 (쉬는 시간 시작): "쉬는 시간입니다"가 기본으로 뜸
                    setAlertPeriod(schedPeriod);
                    setAlertPeriodTime(sched.endTime);
                    setAlertItem(null);
                    setAlertIsRestTime(true);
                    setAlertCustomMessage(sched.restMessage || "쉬는 시간입니다");
                    setIsAlertModalOpen(true);
                    break;
                }
            }
        };

        const timer = setInterval(checkCurrentClass, 1000);
        return () => clearInterval(timer);
    }, [currentPlan, textbooks, navigate]);

    const handleDelete = async (e: React.MouseEvent, bookId: string) => {
        e.stopPropagation();
        if (!window.confirm("이 교과서를 완전히 삭제하시겠습니까?\n(로컬 파일이 삭제되며 복구할 수 없습니다)")) {
            return;
        }

        try {
            await DeleteBook(bookId);
            setTextbooks(prev => prev.filter(b => b.id !== bookId));
            showToast("교과서가 삭제되었습니다.");
        } catch (error) {
            console.error("Failed to delete book:", error);
            alert(`교과서 삭제에 실패했습니다: ${error}`);
        }
    };

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

    // Handle book upload with automatic page offset inspection
    const handleAddBook = async () => {
        try {
            const pdfPaths = await SelectMultiplePdfsDialog();
            if (!pdfPaths || pdfPaths.length === 0) return;

            setIsConverting(true);

            let currentBooks = await GetTextbooks();
            let addedCount = 0;
            let lastAddedBookForOffset: any = null;

            for (let i = 0; i < pdfPaths.length; i++) {
                const pdfPath = pdfPaths[i];
                const baseFilename = pdfPath.split('\\').pop()?.split('/').pop()?.replace('.pdf', '') || '새 교과서';
                
                let title = baseFilename;
                if (pdfPaths.length === 1) {
                    const promptTitle = window.prompt("추가할 교과서의 이름을 입력하세요:", baseFilename);
                    if (!promptTitle) continue;
                    title = promptTitle;
                } else {
                    let counter = 1;
                    const originalTitle = title;
                    while (currentBooks.some((b: any) => b.id === title)) {
                        title = `${originalTitle} (${counter})`;
                        counter++;
                    }
                }

                if (currentBooks.some((b: any) => b.id === title)) {
                    if (pdfPaths.length === 1) alert("이미 같은 이름의 교과서가 존재합니다.");
                    continue;
                }

                setConvertProgress({ current: 0, total: 1, title, statusText: 'PDF 파일 읽는 중...' });

                // Read File as Base64
                const base64Data = await ReadFileBase64(pdfPath);
                const raw = window.atob(base64Data);
                const uint8Array = new Uint8Array(raw.length);
                for (let j = 0; j < raw.length; j++) {
                    uint8Array[j] = raw.charCodeAt(j);
                }

                // Load with PDF.js
                const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
                const pdf = await loadingTask.promise;
                const numPages = pdf.numPages;

                setConvertProgress({ current: 0, total: numPages, title, statusText: '페이지 변환 및 쪽수 검사 중...' });

                const scale = 1.5;
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { alpha: false });

                let detectedOffset: number | null = null;

                for (let j = 1; j <= numPages; j++) {
                    const page = await pdf.getPage(j);
                    const viewport = page.getViewport({ scale });

                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    if (ctx) {
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        const renderContext = {
                            canvasContext: ctx,
                            viewport: viewport,
                        } as any;
                        await page.render(renderContext).promise;

                        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                        await SavePageImage(title, j, dataUrl);

                        // Inspect page numbers on pages 4 to 12
                        if (detectedOffset === null && j >= 4 && j <= 12) {
                            // 1. Check text layer first
                            const printedFromText = await detectPageNumberFromText(page, viewport);
                            if (printedFromText !== null && printedFromText > 0) {
                                detectedOffset = j - printedFromText;
                            } else {
                                // 2. Fallback: OCR on corner
                                const isEven = j % 2 === 0;
                                const printedFromOcr = await detectPageNumberFromCanvas(canvas, isEven);
                                if (printedFromOcr !== null && printedFromOcr > 0) {
                                    detectedOffset = j - printedFromOcr;
                                }
                            }
                        }
                    }

                    setConvertProgress({ 
                        current: j, 
                        total: numPages, 
                        title, 
                        statusText: detectedOffset !== null ? `변환 중... (감지된 쪽수 오프셋: ${detectedOffset})` : '변환 중...' 
                    });
                }

                // Ensure directory with detected offset (default to 0 if not detected)
                const finalOffset = detectedOffset !== null ? detectedOffset : 0;
                await EnsureBookDirWithOffset(title, numPages, finalOffset);

                currentBooks = await GetTextbooks();
                addedCount++;

                lastAddedBookForOffset = {
                    id: title,
                    title,
                    numPages,
                    initialOffset: finalOffset,
                    detectedOffset,
                };
            }

            setTextbooks(currentBooks);

            if (addedCount > 0) {
                // Open adjustment modal for the added book so the user can verify/adjust immediately!
                if (lastAddedBookForOffset) {
                    setOffsetModalBook(lastAddedBookForOffset);
                }
            }
        } catch (err: any) {
            console.error("Failed to add book:", err);
            alert(`교과서 추가 중 오류가 발생했습니다: ${err.message || err}`);
        } finally {
            setIsConverting(false);
            setConvertProgress({ current: 0, total: 0, title: '', statusText: '' });
        }
    };

    // Quick navigation from weekly plan to book page
    const handleGoToBook = (bookId: string, pageNumber: number, item?: any) => {
        const resolved = resolveBookForSubject(bookId, bookId, textbooks);
        const targetId = resolved ? resolved.id : bookId;
        const bookName = resolved ? resolved.title : bookId;
        showToast(`[${bookName} ${pageNumber}쪽]으로 이동합니다.`);
        const topicQ = item?.topic ? `&topic=${encodeURIComponent(item.topic)}` : '';
        const subjQ = item?.subject ? `&subject=${encodeURIComponent(item.subject)}` : '';
        const periodQ = item?.period ? `&period=${encodeURIComponent(`${item.period}교시`)}` : '';
        navigate(`/viewer/${encodeURIComponent(targetId)}?targetPage=${pageNumber}${topicQ}${subjQ}${periodQ}`);
    };

    const handleGoToBlank = (subject: string, topic: string, period?: number) => {
        showToast(`빈 화면 [${subject || '활동 수업'}]으로 이동합니다.`);
        navigate(`/viewer/blank?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}&period=${encodeURIComponent(period ? `${period}교시` : '활동 수업')}`);
    };

    // Manual trigger for current time class alert (or test preview)
    const handleTriggerTestAlert = () => {
        if (!currentPlan || !currentPlan.schedule) {
            alert("먼저 주학습계획안 파일(HWP/HWPX)을 등록해주세요!");
            return;
        }

        const now = new Date();
        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];
        const dayKey = (dayOfWeek === '일' || dayOfWeek === '토') ? '월' : dayOfWeek;
        const items = currentPlan.schedule[dayKey] || [];

        if (items.length === 0) {
            alert(`${dayKey}요일에 등록된 수업이 없습니다.`);
            return;
        }

        const hh = now.getHours().toString().padStart(2, '0');
        const mm = now.getMinutes().toString().padStart(2, '0');
        const currentTimeStr = `${hh}:${mm}`;

        const currentSchedules = getStoredSchedule();

        let activePeriod = 1;
        let activeSched = currentSchedules[0];

        for (let i = 0; i < currentSchedules.length; i++) {
            const s = currentSchedules[i];
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

        let currentItem = items.find(it => it.period === activePeriod);
        if (!currentItem && items.length > 0) {
            currentItem = items[activePeriod - 1] || items[0];
        }

        const periodName = activeSched?.name || `${activePeriod}교시`;
        const periodTime = activeSched ? `${activeSched.startTime} ~ ${activeSched.endTime}` : "";

        setAlertPeriod(activePeriod);
        setAlertPeriodTime(periodTime);
        setAlertItem(currentItem || null);
        setAlertIsRestTime(false);
        setAlertCustomMessage(activeSched?.startMessage || `${periodName} [${currentItem?.subject || '수업'}] 시작 시간입니다!`);
        setIsAlertModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 font-sans pb-32">
            {/* Header with Title and Control Buttons */}
            <header data-wails-drag className="max-w-6xl mx-auto mb-10 mt-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="flex items-center gap-3">
                        <div className="p-3 bg-violet-600 text-white rounded-2xl shadow-lg shadow-violet-500/30">
                            <BookOpen className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                                나의 교과서
                                {appVersion && <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">v{appVersion}</span>}
                            </h1>
                            <p className="text-sm text-slate-500 mt-0.5">
                                교과서 쪽수를 자동으로 맞추고, 주학습계획안과 실시간으로 연동되는 전자 교과서
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sub Bar: Weekly Plan Watch Folder & Add PDF Button */}
                <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Folder Watcher Info */}
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700 shrink-0">
                            <FolderOpen className="w-4 h-4 text-violet-600" />
                            <span>계획안 감시 폴더:</span>
                        </div>
                        <span className="truncate bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800 max-w-xs md:max-w-md" title={watchFolder}>
                            {watchFolder || "지정되지 않음"}
                        </span>
                        <button
                            onClick={async () => {
                                const folder = await SelectWatchFolderDialog();
                                if (folder) setWatchFolder(folder);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors cursor-pointer shrink-0"
                        >
                            변경
                        </button>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={async () => {
                                try {
                                    const res = await SelectWeeklyPlanFileDialog();
                                    if (res && res.success) {
                                        setCurrentPlan(res);
                                        showToast(`주학습계획안이 분석되었습니다: ${res.title}`);
                                        applyWeeklyPlan(res);
                                    }
                                } catch (e: any) {
                                    alert(`계획안 파일 로드 실패: ${e.message || e}`);
                                }
                            }}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <Upload className="w-4 h-4 text-violet-600" />
                            <span>계획안(HWP) 올리기</span>
                        </button>

                        <button
                            onClick={handleAddBook}
                            disabled={isConverting}
                            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl shadow-md shadow-violet-500/20 transition-all font-bold text-sm flex items-center gap-2 cursor-pointer"
                        >
                            {isConverting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{convertProgress.statusText} ({convertProgress.current}/{convertProgress.total})</span>
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" />
                                    <span>새 교과서 추가 (PDF)</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Toast Message */}
                {toastMessage && (
                    <div className="mt-4 p-3 bg-violet-600 text-white rounded-xl shadow-lg flex items-center justify-between text-sm animate-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-yellow-300" />
                            <span>{toastMessage}</span>
                        </div>
                        <button onClick={() => setToastMessage('')} className="p-1 hover:bg-white/20 rounded-md">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </header>

            {/* Main Book Grid */}
            <main className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-16">
                {textbooks.map((book) => {
                    const progressKey = `viewer-progress-${book.id}`;
                    const lastPageStr = localStorage.getItem(progressKey);
                    const lastPage = lastPageStr ? parseInt(lastPageStr, 10) : null;
                    const offset = book.pageOffset || 0;

                    return (
                        <div
                            key={book.id}
                            onClick={() => navigate(`/viewer/${encodeURIComponent(book.id)}`)}
                            className="group cursor-pointer bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden hover:shadow-xl hover:border-violet-300 transition-all duration-300 hover:-translate-y-1 flex flex-col h-full relative"
                        >
                            {/* Book cover area */}
                            <div className={`${book.color} aspect-[3/4] flex items-center justify-center relative overflow-hidden`}>
                                <PdfThumbnail bookId={book.id} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

                                {/* Offset setting button on cover */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOffsetModalBook({
                                            id: book.id,
                                            title: book.title,
                                            numPages: book.numPages || 100,
                                            initialOffset: offset,
                                            detectedOffset: null,
                                        });
                                    }}
                                    className="absolute top-3 left-3 px-2.5 py-1.5 bg-black/40 hover:bg-black/70 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition-all flex items-center gap-1.5 shadow-sm opacity-90 group-hover:opacity-100"
                                    title="실제 쪽수 맞추기 / 오프셋 조정"
                                >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                    <span>쪽수 맞춤</span>
                                </button>

                                {/* Delete Button on cover */}
                                <button
                                    onClick={(e) => handleDelete(e, book.id)}
                                    className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-red-600 text-white rounded-xl backdrop-blur-md transition-all shadow-sm opacity-80 group-hover:opacity-100"
                                    title="교과서 삭제"
                                    aria-label={`${book.title} 삭제`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Content area */}
                            <div className="p-5 flex flex-col flex-grow">
                                <h2 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-violet-600 transition-colors">
                                    {book.title}
                                </h2>

                                <div className="text-xs text-slate-400 mb-3 flex items-center gap-2">
                                    {book.numPages > 0 && <span>총 {book.numPages}페이지</span>}
                                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>오프셋 {offset}</span>
                                    </span>
                                </div>

                                <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-100">
                                    {lastPage ? (
                                        <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-100">
                                            {lastPage}쪽 이어서 보기
                                        </span>
                                    ) : (
                                        <span className="text-xs font-medium text-slate-400">
                                            처음부터 보기
                                        </span>
                                    )}

                                    <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-violet-600 group-hover:text-white text-slate-400 flex items-center justify-center transition-all shadow-xs">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </main>

            {/* Page Offset Adjust Modal */}
            {offsetModalBook && (
                <PageOffsetAdjustModal
                    isOpen={true}
                    bookId={offsetModalBook.id}
                    bookTitle={offsetModalBook.title}
                    initialOffset={offsetModalBook.initialOffset}
                    detectedOffset={offsetModalBook.detectedOffset}
                    numPages={offsetModalBook.numPages}
                    onClose={() => setOffsetModalBook(null)}
                    onSaved={async () => {
                        const updated = await GetTextbooks();
                        if (updated) setTextbooks(updated);
                        showToast(`'${offsetModalBook.title}'의 교재 쪽수가 맞춰졌습니다.`);
                    }}
                />
            )}

            {/* Weekly Plan Schedule Modal */}
            <WeeklyPlanScheduleModal
                isOpen={isScheduleModalOpen}
                plan={currentPlan}
                watchFolder={watchFolder}
                onClose={() => setIsScheduleModalOpen(false)}
                onPlanUpdated={(newPlan) => {
                    setCurrentPlan(newPlan);
                    showToast("주학습계획안이 업데이트되었습니다.");
                    applyWeeklyPlan(newPlan);
                }}
                onWatchFolderChanged={(newFolder) => {
                    setWatchFolder(newFolder);
                    showToast(`감시 폴더가 '${newFolder}'로 설정되었습니다.`);
                }}
                onGoToBook={handleGoToBook}
                onGoToBlank={handleGoToBlank}
            />

            {/* Class Period Alert Modal */}
            <WeeklyPlanAlertModal
                isOpen={isAlertModalOpen}
                isRestTime={alertIsRestTime}
                periodName={`${alertPeriod}교시`}
                periodTime={alertPeriodTime}
                customMessage={alertCustomMessage}
                item={alertItem}
                onClose={() => {
                    const isClassStart = !alertIsRestTime;
                    const itm = alertItem;
                    const pNum = alertPeriod;
                    setIsAlertModalOpen(false);

                    // 수업 시작 알림이 꺼지면 교과명과 쪽수를 자동으로 띄우고 닫기를 누를 때까지 유지
                    if (isClassStart && (itm || pNum)) {
                        setActiveLesson({
                            periodName: `${pNum}교시`,
                            subject: itm?.subject || "수업",
                            pageStr: itm?.pageStr || (itm?.startPage ? `${itm.startPage}쪽` : ""),
                            startPage: itm?.startPage || 1,
                            topic: itm?.topic,
                            matchedBookId: itm?.matchedBookId
                        });
                    }
                }}
                onGoToBook={handleGoToBook}
            />

            {/* Persistent Class Subject & Page Widget (Stays until user clicks close) */}
            {activeLesson && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9990] flex items-center gap-3 bg-slate-900/95 hover:bg-slate-900 backdrop-blur-xl border border-violet-500/70 shadow-[0_10px_35px_rgba(0,0,0,0.6)] rounded-2xl px-5 py-2.5 text-white transition-all animate-in slide-in-from-top-3 duration-300 select-none">
                    {/* 교시 뱃지 */}
                    <div className="px-2.5 py-1 bg-violet-600/30 border border-violet-400/40 text-violet-300 font-bold rounded-xl text-xs flex items-center gap-1 shrink-0">
                        <Clock className="w-3.5 h-3.5 text-violet-400" />
                        <span>{activeLesson.periodName}</span>
                    </div>

                    {/* 교과명 & 쪽수 */}
                    <div 
                        onClick={() => {
                            if (activeLesson.matchedBookId) {
                                handleGoToBook(activeLesson.matchedBookId, activeLesson.startPage || 1);
                            } else {
                                showToast(`[${activeLesson.subject}] 교과서가 없는 활동 수업입니다.`);
                            }
                        }}
                        className="flex items-center gap-2.5 cursor-pointer group"
                        title={activeLesson.matchedBookId ? "클릭하면 해당 교과서로 이동합니다" : "교과서가 없는 활동 수업입니다"}
                    >
                        <div className="flex items-center gap-1.5 font-black text-base text-white group-hover:text-violet-300 transition-colors">
                            <BookOpen className="w-4 h-4 text-violet-400" />
                            <span>{activeLesson.subject}</span>
                        </div>

                        {activeLesson.pageStr ? (
                            <div className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-400/50 text-amber-300 font-black rounded-lg text-sm group-hover:scale-105 transition-transform shadow-xs">
                                {activeLesson.pageStr}
                            </div>
                        ) : (
                            <div className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold rounded-lg text-xs">
                                자율·활동
                            </div>
                        )}

                        {activeLesson.topic && (
                            <div className="text-xs text-slate-300 max-w-[200px] truncate hidden md:block pl-2 border-l border-slate-700/80">
                                {activeLesson.topic}
                            </div>
                        )}
                    </div>

                    {/* 닫기 버튼: 사용자가 닫기를 누를 때까지 계속 떠 있음 */}
                    <button
                        onClick={() => setActiveLesson(null)}
                        className="ml-1 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="닫기"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Schedule & Alert Text Config Modal */}
            <ScheduleConfigModal
                isOpen={isBellConfigModalOpen}
                onClose={() => setIsBellConfigModalOpen(false)}
                onScheduleChanged={(newSched) => setSchedules(newSched)}
            />

            {/* Bottom Floating Action Bar */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/40 hover:bg-slate-900/60 text-white backdrop-blur-xl px-6 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 sm:gap-4 pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-4 duration-300 whitespace-nowrap select-none max-w-[95vw]">
                {/* 주안 미리보기 (주학습 계획안) */}
                <button
                    onClick={() => setIsScheduleModalOpen(true)}
                    className="px-4 py-2.5 bg-slate-800/50 hover:bg-violet-600/80 text-slate-100 hover:text-white rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border border-white/10 hover:border-violet-400/50 shadow-sm cursor-pointer group shrink-0 whitespace-nowrap"
                    title="주학습 계획안 미리보기 및 다른 날의 차시 열기"
                >
                    <Calendar className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform shrink-0" />
                    <span className="whitespace-nowrap">주안 미리보기</span>
                    {currentPlan && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    )}
                </button>

                {/* 수업 알림 시연 */}
                {currentPlan && (
                    <button
                        onClick={handleTriggerTestAlert}
                        className="px-4 py-2.5 bg-slate-800/50 hover:bg-amber-600/80 text-amber-300 hover:text-white rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border border-white/10 hover:border-amber-400/50 shadow-sm cursor-pointer group shrink-0 whitespace-nowrap"
                        title="수업 시작 알림 미리보기"
                    >
                        <Bell className="w-4 h-4 group-hover:scale-110 transition-transform shrink-0" />
                        <span className="whitespace-nowrap">수업 알림 시연</span>
                    </button>
                )}

                {/* 시종 시간·문구 설정 */}
                <button
                    onClick={() => setIsBellConfigModalOpen(true)}
                    className="px-4 py-2.5 bg-slate-800/50 hover:bg-violet-600/80 text-slate-100 hover:text-white rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border border-white/10 hover:border-violet-400/50 shadow-sm cursor-pointer group shrink-0 whitespace-nowrap"
                    title="시종 시간 및 알림 문구 설정"
                >
                    <Clock className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform shrink-0" />
                    <span className="whitespace-nowrap">시종 시간·문구 설정</span>
                </button>

                <div className="w-px h-6 bg-white/15 my-auto shrink-0" />

                {/* Fullscreen Toggle */}
                <button
                    onClick={toggleFullscreen}
                    className="p-2.5 bg-slate-800/50 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl transition-all border border-white/10 flex items-center justify-center cursor-pointer shadow-sm group shrink-0"
                    aria-label={isFullscreen ? "전체화면 종료" : "전체화면 보기"}
                    title={isFullscreen ? "전체화면 종료" : "전체화면 보기"}
                >
                    {isFullscreen ? <Minimize className="w-4 h-4 group-hover:scale-110 transition-transform" /> : <Maximize className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                </button>

                {/* Exit Button */}
                <button
                    onClick={Quit}
                    className="p-2.5 bg-slate-800/50 hover:bg-red-600/80 text-slate-300 hover:text-white rounded-xl transition-all border border-red-500/20 flex items-center justify-center cursor-pointer shadow-sm group shrink-0"
                    title="프로그램 종료"
                    aria-label="종료"
                >
                    <X className="w-4 h-4 text-red-400 group-hover:text-white group-hover:scale-110 transition-transform" />
                </button>
            </div>
        </div>
    );
}

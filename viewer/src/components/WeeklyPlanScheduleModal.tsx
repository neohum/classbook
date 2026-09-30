import React, { useState, useEffect } from 'react';
import { 
    X, Calendar, FolderOpen, Upload, BookOpen, Clock, ArrowRight, 
    CheckCircle2, FileText, Sparkles, RotateCw, Loader2, Plus, 
    Trash2, Edit2, Square, Save, Check 
} from 'lucide-react';
import { main } from '../../wailsjs/go/models';
import { 
    SelectWatchFolderDialog, 
    SelectWeeklyPlanFileDialog, 
    ReanalyzeWeeklyPlan,
    SaveWeeklyPlan,
    GetTextbooks
} from '../../wailsjs/go/main/App';
import HwpHtmlViewerModal from './HwpHtmlViewerModal';

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
}

export default function WeeklyPlanScheduleModal({
    isOpen,
    plan,
    watchFolder,
    onClose,
    onPlanUpdated,
    onWatchFolderChanged,
    onGoToBook,
    onGoToBlank
}: Props) {
    const todayIndex = new Date().getDay(); // 0 is Sun, 1 is Mon...
    const initialDay = (todayIndex >= 1 && todayIndex <= 5) ? DAY_LABELS[todayIndex - 1] : '월';
    const [selectedDay, setSelectedDay] = useState<string>(initialDay);
    const [isLoading, setIsLoading] = useState(false);
    const [isReanalyzing, setIsReanalyzing] = useState(false);
    const [isHwpHtmlViewerOpen, setIsHwpHtmlViewerOpen] = useState(false);
    const [availableBooks, setAvailableBooks] = useState<main.Textbook[]>([]);

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

    if (!isOpen) return null;

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
                alert(`주학습계획안이 성공적으로 분석되었습니다!\n(${res.title})\n\n[HTML 원본 보기] 버튼을 누르면 원본 양식 그대로 열람하실 수도 있습니다.`);
            } else if (res && !res.success) {
                alert(`주학습계획안 데이터 분석에 일부 어려움이 있었으나, [HTML 원본 보기] 버튼으로 원본 HWP 문서를 그대로 확인하실 수 있습니다.`);
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
                alert(`최신 분석 알고리즘(rhwp)으로 주학습계획안을 다시 인식(분석)하였습니다!\n(${res.title})\n\n요일별 교시가 정상 반영되었습니다.`);
            } else {
                alert("재인식 결과 데이터 분석에 실패했습니다. 파일을 다시 올려주세요.");
            }
        } catch (err: any) {
            alert(`재인식 오류: ${err.message || err}`);
        } finally {
            setIsReanalyzing(false);
        }
    };

    const currentDayItems = plan?.schedule ? plan.schedule[selectedDay] || [] : [];

    // Open item editor for adding
    const handleStartAdd = () => {
        const nextPeriod = currentDayItems.length > 0 
            ? Math.max(...currentDayItems.map(i => i.period || 0)) + 1 
            : 1;
        setEditingItem({
            isNew: true,
            day: selectedDay,
            period: nextPeriod > 6 ? 6 : nextPeriod,
            subject: '창체',
            matchedBookId: availableBooks.length > 0 ? availableBooks[0].id : '',
            startPage: 1,
            pageStr: '',
            topic: '',
            isBlankScreen: false
        });
    };

    // Open item editor for editing
    const handleStartEdit = (idx: number, itm: main.WeeklyPlanItem) => {
        const isBlank = itm.matchedBookId === 'blank' || (!itm.matchedBookId && !itm.startPage && !itm.pageStr);
        setEditingItem({
            isNew: false,
            day: selectedDay,
            index: idx,
            period: itm.period || (idx + 1),
            subject: itm.subject || (isBlank ? '활동' : '국어'),
            matchedBookId: itm.matchedBookId || (availableBooks.length > 0 ? availableBooks[0].id : ''),
            startPage: itm.startPage || 1,
            pageStr: itm.pageStr || (itm.startPage ? `${itm.startPage}쪽` : ''),
            topic: itm.topic || '',
            isBlankScreen: isBlank
        });
    };

    // Delete item
    const handleDeleteItem = async (idx: number) => {
        if (!plan) return;
        if (!window.confirm("이 수업 항목을 계획안에서 삭제하시겠습니까?")) return;

        const updatedSchedule = { ...plan.schedule };
        const dayList = [...(updatedSchedule[selectedDay] || [])];
        dayList.splice(idx, 1);
        updatedSchedule[selectedDay] = dayList;

        const updatedPlan: main.WeeklyPlanResult = {
            ...plan,
            schedule: updatedSchedule
        };
        await persistPlan(updatedPlan);
    };

    // Save edited or new item
    const handleSaveEdit = async (openImmediately = false) => {
        if (!editingItem) return;

        const targetPlan: main.WeeklyPlanResult = plan ? { ...plan } : {
            success: true,
            title: "주학습 계획안",
            filePath: "",
            schedule: { "월": [], "화": [], "수": [], "목": [], "금": [] }
        };

        const updatedSchedule = { ...(targetPlan.schedule || {}) };
        const dayList = [...(updatedSchedule[editingItem.day] || [])];

        const newItem: main.WeeklyPlanItem = {
            period: Number(editingItem.period),
            subject: editingItem.subject.trim() || (editingItem.isBlankScreen ? "활동" : "수업"),
            matchedBookId: editingItem.isBlankScreen ? "blank" : editingItem.matchedBookId,
            startPage: editingItem.isBlankScreen ? 0 : Number(editingItem.startPage || 1),
            endPage: editingItem.isBlankScreen ? 0 : Number(editingItem.startPage || 1),
            pageStr: editingItem.isBlankScreen ? "" : (editingItem.pageStr ? editingItem.pageStr : `${editingItem.startPage || 1}쪽`),
            topic: editingItem.topic.trim(),
            raw: `${editingItem.subject} ${editingItem.topic}`
        };

        if (editingItem.isNew) {
            dayList.push(newItem);
        } else if (editingItem.index !== undefined && editingItem.index >= 0) {
            dayList[editingItem.index] = newItem;
        }

        // Sort by period ascending
        dayList.sort((a, b) => (a.period || 0) - (b.period || 0));
        updatedSchedule[editingItem.day] = dayList;

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
                onGoToBook(newItem.matchedBookId || newItem.subject, newItem.startPage || 1, newItem);
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

    return (
        <>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh]">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-violet-600 text-white rounded-2xl shadow-md shadow-violet-500/20">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-extrabold text-slate-800">
                                    {plan?.title || "주학습 계획안"}
                                </h2>
                                <p className="text-xs text-slate-400">
                                    교과서 선택 또는 빈 화면(활동 수업) 내용을 입력하여 수업을 진행할 수 있습니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* 빈화면 바로 열기 버튼 */}
                            <button
                                onClick={() => setShowQuickBlank(true)}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors border border-emerald-200 cursor-pointer shadow-xs"
                                title="교과서 없이 빈 화면(칠판/화이트보드)에 내용을 띄우고 바로 수업을 시작합니다"
                            >
                                <Square className="w-3.5 h-3.5 text-emerald-600" />
                                <span>빈화면 바로 열기</span>
                            </button>

                            {/* HTML 뷰어 열기 버튼 */}
                            <button
                                onClick={() => setIsHwpHtmlViewerOpen(true)}
                                className="px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors border border-violet-200 cursor-pointer shadow-xs"
                                title="rhwp를 이용해 HWP 원본 서식 그대로 HTML로 보기"
                            >
                                <FileText className="w-4 h-4 text-violet-600" />
                                <span>HTML 원본 보기</span>
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

                    {/* Watch Folder & Upload Bar */}
                    <div className="bg-slate-100/80 px-6 py-2.5 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-slate-600 truncate max-w-xs sm:max-w-sm">
                            <span className="font-semibold text-slate-700 shrink-0">감시 폴더:</span>
                            <span className="truncate bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-800 font-mono text-[11px]" title={watchFolder}>
                                {watchFolder || "지정되지 않음"}
                            </span>
                            <button
                                onClick={handleSelectFolder}
                                className="shrink-0 px-2 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <FolderOpen className="w-3.5 h-3.5" />
                                <span>폴더 변경</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleReanalyze}
                                disabled={isReanalyzing || isLoading}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                title="현재 주학습계획안 파일을 최신 분석 알고리즘(rhwp)으로 다시 인식(분석)합니다"
                            >
                                <RotateCw className={`w-3.5 h-3.5 ${isReanalyzing ? 'animate-spin' : ''}`} />
                                <span>{isReanalyzing ? "재인식 중..." : "다시 분석(rhwp)"}</span>
                            </button>

                            <button
                                onClick={handleSelectFile}
                                disabled={isLoading || isReanalyzing}
                                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                <span>{isLoading ? "분석 중..." : "HWP / HWPX 파일 올리기"}</span>
                            </button>
                        </div>
                    </div>

                    {/* Day Tabs & Add Button */}
                    <div className="px-6 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex gap-1.5 flex-1">
                            {DAY_LABELS.map((day) => {
                                const count = plan?.schedule?.[day]?.length || 0;
                                const isSelected = selectedDay === day;
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
                                        <span>{day}요일</span>
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

                        {/* Add button */}
                        <button
                            onClick={handleStartAdd}
                            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                            title="현재 요일에 새 수업 또는 빈 화면 활동을 추가합니다"
                        >
                            <Plus className="w-4 h-4" />
                            <span>수업/활동 추가</span>
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="p-6 overflow-y-auto space-y-3 flex-grow">
                        {/* Inline Edit / Add Form */}
                        {editingItem && (
                            <div className="p-5 bg-violet-50/80 border-2 border-violet-400 rounded-3xl shadow-md mb-4 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-violet-200/70">
                                    <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-base text-violet-900">
                                            {editingItem.isNew ? `[${editingItem.day}요일] 새 수업/활동 등록` : `[${editingItem.day}요일 ${editingItem.period}교시] 수업 내용 수정`}
                                        </span>
                                    </div>

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
                                            교시 (1~6)
                                        </label>
                                        <select
                                            value={editingItem.period}
                                            onChange={(e) => setEditingItem({ ...editingItem, period: parseInt(e.target.value, 10) })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                        >
                                            {[1, 2, 3, 4, 5, 6].map(p => (
                                                <option key={p} value={p}>{p}교시</option>
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
                                            placeholder={editingItem.isBlankScreen ? "예: 창체, 자율, 안전, 학급활동" : "예: 국어, 수학, 학교"}
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
                                                {availableBooks.length === 0 && (
                                                    <option value="">교과서 없음</option>
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
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        {editingItem.isBlankScreen 
                                            ? "이 내용은 빈 화면(칠판/화이트보드) 상단 및 중앙 배너에 강조되어 표시됩니다."
                                            : "수업 진입 시 화면 상단 위젯에 교과명 및 쪽수와 함께 유지되어 표시됩니다."}
                                    </p>
                                </div>

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

                        {/* Schedule List */}
                        {currentDayItems.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-base font-semibold text-slate-600">등록된 수업 계획이 없습니다.</p>
                                <p className="text-xs mt-1 text-slate-400 mb-4">
                                    상단의 [수업/활동 추가]를 눌러 직접 입력하거나 [파일 올리기]로 HWP 주학습계획안을 추가해보세요.
                                </p>
                                <button
                                    onClick={handleStartAdd}
                                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>{selectedDay}요일 수업 추가하기</span>
                                </button>
                            </div>
                        ) : (
                            currentDayItems.map((item, idx) => {
                                const isBlank = item.matchedBookId === 'blank' || (!item.matchedBookId && !item.startPage && !item.pageStr);
                                const targetPage = item.startPage || 1;
                                const targetBookId = item.matchedBookId || item.subject;

                                return (
                                    <div
                                        key={idx}
                                        className="p-4 bg-slate-50 hover:bg-violet-50/60 border border-slate-200/80 hover:border-violet-300 rounded-2xl transition-all flex items-center justify-between gap-4 group shadow-xs hover:shadow-sm"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            {/* 교시 뱃지 */}
                                            <div className="w-11 h-11 bg-white rounded-xl shadow-xs border border-slate-200 group-hover:border-violet-300 flex flex-col items-center justify-center shrink-0 transition-colors">
                                                <span className="text-[10px] text-slate-400 font-bold leading-none">교시</span>
                                                <span className="text-base font-black text-violet-600 leading-none mt-0.5">
                                                    {item.period}
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
                                                                <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
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
                                            {/* 수정 */}
                                            <button
                                                onClick={() => handleStartEdit(idx, item)}
                                                className="p-2 text-slate-400 hover:text-violet-700 hover:bg-violet-100 rounded-xl transition-colors cursor-pointer"
                                                title="이 교시 내용 수정"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>

                                            {/* 삭제 */}
                                            <button
                                                onClick={() => handleDeleteItem(idx)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                                title="이 교시 항목 삭제"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>

                                            {/* 열기 / 바로가기 */}
                                            {isBlank ? (
                                                <button
                                                    onClick={() => {
                                                        onClose();
                                                        if (onGoToBlank) {
                                                            onGoToBlank(item.subject, item.topic, item.period);
                                                        }
                                                    }}
                                                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                                    title="빈 화면에 해당 내용을 표시하고 수업을 엽니다"
                                                >
                                                    <Square className="w-3.5 h-3.5" />
                                                    <span>빈화면 열기</span>
                                                    <ArrowRight className="w-3 h-3" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        onClose();
                                                        onGoToBook(targetBookId, targetPage, item);
                                                    }}
                                                    className="px-3.5 py-2 bg-white group-hover:bg-violet-600 text-slate-700 group-hover:text-white border border-slate-300 group-hover:border-violet-600 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                                    title={`${targetBookId} ${targetPage}쪽 열기`}
                                                >
                                                    <BookOpen className="w-3.5 h-3.5" />
                                                    <span>{targetPage}쪽 열기</span>
                                                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>입력 및 수정한 모든 계획안 내용은 기본 DB에 안전하게 자동 저장·유지됩니다.</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                        >
                            닫기
                        </button>
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
                                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
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
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleLaunchQuickBlank}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md"
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
                filePath={plan?.filePath}
                docTitle={plan?.title}
            />
        </>
    );
}

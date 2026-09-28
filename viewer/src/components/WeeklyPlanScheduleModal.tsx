import React, { useState } from 'react';
import { X, Calendar, FolderOpen, Upload, BookOpen, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { main } from '../../wailsjs/go/models';
import { SelectWatchFolderDialog, SelectWeeklyPlanFileDialog } from '../../wailsjs/go/main/App';

interface Props {
    isOpen: boolean;
    plan: main.WeeklyPlanResult | null;
    watchFolder: string;
    onClose: () => void;
    onPlanUpdated: (newPlan: main.WeeklyPlanResult) => void;
    onWatchFolderChanged: (newFolder: string) => void;
    onGoToBook: (bookId: string, pageNumber: number) => void;
}

const DAY_LABELS = ['월', '화', '수', '목', '금'];

export default function WeeklyPlanScheduleModal({
    isOpen,
    plan,
    watchFolder,
    onClose,
    onPlanUpdated,
    onWatchFolderChanged,
    onGoToBook
}: Props) {
    const todayIndex = new Date().getDay(); // 0 is Sun, 1 is Mon...
    const initialDay = (todayIndex >= 1 && todayIndex <= 5) ? DAY_LABELS[todayIndex - 1] : '월';
    const [selectedDay, setSelectedDay] = useState<string>(initialDay);
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

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
                onPlanUpdated(res);
                alert(`주학습계획안이 성공적으로 분석되었습니다!\n(${res.title})`);
            } else if (res && !res.success) {
                alert(`주학습계획안 분석에 실패했습니다: ${res.error || '내용을 찾을 수 없음'}`);
            }
        } catch (err: any) {
            alert(`파일 분석 오류: ${err.message || err}`);
        } finally {
            setIsLoading(false);
        }
    };

    const currentDayItems = plan?.schedule ? plan.schedule[selectedDay] || [] : [];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-violet-600 text-white rounded-2xl shadow-md shadow-violet-500/20">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-800">
                                {plan?.title || "주학습 계획안"}
                            </h2>
                            <p className="text-xs text-slate-400">
                                교시별 교과명과 쪽수를 확인하고 바로 이동할 수 있습니다.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                        title="닫기"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Watch Folder & Upload Bar */}
                <div className="bg-slate-100/80 px-6 py-3 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
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

                    <button
                        onClick={handleSelectFile}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isLoading ? "분석 중..." : "HWP / HWPX 파일 올리기"}</span>
                    </button>
                </div>

                {/* Day Tabs */}
                <div className="px-6 pt-4 pb-2 border-b border-slate-100 flex gap-2">
                    {DAY_LABELS.map((day) => {
                        const count = plan?.schedule?.[day]?.length || 0;
                        const isSelected = selectedDay === day;
                        return (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(day)}
                                className={`flex-1 py-2 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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

                {/* Schedule List */}
                <div className="p-6 overflow-y-auto space-y-3 flex-grow">
                    {currentDayItems.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-base font-semibold text-slate-600">등록된 수업 계획이 없습니다.</p>
                            <p className="text-xs mt-1">상단의 [HWP / HWPX 파일 올리기]를 눌러 주학습계획안을 추가해보세요.</p>
                        </div>
                    ) : (
                        currentDayItems.map((item, idx) => {
                            const targetPage = item.startPage || 1;
                            const targetBookId = item.matchedBookId || item.subject;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        onClose();
                                        onGoToBook(targetBookId, targetPage);
                                    }}
                                    className="p-4 bg-slate-50 hover:bg-violet-50/80 border border-slate-200/80 hover:border-violet-400 rounded-2xl transition-all flex items-center justify-between gap-4 group cursor-pointer shadow-xs hover:shadow-md"
                                    title={`${selectedDay}요일 ${item.period}교시 [${item.subject} ${targetPage}쪽] 즉시 보기`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl shadow-xs border border-slate-200 group-hover:border-violet-300 flex flex-col items-center justify-center shrink-0 transition-colors">
                                            <span className="text-[11px] text-slate-400 font-bold leading-none">교시</span>
                                            <span className="text-lg font-black text-violet-600 leading-none mt-0.5">
                                                {item.period}
                                            </span>
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h4 className="text-base font-bold text-slate-900 group-hover:text-violet-900 transition-colors">
                                                    {item.subject}
                                                </h4>
                                                {item.pageStr && (
                                                    <span className="text-xs font-semibold px-2 py-0.5 bg-violet-100 text-violet-700 rounded-md">
                                                        {item.pageStr}
                                                    </span>
                                                )}
                                            </div>
                                            {item.topic && (
                                                <p className="text-xs text-slate-500 font-medium line-clamp-1">
                                                    {item.topic}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onClose();
                                            onGoToBook(targetBookId, targetPage);
                                        }}
                                        className="shrink-0 px-3.5 py-2 bg-white group-hover:bg-violet-600 text-slate-700 group-hover:text-white border border-slate-300 group-hover:border-violet-600 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                                    >
                                        <BookOpen className="w-3.5 h-3.5" />
                                        <span>{targetPage}쪽 열기</span>
                                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>감시 폴더에 새 HWP/HWPX 파일이 올라오면 자동으로 분석됩니다.</span>
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
    );
}

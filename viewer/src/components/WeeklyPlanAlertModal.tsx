import React from 'react';
import { BookOpen, X, ArrowRight, Clock, Sparkles } from 'lucide-react';
import { main } from '../../wailsjs/go/models';

interface Props {
    isOpen: boolean;
    period: number;
    periodTime: string; // e.g. "09:50 ~ 10:30"
    item: main.WeeklyPlanItem | null;
    onClose: () => void;
    onGoToBook: (bookId: string, pageNumber: number) => void;
}

export default function WeeklyPlanAlertModal({
    isOpen,
    period,
    periodTime,
    item,
    onClose,
    onGoToBook
}: Props) {
    if (!isOpen || !item) return null;

    const targetPage = item.startPage || 1;
    const targetBookId = item.matchedBookId || item.subject;

    const handleConfirmAndGo = () => {
        onClose();
        if (targetBookId) {
            onGoToBook(targetBookId, targetPage);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-b from-slate-900 to-slate-800 border-2 border-violet-500/80 rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 text-center text-white relative overflow-hidden">
                {/* Background decorative glow */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-violet-600/30 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />

                {/* Close X */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="닫기"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Period Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-300 font-bold text-sm mb-4">
                    <Clock className="w-4 h-4" />
                    <span>{period}교시 수업 안내 {periodTime && `(${periodTime})`}</span>
                </div>

                {/* Header Icon */}
                <div className="w-20 h-20 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-violet-500/40 animate-bounce">
                    <BookOpen className="w-10 h-10 text-white" />
                </div>

                {/* Subject Name */}
                <h3 className="text-3xl font-extrabold text-white mb-2 tracking-tight flex items-center justify-center gap-2">
                    <span>{item.subject}</span>
                    <Sparkles className="w-6 h-6 text-yellow-400 inline" />
                </h3>

                {/* Topic */}
                {item.topic && (
                    <p className="text-slate-300 text-lg font-medium mb-5 px-4 line-clamp-2">
                        {item.topic}
                    </p>
                )}

                {/* Page Number Card */}
                <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 mb-8 shadow-inner">
                    <div className="text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">
                        학습 교재 및 쪽수
                    </div>
                    <div className="text-3xl font-black text-violet-400">
                        {item.pageStr || `${targetPage}쪽`}
                    </div>
                    {item.matchedBookId && (
                        <div className="text-xs text-slate-400 mt-1">
                            연결된 교과서: <span className="text-slate-300 font-semibold">{item.matchedBookId}</span>
                        </div>
                    )}
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleConfirmAndGo}
                        className="w-full py-4 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-lg rounded-2xl shadow-xl shadow-violet-600/40 hover:shadow-violet-600/60 transition-all flex items-center justify-center gap-2 group cursor-pointer active:scale-95"
                    >
                        <span>종료 (해당 교과서 보기)</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full py-2.5 px-4 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}

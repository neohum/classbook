import React, { useEffect, useState } from 'react';
import { BookOpen, X, ArrowRight, Clock, Sparkles, Bell, Coffee } from 'lucide-react';
import { main } from '../../wailsjs/go/models';

interface Props {
    isOpen: boolean;
    isRestTime?: boolean;
    periodName?: string;
    periodTime?: string; // e.g. "09:00 ~ 09:40"
    customMessage?: string;
    item?: main.WeeklyPlanItem | null;
    onClose: () => void;
    onGoToBook?: (bookId: string, pageNumber: number) => void;
}

export default function WeeklyPlanAlertModal({
    isOpen,
    isRestTime = false,
    periodName = "수업",
    periodTime = "",
    customMessage = "",
    item = null,
    onClose,
    onGoToBook
}: Props) {
    const [timeLeft, setTimeLeft] = useState<number>(3);

    useEffect(() => {
        if (!isOpen) return;

        setTimeLeft(3);

        const interval = setInterval(() => {
            setTimeLeft(prev => Math.max(0, prev - 1));
        }, 1000);

        const timer = setTimeout(() => {
            onClose();
        }, 3000);

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const targetPage = item?.startPage || 1;
    const targetBookId = item?.matchedBookId || item?.subject;
    const hasBookTarget = !!targetBookId && !!onGoToBook;

    const handleConfirmAndGo = () => {
        onClose();
        if (hasBookTarget && onGoToBook && targetBookId) {
            onGoToBook(targetBookId, targetPage);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className={`bg-gradient-to-b ${isRestTime ? 'from-slate-900 via-slate-800 to-amber-950/40 border-amber-500/70' : 'from-slate-900 via-slate-800 to-violet-950/40 border-violet-500/80'} border-2 rounded-3xl shadow-2xl p-8 max-w-lg w-full mx-4 text-center text-white relative overflow-hidden`}>
                {/* Background decorative glow */}
                <div className={`absolute -top-24 -left-24 w-48 h-48 ${isRestTime ? 'bg-amber-600/30' : 'bg-violet-600/30'} rounded-full blur-3xl pointer-events-none`} />
                <div className={`absolute -bottom-24 -right-24 w-48 h-48 ${isRestTime ? 'bg-orange-600/30' : 'bg-indigo-600/30'} rounded-full blur-3xl pointer-events-none`} />

                {/* Close X */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="닫기"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Badge */}
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${isRestTime ? 'bg-amber-500/20 border-amber-400/40 text-amber-300' : 'bg-violet-500/20 border-violet-400/40 text-violet-300'} border font-bold text-sm mb-2`}>
                    {isRestTime ? <Coffee className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    <span>
                        {periodName} {isRestTime ? "쉬는 시간 안내" : "수업 시작 안내"} {periodTime && `(${periodTime})`}
                    </span>
                </div>

                {/* Auto Dismiss Countdown Indicator */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-4 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span><strong>{timeLeft}초</strong> 뒤 자동으로 사라집니다</span>
                </div>

                {/* Animated Icon */}
                <div className={`w-20 h-20 bg-gradient-to-tr ${isRestTime ? 'from-amber-600 to-orange-500 shadow-amber-500/40' : 'from-violet-600 to-indigo-500 shadow-violet-500/40'} rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg animate-bounce`}>
                    {isRestTime ? (
                        <Coffee className="w-10 h-10 text-white" />
                    ) : item?.subject ? (
                        <BookOpen className="w-10 h-10 text-white" />
                    ) : (
                        <Bell className="w-10 h-10 text-white" />
                    )}
                </div>

                {/* Main Heading or Custom Message */}
                {isRestTime ? (
                    <div className="mb-6">
                        <h3 className="text-3xl font-extrabold text-amber-300 mb-3 tracking-tight">
                            쉬는 시간입니다
                        </h3>
                        <p className="text-slate-200 text-lg font-medium px-4 leading-relaxed bg-amber-950/40 border border-amber-800/40 rounded-2xl py-4">
                            {customMessage || "쉬는 시간입니다"}
                        </p>
                    </div>
                ) : (
                    <div className="mb-4">
                        {item?.subject ? (
                            <>
                                <h3 className="text-3xl font-black text-white mb-2 tracking-tight flex items-center justify-center gap-2">
                                    <span>{item.subject}</span>
                                    <Sparkles className="w-6 h-6 text-yellow-400 inline" />
                                </h3>
                                {item.topic && (
                                    <p className="text-slate-300 text-base font-medium mb-3 px-2 line-clamp-2">
                                        주제: {item.topic}
                                    </p>
                                )}
                            </>
                        ) : (
                            <h3 className="text-3xl font-extrabold text-white mb-3 tracking-tight">
                                {periodName} 시작 시간입니다!
                            </h3>
                        )}

                        {customMessage && (
                            <p className="text-violet-200 text-base font-medium mb-4 px-3 py-2.5 bg-violet-950/40 border border-violet-800/40 rounded-xl">
                                {customMessage}
                            </p>
                        )}
                    </div>
                )}

                {/* Textbook and Page Number Card (Only for Class Start) */}
                {!isRestTime && item && (
                    <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 mb-6 shadow-inner text-center">
                        {item.pageStr || (item.startPage && item.startPage > 0) ? (
                            <>
                                <div className="text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">
                                    학습 교재 및 쪽수
                                </div>
                                <div className="text-3xl font-black text-violet-400">
                                    {item.pageStr || `${targetPage}쪽`}
                                </div>
                                {item.matchedBookId && (
                                    <div className="text-xs text-slate-300 mt-1.5 flex items-center justify-center gap-1">
                                        <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                                        <span>연결된 교재: <strong>{item.matchedBookId}</strong></span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="text-xs uppercase tracking-wider text-amber-400/90 mb-1 font-semibold">
                                    수업 안내
                                </div>
                                <div className="text-2xl font-black text-amber-300">
                                    교과서 없는 활동 수업
                                </div>
                                <div className="text-xs text-slate-300 mt-1.5 flex items-center justify-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{item.topic || `${item.subject} (자율·체험·창체 활동)`}</span>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Buttons */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleConfirmAndGo}
                        className={`w-full py-4 px-6 bg-gradient-to-r ${isRestTime ? 'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/40' : 'from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-600/40'} text-white font-bold text-lg rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 group cursor-pointer active:scale-95`}
                    >
                        <span>{isRestTime ? "확인 및 알림 끄기" : hasBookTarget ? "종료 (해당 교과서 보기)" : "확인 및 닫기"}</span>
                        {!isRestTime && hasBookTarget && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full py-2 px-4 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
                    >
                        닫기
                    </button>
                </div>

                {/* Animated 3-second progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 overflow-hidden">
                    <div
                        className={`h-full ${isRestTime ? 'bg-amber-400' : 'bg-violet-400'} transition-all ease-linear`}
                        style={{
                            width: `${(timeLeft / 3) * 100}%`,
                            transitionDuration: '1000ms'
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

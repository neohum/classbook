import React from 'react';
import { BookOpen, X, ArrowRight, Clock, Sparkles, Coffee, Check } from 'lucide-react';
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
    if (!isOpen) return null;

    const targetPage = item?.startPage || 1;
    const targetBookId = item?.matchedBookId || item?.subject;
    const hasBookTarget = !!targetBookId && !!onGoToBook && !isRestTime;

    const handleConfirmAndGo = () => {
        onClose();
        if (hasBookTarget && onGoToBook && targetBookId) {
            onGoToBook(targetBookId, targetPage);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 md:p-8 animate-in fade-in duration-200">
            <div className={`bg-gradient-to-b ${
                isRestTime 
                    ? 'from-slate-900 via-slate-800 to-amber-950/50 border-amber-500/70' 
                    : 'from-slate-900 via-slate-800 to-violet-950/60 border-violet-500/80'
            } border-2 rounded-3xl sm:rounded-[36px] shadow-2xl p-6 sm:p-10 md:p-12 max-w-4xl w-full mx-auto text-center text-white relative overflow-hidden max-h-[94vh] flex flex-col justify-between`}>
                
                {/* Background decorative glow */}
                <div className={`absolute -top-32 -left-32 w-72 h-72 ${isRestTime ? 'bg-amber-600/20' : 'bg-violet-600/25'} rounded-full blur-3xl pointer-events-none`} />
                <div className={`absolute -bottom-32 -right-32 w-72 h-72 ${isRestTime ? 'bg-orange-600/20' : 'bg-indigo-600/25'} rounded-full blur-3xl pointer-events-none`} />

                {/* Close X Button (Top Right) */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-3 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer z-10"
                    title="닫기"
                >
                    <X className="w-8 h-8" />
                </button>

                {/* Top Section: Period Badge */}
                <div className="mb-4">
                    <div className={`inline-flex items-center gap-2.5 px-5 py-2 rounded-full ${
                        isRestTime 
                            ? 'bg-amber-500/20 border-amber-400/50 text-amber-300' 
                            : 'bg-violet-500/20 border-violet-400/50 text-violet-200'
                    } border font-black text-base sm:text-lg mb-2 shadow-sm`}>
                        {isRestTime ? <Coffee className="w-5 h-5 text-amber-400" /> : <Clock className="w-5 h-5 text-violet-400" />}
                        <span>
                            {periodName} {isRestTime ? "쉬는 시간" : "수업 시작"} {periodTime && `(${periodTime})`}
                        </span>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="my-auto py-2 space-y-5 overflow-y-auto">
                    {isRestTime ? (
                        <div className="py-6">
                            <div className="w-24 h-24 bg-gradient-to-tr from-amber-600 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-600/30">
                                <Coffee className="w-12 h-12 text-white" />
                            </div>
                            <h3 className="text-4xl sm:text-6xl font-black text-amber-300 mb-4 tracking-tight">
                                쉬는 시간입니다
                            </h3>
                            <p className="text-slate-200 text-xl sm:text-2xl font-bold px-6 py-5 bg-amber-950/40 border border-amber-800/40 rounded-3xl max-w-xl mx-auto leading-relaxed">
                                {customMessage || "잠시 휴식을 취하고 다음 수업을 준비하세요."}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Subject Name Header */}
                            <div>
                                <h3 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight drop-shadow-md flex items-center justify-center gap-3 flex-wrap">
                                    <span>{item?.subject || `${periodName} 수업`}</span>
                                    <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400 inline animate-pulse" />
                                </h3>
                                {customMessage && (
                                    <p className="text-violet-200 text-base sm:text-lg font-medium mt-2">
                                        {customMessage}
                                    </p>
                                )}
                            </div>

                            {/* Learning Topic (학습 주제) - HUGE & CLEAR */}
                            {item?.topic && (
                                <div className="bg-slate-800/90 border-2 border-violet-500/50 rounded-3xl p-5 sm:p-7 shadow-xl max-w-3xl mx-auto">
                                    <div className="text-xs sm:text-sm font-extrabold text-violet-300 tracking-wider uppercase mb-1">
                                        학습 주제
                                    </div>
                                    <div className="text-2xl sm:text-4xl md:text-5xl font-black text-white leading-snug break-keep drop-shadow-sm">
                                        {item.topic}
                                    </div>
                                </div>
                            )}

                            {/* Textbook Page (교과서 페이지) - MAXIMUM SIZE & CLARITY */}
                            {item ? (
                                <div className="bg-gradient-to-b from-amber-500/15 to-amber-500/5 border-2 border-amber-400/60 rounded-3xl p-6 sm:p-8 shadow-2xl max-w-3xl mx-auto">
                                    {item.pageStr || (item.startPage && item.startPage > 0) ? (
                                        <>
                                            <div className="text-sm sm:text-base font-bold text-amber-300 tracking-widest uppercase mb-1">
                                                교과서 쪽수
                                            </div>
                                            <div className="text-6xl sm:text-8xl md:text-9xl font-black text-amber-300 drop-shadow-[0_8px_25px_rgba(245,158,11,0.4)] tracking-tight leading-none py-2">
                                                {item.pageStr || `${targetPage}쪽`}
                                            </div>
                                            {item.matchedBookId && (
                                                <div className="text-base sm:text-xl text-slate-200 mt-3 font-bold flex items-center justify-center gap-2">
                                                    <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
                                                    <span>교재: <strong className="text-white underline decoration-amber-400 decoration-2 underline-offset-4">{item.matchedBookId}</strong></span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="py-2">
                                            <div className="text-xs sm:text-sm font-bold text-emerald-300 tracking-widest uppercase mb-1">
                                                수업 안내
                                            </div>
                                            <div className="text-3xl sm:text-5xl font-black text-emerald-300 drop-shadow-sm">
                                                교과서 없는 활동 수업
                                            </div>
                                            <div className="text-sm sm:text-base text-slate-300 mt-2 font-medium">
                                                판서 도구를 이용하거나 자유롭게 활동을 진행하세요
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </>
                    )}
                </div>

                {/* Bottom Action Buttons (Large & Clear) */}
                <div className="pt-6 border-t border-slate-700/60 mt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                    {/* Primary Button: 교과서 열기 or 수업 시작 */}
                    {!isRestTime && hasBookTarget ? (
                        <button
                            onClick={handleConfirmAndGo}
                            className="w-full sm:w-auto flex-1 max-w-md py-4 sm:py-5 px-8 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-lg sm:text-2xl rounded-2xl sm:rounded-3xl shadow-xl shadow-violet-600/40 transition-all flex items-center justify-center gap-3 group cursor-pointer active:scale-98"
                        >
                            <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" />
                            <span>교과서 열기 ({item?.pageStr || `${targetPage}쪽`})</span>
                            <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7 group-hover:translate-x-1.5 transition-transform" />
                        </button>
                    ) : null}

                    {/* Close Button: 교사가 닫기를 누르면 닫힘 */}
                    <button
                        onClick={onClose}
                        className={`${
                            !isRestTime && hasBookTarget 
                                ? 'w-full sm:w-auto px-8 py-4 sm:py-5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600' 
                                : 'w-full max-w-md py-4 sm:py-5 px-8 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white shadow-lg'
                        } font-black text-lg sm:text-xl rounded-2xl sm:rounded-3xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98`}
                    >
                        <Check className="w-6 h-6" />
                        <span>닫기</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

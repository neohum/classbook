import React from 'react';
import { BookOpen, X, ArrowRight, Clock, Sparkles, Coffee, Check, Square, Utensils } from 'lucide-react';
import { main } from '../../wailsjs/go/models';

interface Props {
    isOpen: boolean;
    isRestTime?: boolean;
    periodName?: string;
    periodTime?: string; // e.g. "09:00 ~ 09:40" or "09:40 ~ 09:50"
    customMessage?: string;
    item?: main.WeeklyPlanItem | null;
    nextItem?: main.WeeklyPlanItem | null;
    nextPeriodName?: string;
    nextPeriodTime?: string;
    onClose: () => void;
    onGoToBook?: (bookId: string, pageNumber: number) => void;
    onGoToBlank?: (subject?: string, topic?: string, period?: string) => void;
}

export default function WeeklyPlanAlertModal({
    isOpen,
    isRestTime = false,
    periodName = "수업",
    periodTime = "",
    customMessage = "",
    item = null,
    nextItem = null,
    nextPeriodName = "",
    nextPeriodTime = "",
    onClose,
    onGoToBook,
    onGoToBlank
}: Props) {
    if (!isOpen) return null;

    // In rest time, the target is the upcoming class
    const upcoming = nextItem || (isRestTime ? item : null);
    const targetItem = isRestTime ? upcoming : item;

    const targetPage = targetItem?.startPage || 1;
    const targetBookId = targetItem?.matchedBookId || targetItem?.subject;
    const isBlank = targetBookId === 'blank' || targetItem?.matchedBookId === 'blank' || targetItem?.period === 0;

    const upcomingTitle = nextPeriodName || (upcoming ? (upcoming.period === 0 ? '아침활동' : `${upcoming.period}교시`) : '다음 교시');

    const handleConfirmAndGo = () => {
        onClose();
        if (isBlank) {
            if (onGoToBlank && targetItem) {
                onGoToBlank(targetItem.subject, targetItem.topic, upcomingTitle);
            }
        } else if (onGoToBook && targetBookId) {
            onGoToBook(targetBookId, targetPage);
        }
    };

    const isLunch = periodName.includes('점심');
    const isPrep = periodName.includes('준비');

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 md:p-8 animate-in fade-in duration-200">
            <div className={`bg-gradient-to-b ${
                isRestTime 
                    ? 'from-slate-900 via-slate-800 to-amber-950/60 border-amber-500/70' 
                    : 'from-slate-900 via-slate-800 to-violet-950/60 border-violet-500/80'
            } border-2 rounded-3xl sm:rounded-[36px] shadow-2xl p-6 sm:p-9 md:p-10 max-w-4xl w-full mx-auto text-center text-white relative overflow-hidden max-h-[94vh] flex flex-col justify-between`}>
                
                {/* Background decorative glow */}
                <div className={`absolute -top-32 -left-32 w-72 h-72 ${isRestTime ? 'bg-amber-600/20' : 'bg-violet-600/25'} rounded-full blur-3xl pointer-events-none`} />
                <div className={`absolute -bottom-32 -right-32 w-72 h-72 ${isRestTime ? 'bg-orange-600/20' : 'bg-indigo-600/25'} rounded-full blur-3xl pointer-events-none`} />

                {/* Close X Button (Top Right) */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer z-10"
                    title="닫기"
                >
                    <X className="w-7 h-7" />
                </button>

                {/* Top Section: Period Badge */}
                <div className="mb-3">
                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${
                        isRestTime 
                            ? 'bg-amber-500/20 border-amber-400/50 text-amber-300' 
                            : 'bg-violet-500/20 border-violet-400/50 text-violet-200'
                    } border font-black text-sm sm:text-base shadow-sm`}>
                        {isRestTime ? (
                            isLunch ? <Utensils className="w-4 h-4 text-amber-400" /> : <Coffee className="w-4 h-4 text-amber-400" />
                        ) : (
                            <Clock className="w-4 h-4 text-violet-400" />
                        )}
                        <span>
                            {periodName} {isRestTime ? (isLunch ? "" : "쉬는 시간") : "수업 시작"} {periodTime && `(${periodTime})`}
                        </span>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="my-auto py-2 space-y-4 overflow-y-auto">
                    {isRestTime ? (
                        <div className="space-y-4">
                            {/* Rest Time Notification & Custom Chime Message */}
                            <div className="py-2">
                                <h3 className="text-3xl sm:text-5xl md:text-6xl font-black text-amber-300 tracking-tight drop-shadow-md flex items-center justify-center gap-3">
                                    <span>{periodName.includes('점심') ? '점심시간입니다' : (periodName.includes('준비') ? '5분 준비시간입니다' : '쉬는 시간입니다')}</span>
                                    <Coffee className="w-8 h-8 text-amber-400 inline" />
                                </h3>
                                <p className="text-amber-100 text-base sm:text-xl font-bold mt-2 px-5 py-2.5 bg-amber-950/40 border border-amber-700/50 rounded-2xl max-w-2xl mx-auto leading-relaxed">
                                    {customMessage || (isLunch ? "점심시간입니다. 즐겁고 맛있는 식사 시간 되세요!" : "잠시 휴식을 취하고 다음 수업을 준비하세요.")}
                                </p>
                            </div>

                            {/* Upcoming Class Preparation Card (주학습계획안에 따른 다음 교과서 & 학습 쪽수 띄우기) */}
                            {upcoming ? (
                                <div className="bg-slate-800/95 border-2 border-amber-400/70 rounded-3xl p-5 sm:p-7 shadow-2xl max-w-3xl mx-auto text-center space-y-3">
                                    {/* Next Class Header */}
                                    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-violet-500/25 border border-violet-400/50 text-violet-200 text-xs sm:text-sm font-extrabold shadow-xs">
                                        <Clock className="w-4 h-4 text-violet-400" />
                                        <span>다음 수업 안내 &bull; <strong className="text-yellow-300 font-black">{upcomingTitle}</strong> {nextPeriodTime && `(${nextPeriodTime})`}</span>
                                    </div>

                                    {/* Subject Title */}
                                    <div className="text-2xl sm:text-4xl md:text-5xl font-black text-white flex items-center justify-center gap-2">
                                        <span>{upcoming.subject}</span>
                                        <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 inline animate-pulse" />
                                    </div>

                                    {/* Textbook & Page Number (HUGE & EYE-CATCHING) */}
                                    {!isBlank && (upcoming.pageStr || (upcoming.startPage && upcoming.startPage > 0)) ? (
                                        <div className="bg-gradient-to-b from-amber-500/20 to-amber-500/5 border-2 border-amber-400/60 rounded-2xl p-4 sm:p-6 my-1">
                                            <div className="text-xs sm:text-sm font-extrabold text-amber-300 tracking-widest uppercase mb-1">
                                                쉬는 시간 동안 미리 펼쳐둘 교과서 쪽수
                                            </div>
                                            <div className="text-6xl sm:text-8xl md:text-9xl font-black text-amber-300 drop-shadow-[0_8px_25px_rgba(245,158,11,0.5)] tracking-tight leading-none py-1">
                                                {upcoming.pageStr || `${upcoming.startPage}쪽`}
                                            </div>
                                            {upcoming.matchedBookId && (
                                                <div className="text-sm sm:text-lg text-slate-200 mt-2 font-bold flex items-center justify-center gap-2">
                                                    <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
                                                    <span>교과서: <strong className="text-white underline decoration-amber-400 decoration-2 underline-offset-4">{upcoming.matchedBookId}</strong></span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-emerald-500/15 border-2 border-emerald-400/50 rounded-2xl p-4 my-1">
                                            <div className="text-xs sm:text-sm font-bold text-emerald-300 tracking-wider mb-1">
                                                수업 안내
                                            </div>
                                            <div className="text-2xl sm:text-3xl font-black text-emerald-300">
                                                교과서 없는 활동 수업
                                            </div>
                                            <div className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                                                칠판 판서 도구를 이용하거나 자유롭게 활동을 진행합니다
                                            </div>
                                        </div>
                                    )}

                                    {/* Topic (학습 주제) */}
                                    {upcoming.topic && (
                                        <div className="bg-slate-900/70 border border-slate-700/80 rounded-xl px-4 py-2 text-xs sm:text-sm text-slate-200">
                                            <span className="text-violet-300 font-extrabold mr-2">학습 주제:</span>
                                            <span className="font-bold">{upcoming.topic}</span>
                                        </div>
                                    )}

                                    <p className="text-[11px] sm:text-xs text-amber-200/80 font-bold">
                                        쉬는 시간 동안 화장실을 다녀오고 다음 시간 교과서와 필기도구를 미리 책상 위에 올려두세요.
                                    </p>
                                </div>
                            ) : (
                                <div className="py-4 text-slate-400 text-sm font-semibold">
                                    등록된 다음 교시 수업 정보가 없습니다.
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Class Start: Subject Name Header */}
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

                            {/* Learning Topic (학습 주제) */}
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

                            {/* Textbook Page (교과서 페이지) */}
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

                {/* Bottom Action Buttons */}
                <div className="pt-4 border-t border-slate-700/60 mt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                    {/* Primary Button: 교과서 열기 or 활동 화면 열기 */}
                    {targetItem && (onGoToBook || onGoToBlank) ? (
                        <button
                            onClick={handleConfirmAndGo}
                            className={`w-full sm:w-auto flex-1 max-w-md py-3.5 sm:py-4 px-6 ${
                                isBlank
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/40'
                                    : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-600/40'
                            } text-white font-black text-base sm:text-lg rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 group cursor-pointer active:scale-95`}
                        >
                            {isBlank ? (
                                <>
                                    <Square className="w-5 h-5" />
                                    <span>{isRestTime ? "다음 활동 화면 바로 열기" : "활동 화면 열기"}</span>
                                </>
                            ) : (
                                <>
                                    <BookOpen className="w-5 h-5" />
                                    <span>
                                        {isRestTime ? "다음 수업 바로 열기" : "교과서 열기"} ({targetItem?.pageStr || `${targetPage}쪽`})
                                    </span>
                                </>
                            )}
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                        </button>
                    ) : null}

                    {/* Close Button: 교사가 닫기를 누르면 닫힘 */}
                    <button
                        onClick={onClose}
                        className={`${
                            targetItem && (onGoToBook || onGoToBlank)
                                ? 'w-full sm:w-auto px-6 py-3.5 sm:py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600' 
                                : 'w-full max-w-md py-3.5 sm:py-4 px-6 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white shadow-lg'
                        } font-black text-base rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95`}
                    >
                        <Check className="w-5 h-5" />
                        <span>닫기</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

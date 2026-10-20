import React, { useState, useEffect } from 'react';
import { BookOpen, X, ArrowRight, Clock, Sparkles, Coffee, Check, Square, Utensils, Maximize, Minimize } from 'lucide-react';
import { main } from '../../wailsjs/go/models';
import { WindowFullscreen, WindowUnfullscreen, WindowIsFullscreen } from '../../wailsjs/runtime/runtime';
import LessonTopicCenterBanner from './LessonTopicCenterBanner';
import { getDisplaySubjectName } from '../utils/bookResolver';
import { getStoredMorningActivity } from '../utils/morningActivityHelper';

interface Props {
    isOpen: boolean;
    isRestTime?: boolean;
    compactBannerMode?: boolean;
    pageOffset?: number;
    totalPages?: number;
    periodName?: string;
    periodTime?: string; // e.g. "09:00 ~ 09:40" or "09:40 ~ 09:50"
    customMessage?: string;
    item?: main.WeeklyPlanItem | null;
    nextItem?: main.WeeklyPlanItem | null;
    nextPeriodName?: string;
    nextPeriodTime?: string;
    onClose: (dismissKey?: string) => void;
    onGoToBook?: (bookId: string, pageNumber: number) => void;
    onGoToBlank?: (subject?: string, topic?: string, period?: string) => void;
}


/**
 * Safely resolves textbook page display string and start page number
 * from WeeklyPlanItem fields, falling back to regex extraction from raw and topic text.
 */
export function resolvePageDisplay(item?: main.WeeklyPlanItem | null): { pageStr: string; startPage: number } {
    if (!item) return { pageStr: '', startPage: 0 };

    // 1. Direct pageStr if present
    const pStr = (item.pageStr || '').trim();
    if (pStr) {
        const numMatch = pStr.match(/(\d{1,3})/);
        const sp = item.startPage && item.startPage > 0 
            ? item.startPage 
            : (numMatch ? parseInt(numMatch[1], 10) : 0);
        return { pageStr: pStr.endsWith('쪽') ? pStr : `${pStr}쪽`, startPage: sp };
    }

    // 2. Direct startPage / endPage
    if (item.startPage && item.startPage > 0) {
        if (item.endPage && item.endPage >= item.startPage) {
            return { pageStr: `${item.startPage}~${item.endPage}쪽`, startPage: item.startPage };
        }
        return { pageStr: `${item.startPage}쪽`, startPage: item.startPage };
    }

    // 3. Fallback: extract from raw and topic text
    const combined = `${item.raw || ''} ${item.topic || ''}`;
    if (!combined.trim()) return { pageStr: '', startPage: 0 };

    const clean = combined
        .replace(/\d{2,4}\s*-\s*\d{3,4}\s*-\s*\d{4}/g, '')
        .replace(/\(?\d{1,2}:\d{2}\s*[~∼\-]\s*\d{1,2}:\d{2}\)?/g, '');

    // Pattern 1: e.g. 12~15쪽, 12-15쪽, p.12~15
    const m1 = clean.match(/(?:(?:쪽|p\.?|page)\s*(\d{1,3})\s*(?:~|∼|-|–)\s*(\d{1,3})|(\d{1,3})\s*(?:~|∼|-|–)\s*(\d{1,3})\s*쪽)/i);
    if (m1) {
        const sp = parseInt(m1[1] || m1[3], 10);
        const ep = parseInt(m1[2] || m1[4], 10);
        if (sp <= 350 && ep <= 350 && sp <= ep) {
            return { pageStr: `${sp}~${ep}쪽`, startPage: sp };
        }
    }

    // Pattern 2: Parentheses e.g. (12~15) or (12-15)
    const m2 = clean.match(/\(\s*(\d{1,3})\s*(?:~|∼|-|–)\s*(\d{1,3})\s*\)/);
    if (m2) {
        const sp = parseInt(m2[1], 10);
        const ep = parseInt(m2[2], 10);
        if (sp <= 350 && ep <= 350 && sp <= ep) {
            return { pageStr: `${sp}~${ep}쪽`, startPage: sp };
        }
    }

    // Pattern 3: Single page e.g. 12쪽, p.12
    const m3 = clean.match(/(?:(\d{1,3})\s*쪽|p\.?\s*(\d{1,3}))/i);
    if (m3) {
        const val = parseInt(m3[1] || m3[2], 10);
        if (val <= 350) {
            return { pageStr: `${val}쪽`, startPage: val };
        }
    }

    // Pattern 4: Standalone range e.g. 12~15 or 12-15
    const m4 = clean.match(/(\d{1,3})\s*(?:~|∼|-|–)\s*(\d{1,3})/);
    if (m4) {
        const sp = parseInt(m4[1], 10);
        const ep = parseInt(m4[2], 10);
        if (sp <= 350 && ep <= 350 && sp <= ep) {
            return { pageStr: `${sp}~${ep}쪽`, startPage: sp };
        }
    }

    return { pageStr: '', startPage: 0 };
}

export default function WeeklyPlanAlertModal({
    isOpen,
    isRestTime = false,
    compactBannerMode = true,
    pageOffset = 0,
    totalPages = 0,
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
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const checkFs = () => {
            const fs = !!document.fullscreenElement;
            setIsFullscreen(fs);
        };
        document.addEventListener('fullscreenchange', checkFs);
        if (typeof WindowIsFullscreen === 'function') {
            WindowIsFullscreen().then(fs => setIsFullscreen(fs)).catch(() => {});
        }
        return () => document.removeEventListener('fullscreenchange', checkFs);
    }, []);

    const toggleFullscreen = () => {
        try {
            if (typeof WindowIsFullscreen === 'function' && typeof WindowFullscreen === 'function' && typeof WindowUnfullscreen === 'function') {
                WindowIsFullscreen().then(fs => {
                    if (fs) {
                        WindowUnfullscreen();
                        setIsFullscreen(false);
                    } else {
                        WindowFullscreen();
                        setIsFullscreen(true);
                    }
                }).catch(() => {
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
                    } else {
                        document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
                    }
                });
            } else {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
                } else {
                    document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
                }
            }
        } catch (e) {
            console.error("Fullscreen toggle error:", e);
        }
    };

    if (!isOpen) return null;

    // Morning activity unified resolution
    const storedMorning = getStoredMorningActivity();
    const isMorningPeriod = periodName.includes('아침') || item?.period === 0 || nextItem?.period === 0;

    if (!isRestTime && compactBannerMode) {
        return (
            <LessonTopicCenterBanner
                isOpen={isOpen}
                lesson={{
                    periodName,
                    periodTime,
                    subject: getDisplaySubjectName(item?.subject || (isMorningPeriod ? storedMorning.subject : `${periodName} 수업`), item?.matchedBookId, [], undefined, item?.topic),
                    pageStr: resolvePageDisplay(item).pageStr || item?.pageStr,
                    startPage: resolvePageDisplay(item).startPage || item?.startPage,
                    endPage: item?.endPage,
                    topic: item?.topic || (isMorningPeriod ? storedMorning.topic : undefined),
                    matchedBookId: item?.matchedBookId,
                    customMessage
                }}
                pageOffset={pageOffset}
                totalPages={totalPages}
                onClose={(dismissKey) => onClose(dismissKey)}
                onJumpToPage={(bookId, printedPage) => {
                    onGoToBook?.(bookId, printedPage);
                }}
                onOpenBlankActivity={(subject, topic, period) => {
                    onGoToBlank?.(subject, topic, period);
                }}
            />
        );
    }

    // In rest time, the target is the upcoming class
    const upcoming = nextItem || (isRestTime ? item : null);
    const targetItem = isRestTime ? upcoming : item;

    const upcomingPage = resolvePageDisplay(upcoming);
    const currentPage = resolvePageDisplay(item);
    const targetPageInfo = isRestTime ? upcomingPage : currentPage;

    const isUpcomingMorning = Boolean(upcoming && upcoming.period === 0);
    const isCurrentMorning = Boolean(item && (item.period === 0 || periodName.includes('아침')));
    const isMorning = isRestTime ? isUpcomingMorning : isCurrentMorning;

    const effectiveTopic = targetItem?.topic || (isMorning ? storedMorning.topic : '') || '';
    const rawSubject = targetItem?.subject || (isMorning ? storedMorning.subject : '') || (isMorning ? '아침활동' : '활동 수업');
    const effectiveSubject = getDisplaySubjectName(rawSubject, targetItem?.matchedBookId, [], undefined, targetItem?.topic);

    const targetPage = targetPageInfo.startPage || 1;
    const targetBookId = targetItem?.matchedBookId || targetItem?.subject;
    const isBlank = isMorning || targetBookId === 'blank' || targetItem?.matchedBookId === 'blank';

    const upcomingTitle = nextPeriodName || (upcoming ? (upcoming.period === 0 ? '아침활동' : `${upcoming.period}교시`) : '다음 교시');

    const handleConfirmAndGo = () => {
        onClose();
        if (isBlank) {
            if (onGoToBlank && targetItem) {
                onGoToBlank(effectiveSubject, effectiveTopic, upcomingTitle);
            }
        } else if (onGoToBook && targetBookId) {
            onGoToBook(targetBookId, targetPage);
        }
    };

    const isLunch = periodName.includes('점심');

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

                {/* Top Right Buttons: Fullscreen & Close */}
                <div className="absolute top-4 right-4 sm:top-5 sm:right-5 flex items-center gap-2 z-10">
                    <button
                        onClick={toggleFullscreen}
                        className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 border border-white/20 cursor-pointer shadow-xs active:scale-95"
                        title="화면 전체 보기 (전체화면 전환)"
                    >
                        {isFullscreen ? <Minimize className="w-4 h-4 text-amber-300" /> : <Maximize className="w-4 h-4 text-violet-300" />}
                        <span className="font-extrabold">{isFullscreen ? "창 모드" : "화면 전체 보기"}</span>
                    </button>

                    <button
                        onClick={() => onClose()}
                        className="p-2 sm:p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="닫기"
                    >
                        <X className="w-6 h-6 sm:w-7 sm:h-7" />
                    </button>
                </div>

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
                                        <span>{getDisplaySubjectName(upcoming.subject, upcoming.matchedBookId, [], undefined, upcoming.topic)}</span>
                                        <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 inline animate-pulse" />
                                    </div>

                                    {(upcomingPage.pageStr || upcomingPage.startPage > 0) ? (
                                        <div className="bg-gradient-to-b from-amber-500/20 to-amber-500/5 border-2 border-amber-400/60 rounded-2xl p-4 sm:p-6 my-1">
                                            <div className="text-xs sm:text-sm font-extrabold text-amber-300 tracking-widest uppercase mb-1">
                                                쉬는 시간 동안 미리 펼쳐둘 교과서 쪽수
                                            </div>
                                            <div className="text-6xl sm:text-8xl md:text-9xl font-black text-amber-300 drop-shadow-[0_8px_25px_rgba(245,158,11,0.5)] tracking-tight leading-none py-1">
                                                {upcomingPage.pageStr || `${upcomingPage.startPage}쪽`}
                                            </div>
                                            {upcoming.matchedBookId && upcoming.matchedBookId !== 'blank' && (
                                                <div className="text-sm sm:text-lg text-slate-200 mt-2 font-bold flex items-center justify-center gap-2">
                                                    <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
                                                    <span>교과서: <strong className="text-white underline decoration-amber-400 decoration-2 underline-offset-4">{upcoming.matchedBookId}</strong></span>
                                                </div>
                                            )}
                                        </div>
                                    ) : isUpcomingMorning ? (
                                        <div className="bg-gradient-to-b from-amber-500/25 to-amber-500/10 border-2 border-amber-400/80 rounded-2xl p-5 sm:p-7 my-2 shadow-lg">
                                            <div className="text-xs sm:text-sm font-extrabold text-amber-300 tracking-wider mb-2">
                                                아침활동 내용
                                            </div>
                                            <div className="text-2xl sm:text-4xl md:text-5xl font-black text-amber-300 drop-shadow-[0_8px_20px_rgba(245,158,11,0.5)] leading-snug break-keep">
                                                {effectiveTopic || storedMorning.topic || '아침 독서 및 자율활동'}
                                            </div>
                                            <div className="text-xs sm:text-sm text-slate-300 mt-2 font-medium">
                                                지정된 아침활동을 준비하고 자율적으로 진행합니다
                                            </div>
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
                                    {!isMorning && upcoming.topic && (
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
                                    <span>{effectiveSubject || `${periodName} 수업`}</span>
                                    <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400 inline animate-pulse" />
                                </h3>
                                {customMessage && (
                                    <p className="text-violet-200 text-base sm:text-lg font-medium mt-2">
                                        {customMessage}
                                    </p>
                                )}
                            </div>

                            {/* Learning Topic (학습 주제 - 일반 수업일 때만) */}
                            {!isMorning && item?.topic && (
                                <div className="bg-slate-800/90 border-2 border-violet-500/50 rounded-3xl p-5 sm:p-7 shadow-xl max-w-3xl mx-auto">
                                    <div className="text-xs sm:text-sm font-extrabold text-violet-300 tracking-wider uppercase mb-1">
                                        학습 주제
                                    </div>
                                    <div className="text-2xl sm:text-4xl md:text-5xl font-black text-white leading-snug break-keep drop-shadow-sm">
                                        {item.topic}
                                    </div>
                                </div>
                            )}

                            {/* Textbook Page or Morning/Activity Box */}
                            {item || isMorning ? (
                                <div className="bg-gradient-to-b from-amber-500/15 to-amber-500/5 border-2 border-amber-400/60 rounded-3xl p-6 sm:p-8 shadow-2xl max-w-3xl mx-auto">
                                    {isMorning ? (
                                        <div className="py-3">
                                            <div className="text-xs sm:text-sm font-bold text-amber-300 tracking-widest uppercase mb-2">
                                                아침활동 내용
                                            </div>
                                            <div className="text-3xl sm:text-5xl md:text-6xl font-black text-amber-300 drop-shadow-[0_8px_25px_rgba(245,158,11,0.5)] leading-tight break-keep">
                                                {effectiveTopic || storedMorning.topic || '아침 독서 및 자율활동'}
                                            </div>
                                            <div className="text-sm sm:text-base text-slate-300 mt-3 font-medium">
                                                스스로 독서를 하거나 지정된 아침 자율활동을 진행하세요
                                            </div>
                                        </div>
                                    ) : (currentPage.pageStr || currentPage.startPage > 0) ? (
                                        <>
                                            <div className="text-sm sm:text-base font-bold text-amber-300 tracking-widest uppercase mb-1">
                                                교과서 쪽수
                                            </div>
                                            <div className="text-6xl sm:text-8xl md:text-9xl font-black text-amber-300 drop-shadow-[0_8px_25px_rgba(245,158,11,0.4)] tracking-tight leading-none py-2">
                                                {currentPage.pageStr || `${targetPage}쪽`}
                                            </div>
                                            {item.matchedBookId && item.matchedBookId !== 'blank' && (
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

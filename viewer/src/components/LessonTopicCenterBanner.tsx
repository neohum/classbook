import React, { useEffect } from 'react';
import { BookOpen, X, ArrowRight, Clock, Sparkles, Square } from 'lucide-react';
import type { OffsetDetectResult } from '../utils/ocrOffsetDetector';
import { getDisplaySubjectName } from '../utils/bookResolver';

export interface LessonBannerData {
    periodName: string;
    periodTime?: string;
    subject: string;
    pageStr?: string;
    startPage?: number;
    endPage?: number;
    topic?: string;
    matchedBookId?: string;
    customMessage?: string;
}

export interface LessonTopicCenterBannerProps {
    isOpen: boolean;
    lesson: LessonBannerData | null;
    pageOffset?: number;
    totalPages?: number;
    ocrDetection?: OffsetDetectResult | null;
    onClose: (dismissKey: string) => void;
    onJumpToPage?: (targetBookId: string, printedPage: number, physicalPage: number) => void;
    onOpenBlankActivity?: (subject: string, topic: string, periodName: string) => void;
}

const DISMISSED_LESSONS_STORAGE_KEY = 'classbook_dismissed_lesson_banners_v1';

/**
 * Generates a deterministic key for a given date and lesson period so that
 * once dismissed by a student or teacher, the banner is not re-shown during the same period.
 */
export function createLessonDismissKey(
    dateKey: string,
    periodName: string,
    subject?: string,
    startPage?: number
): string {
    const cleanDate = (dateKey || '').trim() || new Date().toISOString().slice(0, 10);
    const cleanPeriod = (periodName || '수업').trim();
    const cleanSubject = (subject || '').trim();
    const pagePart = typeof startPage === 'number' && startPage > 0 ? String(startPage) : '0';
    return `${cleanDate}::${cleanPeriod}::${cleanSubject}::${pagePart}`;
}

export function getTodayDateKey(now: Date = new Date()): string {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function isLessonBannerDismissed(
    dismissKey: string,
    storage?: Pick<Storage, 'getItem'>
): boolean {
    if (!dismissKey) return false;
    try {
        const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
        if (!targetStorage) return false;
        const raw = targetStorage.getItem(DISMISSED_LESSONS_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.includes(dismissKey);
    } catch {
        return false;
    }
}

export function markLessonBannerDismissed(
    dismissKey: string,
    storage?: Pick<Storage, 'getItem' | 'setItem'>
): string[] {
    if (!dismissKey) return [];
    try {
        const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
        if (!targetStorage) return [dismissKey];
        const raw = targetStorage.getItem(DISMISSED_LESSONS_STORAGE_KEY);
        const existing: string[] = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(existing) ? existing : [];
        if (!list.includes(dismissKey)) {
            list.push(dismissKey);
        }
        const trimmed = list.slice(-50);
        targetStorage.setItem(DISMISSED_LESSONS_STORAGE_KEY, JSON.stringify(trimmed));
        return trimmed;
    } catch {
        return [dismissKey];
    }
}

/**
 * Resolves the physical PDF/image page index using the printed textbook page and OCR offset.
 */
export function resolvePhysicalPageWithOffset(
    printedPage: number,
    pageOffset: number = 0,
    totalPages: number = 0,
    ocrDetection?: OffsetDetectResult | null
): number {
    const safePrinted = Number.isFinite(printedPage) && printedPage > 0 ? Math.floor(printedPage) : 1;
    const effectiveOffset =
        ocrDetection && ocrDetection.detected && Number.isFinite(ocrDetection.offset)
            ? ocrDetection.offset
            : Number.isFinite(pageOffset)
            ? pageOffset
            : 0;
    const rawPhysical = safePrinted + effectiveOffset;
    if (totalPages > 0) {
        return Math.min(Math.max(1, rawPhysical), totalPages);
    }
    return Math.max(1, rawPhysical);
}

export function formatLessonPageLabel(lesson: LessonBannerData | null): string {
    if (!lesson) return '';
    if (lesson.pageStr && lesson.pageStr.trim().length > 0) {
        return lesson.pageStr.trim();
    }
    if (lesson.startPage && lesson.startPage > 0) {
        if (lesson.endPage && lesson.endPage > lesson.startPage) {
            return `${lesson.startPage}~${lesson.endPage}쪽`;
        }
        return `${lesson.startPage}쪽`;
    }
    return '활동 중심 수업';
}

export default function LessonTopicCenterBanner({
    isOpen,
    lesson,
    pageOffset = 0,
    totalPages = 0,
    ocrDetection = null,
    onClose,
    onJumpToPage,
    onOpenBlankActivity
}: LessonTopicCenterBannerProps) {
    const dismissKey = lesson
        ? createLessonDismissKey(
              getTodayDateKey(),
              lesson.periodName,
              lesson.subject,
              lesson.startPage
          )
        : '';

    useEffect(() => {
        if (!isOpen || !lesson) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                markLessonBannerDismissed(dismissKey);
                onClose(dismissKey);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, lesson, dismissKey, onClose]);

    if (!isOpen || !lesson) return null;

    const displaySubject = getDisplaySubjectName(lesson.subject, lesson.matchedBookId, [], undefined, lesson.topic);
    const printedPage = lesson.startPage && lesson.startPage > 0 ? lesson.startPage : 1;
    const physicalPage = resolvePhysicalPageWithOffset(
        printedPage,
        pageOffset,
        totalPages,
        ocrDetection
    );
    const pageLabel = formatLessonPageLabel(lesson);
    const isBlankLesson =
        lesson.matchedBookId === 'blank' ||
        (!lesson.matchedBookId && (!lesson.startPage || lesson.startPage <= 0));
    const targetBook = lesson.matchedBookId || displaySubject;

    const handleDismiss = () => {
        markLessonBannerDismissed(dismissKey);
        onClose(dismissKey);
    };

    const handleActionClick = () => {
        markLessonBannerDismissed(dismissKey);
        onClose(dismissKey);
        if (isBlankLesson) {
            onOpenBlankActivity?.(
                displaySubject || '활동',
                lesson.topic || '',
                lesson.periodName || '수업'
            );
        } else if (onJumpToPage && targetBook) {
            onJumpToPage(targetBook, printedPage, physicalPage);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="false"
            aria-label={`${lesson.periodName} 수업 안내 배너`}
            data-testid="lesson-topic-center-banner-overlay"
            className="fixed inset-0 z-[9500] flex items-center justify-center p-4 pointer-events-none"
        >
            <div
                data-testid="lesson-topic-center-banner-card"
                style={{ maxWidth: '460px' }}
                className="pointer-events-auto w-full max-w-[460px] rounded-3xl bg-slate-900/85 backdrop-blur-xl border-2 border-violet-400/70 shadow-[0_20px_60px_rgba(15,23,42,0.75)] text-white p-5 sm:p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
                {/* Subtle decorative top highlight */}
                <div className="absolute -top-20 -right-20 w-44 h-44 bg-violet-500/20 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

                {/* Top Header Row: Period Badge & Immediate Close Button */}
                <div className="flex items-center justify-between gap-2 mb-3.5 relative z-10">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/25 border border-violet-400/50 text-violet-200 text-xs sm:text-sm font-extrabold">
                        <Clock className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                        <span>{lesson.periodName}</span>
                        {lesson.periodTime && (
                            <span className="text-violet-300/90 font-semibold">
                                ({lesson.periodTime})
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleDismiss}
                        aria-label="배너 닫기"
                        data-testid="lesson-banner-close-x"
                        className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/15 transition-colors cursor-pointer flex items-center justify-center"
                        title="닫기 (ESC)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Subject & Page Row */}
                <div className="flex items-center justify-between gap-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl px-4 py-3 mb-3 relative z-10">
                    <div className="text-left min-w-0">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            오늘의 과목
                        </div>
                        <div
                            data-testid="lesson-banner-subject"
                            className="text-xl sm:text-2xl font-black text-white flex items-center gap-1.5 truncate break-keep"
                        >
                            <span className="truncate">{displaySubject || '수업'}</span>
                            <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
                        </div>
                    </div>

                    <div className="text-right shrink-0 bg-amber-500/15 border border-amber-400/50 rounded-xl px-3.5 py-1.5">
                        <div className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
                            교과서 쪽수
                        </div>
                        <div
                            data-testid="lesson-banner-page"
                            className="text-xl sm:text-2xl font-black text-amber-300 leading-tight"
                        >
                            {pageLabel}
                        </div>
                    </div>
                </div>

                {/* Learning Topic Section */}
                <div className="bg-slate-950/60 border border-violet-500/40 rounded-2xl px-4 py-3 mb-4 text-left relative z-10">
                    <div className="text-[11px] font-extrabold text-violet-300 uppercase tracking-wider mb-1">
                        학습 주제
                    </div>
                    <p
                        data-testid="lesson-banner-topic"
                        className="text-sm sm:text-base font-bold text-slate-100 leading-snug break-keep"
                    >
                        {lesson.topic || lesson.customMessage || `${lesson.subject} 수업을 시작합니다.`}
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-2.5 relative z-10">
                    {(onJumpToPage || onOpenBlankActivity) && (
                        <button
                            type="button"
                            onClick={handleActionClick}
                            data-testid="lesson-banner-jump-btn"
                            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-violet-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        >
                            {isBlankLesson ? (
                                <>
                                    <Square className="w-4 h-4 shrink-0" />
                                    <span>활동 화면 열기</span>
                                </>
                            ) : (
                                <>
                                    <BookOpen className="w-4 h-4 shrink-0" />
                                    <span>해당 쪽 바로 펼치기 ({pageLabel})</span>
                                </>
                            )}
                            <ArrowRight className="w-4 h-4 shrink-0" />
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleDismiss}
                        data-testid="lesson-banner-close-btn"
                        className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-extrabold text-sm transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    >
                        <span>닫힘</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

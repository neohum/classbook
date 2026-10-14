import React, { useEffect, useState } from 'react';
import {
    BookmarkPlus,
    BookmarkCheck,
    ChevronDown,
    ChevronUp,
    Sparkles,
    X,
    Edit3,
    BookOpen
} from 'lucide-react';
import {
    KNOWLEDGE_CATEGORY_LABELS,
    KNOWLEDGE_DIFFICULTY_LABELS,
    type CanvasRect,
    type KnowledgeAnnotation
} from '../types/knowledgeOverlay';
import { clampPopoverPosition } from '../utils/knowledgeTermMatcher';

export interface KnowledgePopoverCardProps {
    annotation: KnowledgeAnnotation | null;
    anchorRect: CanvasRect | null;
    viewportSize: { width: number; height: number };
    isInReviewQueue?: boolean;
    isTeacherMode?: boolean;
    initialExpanded?: boolean;
    onClose: () => void;
    onAddToReviewQueue: (annotation: KnowledgeAnnotation) => void;
    onEditAnnotation?: (annotation: KnowledgeAnnotation) => void;
}

const POPOVER_WIDTH = 360;
const POPOVER_COLLAPSED_HEIGHT = 230;
const POPOVER_EXPANDED_HEIGHT = 360;

export default function KnowledgePopoverCard({
    annotation,
    anchorRect,
    viewportSize,
    isInReviewQueue = false,
    isTeacherMode = false,
    initialExpanded = false,
    onClose,
    onAddToReviewQueue,
    onEditAnnotation
}: KnowledgePopoverCardProps) {
    const [isExpanded, setIsExpanded] = useState<boolean>(initialExpanded);

    useEffect(() => {
        setIsExpanded(initialExpanded);
    }, [annotation?.id, initialExpanded]);

    useEffect(() => {
        if (!annotation) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [annotation, onClose]);

    if (!annotation) return null;

    const effectiveAnchor: CanvasRect = anchorRect || {
        left: Math.round(viewportSize.width * annotation.bbox.x),
        top: Math.round(viewportSize.height * annotation.bbox.y),
        width: Math.max(48, Math.round(viewportSize.width * annotation.bbox.width)),
        height: Math.max(24, Math.round(viewportSize.height * annotation.bbox.height))
    };

    const estimatedHeight = isExpanded ? POPOVER_EXPANDED_HEIGHT : POPOVER_COLLAPSED_HEIGHT;
    const clampedPos = clampPopoverPosition(
        effectiveAnchor,
        { width: POPOVER_WIDTH, height: estimatedHeight },
        viewportSize,
        16
    );

    const categoryLabel = KNOWLEDGE_CATEGORY_LABELS[annotation.category] || '어휘';
    const difficultyLabel = KNOWLEDGE_DIFFICULTY_LABELS[annotation.difficulty] || '기초';

    const difficultyColorMap: Record<string, string> = {
        basic: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
        intermediate: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
        advanced: 'bg-rose-500/20 text-rose-300 border-rose-400/40'
    };

    return (
        <div
            role="dialog"
            aria-modal="false"
            aria-label={`${annotation.term} 뜻풀이 팝오버`}
            data-testid="knowledge-popover-card"
            data-placement={clampedPos.placement}
            style={{
                left: `${clampedPos.left}px`,
                top: `${clampedPos.top}px`,
                width: `${POPOVER_WIDTH}px`,
                maxWidth: 'calc(100vw - 32px)'
            }}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[9200] rounded-2xl bg-slate-900/95 backdrop-blur-xl border-2 border-violet-400/70 shadow-[0_18px_50px_rgba(15,23,42,0.85)] text-slate-100 p-4 pointer-events-auto transition-all duration-150"
        >
            {/* Header: Category, Part of Speech, Difficulty, Close */}
            <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                        data-testid="knowledge-popover-category"
                        className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-violet-500/25 text-violet-200 border border-violet-400/50"
                    >
                        {categoryLabel}
                    </span>
                    {annotation.partOfSpeech && (
                        <span className="text-xs font-semibold text-slate-400">
                            {annotation.partOfSpeech}
                        </span>
                    )}
                    <span
                        data-testid="knowledge-popover-difficulty"
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            difficultyColorMap[annotation.difficulty] || difficultyColorMap.basic
                        }`}
                    >
                        {difficultyLabel}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="뜻풀이 닫기"
                    data-testid="knowledge-popover-close"
                    className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Term Title */}
            <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <h4
                    data-testid="knowledge-popover-term"
                    className="text-lg font-black text-white tracking-tight break-keep"
                >
                    {annotation.term}
                </h4>
            </div>

            {/* Tier 1: Basic 1-2 line easy summary */}
            <div
                data-testid="knowledge-popover-basic-summary"
                className="bg-slate-800/85 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-100 leading-relaxed break-keep mb-3"
            >
                {annotation.basicSummary}
            </div>

            {/* Tier 2 Accordion: Deep Dive + Examples */}
            {isExpanded && (
                <div
                    data-testid="knowledge-popover-deep-dive"
                    className="bg-violet-950/40 border border-violet-500/40 rounded-xl px-3.5 py-3 mb-3 space-y-2 text-xs sm:text-sm text-slate-200 leading-relaxed break-keep animate-in fade-in duration-150"
                >
                    <div className="flex items-center gap-1.5 text-violet-300 font-extrabold text-xs">
                        <BookOpen className="w-3.5 h-3.5 shrink-0" />
                        <span>더 알아보기 (심화 해설)</span>
                    </div>
                    <p className="text-slate-200 font-medium">{annotation.deepDive}</p>
                    {annotation.examples && annotation.examples.length > 0 && (
                        <div className="pt-1.5 border-t border-violet-500/25">
                            <div className="text-[11px] font-bold text-amber-300 mb-1">
                                교과서 예문·활용
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-300">
                                {annotation.examples.map((ex, idx) => (
                                    <li key={idx} className="break-keep">
                                        {ex}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Footer Action Buttons (Center-aligned) */}
            <div className="flex items-center justify-center gap-2 pt-1">
                <button
                    type="button"
                    onClick={() => setIsExpanded((prev) => !prev)}
                    data-testid="knowledge-popover-toggle-deep"
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-violet-200 border border-slate-600 font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                >
                    <span>{isExpanded ? '간단히 보기' : '더 알아보기'}</span>
                    {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => onAddToReviewQueue(annotation)}
                    data-testid="knowledge-popover-save-review"
                    className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                        isInReviewQueue
                            ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white border border-emerald-400/50'
                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-600/30'
                    }`}
                >
                    {isInReviewQueue ? (
                        <>
                            <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>복습 큐에 담김</span>
                        </>
                    ) : (
                        <>
                            <BookmarkPlus className="w-3.5 h-3.5 shrink-0" />
                            <span>다음에 보기 담기</span>
                        </>
                    )}
                </button>

                {isTeacherMode && onEditAnnotation && (
                    <button
                        type="button"
                        onClick={() => onEditAnnotation(annotation)}
                        data-testid="knowledge-popover-edit-btn"
                        className="py-2 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/50 font-bold text-xs transition-all flex items-center justify-center cursor-pointer"
                        title="주석 편집"
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}

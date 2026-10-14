import React, { useRef } from 'react';
import { Sparkles, PlusCircle } from 'lucide-react';
import {
    KNOWLEDGE_CATEGORY_LABELS,
    type CanvasRect,
    type KnowledgeAnnotation,
    type NormalizedBBox
} from '../types/knowledgeOverlay';
import { canvasRectToNormalizedBBox } from '../utils/knowledgeTermMatcher';

export interface KnowledgeOverlayLayerProps {
    enabled: boolean;
    pageNumber: number;
    annotations: KnowledgeAnnotation[];
    activeAnnotationId?: string | null;
    isDrawingMode?: boolean;
    isTeacherMode?: boolean;
    scale?: number;
    onSelectAnnotation: (annotation: KnowledgeAnnotation, anchorRect: CanvasRect) => void;
    onRequestCreateAtBBox?: (pageNumber: number, bbox: NormalizedBBox) => void;
}

export default function KnowledgeOverlayLayer({
    enabled,
    pageNumber,
    annotations,
    activeAnnotationId = null,
    isDrawingMode = false,
    isTeacherMode = false,
    scale = 1,
    onSelectAnnotation,
    onRequestCreateAtBBox
}: KnowledgeOverlayLayerProps) {
    const layerRef = useRef<HTMLDivElement>(null);

    if (!enabled && !isTeacherMode) {
        return null;
    }

    const pageAnnotations = annotations.filter((item) => item.pageNumber === pageNumber);

    const handleLayerClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isTeacherMode || isDrawingMode || !onRequestCreateAtBBox) return;
        const container = layerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const defaultW = Math.min(rect.width * 0.16, 140);
        const defaultH = Math.min(rect.height * 0.048, 36);

        const normalized = canvasRectToNormalizedBBox(
            {
                left: Math.max(0, clickX - defaultW / 2),
                top: Math.max(0, clickY - defaultH / 2),
                width: defaultW,
                height: defaultH
            },
            rect.width / scale,
            rect.height / scale,
            scale
        );
        onRequestCreateAtBBox(pageNumber, normalized);
    };

    const categoryBadgeStyles: Record<string, string> = {
        vocabulary:
            'bg-violet-600/20 hover:bg-violet-600/35 border-violet-400/80 text-violet-950 dark:text-violet-100',
        symbol:
            'bg-amber-500/20 hover:bg-amber-500/35 border-amber-400/80 text-amber-950 dark:text-amber-100',
        concept:
            'bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-400/80 text-emerald-950 dark:text-emerald-100',
        background:
            'bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/80 text-sky-950 dark:text-sky-100'
    };

    return (
        <div
            ref={layerRef}
            data-testid={`knowledge-overlay-layer-p${pageNumber}`}
            onClick={handleLayerClick}
            className={`absolute inset-0 z-20 select-none ${
                isDrawingMode
                    ? 'pointer-events-none'
                    : isTeacherMode
                    ? 'pointer-events-auto cursor-copy'
                    : 'pointer-events-none'
            }`}
        >
            {isTeacherMode && (
                <div className="absolute top-2 left-2 z-30 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/90 text-slate-950 font-extrabold text-[11px] shadow-md pointer-events-none">
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>교사 편집: 페이지 원하는 위치를 클릭해 지식 노트 추가</span>
                </div>
            )}

            {pageAnnotations.map((annotation) => {
                const isSelected = activeAnnotationId === annotation.id;
                const badgeStyle =
                    categoryBadgeStyles[annotation.category] || categoryBadgeStyles.vocabulary;

                return (
                    <button
                        key={annotation.id}
                        type="button"
                        data-testid={`knowledge-hotspot-${annotation.id}`}
                        data-term={annotation.term}
                        aria-label={`${annotation.term} (${KNOWLEDGE_CATEGORY_LABELS[annotation.category]}) 설명 보기`}
                        style={{
                            left: `${(annotation.bbox.x * 100).toFixed(3)}%`,
                            top: `${(annotation.bbox.y * 100).toFixed(3)}%`,
                            width: `${(annotation.bbox.width * 100).toFixed(3)}%`,
                            height: `${(annotation.bbox.height * 100).toFixed(3)}%`,
                            minWidth: '64px',
                            minHeight: '26px'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            const btnRect = e.currentTarget.getBoundingClientRect();
                            onSelectAnnotation(annotation, {
                                left: btnRect.left,
                                top: btnRect.top,
                                width: btnRect.width,
                                height: btnRect.height
                            });
                        }}
                        className={`absolute pointer-events-auto rounded-lg border-b-2 border-dashed transition-all duration-150 flex items-center justify-center px-1.5 py-0.5 shadow-sm group cursor-pointer ${badgeStyle} ${
                            isSelected
                                ? 'ring-2 ring-violet-400 bg-violet-600/35 scale-[1.03]'
                                : 'hover:scale-[1.02]'
                        }`}
                    >
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/85 text-white text-[11px] font-extrabold shadow-md whitespace-nowrap">
                            <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                            <span>{annotation.term}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

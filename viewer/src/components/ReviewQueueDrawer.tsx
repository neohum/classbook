import React, { useState } from 'react';
import {
    Bookmark,
    CheckCircle2,
    Circle,
    Trash2,
    ArrowUpRight,
    X,
    BookOpen
} from 'lucide-react';
import {
    KNOWLEDGE_CATEGORY_LABELS,
    type ReviewQueueItem
} from '../types/knowledgeOverlay';
import {
    filterReviewQueueItems,
    type ReviewFilterStatus
} from '../hooks/useReviewQueue';

export interface ReviewQueueDrawerProps {
    isOpen: boolean;
    bookId?: string;
    items: ReviewQueueItem[];
    onClose: () => void;
    onToggleComplete: (itemId: string) => void;
    onRemoveItem: (itemId: string) => void;
    onJumpToReviewItem: (item: ReviewQueueItem) => void;
}

export default function ReviewQueueDrawer({
    isOpen,
    bookId,
    items,
    onClose,
    onToggleComplete,
    onRemoveItem,
    onJumpToReviewItem
}: ReviewQueueDrawerProps) {
    const [statusFilter, setStatusFilter] = useState<ReviewFilterStatus>('all');

    if (!isOpen) return null;

    const filteredItems = filterReviewQueueItems(items, {
        bookId,
        status: statusFilter
    });

    const bookScopedAll = filterReviewQueueItems(items, { bookId, status: 'all' });
    const pendingCount = bookScopedAll.filter((it) => !it.completed).length;
    const completedCount = bookScopedAll.filter((it) => it.completed).length;

    return (
        <div
            role="dialog"
            aria-modal="false"
            aria-label="다음에 보기 복습 큐 서랍"
            data-testid="review-queue-drawer"
            className="fixed inset-y-0 right-0 z-[9400] w-full max-w-sm bg-slate-900/95 backdrop-blur-2xl border-l border-slate-700/80 shadow-[-16px_0_50px_rgba(15,23,42,0.85)] text-slate-100 flex flex-col pointer-events-auto animate-in slide-in-from-right duration-200"
        >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-left">
                    <div className="w-8 h-8 rounded-xl bg-violet-600/25 border border-violet-400/50 flex items-center justify-center text-violet-300">
                        <Bookmark className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-white leading-tight">
                            다음에 보기 복습 큐
                        </h3>
                        <p className="text-xs text-slate-400">
                            남은 복습 {pendingCount}개 &middot; 완료 {completedCount}개
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="복습 큐 닫기"
                    data-testid="review-queue-close"
                    className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="px-5 py-2.5 border-b border-slate-800/80 flex items-center gap-1.5">
                {(
                    [
                        { key: 'all', label: `전체 (${bookScopedAll.length})` },
                        { key: 'pending', label: `복습 전 (${pendingCount})` },
                        { key: 'completed', label: `완료 (${completedCount})` }
                    ] as const
                ).map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        data-testid={`review-filter-${tab.key}`}
                        onClick={() => setStatusFilter(tab.key)}
                        className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center cursor-pointer ${
                            statusFilter === tab.key
                                ? 'bg-violet-600 text-white shadow-sm'
                                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-left">
                {filteredItems.length === 0 ? (
                    <div
                        data-testid="review-queue-empty"
                        className="h-56 flex flex-col items-center justify-center text-center px-6 text-slate-400"
                    >
                        <BookOpen className="w-10 h-10 text-slate-600 mb-2" />
                        <p className="text-sm font-bold text-slate-300 mb-1 break-keep">
                            아직 담아둔 복습 어휘·기호가 없습니다.
                        </p>
                        <p className="text-xs text-slate-500 break-keep">
                            교과서의 지식 배지를 눌러 ‘다음에 보기 담기’를 선택해 보세요.
                        </p>
                    </div>
                ) : (
                    filteredItems.map((item) => (
                        <div
                            key={item.id}
                            data-testid={`review-queue-item-${item.id}`}
                            className={`rounded-2xl border p-3.5 transition-all ${
                                item.completed
                                    ? 'bg-slate-900/60 border-slate-800 opacity-75'
                                    : 'bg-slate-800/90 border-slate-700/80 hover:border-violet-400/60 shadow-md'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-200 text-[11px] font-extrabold">
                                        {KNOWLEDGE_CATEGORY_LABELS[item.category] || '어휘'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-extrabold">
                                        {item.pageNumber}쪽
                                    </span>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => onToggleComplete(item.id)}
                                        data-testid={`review-toggle-${item.id}`}
                                        aria-label={item.completed ? '미완료로 변경' : '학습 완료 체크'}
                                        className={`p-1 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                                            item.completed
                                                ? 'text-emerald-400 hover:bg-emerald-500/15'
                                                : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-700'
                                        }`}
                                        title={item.completed ? '완료됨 (클릭 시 해제)' : '학습 완료 체크'}
                                    >
                                        {item.completed ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                        ) : (
                                            <Circle className="w-4 h-4" />
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onRemoveItem(item.id)}
                                        data-testid={`review-remove-${item.id}`}
                                        aria-label="복습 큐에서 삭제"
                                        className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors cursor-pointer flex items-center justify-center"
                                        title="삭제"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <h4
                                className={`text-sm font-black mb-1 break-keep ${
                                    item.completed ? 'line-through text-slate-400' : 'text-white'
                                }`}
                            >
                                {item.term}
                            </h4>

                            <p className="text-xs text-slate-300 leading-relaxed break-keep mb-3">
                                {item.basicSummary}
                            </p>

                            <button
                                type="button"
                                onClick={() => onJumpToReviewItem(item)}
                                data-testid={`review-jump-${item.id}`}
                                className="w-full py-2 px-3 rounded-xl bg-slate-900/90 hover:bg-violet-600/80 text-violet-200 hover:text-white border border-slate-700 hover:border-violet-400 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <span>{item.pageNumber}쪽 본문 위치로 바로 이동</span>
                                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

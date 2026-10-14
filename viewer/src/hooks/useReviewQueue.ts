import { useState, useEffect, useCallback } from 'react';
import type { KnowledgeAnnotation, ReviewQueueItem } from '../types/knowledgeOverlay';
import { LoadReviewQueue, SaveReviewQueue } from '../../wailsjs/go/main/App';

export const REVIEW_QUEUE_STORAGE_KEY = 'classbook_review_queue_v1';

export type ReviewFilterStatus = 'all' | 'pending' | 'completed';

export function loadReviewQueueFromStorage(
    storage?: Pick<Storage, 'getItem'>
): ReviewQueueItem[] {
    try {
        const target =
            storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
        if (!target) return [];
        const raw = target.getItem(REVIEW_QUEUE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (item): item is ReviewQueueItem =>
                Boolean(
                    item &&
                        typeof item.id === 'string' &&
                        typeof item.bookId === 'string' &&
                        typeof item.pageNumber === 'number' &&
                        typeof item.term === 'string'
                )
        );
    } catch {
        return [];
    }
}

export function saveReviewQueueToStorage(
    items: ReviewQueueItem[],
    storage?: Pick<Storage, 'setItem'>
): void {
    const serialized = JSON.stringify(items);
    try {
        const target =
            storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
        if (target) {
            target.setItem(REVIEW_QUEUE_STORAGE_KEY, serialized);
        }
    } catch {
        // Ignore storage quota errors
    }

    try {
        SaveReviewQueue(serialized).catch(() => {});
    } catch {
        // Ignore if Wails runtime is not active
    }
}

export function addAnnotationToReviewQueue(
    currentItems: ReviewQueueItem[],
    annotation: KnowledgeAnnotation,
    nowIso: string = new Date().toISOString()
): { items: ReviewQueueItem[]; added: boolean; item: ReviewQueueItem } {
    const existingIdx = currentItems.findIndex(
        (it) =>
            it.annotationId === annotation.id ||
            (it.bookId === annotation.bookId &&
                it.pageNumber === annotation.pageNumber &&
                it.term === annotation.term)
    );

    if (existingIdx >= 0) {
        const existing = currentItems[existingIdx];
        return { items: currentItems, added: false, item: existing };
    }

    const newItem: ReviewQueueItem = {
        id: `rq-${annotation.bookId}-p${annotation.pageNumber}-${annotation.id}`,
        annotationId: annotation.id,
        bookId: annotation.bookId,
        pageNumber: annotation.pageNumber,
        term: annotation.term,
        category: annotation.category,
        partOfSpeech: annotation.partOfSpeech,
        difficulty: annotation.difficulty,
        basicSummary: annotation.basicSummary,
        deepDive: annotation.deepDive,
        bbox: { ...annotation.bbox },
        completed: false,
        savedAt: nowIso
    };

    const nextItems = [newItem, ...currentItems];
    return { items: nextItems, added: true, item: newItem };
}

export function toggleReviewQueueItemCompleted(
    currentItems: ReviewQueueItem[],
    itemId: string,
    nowIso: string = new Date().toISOString()
): ReviewQueueItem[] {
    return currentItems.map((it) => {
        if (it.id !== itemId && it.annotationId !== itemId) return it;
        const nextCompleted = !it.completed;
        return {
            ...it,
            completed: nextCompleted,
            completedAt: nextCompleted ? nowIso : undefined
        };
    });
}

export function removeReviewQueueItem(
    currentItems: ReviewQueueItem[],
    itemId: string
): ReviewQueueItem[] {
    return currentItems.filter((it) => it.id !== itemId && it.annotationId !== itemId);
}

export function filterReviewQueueItems(
    items: ReviewQueueItem[],
    options: { bookId?: string; status?: ReviewFilterStatus } = {}
): ReviewQueueItem[] {
    const { bookId, status = 'all' } = options;
    return items.filter((item) => {
        if (bookId && item.bookId !== bookId) return false;
        if (status === 'pending' && item.completed) return false;
        if (status === 'completed' && !item.completed) return false;
        return true;
    });
}

export function useReviewQueue(currentBookId?: string) {
    const [items, setItems] = useState<ReviewQueueItem[]>(() => loadReviewQueueFromStorage());

    useEffect(() => {
        let mounted = true;
        LoadReviewQueue()
            .then((raw) => {
                if (!mounted || !raw) return;
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setItems((prev) => {
                        if (prev.length === 0) {
                            saveReviewQueueToStorage(parsed);
                            return parsed;
                        }
                        return prev;
                    });
                }
            })
            .catch(() => {});
        return () => {
            mounted = false;
        };
    }, []);

    const addToQueue = useCallback((annotation: KnowledgeAnnotation) => {
        let wasAdded = false;
        setItems((prev) => {
            const result = addAnnotationToReviewQueue(prev, annotation);
            wasAdded = result.added;
            saveReviewQueueToStorage(result.items);
            return result.items;
        });
        return wasAdded;
    }, []);

    const toggleComplete = useCallback((itemId: string) => {
        setItems((prev) => {
            const next = toggleReviewQueueItemCompleted(prev, itemId);
            saveReviewQueueToStorage(next);
            return next;
        });
    }, []);

    const removeItem = useCallback((itemId: string) => {
        setItems((prev) => {
            const next = removeReviewQueueItem(prev, itemId);
            saveReviewQueueToStorage(next);
            return next;
        });
    }, []);

    const isAnnotationSaved = useCallback(
        (annotationId: string) =>
            items.some((it) => it.annotationId === annotationId || it.id === annotationId),
        [items]
    );

    const bookItems = currentBookId
        ? items.filter((it) => it.bookId === currentBookId)
        : items;

    return {
        items,
        bookItems,
        pendingCount: bookItems.filter((it) => !it.completed).length,
        completedCount: bookItems.filter((it) => it.completed).length,
        addToQueue,
        toggleComplete,
        removeItem,
        isAnnotationSaved
    };
}

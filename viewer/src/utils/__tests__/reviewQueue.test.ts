import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    addAnnotationToReviewQueue,
    filterReviewQueueItems,
    loadReviewQueueFromStorage,
    removeReviewQueueItem,
    saveReviewQueueToStorage,
    toggleReviewQueueItemCompleted
} from '../../hooks/useReviewQueue';
import ReviewQueueDrawer from '../../components/ReviewQueueDrawer';
import {
    deleteTeacherAnnotation,
    upsertTeacherAnnotation
} from '../../components/TeacherAnnotationModal';
import {
    deserializeKnowledgeBundle,
    serializeKnowledgeBundle
} from '../knowledgeTermMatcher';
import type { KnowledgeAnnotation } from '../../types/knowledgeOverlay';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

describe('Step 4: ReviewQueueDrawer & TeacherAnnotationModal CRUD/Bundle', () => {
    const sampleAnnotation: KnowledgeAnnotation = {
        id: 'ann-math-fraction',
        bookId: '수학3-1',
        pageNumber: 54,
        term: '분수',
        category: 'symbol',
        partOfSpeech: '수식·기호',
        difficulty: 'basic',
        basicSummary: '전체 1을 똑같이 나눈 것 중의 몇인지를 나타낸 수예요.',
        deepDive: '가로선 아래의 수를 분모, 가로선 위의 수를 분자라고 합니다.',
        bbox: { x: 0.22, y: 0.42, width: 0.14, height: 0.045 }
    };

    it('AC-1: adds annotation to review queue, persists to storage, toggles completion, and renders jump button in ReviewQueueDrawer', () => {
        const firstAdd = addAnnotationToReviewQueue([], sampleAnnotation, '2026-10-14T09:00:00.000Z');
        expect(firstAdd.added).toBe(true);
        expect(firstAdd.items).toHaveLength(1);

        // Deduplicates same annotation
        const duplicateAdd = addAnnotationToReviewQueue(firstAdd.items, sampleAnnotation);
        expect(duplicateAdd.added).toBe(false);
        expect(duplicateAdd.items).toHaveLength(1);

        // Storage persistence round-trip
        saveReviewQueueToStorage(firstAdd.items);
        const loaded = loadReviewQueueFromStorage();
        expect(loaded).toHaveLength(1);
        expect(loaded[0].term).toBe('분수');
        expect(loaded[0].pageNumber).toBe(54);

        // Render ReviewQueueDrawer with item
        const drawerHtml = renderToStaticMarkup(
            React.createElement(ReviewQueueDrawer, {
                isOpen: true,
                bookId: '수학3-1',
                items: loaded,
                onClose: () => {},
                onToggleComplete: () => {},
                onRemoveItem: () => {},
                onJumpToReviewItem: () => {}
            })
        );
        expect(drawerHtml).toContain('다음에 보기 복습 큐');
        expect(drawerHtml).toContain('54쪽 본문 위치로 바로 이동');

        // Toggle completion and filter
        const toggled = toggleReviewQueueItemCompleted(loaded, loaded[0].id, '2026-10-14T10:00:00.000Z');
        expect(toggled[0].completed).toBe(true);
        expect(filterReviewQueueItems(toggled, { bookId: '수학3-1', status: 'completed' })).toHaveLength(1);
        expect(filterReviewQueueItems(toggled, { bookId: '수학3-1', status: 'pending' })).toHaveLength(0);

        // Remove item
        const afterRemove = removeReviewQueueItem(toggled, loaded[0].id);
        expect(afterRemove).toHaveLength(0);
    });

    it('AC-2: creates, edits, deletes teacher annotations and exports/imports .cbk-notes.json bundle', () => {
        const created = upsertTeacherAnnotation([], {
            id: 'teacher-note-1',
            bookId: '사회4-1',
            pageNumber: 28,
            term: '문화유산',
            category: 'background',
            partOfSpeech: '배경지식',
            difficulty: 'basic',
            basicSummary: '조상들이 물려준 소중한 문화적 보물이에요.',
            deepDive: '유형문화유산과 무형문화유산으로 나뉩니다.',
            examplesText: '첨성대\n훈민정음',
            bbox: { x: 0.3, y: 0.4, width: 0.16, height: 0.05 }
        });

        expect(created.errors).toHaveLength(0);
        expect(created.annotations).toHaveLength(1);
        expect(created.saved?.examples).toEqual(['첨성대', '훈민정음']);

        // Export to .cbk-notes.json and import back
        const bundleJson = serializeKnowledgeBundle('사회4-1', created.annotations);
        const imported = deserializeKnowledgeBundle(bundleJson);
        expect(imported.valid).toBe(true);
        expect(imported.bundle?.annotations).toHaveLength(1);
        expect(imported.bundle?.annotations[0].term).toBe('문화유산');

        // Delete annotation
        const remaining = deleteTeacherAnnotation(created.annotations, 'teacher-note-1');
        expect(remaining).toHaveLength(0);
    });
});

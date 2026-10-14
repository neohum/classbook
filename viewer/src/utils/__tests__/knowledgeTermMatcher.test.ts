import {
    canvasRectToNormalizedBBox,
    clampPopoverPosition,
    deserializeKnowledgeBundle,
    matchKnowledgeTermsFromTokens,
    normalizedBBoxToCanvasRect,
    serializeKnowledgeBundle,
    validateKnowledgeAnnotation,
    validateNormalizedBBox
} from '../knowledgeTermMatcher';
import type { KnowledgeAnnotation, OcrTextToken } from '../../types/knowledgeOverlay';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

describe('Step 2: KnowledgeAnnotation Schema, Coordinate Transform & Term Matcher', () => {
    it('AC-1: validates, serializes, and deserializes KnowledgeAnnotation and KnowledgeBundle', () => {
        const validItem: KnowledgeAnnotation = {
            id: 'ann-1',
            bookId: '국어4-1',
            pageNumber: 12,
            term: '중심생각',
            category: 'concept',
            partOfSpeech: '핵심개념',
            difficulty: 'basic',
            basicSummary: '문단에서 글쓴이가 가장 말하고 싶은 핵심 내용이에요.',
            deepDive: '중심 문장과 뒷받침 문장을 구분하면 중심생각을 쉽게 찾을 수 있습니다.',
            examples: ['첫째 문단의 중심생각을 찾아봅시다.'],
            bbox: { x: 0.15, y: 0.25, width: 0.18, height: 0.05 },
            createdBy: 'teacher'
        };

        const check = validateKnowledgeAnnotation(validItem);
        expect(check.valid).toBe(true);
        expect(check.errors).toHaveLength(0);

        const serialized = serializeKnowledgeBundle('국어4-1', [validItem], '2026-10-14T00:00:00.000Z');
        const restored = deserializeKnowledgeBundle(serialized);

        expect(restored.valid).toBe(true);
        expect(restored.bundle?.bookId).toBe('국어4-1');
        expect(restored.bundle?.annotations).toHaveLength(1);
        expect(restored.bundle?.annotations[0].term).toBe('중심생각');
        expect(restored.bundle?.annotations[0].bbox.x).toBe(0.15);
    });

    it('AC-1: rejects out-of-range normalized coordinates and missing required fields', () => {
        expect(validateNormalizedBBox({ x: -0.1, y: 0.2, width: 0.2, height: 0.1 })).toBe(false);
        expect(validateNormalizedBBox({ x: 0.85, y: 0.2, width: 0.3, height: 0.1 })).toBe(false);
        expect(validateNormalizedBBox({ x: 0.2, y: 0.2, width: 0, height: 0.1 })).toBe(false);

        const invalidResult = validateKnowledgeAnnotation({
            id: '',
            bookId: '수학',
            pageNumber: 0,
            term: '',
            category: 'invalid_cat',
            difficulty: 'basic',
            basicSummary: '',
            deepDive: '설명',
            bbox: { x: 0.9, y: 0.9, width: 0.3, height: 0.3 }
        });
        expect(invalidResult.valid).toBe(false);
        expect(invalidResult.errors.length).toBeGreaterThan(3);
    });

    it('AC-2: converts normalized [0.0~1.0] coordinates to canvas pixels and back without drift across zoom/resize', () => {
        const bbox = { x: 0.25, y: 0.4, width: 0.15, height: 0.05 };

        // Base 1000x1400 canvas at scale 1.0
        const rect1 = normalizedBBoxToCanvasRect(bbox, 1000, 1400, 1.0);
        expect(rect1).toEqual({ left: 250, top: 560, width: 150, height: 70 });

        // Zoomed 1.5x
        const rectZoomed = normalizedBBoxToCanvasRect(bbox, 1000, 1400, 1.5);
        expect(rectZoomed).toEqual({ left: 375, top: 840, width: 225, height: 105 });

        // Round-trip back to normalized BBox
        const roundTrip = canvasRectToNormalizedBBox(rectZoomed, 1000, 1400, 1.5);
        expect(roundTrip).toEqual(bbox);
    });

    it('clamps popover position inside viewport edges when hotspot is near right or bottom boundary', () => {
        const nearBottomRight = clampPopoverPosition(
            { left: 1200, top: 740, width: 60, height: 30 },
            { width: 360, height: 240 },
            { width: 1280, height: 800 },
            16
        );
        expect(nearBottomRight.left).toBeLessThanOrEqual(1280 - 360 - 16);
        expect(nearBottomRight.top).toBeLessThanOrEqual(800 - 240 - 16);
        expect(nearBottomRight.placement).toBe('top');
    });

    it('matches curriculum terms and math symbols from OCR tokens automatically', () => {
        const tokens: OcrTextToken[] = [
            {
                text: '오늘 배울 문단의 중심생각을 찾아봅시다.',
                pageNumber: 14,
                bbox: { x: 0.12, y: 0.18, width: 0.22, height: 0.04 }
            },
            {
                text: '식물의 잎에서 일어나는 광합성 과정',
                pageNumber: 14,
                bbox: { x: 0.45, y: 0.52, width: 0.2, height: 0.04 }
            }
        ];

        const matched = matchKnowledgeTermsFromTokens('과학5-1', tokens);
        expect(matched).toHaveLength(2);
        expect(matched[0].term).toBe('중심생각');
        expect(matched[1].term).toBe('광합성');
        expect(matched[1].bbox).toEqual({ x: 0.45, y: 0.52, width: 0.2, height: 0.04 });
    });
});

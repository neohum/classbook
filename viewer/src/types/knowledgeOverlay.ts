export type KnowledgeCategory = 'vocabulary' | 'symbol' | 'concept' | 'background';

export type KnowledgeDifficulty = 'basic' | 'intermediate' | 'advanced';

/**
 * Normalized bounding box in page-relative coordinates (0.0 to 1.0).
 */
export interface NormalizedBBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Pixel-space rectangle relative to the rendered page canvas/image container.
 */
export interface CanvasRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface KnowledgeAnnotation {
    id: string;
    bookId: string;
    pageNumber: number;
    term: string;
    category: KnowledgeCategory;
    partOfSpeech?: string;
    difficulty: KnowledgeDifficulty;
    basicSummary: string;
    deepDive: string;
    examples?: string[];
    bbox: NormalizedBBox;
    createdBy?: 'system' | 'teacher';
    updatedAt?: string;
}

export interface KnowledgeBundle {
    schemaVersion: number;
    bookId: string;
    exportedAt: string;
    annotations: KnowledgeAnnotation[];
}

export interface ReviewQueueItem {
    id: string;
    annotationId: string;
    bookId: string;
    pageNumber: number;
    term: string;
    category: KnowledgeCategory;
    partOfSpeech?: string;
    difficulty: KnowledgeDifficulty;
    basicSummary: string;
    deepDive: string;
    bbox: NormalizedBBox;
    completed: boolean;
    savedAt: string;
    completedAt?: string;
}

export interface OcrTextToken {
    text: string;
    pageNumber: number;
    bbox: NormalizedBBox;
}

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
    vocabulary: '어휘',
    symbol: '수식·기호',
    concept: '핵심개념',
    background: '배경지식'
};

export const KNOWLEDGE_DIFFICULTY_LABELS: Record<KnowledgeDifficulty, string> = {
    basic: '기초',
    intermediate: '보통',
    advanced: '심화'
};

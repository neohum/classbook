import type {
    CanvasRect,
    KnowledgeAnnotation,
    KnowledgeBundle,
    KnowledgeCategory,
    KnowledgeDifficulty,
    NormalizedBBox,
    OcrTextToken
} from '../types/knowledgeOverlay';

export interface LexiconEntry {
    term: string;
    aliases?: string[];
    category: KnowledgeCategory;
    partOfSpeech: string;
    difficulty: KnowledgeDifficulty;
    basicSummary: string;
    deepDive: string;
    examples?: string[];
    defaultBBox?: NormalizedBBox;
}

export const DEFAULT_CURRICULUM_LEXICON: LexiconEntry[] = [
    {
        term: '중심생각',
        aliases: ['중심 생각', '주제문'],
        category: 'concept',
        partOfSpeech: '핵심개념',
        difficulty: 'basic',
        basicSummary: '글쓴이가 글이나 문단에서 가장 말하고 싶어 하는 핵심 내용이에요.',
        deepDive: '문단마다 가장 중요한 문장을 중심 문장이라고 하고, 이를 뒷받침하는 설명이나 예시를 뒷받침 문장이라고 합니다.',
        examples: ['첫째 문단의 중심생각을 찾아 밑줄을 그어 봅시다.'],
        defaultBBox: { x: 0.14, y: 0.18, width: 0.16, height: 0.045 }
    },
    {
        term: '비유',
        aliases: ['비유적 표현', '직유', '은유'],
        category: 'vocabulary',
        partOfSpeech: '명사·문학용어',
        difficulty: 'intermediate',
        basicSummary: '어떤 현상이나 사물을 비슷한 다른 사물에 빗대어 표현하는 방법이에요.',
        deepDive: '‘~처럼’, ‘~같이’를 사용하여 직접 빗대는 직유법과 ‘내 마음은 호수요’처럼 은근히 빗대는 은유법이 있습니다.',
        examples: ['구름이 솜사탕처럼 폭신해 보인다.'],
        defaultBBox: { x: 0.56, y: 0.26, width: 0.14, height: 0.045 }
    },
    {
        term: '분수',
        aliases: ['진분수', '가분수', '대분수', '÷'],
        category: 'symbol',
        partOfSpeech: '수식·기호',
        difficulty: 'basic',
        basicSummary: '전체 1을 똑같이 나눈 것 중의 몇 부분인지를 가로선 위아래 숫자로 나타낸 수예요.',
        deepDive: '가로선 아래의 수를 분모(전체를 똑같이 나눈 수), 가로선 위의 수를 분자(그중 색칠하거나 선택한 수)라고 부릅니다. 나눗셈 기호(÷)와 깊은 관련이 있어요.',
        examples: ['피자 한 판을 4조각으로 똑같이 나눈 것 중 1조각은 1/4입니다.'],
        defaultBBox: { x: 0.22, y: 0.42, width: 0.13, height: 0.045 }
    },
    {
        term: '등호(=)와 부등호(>, <)',
        aliases: ['등호', '부등호', '≥', '≤'],
        category: 'symbol',
        partOfSpeech: '수식·기호',
        difficulty: 'basic',
        basicSummary: '두 수나 식의 크기가 같음(=) 또는 어느 쪽이 더 큰지(>, <)를 나타내는 기호예요.',
        deepDive: '등호(=)는 양쪽의 값이 같다는 뜻이고, 부등호(>, <)는 입이 벌어진 쪽의 수가 더 크다는 뜻입니다.',
        examples: ['3 + 4 = 7', '12 > 9'],
        defaultBBox: { x: 0.62, y: 0.48, width: 0.2, height: 0.045 }
    },
    {
        term: '광합성',
        aliases: ['엽록체', '증산 작용'],
        category: 'concept',
        partOfSpeech: '과학개념',
        difficulty: 'intermediate',
        basicSummary: '식물이 햇빛과 물, 이산화탄소를 이용해 스스로 양분(녹말)과 산소를 만드는 과정이에요.',
        deepDive: '식물의 잎에 있는 엽록체에서 일어나며, 낮에 빛을 받아 포도당을 합성하고 우리가 숨 쉬는 데 필요한 산소를 공기 중으로 내보냅니다.',
        examples: ['식물은 빛이 잘 드는 곳에서 광합성을 활발하게 합니다.'],
        defaultBBox: { x: 0.18, y: 0.64, width: 0.15, height: 0.045 }
    },
    {
        term: '문화유산',
        aliases: ['유형문화유산', '무형문화유산'],
        category: 'background',
        partOfSpeech: '배경지식',
        difficulty: 'basic',
        basicSummary: '조상들이 만들어 오늘날까지 전해 내려오는 소중한 문화적 보물이에요.',
        deepDive: '절이나 탑, 책처럼 형태가 있는 유형문화유산과 탈춤, 판소리, 김장 문화처럼 형태가 없는 기술·예술인 무형문화유산으로 나뉩니다.',
        examples: ['훈민정음과 첨성대는 자랑스러운 우리의 문화유산입니다.'],
        defaultBBox: { x: 0.54, y: 0.72, width: 0.16, height: 0.045 }
    }
];

const VALID_CATEGORIES: Set<KnowledgeCategory> = new Set([
    'vocabulary',
    'symbol',
    'concept',
    'background'
]);

const VALID_DIFFICULTIES: Set<KnowledgeDifficulty> = new Set([
    'basic',
    'intermediate',
    'advanced'
]);

export function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

export function validateNormalizedBBox(bbox: unknown): bbox is NormalizedBBox {
    if (!bbox || typeof bbox !== 'object') return false;
    const candidate = bbox as Record<string, unknown>;
    const { x, y, width, height } = candidate;
    if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        typeof width !== 'number' ||
        typeof height !== 'number'
    ) {
        return false;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
        return false;
    }
    if (x < 0 || x > 1 || y < 0 || y > 1) return false;
    if (width <= 0 || width > 1 || height <= 0 || height > 1) return false;
    if (x + width > 1.0001 || y + height > 1.0001) return false;
    return true;
}

export function validateKnowledgeAnnotation(input: unknown): {
    valid: boolean;
    errors: string[];
    annotation?: KnowledgeAnnotation;
} {
    const errors: string[] = [];
    if (!input || typeof input !== 'object') {
        return { valid: false, errors: ['Annotation must be an object'] };
    }
    const obj = input as Record<string, unknown>;

    if (typeof obj.id !== 'string' || obj.id.trim().length === 0) {
        errors.push('id must be a non-empty string');
    }
    if (typeof obj.bookId !== 'string' || obj.bookId.trim().length === 0) {
        errors.push('bookId must be a non-empty string');
    }
    if (typeof obj.pageNumber !== 'number' || !Number.isInteger(obj.pageNumber) || obj.pageNumber < 1) {
        errors.push('pageNumber must be a positive integer');
    }
    if (typeof obj.term !== 'string' || obj.term.trim().length === 0) {
        errors.push('term must be a non-empty string');
    }
    if (typeof obj.category !== 'string' || !VALID_CATEGORIES.has(obj.category as KnowledgeCategory)) {
        errors.push('category must be one of vocabulary, symbol, concept, background');
    }
    if (
        typeof obj.difficulty !== 'string' ||
        !VALID_DIFFICULTIES.has(obj.difficulty as KnowledgeDifficulty)
    ) {
        errors.push('difficulty must be one of basic, intermediate, advanced');
    }
    if (typeof obj.basicSummary !== 'string' || obj.basicSummary.trim().length === 0) {
        errors.push('basicSummary must be a non-empty string');
    }
    if (typeof obj.deepDive !== 'string' || obj.deepDive.trim().length === 0) {
        errors.push('deepDive must be a non-empty string');
    }
    if (!validateNormalizedBBox(obj.bbox)) {
        errors.push('bbox must contain normalized coordinates in [0.0, 1.0]');
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    const bbox = obj.bbox as NormalizedBBox;
    const annotation: KnowledgeAnnotation = {
        id: (obj.id as string).trim(),
        bookId: (obj.bookId as string).trim(),
        pageNumber: obj.pageNumber as number,
        term: (obj.term as string).trim(),
        category: obj.category as KnowledgeCategory,
        partOfSpeech: typeof obj.partOfSpeech === 'string' ? obj.partOfSpeech.trim() : undefined,
        difficulty: obj.difficulty as KnowledgeDifficulty,
        basicSummary: (obj.basicSummary as string).trim(),
        deepDive: (obj.deepDive as string).trim(),
        examples: Array.isArray(obj.examples)
            ? obj.examples.filter((item): item is string => typeof item === 'string')
            : undefined,
        bbox: {
            x: Number(bbox.x.toFixed(6)),
            y: Number(bbox.y.toFixed(6)),
            width: Number(bbox.width.toFixed(6)),
            height: Number(bbox.height.toFixed(6))
        },
        createdBy: obj.createdBy === 'teacher' ? 'teacher' : 'system',
        updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : undefined
    };

    return { valid: true, errors: [], annotation };
}

export function serializeKnowledgeBundle(
    bookId: string,
    annotations: KnowledgeAnnotation[],
    exportedAt: string = new Date().toISOString()
): string {
    const validAnnotations: KnowledgeAnnotation[] = [];
    for (const item of annotations) {
        const res = validateKnowledgeAnnotation(item);
        if (res.valid && res.annotation) {
            validAnnotations.push(res.annotation);
        }
    }
    const bundle: KnowledgeBundle = {
        schemaVersion: 1,
        bookId: bookId.trim(),
        exportedAt,
        annotations: validAnnotations
    };
    return JSON.stringify(bundle, null, 2);
}

export function deserializeKnowledgeBundle(rawJson: string): {
    valid: boolean;
    errors: string[];
    bundle?: KnowledgeBundle;
} {
    try {
        const parsed = JSON.parse(rawJson);
        if (!parsed || typeof parsed !== 'object') {
            return { valid: false, errors: ['Bundle JSON must be an object'] };
        }
        const obj = parsed as Record<string, unknown>;
        if (typeof obj.bookId !== 'string' || !obj.bookId.trim()) {
            return { valid: false, errors: ['Bundle bookId is missing'] };
        }
        if (!Array.isArray(obj.annotations)) {
            return { valid: false, errors: ['Bundle annotations must be an array'] };
        }

        const annotations: KnowledgeAnnotation[] = [];
        const errors: string[] = [];

        obj.annotations.forEach((rawItem, idx) => {
            const check = validateKnowledgeAnnotation(rawItem);
            if (check.valid && check.annotation) {
                annotations.push(check.annotation);
            } else {
                errors.push(`annotations[${idx}]: ${check.errors.join(', ')}`);
            }
        });

        if (errors.length > 0) {
            return { valid: false, errors };
        }

        return {
            valid: true,
            errors: [],
            bundle: {
                schemaVersion: typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1,
                bookId: obj.bookId.trim(),
                exportedAt:
                    typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
                annotations
            }
        };
    } catch (e: any) {
        return { valid: false, errors: [e?.message || 'Invalid JSON string'] };
    }
}

/**
 * Converts normalized [0.0, 1.0] coordinates into pixel coordinates on a rendered canvas/container.
 */
export function normalizedBBoxToCanvasRect(
    bbox: NormalizedBBox,
    canvasWidth: number,
    canvasHeight: number,
    scale: number = 1
): CanvasRect {
    const effectiveWidth = Math.max(0, canvasWidth * scale);
    const effectiveHeight = Math.max(0, canvasHeight * scale);
    return {
        left: Number((bbox.x * effectiveWidth).toFixed(2)),
        top: Number((bbox.y * effectiveHeight).toFixed(2)),
        width: Number((bbox.width * effectiveWidth).toFixed(2)),
        height: Number((bbox.height * effectiveHeight).toFixed(2))
    };
}

/**
 * Converts pixel coordinates on a rendered canvas/container back into normalized [0.0, 1.0] coordinates.
 */
export function canvasRectToNormalizedBBox(
    rect: CanvasRect,
    canvasWidth: number,
    canvasHeight: number,
    scale: number = 1
): NormalizedBBox {
    const effectiveWidth = Math.max(1, canvasWidth * scale);
    const effectiveHeight = Math.max(1, canvasHeight * scale);
    const x = clamp01(rect.left / effectiveWidth);
    const y = clamp01(rect.top / effectiveHeight);
    const maxW = Math.max(0.01, 1 - x);
    const maxH = Math.max(0.01, 1 - y);
    const width = Math.min(maxW, Math.max(0.01, rect.width / effectiveWidth));
    const height = Math.min(maxH, Math.max(0.01, rect.height / effectiveHeight));
    return {
        x: Number(x.toFixed(6)),
        y: Number(y.toFixed(6)),
        width: Number(width.toFixed(6)),
        height: Number(height.toFixed(6))
    };
}

/**
 * Computes a viewport-safe popover coordinate so that popovers near screen edges never clip outside the viewport.
 */
export function clampPopoverPosition(
    anchorRect: CanvasRect,
    popoverSize: { width: number; height: number },
    viewportSize: { width: number; height: number },
    padding: number = 16
): { left: number; top: number; placement: 'bottom' | 'top' } {
    const halfPopoverW = popoverSize.width / 2;
    const anchorCenterX = anchorRect.left + anchorRect.width / 2;

    const minLeft = padding;
    const maxLeft = Math.max(padding, viewportSize.width - popoverSize.width - padding);
    const left = Math.min(maxLeft, Math.max(minLeft, Math.round(anchorCenterX - halfPopoverW)));

    const belowTop = anchorRect.top + anchorRect.height + 10;
    const aboveTop = anchorRect.top - popoverSize.height - 10;

    if (belowTop + popoverSize.height + padding <= viewportSize.height || aboveTop < padding) {
        const clampedTop = Math.min(
            Math.max(padding, Math.round(belowTop)),
            Math.max(padding, viewportSize.height - popoverSize.height - padding)
        );
        return { left, top: clampedTop, placement: 'bottom' };
    }

    return {
        left,
        top: Math.max(padding, Math.round(aboveTop)),
        placement: 'top'
    };
}

/**
 * Matches OCR/text tokens against curriculum lexicon entries to automatically generate KnowledgeAnnotations.
 */
export function matchKnowledgeTermsFromTokens(
    bookId: string,
    tokens: OcrTextToken[],
    lexicon: LexiconEntry[] = DEFAULT_CURRICULUM_LEXICON
): KnowledgeAnnotation[] {
    const matched: KnowledgeAnnotation[] = [];
    const seenPerPage = new Set<string>();

    const normalizeText = (s: string) => s.replace(/\s+/g, '').toLowerCase();

    for (const token of tokens) {
        const cleanToken = token.text.trim();
        if (!cleanToken) continue;
        const normToken = normalizeText(cleanToken);

        for (const entry of lexicon) {
            const candidates = [entry.term, ...(entry.aliases || [])];
            const isMatch = candidates.some((cand) => {
                const normCand = normalizeText(cand);
                return normCand.length > 0 && (normToken.includes(normCand) || cleanToken.includes(cand));
            });

            if (isMatch) {
                const dedupeKey = `${token.pageNumber}::${entry.term}`;
                if (seenPerPage.has(dedupeKey)) break;
                seenPerPage.add(dedupeKey);

                const candidateAnnotation: KnowledgeAnnotation = {
                    id: `auto-${bookId}-p${token.pageNumber}-${entry.term}`,
                    bookId,
                    pageNumber: token.pageNumber,
                    term: entry.term,
                    category: entry.category,
                    partOfSpeech: entry.partOfSpeech,
                    difficulty: entry.difficulty,
                    basicSummary: entry.basicSummary,
                    deepDive: entry.deepDive,
                    examples: entry.examples,
                    bbox: validateNormalizedBBox(token.bbox)
                        ? token.bbox
                        : entry.defaultBBox || { x: 0.2, y: 0.2, width: 0.15, height: 0.05 },
                    createdBy: 'system'
                };
                matched.push(candidateAnnotation);
                break;
            }
        }
    }

    return matched;
}

/**
 * Returns built-in starter knowledge annotations for a given book and page so students and teachers
 * can immediately experience interactive vocabulary/symbol overlays on any textbook page.
 */
export function getDefaultPageAnnotations(
    bookId: string,
    pageNumber: number
): KnowledgeAnnotation[] {
    if (!bookId || bookId === 'blank' || pageNumber < 1) return [];
    const count = DEFAULT_CURRICULUM_LEXICON.length;
    const firstIdx = (pageNumber - 1) % count;
    const secondIdx = (pageNumber + 2) % count;
    const indices = firstIdx === secondIdx ? [firstIdx] : [firstIdx, secondIdx];

    return indices.map((idx, slot) => {
        const entry = DEFAULT_CURRICULUM_LEXICON[idx];
        const fallbackBBox: NormalizedBBox =
            slot === 0
                ? entry.defaultBBox || { x: 0.16, y: 0.24, width: 0.16, height: 0.048 }
                : { x: 0.54, y: 0.62, width: 0.18, height: 0.048 };
        return {
            id: `builtin-${bookId}-p${pageNumber}-${idx}`,
            bookId,
            pageNumber,
            term: entry.term,
            category: entry.category,
            partOfSpeech: entry.partOfSpeech,
            difficulty: entry.difficulty,
            basicSummary: entry.basicSummary,
            deepDive: entry.deepDive,
            examples: entry.examples,
            bbox: fallbackBBox,
            createdBy: 'system'
        };
    });
}

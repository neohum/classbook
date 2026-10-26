import { createWorker } from 'tesseract.js';

export interface OffsetDetectResult {
    detected: boolean;
    physicalPage: number;
    printedPage: number;
    offset: number;
    confidenceMsg: string;
}

export interface BookOffsetInspectionResult {
    offset: number;
    startPrintedPage: number;
    endPrintedPage: number;
    confidenceMsg: string;
    sampleCount: number;
}

/**
 * Checks text content from PDF.js getTextContent() for page numbers
 */
export async function detectPageNumberFromText(page: any, viewport: any): Promise<number | null> {
    try {
        const textContent = await page.getTextContent();
        if (!textContent || !textContent.items || textContent.items.length === 0) {
            return null;
        }

        const height = viewport.height;
        // Search items in the bottom 15% or top 10%
        for (const item of textContent.items) {
            if (!('str' in item)) continue;
            const str = item.str.trim();
            if (/^\d{1,3}$/.test(str)) {
                const y = item.transform[5]; // y coordinate
                if (y < height * 0.15 || y > height * 0.88) {
                    const num = parseInt(str, 10);
                    if (num > 0 && num < 500) {
                        return num;
                    }
                }
            }
        }
    } catch (err) {
        console.warn("Text extraction error:", err);
    }
    return null;
}

let tesseractWorkerPromise: Promise<any> | null = null;

async function getTesseractWorker() {
    if (!tesseractWorkerPromise) {
        tesseractWorkerPromise = (async () => {
            try {
                const worker = await createWorker('eng');
                await worker.setParameters({
                    tessedit_char_whitelist: '0123456789',
                    tessedit_pageseg_mode: '7' as any, // Single text line
                });
                return worker;
            } catch (err) {
                console.error("Failed to initialize Tesseract worker:", err);
                tesseractWorkerPromise = null;
                return null;
            }
        })();
    }
    return tesseractWorkerPromise;
}

/**
 * Recognizes printed page number from a rendered page canvas using OCR on corner areas
 */
export async function detectPageNumberFromCanvas(canvas: HTMLCanvasElement, isEvenPage: boolean): Promise<number | null> {
    try {
        const worker = await getTesseractWorker();
        if (!worker) return null;

        const cw = canvas.width;
        const ch = canvas.height;

        // Create small crop canvas for the bottom corner
        const crop = document.createElement('canvas');
        const cropW = Math.floor(cw * 0.35);
        const cropH = Math.floor(ch * 0.12);
        crop.width = cropW;
        crop.height = cropH;

        const ctx = crop.getContext('2d');
        if (!ctx) return null;

        // If even page: left bottom corner. If odd page: right bottom corner.
        const srcX = isEvenPage ? 0 : Math.floor(cw * 0.65);
        const srcY = Math.floor(ch * 0.88);

        ctx.drawImage(canvas, srcX, srcY, cropW, cropH, 0, 0, cropW, cropH);

        const res = await worker.recognize(crop);
        const text = res.data.text.trim();
        const matches = text.match(/\b\d{1,3}\b/g);
        if (matches && matches.length > 0) {
            for (const m of matches) {
                const num = parseInt(m, 10);
                if (num > 0 && num < 500) {
                    return num;
                }
            }
        }
    } catch (err) {
        console.warn("OCR recognition error:", err);
    }
    return null;
}

/**
 * Calculates the consensus offset and printed page range from collected physical vs printed page pairs.
 */
export function computeConsensusOffset(
    samples: { physicalPage: number; printedPage: number }[],
    totalPhysicalPages: number,
    bookTitle: string = ''
): BookOffsetInspectionResult {
    if (!samples || samples.length === 0) {
        // Fallback heuristic based on title
        if (bookTitle.includes('나') && !bookTitle.includes('가')) {
            return {
                offset: -140,
                startPrintedPage: 141,
                endPrintedPage: 140 + totalPhysicalPages,
                confidenceMsg: '권(나) 휴리스틱 적용 (기본 오프셋: -140)',
                sampleCount: 0
            };
        }
        return {
            offset: 0,
            startPrintedPage: 1,
            endPrintedPage: totalPhysicalPages,
            confidenceMsg: '기본 1:1 매칭 적용 (오프셋: 0)',
            sampleCount: 0
        };
    }

    // Count occurrences of each offset
    const offsetCounts: Record<number, number> = {};
    for (const s of samples) {
        const diff = s.physicalPage - s.printedPage;
        offsetCounts[diff] = (offsetCounts[diff] || 0) + 1;
    }

    let bestOffset = 0;
    let maxCount = -1;
    for (const [offStr, count] of Object.entries(offsetCounts)) {
        const off = parseInt(offStr, 10);
        if (count > maxCount) {
            maxCount = count;
            bestOffset = off;
        }
    }

    const startPrintedPage = bestOffset < 0 ? (1 - bestOffset) : 1;
    const endPrintedPage = totalPhysicalPages - bestOffset;

    return {
        offset: bestOffset,
        startPrintedPage,
        endPrintedPage,
        confidenceMsg: `${maxCount}개 페이지에서 오프셋(${bestOffset}) 검증 완료 (${startPrintedPage}~${endPrintedPage}쪽)`,
        sampleCount: samples.length
    };
}

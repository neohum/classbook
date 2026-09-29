import React, { useEffect, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, ExternalLink, Download, FileText, Loader2, Maximize2, AlertCircle } from 'lucide-react';
import init, { HwpDocument } from '@rhwp/core';
import { GetWeeklyPlanRawBase64 } from '../../wailsjs/go/main/App';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    filePath?: string;
    docTitle?: string;
}

// Ensure measureTextWidth callback is registered before WASM initializes
if (typeof window !== 'undefined' && !(globalThis as any).measureTextWidth) {
    let measureCtx: CanvasRenderingContext2D | null = null;
    let lastFontStr = '';
    (globalThis as any).measureTextWidth = (font: string, text: string) => {
        if (!measureCtx) {
            measureCtx = document.createElement('canvas').getContext('2d');
        }
        if (font !== lastFontStr && measureCtx) {
            measureCtx.font = font;
            lastFontStr = font;
        }
        return measureCtx ? measureCtx.measureText(text).width : 0;
    };
}

let wasmInitPromise: Promise<any> | null = null;
const ensureWasmInitialized = () => {
    if (!wasmInitPromise) {
        wasmInitPromise = init({ module_or_path: '/rhwp_bg.wasm' }).catch(err => {
            console.error("WASM init with /rhwp_bg.wasm failed, falling back to default:", err);
            return init();
        });
    }
    return wasmInitPromise;
};

export default function HwpHtmlViewerModal({
    isOpen,
    onClose,
    filePath,
    docTitle
}: Props) {
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [pageSvgs, setPageSvgs] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState<number>(0);
    const [zoom, setZoom] = useState<number>(100);
    const [viewMode, setViewMode] = useState<'single' | 'scroll'>('scroll');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        let isCancelled = false;
        setIsLoading(true);
        setErrorMsg(null);
        setPageSvgs([]);
        setCurrentPage(0);

        const loadDoc = async () => {
            try {
                // 1. Initialize WASM
                await ensureWasmInitialized();

                // 2. Fetch base64 data
                const base64Data = await GetWeeklyPlanRawBase64(filePath || "");
                if (!base64Data) {
                    throw new Error("주학습계획안 파일 데이터를 읽어오지 못했습니다.");
                }

                // 3. Convert base64 to Uint8Array
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                // 4. Parse with HwpDocument
                const doc = new HwpDocument(bytes);
                const totalPages = doc.pageCount();

                if (totalPages === 0) {
                    throw new Error("문서에 렌더링할 수 있는 페이지가 없습니다.");
                }

                const svgs: string[] = [];
                for (let i = 0; i < totalPages; i++) {
                    const svg = doc.renderPageSvg(i);
                    svgs.push(svg);
                }

                if (!isCancelled) {
                    setPageSvgs(svgs);
                    setIsLoading(false);
                }
            } catch (err: any) {
                console.error("Failed to render HWP document with rhwp:", err);
                if (!isCancelled) {
                    setErrorMsg(err.message || String(err));
                    setIsLoading(false);
                }
            }
        };

        loadDoc();

        return () => {
            isCancelled = true;
        };
    }, [isOpen, filePath]);

    if (!isOpen) return null;

    const handleOpenInNewWindow = () => {
        if (pageSvgs.length === 0) return;
        const newWin = window.open('', '_blank');
        if (!newWin) {
            alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
            return;
        }

        const fullHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>${docTitle || "주학습 계획안"} - HTML 뷰어</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&family=Noto+Serif+KR:wght@400;700&family=Nanum+Gothic&display=swap">
    <style>
        body {
            margin: 0;
            padding: 24px;
            background-color: #f1f5f9;
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: 'Noto Sans KR', sans-serif;
        }
        .page-container {
            margin-bottom: 30px;
            background: #ffffff;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            justify-content: center;
        }
        .page-container svg {
            display: block;
            max-width: 100%;
            height: auto;
        }
        .header {
            position: sticky;
            top: 0;
            background: #ffffff;
            width: 100%;
            padding: 12px 24px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-sizing: border-box;
            z-index: 10;
        }
        .btn {
            background: #7c3aed;
            color: #ffffff;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
        }
        @media print {
            body { padding: 0; background: none; }
            .header { display: none; }
            .page-container { margin: 0; box-shadow: none; border-radius: 0; page-break-after: always; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h2 style="margin: 0; font-size: 18px; color: #1e293b;">${docTitle || "주학습 계획안"}</h2>
        <button class="btn" onclick="window.print()">인쇄하기</button>
    </div>
    <div style="height: 20px;"></div>
    ${pageSvgs.map((svg, idx) => `
        <div class="page-container" id="page-${idx + 1}">
            ${svg}
        </div>
    `).join('')}
</body>
</html>`;

        newWin.document.open();
        newWin.document.write(fullHtml);
        newWin.document.close();
    };

    const handleDownloadHtml = () => {
        if (pageSvgs.length === 0) return;
        const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>${docTitle || "주학습 계획안"}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap">
    <style>
        body { margin: 0; padding: 24px; background: #f8fafc; display: flex; flex-direction: column; align-items: center; font-family: 'Noto Sans KR', sans-serif; }
        .page { margin-bottom: 24px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-radius: 8px; }
        svg { display: block; max-width: 100%; height: auto; }
    </style>
</head>
<body>
    ${pageSvgs.map(s => `<div class="page">${s}</div>`).join('')}
</body>
</html>`;

        const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${docTitle || '주학습계획안'}_변환결과.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-4 animate-in fade-in select-none">
            <div className="bg-slate-900 text-slate-100 rounded-3xl shadow-2xl border border-slate-700 w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-600 text-white rounded-xl shadow-md shadow-violet-500/20">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-white">
                                    {docTitle || "주학습 계획안"}
                                </h3>
                                <span className="text-[11px] px-2 py-0.5 bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-full font-semibold">
                                    rhwp HTML 변환
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                한글(HWP/HWPX) 문서를 HTML/SVG로 원본 서식 그대로 렌더링한 결과입니다.
                            </p>
                        </div>
                    </div>

                    {/* Toolbar Controls */}
                    <div className="flex items-center gap-2">
                        {/* Zoom controls */}
                        <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-xl p-1 text-xs">
                            <button
                                onClick={() => setZoom(prev => Math.max(50, prev - 15))}
                                className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                                title="축소"
                            >
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <span className="px-2 font-mono font-bold text-violet-300 min-w-11 text-center">
                                {zoom}%
                            </span>
                            <button
                                onClick={() => setZoom(prev => Math.min(200, prev + 15))}
                                className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                                title="확대"
                            >
                                <ZoomIn className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setZoom(100)}
                                className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border-l border-slate-700 ml-1"
                                title="100% 원래 크기"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-xl p-1 text-xs">
                            <button
                                onClick={() => setViewMode('scroll')}
                                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${viewMode === 'scroll' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                연속 스크롤
                            </button>
                            <button
                                onClick={() => setViewMode('single')}
                                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${viewMode === 'single' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                페이지별 보기
                            </button>
                        </div>

                        {/* Open in new window */}
                        <button
                            onClick={handleOpenInNewWindow}
                            disabled={pageSvgs.length === 0}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                            title="새 창에서 원본 HTML 보기 및 인쇄"
                        >
                            <ExternalLink className="w-4 h-4" />
                            <span className="hidden sm:inline">새 창으로 보기</span>
                        </button>

                        {/* Download HTML */}
                        <button
                            onClick={handleDownloadHtml}
                            disabled={pageSvgs.length === 0}
                            className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
                            title="HTML 파일로 다운로드"
                        >
                            <Download className="w-4 h-4" />
                        </button>

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
                            title="닫기"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div
                    ref={containerRef}
                    className="flex-1 overflow-auto bg-slate-950 p-6 flex flex-col items-center justify-start relative"
                >
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs gap-3">
                            <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                            <p className="text-sm font-semibold text-slate-300">
                                rhwp로 HWP 문서를 HTML로 변환하는 중...
                            </p>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="max-w-md w-full p-6 bg-red-950/60 border border-red-800/80 rounded-2xl flex flex-col items-center text-center gap-3 my-auto">
                            <AlertCircle className="w-10 h-10 text-red-400" />
                            <div>
                                <h4 className="font-bold text-red-200 text-base">문서 변환 실패</h4>
                                <p className="text-xs text-red-300 mt-1 leading-relaxed">
                                    {errorMsg}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="mt-2 px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    )}

                    {!isLoading && !errorMsg && pageSvgs.length > 0 && (
                        <div
                            style={{
                                transform: `scale(${zoom / 100})`,
                                transformOrigin: 'top center',
                                transition: 'transform 0.15s ease-out'
                            }}
                            className="flex flex-col items-center gap-8 my-auto"
                        >
                            {viewMode === 'scroll' ? (
                                pageSvgs.map((svg, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-300/40 p-1"
                                        dangerouslySetInnerHTML={{ __html: svg }}
                                    />
                                ))
                            ) : (
                                <div
                                    className="bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-300/40 p-1"
                                    dangerouslySetInnerHTML={{ __html: pageSvgs[currentPage] }}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Footer / Page Navigation for single page mode */}
                {viewMode === 'single' && pageSvgs.length > 1 && (
                    <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                                disabled={currentPage === 0}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg font-bold flex items-center gap-1 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span>이전 쪽</span>
                            </button>
                            <span className="font-mono px-3 text-slate-300">
                                {currentPage + 1} / {pageSvgs.length}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(pageSvgs.length - 1, prev + 1))}
                                disabled={currentPage >= pageSvgs.length - 1}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg font-bold flex items-center gap-1 transition-colors"
                            >
                                <span>다음 쪽</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

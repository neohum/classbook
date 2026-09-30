import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
    X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, 
    ExternalLink, Download, FileText, Loader2, AlertCircle, Upload 
} from 'lucide-react';
import init, { HwpDocument } from '@rhwp/core';
import wasmUrl from '@rhwp/core/rhwp_bg.wasm?url';
import { GetWeeklyPlanRawBase64, SelectWeeklyPlanFileDialog } from '../../wailsjs/go/main/App';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    filePath?: string;
    docTitle?: string;
    onPlanUpdated?: (plan: any) => void;
}

let wasmInitPromise: Promise<any> | null = null;
const ensureWasmInitialized = () => {
    if (!wasmInitPromise) {
        wasmInitPromise = init({ module_or_path: wasmUrl }).catch(err => {
            console.warn("WASM init with wasmUrl failed, trying /rhwp_bg.wasm:", err);
            return init({ module_or_path: '/rhwp_bg.wasm' }).catch(err2 => {
                console.warn("WASM init with /rhwp_bg.wasm failed, falling back to default init():", err2);
                return init();
            });
        });
    }
    return wasmInitPromise;
};

export default function HwpHtmlViewerModal({
    isOpen,
    onClose,
    filePath,
    docTitle,
    onPlanUpdated
}: Props) {
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [pageSvgs, setPageSvgs] = useState<string[]>([]);
    const [pageHtmls, setPageHtmls] = useState<string[]>([]);
    const [renderFormat, setRenderFormat] = useState<'svg' | 'html'>('svg');
    const [currentPage, setCurrentPage] = useState<number>(0);
    const [zoom, setZoom] = useState<number>(100);
    const [viewMode, setViewMode] = useState<'scroll' | 'single'>('scroll');
    const [resolvedTitle, setResolvedTitle] = useState(docTitle || "주학습 계획안");
    const [isSelectingFile, setIsSelectingFile] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        let isCancelled = false;
        setIsLoading(true);
        setErrorMsg(null);
        setPageSvgs([]);
        setPageHtmls([]);
        setCurrentPage(0);
        if (docTitle) setResolvedTitle(docTitle);

        const loadDoc = async () => {
            try {
                // 1. Initialize WASM safely
                await ensureWasmInitialized();

                // 2. Fetch base64 data
                const base64Data = await GetWeeklyPlanRawBase64(filePath || "");
                if (!base64Data) {
                    throw new Error("주학습계획안 파일(HWP/HWPX)을 찾을 수 없습니다. 아래의 [파일 직접 선택] 버튼으로 주학습계획안 파일을 지정해주세요.");
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
                const htmls: string[] = [];
                for (let i = 0; i < totalPages; i++) {
                    try {
                        const svg = doc.renderPageSvg(i);
                        if (svg) svgs.push(svg);
                    } catch (e) {
                        console.warn(`renderPageSvg failed for page ${i}:`, e);
                    }

                    try {
                        if (typeof doc.renderPageHtml === 'function') {
                            const html = doc.renderPageHtml(i);
                            if (html) htmls.push(html);
                        }
                    } catch (e) {
                        console.warn(`renderPageHtml failed for page ${i}:`, e);
                    }
                }

                if (!isCancelled) {
                    setPageSvgs(svgs);
                    setPageHtmls(htmls);
                    // Default to SVG if available, otherwise HTML
                    setRenderFormat(svgs.length > 0 ? 'svg' : 'html');
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
    }, [isOpen, filePath, docTitle]);

    const handleSelectManualFile = async () => {
        try {
            setIsSelectingFile(true);
            const res = await SelectWeeklyPlanFileDialog();
            if (res && res.success) {
                setResolvedTitle(res.title);
                if (onPlanUpdated) onPlanUpdated(res);
                // Trigger reload
                setIsLoading(true);
                setErrorMsg(null);
                await ensureWasmInitialized();
                const base64Data = await GetWeeklyPlanRawBase64(res.filePath || "");
                if (base64Data) {
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const doc = new HwpDocument(bytes);
                    const totalPages = doc.pageCount();
                    const svgs: string[] = [];
                    const htmls: string[] = [];
                    for (let i = 0; i < totalPages; i++) {
                        try { svgs.push(doc.renderPageSvg(i)); } catch (e) {}
                        try { if (typeof doc.renderPageHtml === 'function') htmls.push(doc.renderPageHtml(i)); } catch (e) {}
                    }
                    setPageSvgs(svgs);
                    setPageHtmls(htmls);
                }
            }
        } catch (e: any) {
            alert(`파일 선택 실패: ${e.message || e}`);
        } finally {
            setIsSelectingFile(false);
            setIsLoading(false);
        }
    };

    // Construct isolated iframe HTML document
    const iframeSrcDoc = useMemo(() => {
        const pages = renderFormat === 'svg' ? pageSvgs : (pageHtmls.length > 0 ? pageHtmls : pageSvgs);
        if (pages.length === 0) return '';

        const targetPages = viewMode === 'scroll' ? pages : [pages[currentPage] || pages[0]];

        if (renderFormat === 'svg') {
            return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>${resolvedTitle} - 미리보기</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            background-color: #0b0f19;
            width: 100%;
            height: 100%;
            overflow: auto;
        }
        body {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 32px 16px;
            gap: 36px;
            font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", sans-serif;
        }
        .page-container {
            background-color: #ffffff;
            box-shadow: 0 20px 30px -10px rgba(0,0,0,0.6), 0 10px 15px -5px rgba(0,0,0,0.4);
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            justify-content: center;
            border: 1px solid rgba(255, 255, 255, 0.15);
            transform: scale(${zoom / 100});
            transform-origin: top center;
            transition: transform 0.12s ease-out;
            margin-bottom: ${zoom > 100 ? `${(zoom - 100) * 10}px` : '0px'};
        }
        svg {
            display: block;
            max-width: 100%;
            height: auto;
        }
        @media print {
            body { padding: 0; background: none; }
            .page-container { margin: 0; box-shadow: none; border-radius: 0; page-break-after: always; transform: none !important; }
        }
    </style>
</head>
<body>
    ${targetPages.map((svg, idx) => `
        <div class="page-container" id="page-${idx + 1}">
            ${svg}
        </div>
    `).join('')}
</body>
</html>`;
        } else {
            return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>${resolvedTitle} - 미리보기</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            background-color: #0b0f19;
            width: 100%;
            height: 100%;
            overflow: auto;
        }
        body {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 32px 16px;
            gap: 36px;
            font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", sans-serif;
        }
        .html-page-box {
            background-color: #ffffff;
            box-shadow: 0 20px 30px -10px rgba(0,0,0,0.6), 0 10px 15px -5px rgba(0,0,0,0.4);
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.15);
            transform: scale(${zoom / 100});
            transform-origin: top center;
            transition: transform 0.12s ease-out;
            margin-bottom: ${zoom > 100 ? `${(zoom - 100) * 10}px` : '0px'};
        }
        @media print {
            body { padding: 0; background: none; }
            .html-page-box { margin: 0; box-shadow: none; border-radius: 0; page-break-after: always; transform: none !important; }
        }
    </style>
</head>
<body>
    ${targetPages.map((html, idx) => `
        <div class="html-page-box" id="page-${idx + 1}">
            ${html}
        </div>
    `).join('')}
</body>
</html>`;
        }
    }, [renderFormat, pageSvgs, pageHtmls, viewMode, currentPage, zoom, resolvedTitle]);

    if (!isOpen) return null;

    const handleOpenInNewWindow = () => {
        if (!iframeSrcDoc) return;
        const newWin = window.open('', '_blank');
        if (!newWin) {
            alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
            return;
        }
        newWin.document.open();
        newWin.document.write(iframeSrcDoc);
        newWin.document.close();
    };

    const handleDownloadHtml = () => {
        if (!iframeSrcDoc) return;
        const blob = new Blob([iframeSrcDoc], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${resolvedTitle}_미리보기.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const totalPages = Math.max(pageSvgs.length, pageHtmls.length);

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in select-none">
            <div className="bg-slate-900 text-slate-100 rounded-3xl shadow-2xl border border-slate-700 w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/90 gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-violet-600 text-white rounded-xl shadow-md shadow-violet-500/20 shrink-0">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base sm:text-lg font-bold text-white truncate max-w-sm sm:max-w-md">
                                    {resolvedTitle}
                                </h3>
                                <span className="text-[11px] px-2 py-0.5 bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-full font-semibold shrink-0">
                                    HWP 원본 서식 미리보기
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                                한글(HWP/HWPX) 양식 그대로 실시간 렌더링된 주학습 계획안 화면입니다.
                            </p>
                        </div>
                    </div>

                    {/* Toolbar Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Format Switch (SVG vs HTML) */}
                        {pageHtmls.length > 0 && pageSvgs.length > 0 && (
                            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5 text-xs">
                                <button
                                    onClick={() => setRenderFormat('svg')}
                                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                                        renderFormat === 'svg' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                    title="SVG 벡터 그래픽 모드로 선명하게 보기"
                                >
                                    벡터(SVG)
                                </button>
                                <button
                                    onClick={() => setRenderFormat('html')}
                                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                                        renderFormat === 'html' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                    title="HTML 표 서식 모드로 보기"
                                >
                                    텍스트(HTML)
                                </button>
                            </div>
                        )}

                        {/* Zoom controls */}
                        <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5 text-xs">
                            <button
                                onClick={() => setZoom(prev => Math.max(50, prev - 15))}
                                className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                                title="축소"
                            >
                                <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2 font-mono font-bold text-violet-300 min-w-10 text-center text-xs">
                                {zoom}%
                            </span>
                            <button
                                onClick={() => setZoom(prev => Math.min(200, prev + 15))}
                                className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                                title="확대"
                            >
                                <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setZoom(100)}
                                className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border-l border-slate-700 ml-0.5 cursor-pointer"
                                title="100% 원래 크기"
                            >
                                <RotateCcw className="w-3 h-3" />
                            </button>
                        </div>

                        {/* View Mode Toggle */}
                        {totalPages > 1 && (
                            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5 text-xs">
                                <button
                                    onClick={() => setViewMode('scroll')}
                                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                                        viewMode === 'scroll' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    연속
                                </button>
                                <button
                                    onClick={() => setViewMode('single')}
                                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                                        viewMode === 'single' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    쪽별
                                </button>
                            </div>
                        )}

                        {/* Open in new window */}
                        <button
                            onClick={handleOpenInNewWindow}
                            disabled={totalPages === 0}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                            title="새 창에서 원본 HTML 보기 및 인쇄"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">새 창</span>
                        </button>

                        {/* Download HTML */}
                        <button
                            onClick={handleDownloadHtml}
                            disabled={totalPages === 0}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
                            title="HTML 파일로 다운로드"
                        >
                            <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
                            title="닫기"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Main Content Area - Isolated Iframe */}
                <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20 backdrop-blur-xs gap-3">
                            <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                            <p className="text-sm font-semibold text-slate-200">
                                HWP 문서를 안전하게 렌더링하는 중입니다...
                            </p>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-950/95 z-20">
                            <div className="max-w-md w-full p-6 bg-slate-900 border border-red-500/40 rounded-3xl flex flex-col items-center text-center gap-4 shadow-2xl">
                                <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl">
                                    <AlertCircle className="w-8 h-8" />
                                </div>
                                <div>
                                    <h4 className="font-extrabold text-white text-base">문서 미리보기 준비 중</h4>
                                    <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-wrap">
                                        {errorMsg}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 mt-2 w-full">
                                    <button
                                        onClick={handleSelectManualFile}
                                        disabled={isSelectingFile}
                                        className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                                    >
                                        <Upload className="w-4 h-4" />
                                        <span>{isSelectingFile ? "파일 여는 중..." : "HWP 파일 직접 선택"}</span>
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700"
                                    >
                                        닫기
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isLoading && !errorMsg && iframeSrcDoc && (
                        <iframe
                            title="HWP Document Preview"
                            srcDoc={iframeSrcDoc}
                            className="w-full h-full border-none flex-1 bg-[#0b0f19]"
                            sandbox="allow-same-origin allow-scripts allow-modals allow-downloads"
                        />
                    )}
                </div>

                {/* Footer / Page Navigation for single page mode */}
                {viewMode === 'single' && totalPages > 1 && (
                    <div className="px-6 py-2.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                                disabled={currentPage === 0}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span>이전 쪽</span>
                            </button>
                            <span className="font-mono px-3 text-slate-300 font-bold">
                                {currentPage + 1} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                                disabled={currentPage >= totalPages - 1}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                                <span>다음 쪽</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        <span className="text-[11px] text-slate-500">
                            Tip: [새 창]을 누르면 인쇄 및 브라우저 확대가 가능합니다.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

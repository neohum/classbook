import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Home, Loader2, Maximize, Minimize, PenTool, X, Eraser, Trash2 } from 'lucide-react';
import { WindowFullscreen, WindowUnfullscreen, WindowIsFullscreen, Quit } from '../../wailsjs/runtime/runtime';
import { StartDrag } from '../../wailsjs/go/main/App';

function PageRenderer({ bookId, pageNumber, scale }: { bookId: string, pageNumber: number, scale: number }) {
    const [isRendered, setIsRendered] = useState(false);
    const [imgUrl, setImgUrl] = useState('');

    useEffect(() => {
        setIsRendered(false);
        const url = `/book/images/${bookId}/page_${pageNumber}.jpg`;
        const img = new Image();
        img.src = url;
        img.onload = () => {
            setImgUrl(url);
            setIsRendered(true);
        };
        img.onerror = () => {
            console.error(`Failed to load page ${pageNumber} for`, bookId);
        };
    }, [bookId, pageNumber]);

    return (
        <div className="relative shadow-xl bg-white flex-shrink-0 h-full flex flex-col items-center justify-center overflow-hidden">
            {!isRendered && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 animate-pulse min-w-[300px]">
                    <Loader2 className="w-12 h-12 text-slate-300 animate-spin" />
                </div>
            )}
            {imgUrl && (
                <img
                    src={imgUrl}
                    alt={`Page ${pageNumber}`}
                    className={`block object-contain transition-all duration-300 h-full ${isRendered ? 'opacity-100' : 'opacity-0'}`}
                    style={{
                        width: scale > 1 ? `${scale * 100}%` : 'auto',
                        height: scale > 1 ? 'auto' : '100%',
                        maxWidth: 'none',
                        maxHeight: '100%'
                    }}
                />
            )}
        </div>
    );
}

export default function ViewerPage() {
    const { bookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();

    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [inputPage, setInputPage] = useState<string>("1");
    const [loading, setLoading] = useState(true);
    const scale = 1.0;
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Drawing State
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#ef4444'); // Default Red
    const [lineWidth, setLineWidth] = useState(4);
    const [isEraser, setIsEraser] = useState(false);

    const handleHeaderPointerDown = (e: React.PointerEvent<HTMLElement>) => {
        // Prevent drag if touching a button
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('form')) {
            return;
        }

        // Native Windows drag triggered by Go
        StartDrag();
    };

    const toggleDrawingMode = () => {
        setIsDrawingMode(!isDrawingMode);
    };
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawingMode) return;
        e.preventDefault();
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                const { offsetX, offsetY } = getCoordinates(e, canvas);
                ctx.moveTo(offsetX, offsetY);
                ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : color;
                ctx.lineWidth = isEraser ? 20 : lineWidth;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !isDrawingMode) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const { offsetX, offsetY } = getCoordinates(e, canvas);
                ctx.lineTo(offsetX, offsetY);
                ctx.stroke();
            }
        }
    };

    const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawingMode) return;
        e.preventDefault();
        setIsDrawing(false);
    };

    const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e) {
            return {
                offsetX: e.touches[0].clientX - rect.left,
                offsetY: e.touches[0].clientY - rect.top
            };
        }
        return {
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top
        };
    };

    // Resize canvas to match window
    useEffect(() => {
        const resizeCanvas = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                // Get actual display size
                const rect = canvas.getBoundingClientRect();

                // Set actual internal dimensions to match display dimensions
                // This prevents pixel stretching or coordinate misalignment
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Also call resize when drawing mode toggles in case layout shifted
        if (isDrawingMode) {
            setTimeout(resizeCanvas, 50);
        }

        return () => window.removeEventListener('resize', resizeCanvas);
    }, [isDrawingMode]);

    const toggleFullscreen = async () => {
        try {
            const isFull = await WindowIsFullscreen();
            if (!isFull) {
                WindowFullscreen();
                setIsFullscreen(true);
            } else {
                WindowUnfullscreen();
                setIsFullscreen(false);
            }
        } catch (err) {
            console.error("Wails fullscreen error:", err);
        }
    };

    // Track Escape key to exit fullscreen manually since Wails takes over standard HTML5 behavior
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                WindowUnfullscreen();
                setIsFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen]);

    // Calculate pages to show based on currentPage view (spread)
    const leftPage = currentPage;
    const rightPage = currentPage + 1 <= numPages ? currentPage + 1 : null;

    const handlePageSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = parseInt(inputPage, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= numPages) {
            setCurrentPage(parsed);
        } else {
            // Reset to current if invalid
            setInputPage(currentPage.toString());
        }
    };

    // Auto-sync input when currentPage changes programmatically
    useEffect(() => {
        setInputPage(currentPage.toString());
    }, [currentPage]);

    // Initialize and load PDF metadata
    useEffect(() => {
        if (!bookId) return;

        const loadMetadata = async () => {
            setLoading(true);
            try {
                // Fetch the generated metadata file to know how many pages exist
                const response = await fetch(`/book/images/${bookId}/metadata.json`);
                if (!response.ok) throw new Error("Metadata not found");
                const data = await response.json();

                setNumPages(data.numPages);

                // Load saved progress
                const savedPage = localStorage.getItem(`viewer-progress-${bookId}`);
                if (savedPage) {
                    const parsed = parseInt(savedPage, 10);
                    if (!isNaN(parsed) && parsed >= 1 && parsed <= data.numPages) {
                        setCurrentPage(parsed);
                        setInputPage(parsed.toString()); // Sync input
                    }
                }
            } catch (error) {
                console.error("Failed to load PDF metadata:", error);
            } finally {
                setLoading(false);
            }
        };

        loadMetadata();
    }, [bookId]);

    // Save progress when page changes
    useEffect(() => {
        if (!bookId || numPages === 0) return;
        localStorage.setItem(`viewer-progress-${bookId}`, currentPage.toString());
    }, [bookId, currentPage, numPages]);

    const goToNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, Math.max(1, numPages - 1)));
    };

    const goToPrevPage = () => {
        setCurrentPage(prev => Math.max(1, prev - 1));
    };

    const goBack = () => navigate('/');

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-violet-500 animate-spin mb-4" />
                <p className="text-slate-400 text-lg">교과서를 불러오는 중입니다...</p>
            </div>
        );
    }

    if (numPages === 0) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
                <p className="text-red-400 text-lg mb-4">교과서를 불러올 수 없습니다. 이미지가 렌더링되지 않았을 수 있습니다.</p>
                <button onClick={goBack} className="px-6 py-2 bg-violet-600 rounded-full hover:bg-violet-700 transition">
                    돌아가기
                </button>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-200 flex flex-col font-sans">
            {/* Top Navigation - Custom Title Bar Dragging */}
            <header
                onPointerDown={handleHeaderPointerDown}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                className="h-16 flex-shrink-0 border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 bg-slate-900/80 backdrop-blur-md z-50 touch-none select-none cursor-move"
            >
                <button
                    onClick={goBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                    <Home className="w-5 h-5" />
                    <span className="font-medium hidden sm:inline">목록으로</span>
                </button>

                <div className="flex items-center gap-4 sm:gap-6">
                    <div className="font-semibold text-white tracking-wide text-base sm:text-lg">
                        {bookId}
                    </div>


                    {/* Page Input Form */}
                    <form onSubmit={handlePageSubmit} className="flex items-center bg-slate-800 rounded-full border border-slate-700 overflow-hidden px-2 py-1 hidden sm:flex">
                        <span className="text-xs text-slate-400 px-2 select-none">쪽:</span>
                        <input
                            type="number"
                            min="1"
                            max={numPages}
                            value={inputPage}
                            onChange={(e) => setInputPage(e.target.value)}
                            onBlur={handlePageSubmit}
                            className="bg-transparent text-white text-sm w-12 text-center outline-none"
                            aria-label="이동할 페이지 입력"
                        />
                        <span className="text-xs text-slate-500 pr-2 select-none">/ {numPages}</span>
                    </form>

                    {/* Pen Tool Launch */}
                    <button
                        onClick={toggleDrawingMode}
                        className={`p-1.5 sm:p-2 rounded-full border transition-colors ${isDrawingMode ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                        title="판서 모드 토글"
                        aria-label="판서 모드 토글"
                    >
                        <PenTool className="w-4 h-4" />
                    </button>

                    {/* Fullscreen Toggle */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-1.5 sm:p-2 bg-slate-800 text-slate-400 hover:text-white rounded-full border border-slate-700 hover:bg-slate-700 transition-colors"
                        aria-label={isFullscreen ? "전체화면 종료" : "전체화면 보기"}
                    >
                        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>

                    {/* Exit Button */}
                    <button
                        onClick={Quit}
                        className="p-1.5 sm:p-2 bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-900/40 rounded-full border border-slate-700 transition-colors ml-2"
                        title="프로그램 종료"
                        aria-label="종료"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="text-xs sm:text-sm font-medium text-slate-400 bg-slate-800 px-3 py-1 sm:py-1.5 rounded-full border border-slate-700 select-none hidden md:block">
                    <span className="text-white">{leftPage}</span> {rightPage ? <span className="text-slate-500">/ <span className="text-white">{rightPage}</span></span> : ''}
                </div>
            </header>

            <main className="flex-1 w-full relative overflow-hidden flex items-center justify-center bg-slate-900">
                {/* Left Side Controls */}
                <div className="absolute left-2 sm:left-6 z-50 flex flex-col gap-3">
                    <button
                        onClick={goToPrevPage}
                        disabled={currentPage <= 1}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-violet-600/80 backdrop-blur disabled:opacity-0 disabled:pointer-events-none text-white rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto"
                        aria-label="이전 페이지"
                    >
                        <ChevronLeft className="w-8 h-8 -ml-1" />
                    </button>

                    {/* Additional Left Controls */}
                    <button
                        onClick={toggleDrawingMode}
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto ${isDrawingMode ? 'bg-violet-600/90 text-white' : 'bg-black/40 hover:bg-slate-700/80 text-slate-300 hover:text-white'}`}
                        title="판서 모드 토글"
                    >
                        <PenTool className="w-6 h-6" />
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto"
                        title={isFullscreen ? "전체화면 종료" : "전체화면 보기"}
                    >
                        {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                    </button>
                    <button
                        onClick={Quit}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-red-900/80 text-slate-300 hover:text-red-400 rounded-full flex items-center justify-center transition-all shadow-xl border border-red-500/20 relative z-50 pointer-events-auto mt-2"
                        title="프로그램 종료"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Image Spread */}
                <div className="flex items-center justify-center h-full relative z-0">
                    <PageRenderer bookId={bookId!} pageNumber={leftPage} scale={scale} />
                    {rightPage && (
                        <PageRenderer bookId={bookId!} pageNumber={rightPage} scale={scale} />
                    )}
                </div>

                {/* Right Side Controls */}
                <div className="absolute right-2 sm:right-6 z-50 flex flex-col gap-3">
                    <button
                        onClick={goToNextPage}
                        disabled={rightPage === null || rightPage >= numPages}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-violet-600/80 backdrop-blur disabled:opacity-0 disabled:pointer-events-none text-white rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto"
                        aria-label="다음 페이지"
                    >
                        <ChevronRight className="w-8 h-8 -mr-1" />
                    </button>

                    {/* Additional Right Controls */}
                    <button
                        onClick={toggleDrawingMode}
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto ${isDrawingMode ? 'bg-violet-600/90 text-white' : 'bg-black/40 hover:bg-slate-700/80 text-slate-300 hover:text-white'}`}
                        title="판서 모드 토글"
                    >
                        <PenTool className="w-6 h-6" />
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10 relative z-50 pointer-events-auto"
                        title={isFullscreen ? "전체화면 종료" : "전체화면 보기"}
                    >
                        {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                    </button>
                    <button
                        onClick={Quit}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-red-900/80 text-slate-300 hover:text-red-400 rounded-full flex items-center justify-center transition-all shadow-xl border border-red-500/20 relative z-50 pointer-events-auto mt-2"
                        title="프로그램 종료"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </main>

            {/* Drawing Canvas Overlay */}
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                onTouchCancel={stopDrawing}
                className={`absolute inset-0 w-full h-full z-40 touch-none ${isDrawingMode ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
                style={{ display: isDrawingMode ? 'block' : 'none' }}
            />

            {/* Floating Drawing Toolbar */}
            {isDrawingMode && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-full py-2 px-4 shadow-xl pointer-events-auto">
                    {/* Colors */}
                    <button onClick={() => { setColor('#ef4444'); setIsEraser(false); }} className={`w-6 h-6 rounded-full bg-red-500 border-2 ${color === '#ef4444' && !isEraser ? 'border-white scale-110' : 'border-transparent'} transition-all`} title="빨강" />
                    <button onClick={() => { setColor('#3b82f6'); setIsEraser(false); }} className={`w-6 h-6 rounded-full bg-blue-500 border-2 ${color === '#3b82f6' && !isEraser ? 'border-white scale-110' : 'border-transparent'} transition-all`} title="파랑" />
                    <button onClick={() => { setColor('#eab308'); setIsEraser(false); setLineWidth(12); }} className={`w-6 h-6 rounded-full bg-yellow-500/50 border-2 ${color === '#eab308' && !isEraser ? 'border-white scale-110' : 'border-transparent'} transition-all`} title="형광펜" />
                    <button onClick={() => { setColor('#000000'); setIsEraser(false); setLineWidth(4); }} className={`w-6 h-6 rounded-full bg-black border-2 ${color === '#000000' && !isEraser ? 'border-white scale-110' : 'border-slate-500'} transition-all`} title="검정" />

                    <div className="w-px h-6 bg-slate-600 mx-2" />

                    {/* Eraser */}
                    <button
                        onClick={() => setIsEraser(true)}
                        className={`p-1.5 rounded-full transition-colors ${isEraser ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                        title="지우개"
                    >
                        <Eraser className="w-5 h-5" />
                    </button>

                    {/* Clear All */}
                    <button
                        onClick={clearCanvas}
                        className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-slate-700 rounded-full transition-colors ml-1"
                        title="전체 지우기"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Progress Bar */}
            <div className="h-1.5 bg-slate-800 w-full flex-shrink-0 relative">
                <div
                    className="absolute left-0 top-0 bottom-0 bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.8)] transition-all duration-300 ease-out"
                    style={{ width: `${(Math.max(rightPage || leftPage, 1) / numPages) * 100}%` }}
                />
            </div>
        </div>
    );
}

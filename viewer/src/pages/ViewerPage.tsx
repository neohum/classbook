import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Home, Loader2, Maximize, Minimize, PenTool, X } from 'lucide-react';
import { WindowFullscreen, WindowUnfullscreen, WindowIsFullscreen, Quit } from '../../wailsjs/runtime/runtime';
import { LaunchPenTool } from '../../wailsjs/go/main/App';

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

    const handleLaunchPen = async () => {
        try {
            await LaunchPenTool();
        } catch (err) {
            console.error("Failed to launch pen tool:", err);
            // Optionally, we could show a toast or alert here to the user
        }
    };

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
            {/* Top Navigation - Added data-wails-drag for Frameless window moving */}
            <header data-wails-drag className="h-16 flex-shrink-0 border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 bg-slate-900/80 backdrop-blur-md z-50">
                <button
                    onClick={goBack}
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    <Home className="w-5 h-5" />
                    <span className="font-medium hidden sm:inline">목록으로</span>
                </button>

                <div className="flex items-center gap-4 sm:gap-6" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
                        onClick={handleLaunchPen}
                        className="p-1.5 sm:p-2 bg-slate-800 text-slate-400 hover:text-white rounded-full border border-slate-700 hover:bg-slate-700 transition-colors"
                        title="판서 도구 열기"
                        aria-label="판서 도구 열기"
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
                {/* Previous Button */}
                <button
                    onClick={goToPrevPage}
                    disabled={currentPage <= 1}
                    className="absolute left-2 sm:left-6 z-10 w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-violet-600/80 backdrop-blur disabled:opacity-0 disabled:pointer-events-none text-white rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10"
                    aria-label="이전 페이지"
                >
                    <ChevronLeft className="w-8 h-8 -ml-1" />
                </button>

                {/* Image Spread */}
                <div className="flex items-center justify-center h-full relative z-0">
                    <PageRenderer bookId={bookId!} pageNumber={leftPage} scale={scale} />
                    {rightPage && (
                        <PageRenderer bookId={bookId!} pageNumber={rightPage} scale={scale} />
                    )}
                </div>

                {/* Next Button */}
                <button
                    onClick={goToNextPage}
                    disabled={rightPage === null || rightPage >= numPages}
                    className="absolute right-2 sm:right-6 z-10 w-12 h-12 sm:w-14 sm:h-14 bg-black/40 hover:bg-violet-600/80 backdrop-blur disabled:opacity-0 disabled:pointer-events-none text-white rounded-full flex items-center justify-center transition-all shadow-xl border border-white/10"
                    aria-label="다음 페이지"
                >
                    <ChevronRight className="w-8 h-8 -mr-1" />
                </button>
            </main>

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

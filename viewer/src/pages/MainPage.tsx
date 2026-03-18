import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, BookCopy, ArrowRight, X, Maximize, Minimize, Trash2, Plus, Loader2 } from 'lucide-react';
import { Quit, WindowFullscreen, WindowUnfullscreen, WindowIsFullscreen } from '../../wailsjs/runtime/runtime';
import { DeleteBook, SelectPdfDialog, ReadFileBase64, EnsureBookDir, SavePageImage, GetTextbooks } from '../../wailsjs/go/main/App';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker using Vite's ?url literal for local bundling
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const INITIAL_TEXTBOOKS = [
    { id: '국어1-1가', title: '국어 1-1 가', color: 'bg-orange-500' },
    { id: '국어활동1-1', title: '국어 활동 1-1', color: 'bg-orange-400' },
    { id: '수학1-1', title: '수학 1-1', color: 'bg-blue-500' },
    { id: '수학익힘1-1', title: '수학 익힘 1-1', color: 'bg-blue-400' },
    { id: '학교1-1', title: '학교 1-1', color: 'bg-green-500' },
];

export { INITIAL_TEXTBOOKS };

function PdfThumbnail({ bookId }: { bookId: string }) {
    const [loading, setLoading] = useState(true);
    const [imgUrl, setImgUrl] = useState('');

    useEffect(() => {
        // Thumbnail is just the first page image
        const url = `/book/images/${bookId}/page_1.jpg`;
        const img = new Image();
        img.src = url;
        img.onload = () => {
            setImgUrl(url);
            setLoading(false);
        };
        img.onerror = () => {
            console.error("Failed to load thumbnail for", bookId);
            setLoading(false);
        };
    }, [bookId]);

    return (
        <div className={`relative w-full h-full flex items-center justify-center overflow-hidden`}>
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <BookCopy className="w-16 h-16 text-white/40 drop-shadow-sm animate-pulse" />
                </div>
            )}
            {imgUrl && (
                <img
                    src={imgUrl}
                    alt={`Cover for ${bookId}`}
                    className={`w-full h-full object-contain p-4 transition-all duration-700 ${loading ? 'opacity-0 scale-95' : 'opacity-100 group-hover:scale-105'}`}
                />
            )}
        </div>
    );
}

export default function MainPage() {
    const navigate = useNavigate();
    const [isFullscreen, setIsFullscreen] = useState(false);

    const [textbooks, setTextbooks] = useState<any[]>([]);
    const [isConverting, setIsConverting] = useState(false);
    const [convertProgress, setConvertProgress] = useState({ current: 0, total: 0 });

    // Load available books on mount
    useEffect(() => {
        const loadBooks = async () => {
            try {
                const books = await GetTextbooks();
                if (books) {
                    setTextbooks(books);
                }
            } catch (err) {
                console.error("Failed to load textbooks from backend:", err);
            }
        };
        loadBooks();
    }, []);

    const handleDelete = async (e: React.MouseEvent, bookId: string) => {
        e.stopPropagation();
        if (!window.confirm("이 교과서를 완전히 삭제하시겠습니까?\n(로컬 파일이 삭제되며 복구할 수 없습니다)")) {
            return;
        }

        try {
            await DeleteBook(bookId);
            setTextbooks(prev => prev.filter(b => b.id !== bookId));
        } catch (error) {
            console.error("Failed to delete book:", error);
            alert(`교과서 삭제에 실패했습니다: ${error}`);
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

    const handleAddBook = async () => {
        try {
            // 1. Let user pick a PDF
            const pdfPath = await SelectPdfDialog();
            if (!pdfPath) return; // User cancelled

            // 2. Ask for a title
            const defaultTitle = pdfPath.split('\\').pop()?.split('/').pop()?.replace('.pdf', '') || '새 교과서';
            const title = window.prompt("추가할 교과서의 이름을 입력하세요:", defaultTitle);
            if (!title) return;

            // Check if title already exists
            if (textbooks.some(b => b.id === title)) {
                alert("이미 같은 이름의 교과서가 존재합니다.");
                return;
            }

            setIsConverting(true);
            setConvertProgress({ current: 0, total: 1 });

            // 3. Read File as Base64 from Go Backend
            const base64Data = await ReadFileBase64(pdfPath);
            const raw = window.atob(base64Data);
            const uint8Array = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) {
                uint8Array[i] = raw.charCodeAt(i);
            }

            // 4. Load with PDF.js
            const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
            const pdf = await loadingTask.promise;
            const numPages = pdf.numPages;

            setConvertProgress({ current: 0, total: numPages });

            // 5. Ensure Book Directory exists
            await EnsureBookDir(title, numPages);

            // 6. Render each page to canvas -> base64 -> send to Go Backend
            // We use a relatively high scale (e.g. 2.0 or 1.5) for good image quality
            const scale = 1.5;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { alpha: false }); // JPEG doesn't need alpha

            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale });

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                if (ctx) {
                    // Fill white background just in case
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    const renderContext = {
                        canvasContext: ctx,
                        viewport: viewport,
                    } as any;
                    await page.render(renderContext).promise;

                    // Extract as high-quality JPEG base64 Data URL
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

                    // Send to backend to save as page_{i}.jpg
                    await SavePageImage(title, i, dataUrl);
                }

                setConvertProgress({ current: i, total: numPages });
            }

            // 7. Refresh book list
            const updatedBooks = await GetTextbooks();
            setTextbooks(updatedBooks);

            alert(`"${title}" 교과서가 성공적으로 추가되었습니다!`);

        } catch (err: any) {
            console.error("Failed to add book:", err);
            alert(`교과서 추가 중 오류가 발생했습니다: ${err.message || err}`);
        } finally {
            setIsConverting(false);
            setConvertProgress({ current: 0, total: 0 });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-8 font-sans">
            <header data-wails-drag className="max-w-6xl mx-auto mb-16 mt-8">
                <div className="flex items-center justify-between mb-4">
                    <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="flex items-center gap-3">
                        <BookOpen className="w-10 h-10 text-violet-600" />
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
                            나의 교과서
                        </h1>
                    </div>

                    <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="flex items-center gap-2">
                        {/* Fullscreen Toggle */}
                        <button
                            onClick={toggleFullscreen}
                            className="p-2 bg-slate-100 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-full transition-colors flex items-center justify-center"
                            aria-label={isFullscreen ? "전체화면 종료" : "전체화면 보기"}
                        >
                            {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                        </button>

                        {/* Exit Button */}
                        <button
                            onClick={Quit}
                            className="p-2 bg-slate-100 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex items-center justify-center"
                            title="프로그램 종료"
                            aria-label="종료"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                <p className="text-lg text-slate-500">
                    학습할 교과서를 선택하고 이어서 학습을 진행해보세요.
                </p>

                <div className="mt-6">
                    <button
                        onClick={handleAddBook}
                        disabled={isConverting}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-sm transition-all font-medium"
                    >
                        {isConverting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>변환 중... ({convertProgress.current} / {convertProgress.total})</span>
                            </>
                        ) : (
                            <>
                                <Plus className="w-5 h-5" />
                                <span>새 교과서 추가하기 (PDF)</span>
                            </>
                        )}
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 mb-16">
                {textbooks.map((book) => {
                    // Read from localStorage to see if there's progress
                    const progressKey = `viewer-progress-${book.id}`;
                    const lastPageStr = localStorage.getItem(progressKey);
                    const lastPage = lastPageStr ? parseInt(lastPageStr, 10) : null;

                    return (
                        <div
                            key={book.id}
                            onClick={() => navigate(`/viewer/${encodeURIComponent(book.id)}`)}
                            className="group cursor-pointer bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col h-full relative"
                        >
                            {/* Book cover area */}
                            <div className={`${book.color} aspect-[3/4] flex items-center justify-center relative overflow-hidden`}>
                                <PdfThumbnail bookId={book.id} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                            </div>

                            {/* Content area */}
                            <div className="p-6 flex flex-col flex-grow relative">
                                <h2 className="text-xl font-bold text-slate-800 mb-2">{book.title}</h2>

                                {/* Delete Button */}
                                <button
                                    onClick={(e) => handleDelete(e, book.id)}
                                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
                                    title="교과서 삭제"
                                    aria-label={`${book.title} 삭제`}
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>

                                <div className="mt-auto pt-4 flex items-center justify-between">
                                    {lastPage ? (
                                        <span className="text-sm font-medium text-violet-600 bg-violet-50 px-3 py-1 rounded-full border border-violet-100">
                                            {lastPage}쪽 이어서 보기
                                        </span>
                                    ) : (
                                        <span className="text-sm font-medium text-slate-400">
                                            처음부터 보기
                                        </span>
                                    )}

                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-violet-100 group-hover:text-violet-600 transition-colors">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </main>
        </div>
    );
}

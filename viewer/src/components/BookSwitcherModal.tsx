import React, { useEffect, useState } from 'react';
import { X, BookCopy, BookOpen, Check, Search, ArrowRight, Clock, Bookmark } from 'lucide-react';
import { GetTextbooks } from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';

interface Props {
    isOpen: boolean;
    currentBookId: string;
    onClose: () => void;
    onSelectBook: (bookId: string, targetPrintedPage?: number) => void;
}

export default function BookSwitcherModal({
    isOpen,
    currentBookId,
    onClose,
    onSelectBook
}: Props) {
    const [books, setBooks] = useState<main.Textbook[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [targetPages, setTargetPages] = useState<{ [bookId: string]: string }>({});

    useEffect(() => {
        if (isOpen) {
            GetTextbooks().then(res => {
                setBooks(res || []);
            }).catch(err => {
                console.error("Failed to load textbooks for switcher:", err);
            });
            setSearchTerm('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Helper: calculate last opened printed page for a textbook
    const getBookLastPrintedPage = (book: main.Textbook): { page: number; hasSaved: boolean } => {
        const saved = localStorage.getItem(`viewer-progress-${book.id}`);
        if (saved) {
            const physical = parseInt(saved, 10);
            if (!isNaN(physical) && physical >= 1) {
                const offset = book.pageOffset || 0;
                return { page: Math.max(1, physical - offset), hasSaved: true };
            }
        }
        return { page: 1, hasSaved: false };
    };

    const filteredBooks = books.filter(b =>
        b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (book: main.Textbook) => {
        const pageStr = targetPages[book.id];
        let targetPage: number;
        
        if (pageStr && pageStr.trim() !== '') {
            const parsed = parseInt(pageStr, 10);
            targetPage = isNaN(parsed) ? getBookLastPrintedPage(book).page : Math.max(1, parsed);
        } else {
            // 이전에 열었던 교과서 쪽이 기록된 쪽으로 바로 이동!
            targetPage = getBookLastPrintedPage(book).page;
        }

        onSelectBook(book.id, targetPage);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in select-none">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-500/20">
                            <BookCopy className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-extrabold text-slate-800">
                                    교과서 바꾸기
                                </h3>
                                <span className="text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full">
                                    총 {books.length}권 등록됨
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                교과서를 선택하면 <strong className="text-emerald-700">이전에 열었던 쪽</strong>으로 즉시 이어보기가 됩니다.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                        title="닫기"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200/80 flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                        type="text"
                        placeholder="교과서 이름 검색 (예: 국어, 수학, 봄...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
                        autoFocus
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="text-xs text-slate-400 hover:text-slate-600 px-1 cursor-pointer"
                        >
                            지우기
                        </button>
                    )}
                </div>

                {/* Book Cards Grid */}
                <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-grow">
                    {filteredBooks.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-slate-400">
                            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm font-semibold text-slate-600">등록된 교과서가 없습니다.</p>
                            <p className="text-xs mt-0.5 text-slate-400">메인 화면에서 교과서 PDF를 등록해주세요.</p>
                        </div>
                    ) : (
                        filteredBooks.map((book) => {
                            const isCurrent = book.id === currentBookId;
                            const { page: lastPrintedPage, hasSaved } = getBookLastPrintedPage(book);

                            return (
                                <div
                                    key={book.id}
                                    onClick={() => handleSelect(book)}
                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 cursor-pointer group shadow-xs hover:shadow-md ${
                                        isCurrent
                                            ? 'bg-emerald-50/70 border-emerald-500 shadow-emerald-500/10'
                                            : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-emerald-300'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0 ${book.color || 'bg-emerald-500'}`}>
                                                <BookOpen className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h4 className="text-base font-extrabold text-slate-800 group-hover:text-emerald-700 transition-colors line-clamp-1">
                                                        {book.title}
                                                    </h4>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-slate-400 font-medium">
                                                        총 {book.numPages}쪽
                                                    </span>
                                                    {hasSaved && (
                                                        <span className="text-[11px] font-bold px-1.5 py-0.2 bg-violet-100 text-violet-700 rounded-md flex items-center gap-0.5">
                                                            <Clock className="w-3 h-3" />
                                                            <span>기록: {lastPrintedPage}쪽</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {isCurrent && (
                                            <span className="shrink-0 px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center gap-1 shadow-xs">
                                                <Check className="w-3 h-3" />
                                                <span>현재 수업 중</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Action Bar */}
                                    <div
                                        className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <span>쪽수:</span>
                                            <input
                                                type="number"
                                                min={1}
                                                max={book.numPages || 300}
                                                placeholder={lastPrintedPage.toString()}
                                                value={targetPages[book.id] || ''}
                                                onChange={(e) => setTargetPages({
                                                    ...targetPages,
                                                    [book.id]: e.target.value
                                                })}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSelect(book);
                                                }}
                                                className="w-14 px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-center font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                                                title="다른 쪽수를 열고 싶다면 입력하세요"
                                            />
                                            <span>쪽</span>
                                        </div>

                                        <button
                                            onClick={() => handleSelect(book)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                                isCurrent
                                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                    : 'bg-emerald-50 group-hover:bg-emerald-600 text-emerald-800 group-hover:text-white border border-emerald-200/80 group-hover:border-emerald-600'
                                            }`}
                                        >
                                            {isCurrent ? (
                                                <span>{lastPrintedPage}쪽 (현재)</span>
                                            ) : hasSaved ? (
                                                <>
                                                    <Bookmark className="w-3 h-3" />
                                                    <span>{lastPrintedPage}쪽 바로가기</span>
                                                </>
                                            ) : (
                                                <span>1쪽 열기</span>
                                            )}
                                            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <Bookmark className="w-4 h-4 text-emerald-600" />
                        <span>교과서를 터치하면 <strong>이전에 열었던 쪽</strong>으로 즉시 이동합니다.</span>
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}

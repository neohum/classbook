import React, { useState, useEffect } from 'react';
import { X, Check, BookOpen, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { UpdateBookOffset } from '../../wailsjs/go/main/App';

interface Props {
    isOpen: boolean;
    bookId: string;
    bookTitle: string;
    initialOffset?: number;
    detectedOffset?: number | null;
    numPages: number;
    onClose: () => void;
    onSaved: (newOffset: number) => void;
}

export default function PageOffsetAdjustModal({
    isOpen,
    bookId,
    bookTitle,
    initialOffset = 0,
    detectedOffset = null,
    numPages,
    onClose,
    onSaved
}: Props) {
    const [samplePhysicalPage, setSamplePhysicalPage] = useState<number>(6);
    const [printedPageInput, setPrintedPageInput] = useState<string>("6");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Default to page 6 or something in the range of 1..numPages
            const samplePage = Math.min(Math.max(1, numPages >= 6 ? 6 : 1), numPages);
            setSamplePhysicalPage(samplePage);

            const offset = detectedOffset !== null ? detectedOffset : initialOffset;
            const printed = samplePage - offset;
            setPrintedPageInput(printed > 0 ? printed.toString() : "1");
        }
    }, [isOpen, bookId, initialOffset, detectedOffset, numPages]);

    if (!isOpen) return null;

    const handlePrintedPageChange = (val: string) => {
        setPrintedPageInput(val);
    };

    const currentOffset = samplePhysicalPage - (parseInt(printedPageInput, 10) || 0);

    const handleSave = async () => {
        const parsedPrinted = parseInt(printedPageInput, 10);
        if (isNaN(parsedPrinted) || parsedPrinted <= 0) {
            alert("올바른 실제 쪽수(양수)를 입력해주세요.");
            return;
        }

        const calculatedOffset = samplePhysicalPage - parsedPrinted;
        setIsSaving(true);
        try {
            await UpdateBookOffset(bookId, calculatedOffset);
            localStorage.setItem(`pageOffset_${bookId}`, calculatedOffset.toString());
            onSaved(calculatedOffset);
            onClose();
        } catch (err: any) {
            alert(`오프셋 저장 실패: ${err.message || err}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrevSample = () => {
        if (samplePhysicalPage > 1) {
            const next = samplePhysicalPage - 1;
            setSamplePhysicalPage(next);
            setPrintedPageInput((next - currentOffset).toString());
        }
    };

    const handleNextSample = () => {
        if (samplePhysicalPage < numPages) {
            const next = samplePhysicalPage + 1;
            setSamplePhysicalPage(next);
            setPrintedPageInput((next - currentOffset).toString());
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-violet-600" />
                        <h2 className="text-xl font-bold text-slate-800">교재 실제 쪽수 맞추기</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-5">
                    <div>
                        <div className="text-sm font-semibold text-slate-500 mb-1">교과서 이름</div>
                        <div className="text-lg font-bold text-slate-800">{bookTitle}</div>
                    </div>

                    {detectedOffset !== null && (
                        <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl flex items-start gap-2.5 text-sm text-violet-800">
                            <AlertCircle className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-semibold">파일 자동 검사 완료: </span>
                                실제 교재 쪽수가 감지되었습니다 (추천 오프셋: {detectedOffset}).
                                아래 미리보기에서 번호를 확인하고 맞춤을 완료하세요.
                            </div>
                        </div>
                    )}

                    {/* Page Thumbnail Preview */}
                    <div className="flex flex-col items-center">
                        <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                            <span>PDF 파일 페이지: <strong>{samplePhysicalPage}페이지</strong> / 총 {numPages}페이지</span>
                        </div>

                        <div className="relative w-64 h-80 bg-slate-100 rounded-xl overflow-hidden shadow-inner border border-slate-200 flex items-center justify-center">
                            <img
                                src={`/book/images/${bookId}/page_${samplePhysicalPage}.jpg`}
                                alt={`Sample Page ${samplePhysicalPage}`}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                }}
                            />

                            {/* Navigation inside thumbnail */}
                            <button
                                onClick={handlePrevSample}
                                disabled={samplePhysicalPage <= 1}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full disabled:opacity-30 transition-all"
                                title="이전 페이지 미리보기"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleNextSample}
                                disabled={samplePhysicalPage >= numPages}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full disabled:opacity-30 transition-all"
                                title="다음 페이지 미리보기"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Matching Input */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-2">
                        <label className="text-sm font-semibold text-slate-700 block">
                            위 미리보기 화면(PDF {samplePhysicalPage}페이지)에 적힌 실제 쪽수는?
                        </label>
                        <div className="flex items-center justify-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={numPages}
                                value={printedPageInput}
                                onChange={(e) => handlePrintedPageChange(e.target.value)}
                                className="w-24 text-center text-2xl font-bold py-2 px-3 border-2 border-violet-500 rounded-xl bg-white text-violet-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                            />
                            <span className="text-lg font-bold text-slate-700">쪽</span>
                        </div>
                        <p className="text-xs text-slate-400">
                            (계산된 교재 오프셋: {currentOffset})
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl font-medium transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-md shadow-violet-500/20 flex items-center gap-2 transition-all"
                    >
                        <Check className="w-4 h-4" />
                        <span>쪽수 맞춤 적용하기</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

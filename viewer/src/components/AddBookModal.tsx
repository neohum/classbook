import React, { useState } from 'react';
import { 
    X, 
    Upload, 
    HardDrive, 
    FileText, 
    BookOpen, 
    Check, 
    CheckSquare, 
    Square, 
    Loader2, 
    RefreshCw, 
    FolderSearch, 
    Sparkles, 
    Trash2, 
    Edit3,
    AlertCircle
} from 'lucide-react';
import { 
    ScanUsbTextbooks, 
    ScanFolderForTextbooks, 
    SelectDirectoryDialog, 
    ImportBookFromImageFolder 
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onAddFromPdf: () => void;
    onImportPdfCandidate: (sourcePath: string, title: string) => Promise<void>;
    onBookAdded: (book: { id: string; title: string; numPages: number; initialOffset: number; detectedOffset: number | null }) => void;
    existingTitles: string[];
}

interface CandidateItem extends main.UsbTextbookCandidate {
    customTitle: string;
    selected: boolean;
}

export default function AddBookModal({
    isOpen,
    onClose,
    onAddFromPdf,
    onImportPdfCandidate,
    onBookAdded,
    existingTitles
}: Props) {
    const [mode, setMode] = useState<'select' | 'usb'>('select');
    const [isScanning, setIsScanning] = useState(false);
    const [candidates, setCandidates] = useState<CandidateItem[]>([]);
    const [scanMessage, setScanMessage] = useState<string>('');
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState<string>('');

    if (!isOpen) return null;

    const handleStartUsbScan = async () => {
        setMode('usb');
        setIsScanning(true);
        setScanMessage('연결된 교사용 USB 드라이브를 탐색하고 있습니다...');
        try {
            const results = await ScanUsbTextbooks();
            if (results && results.length > 0) {
                const formatted: CandidateItem[] = results.map(r => ({
                    ...r,
                    customTitle: r.title,
                    selected: r.isRecommended || r.type === 'image_folder'
                }));
                setCandidates(formatted);
                setScanMessage(`${results.length}개의 교과서 자료가 탐색되었습니다.`);
            } else {
                setCandidates([]);
                setScanMessage('연결된 USB 드라이브에서 교과서 자료를 찾지 못했습니다.');
            }
        } catch (e: any) {
            console.error('USB scan failed:', e);
            setCandidates([]);
            setScanMessage(`탐색 중 오류가 발생했습니다: ${e.message || e}`);
        } finally {
            setIsScanning(false);
        }
    };

    const handleSelectCustomFolder = async () => {
        try {
            const folder = await SelectDirectoryDialog("교과서가 있는 폴더 또는 드라이브 선택");
            if (!folder) return;

            setMode('usb');
            setIsScanning(true);
            setScanMessage(`선택한 폴더(${folder})를 탐색하고 있습니다...`);

            const results = await ScanFolderForTextbooks(folder);
            if (results && results.length > 0) {
                const formatted: CandidateItem[] = results.map(r => ({
                    ...r,
                    customTitle: r.title,
                    selected: true
                }));
                setCandidates(formatted);
                setScanMessage(`${results.length}개의 교과서 자료가 탐색되었습니다.`);
            } else {
                setCandidates([]);
                setScanMessage('선택한 폴더에서 교과서 자료를 찾지 못했습니다.');
            }
        } catch (e: any) {
            console.error('Folder scan failed:', e);
            alert(`폴더 탐색 오류: ${e.message || e}`);
        } finally {
            setIsScanning(false);
        }
    };

    const toggleSelectAll = () => {
        const allSelected = candidates.every(c => c.selected);
        setCandidates(candidates.map(c => ({ ...c, selected: !allSelected })));
    };

    const toggleCandidate = (id: string) => {
        setCandidates(candidates.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
    };

    const updateTitle = (id: string, newTitle: string) => {
        setCandidates(candidates.map(c => c.id === id ? { ...c, customTitle: newTitle } : c));
    };

    const removeCandidate = (id: string) => {
        setCandidates(candidates.filter(c => c.id !== id));
    };

    const handleImportSingle = async (candidate: CandidateItem) => {
        const cleanTitle = candidate.customTitle.trim() || candidate.title;
        if (existingTitles.includes(cleanTitle)) {
            if (!window.confirm(`'${cleanTitle}' 교과서가 이미 등록되어 있습니다. 덮어쓰시겠습니까?`)) {
                return;
            }
        }

        setIsImporting(true);
        setImportStatus(`'${cleanTitle}' 교과서 가져오는 중...`);

        try {
            if (candidate.type === 'image_folder') {
                await ImportBookFromImageFolder(cleanTitle, candidate.sourcePath, 0);
                onBookAdded({
                    id: cleanTitle,
                    title: cleanTitle,
                    numPages: candidate.pageCount,
                    initialOffset: 0,
                    detectedOffset: null
                });
                onClose();
            } else if (candidate.type === 'pdf') {
                await onImportPdfCandidate(candidate.sourcePath, cleanTitle);
                onClose();
            }
        } catch (e: any) {
            alert(`교과서 등록 실패: ${e.message || e}`);
        } finally {
            setIsImporting(false);
            setImportStatus('');
        }
    };

    const handleImportSelected = async () => {
        const selectedItems = candidates.filter(c => c.selected);
        if (selectedItems.length === 0) {
            alert('등록할 교과서를 하나 이상 선택해주세요.');
            return;
        }

        setIsImporting(true);
        let lastAddedBook: any = null;

        for (let i = 0; i < selectedItems.length; i++) {
            const item = selectedItems[i];
            const cleanTitle = item.customTitle.trim() || item.title;
            setImportStatus(`[${i + 1}/${selectedItems.length}] '${cleanTitle}' 교과서 등록 중...`);

            try {
                if (item.type === 'image_folder') {
                    await ImportBookFromImageFolder(cleanTitle, item.sourcePath, 0);
                    lastAddedBook = {
                        id: cleanTitle,
                        title: cleanTitle,
                        numPages: item.pageCount,
                        initialOffset: 0,
                        detectedOffset: null
                    };
                } else if (item.type === 'pdf') {
                    await onImportPdfCandidate(item.sourcePath, cleanTitle);
                }
            } catch (e: any) {
                console.error(`Failed to import ${cleanTitle}:`, e);
            }
        }

        setIsImporting(false);
        setImportStatus('');
        onClose();

        if (lastAddedBook) {
            onBookAdded(lastAddedBook);
        }
    };

    const selectedCount = candidates.filter(c => c.selected).length;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700 shadow-xs">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900">새 교과서 추가</h2>
                            <p className="text-xs text-slate-500 font-medium">교재 PDF 파일 또는 출판사 교사용 USB에서 교과서를 추출하여 등록합니다</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isImporting || isScanning}
                        className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Method Selection Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Option 1: PDF Selection */}
                        <div 
                            onClick={() => {
                                if (isImporting || isScanning) return;
                                onClose();
                                onAddFromPdf();
                            }}
                            className="group p-5 rounded-2xl border-2 border-slate-200 hover:border-violet-500 hover:bg-violet-50/40 transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between"
                        >
                            <div>
                                <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <h3 className="font-extrabold text-slate-900 text-base mb-1 group-hover:text-violet-900">
                                    PDF 파일로 추가
                                </h3>
                                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                    소장 중인 PDF 파일을 직접 선택하여 변환합니다. 여러 개의 PDF를 한 번에 선택할 수 있습니다.
                                </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-violet-600">
                                <span>PDF 파일 찾기</span>
                                <span>&rarr;</span>
                            </div>
                        </div>

                        {/* Option 2: USB Auto-Search */}
                        <div 
                            onClick={() => {
                                if (isImporting || isScanning) return;
                                handleStartUsbScan();
                            }}
                            className={`group p-5 rounded-2xl border-2 transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between ${
                                mode === 'usb' 
                                    ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20' 
                                    : 'border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <HardDrive className="w-6 h-6" />
                                    </div>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        추천 / 자동 탐색
                                    </span>
                                </div>
                                <h3 className="font-extrabold text-slate-900 text-base mb-1 group-hover:text-emerald-900">
                                    USB 드라이브 자동 탐색
                                </h3>
                                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                    꽂혀있는 USB 전자저작물을 자동 스캔하여 교과서(인쇄 원본 이미지 및 PDF)만 정확히 추출합니다.
                                </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                                <span>USB 자동 스캔</span>
                                <span>&rarr;</span>
                            </div>
                        </div>
                    </div>

                    {/* USB Scan Results Area */}
                    {mode === 'usb' && (
                        <div className="pt-2 border-t border-slate-100 space-y-4">
                            {/* Toolbar */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-black text-sm text-slate-800">
                                        탐색된 교과서 자료
                                    </h4>
                                    {candidates.length > 0 && (
                                        <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                                            {candidates.length}개
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSelectCustomFolder}
                                        disabled={isScanning || isImporting}
                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                        title="외장하드나 특정 폴더를 직접 지정하여 탐색"
                                    >
                                        <FolderSearch className="w-3.5 h-3.5 text-slate-600" />
                                        <span>폴더 직접 선택</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleStartUsbScan}
                                        disabled={isScanning || isImporting}
                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isScanning ? 'animate-spin' : ''}`} />
                                        <span>다시 탐색</span>
                                    </button>
                                </div>
                            </div>

                            {/* Scanning state */}
                            {isScanning && (
                                <div className="py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                                    <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
                                    <p className="text-sm font-bold text-slate-700">{scanMessage}</p>
                                    <p className="text-xs text-slate-400 mt-1">대용량 교과서 전자저작물을 분석 중입니다. 잠시만 기다려주세요.</p>
                                </div>
                            )}

                            {/* Empty candidates state */}
                            {!isScanning && candidates.length === 0 && (
                                <div className="py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center px-4">
                                    <AlertCircle className="w-10 h-10 text-amber-500 mb-2 opacity-80" />
                                    <p className="text-sm font-bold text-slate-700">{scanMessage || '탐색된 교과서가 없습니다.'}</p>
                                    <p className="text-xs text-slate-400 mt-1 max-w-md">
                                        출판사 USB가 PC에 꽂혀 있는지 확인하거나, 상단의 <strong>[폴더 직접 선택]</strong>을 눌러 교과서가 있는 폴더나 드라이브를 직접 지정해보세요.
                                    </p>
                                </div>
                            )}

                            {/* Candidates List */}
                            {!isScanning && candidates.length > 0 && (
                                <div className="space-y-2.5">
                                    {/* Select All Toggle Bar */}
                                    <div className="flex items-center justify-between px-2 py-1 bg-slate-50 rounded-xl text-xs font-bold text-slate-600">
                                        <button
                                            type="button"
                                            onClick={toggleSelectAll}
                                            className="flex items-center gap-1.5 hover:text-slate-900 cursor-pointer"
                                        >
                                            {candidates.every(c => c.selected) ? (
                                                <CheckSquare className="w-4 h-4 text-emerald-600" />
                                            ) : (
                                                <Square className="w-4 h-4 text-slate-400" />
                                            )}
                                            <span>전체 선택 / 해제</span>
                                        </button>
                                        <span>선택됨: <strong className="text-emerald-600">{selectedCount}</strong> / {candidates.length}</span>
                                    </div>

                                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                                        {candidates.map((cand) => (
                                            <div
                                                key={cand.id}
                                                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                                    cand.selected 
                                                        ? 'bg-emerald-50/30 border-emerald-300 ring-1 ring-emerald-400/20' 
                                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    {/* Checkbox */}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCandidate(cand.id)}
                                                        className="text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0"
                                                    >
                                                        {cand.selected ? (
                                                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                                                        ) : (
                                                            <Square className="w-5 h-5 text-slate-300" />
                                                        )}
                                                    </button>

                                                    <div className="min-w-0 flex-1">
                                                        {/* Title Input */}
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <input
                                                                type="text"
                                                                value={cand.customTitle}
                                                                onChange={(e) => updateTitle(cand.id, e.target.value)}
                                                                className="text-sm font-extrabold text-slate-800 bg-white border border-slate-200 focus:border-emerald-500 rounded-lg px-2 py-0.5 w-full max-w-xs focus:outline-none"
                                                                placeholder="교과서 제목 입력"
                                                                title="교과서 이름을 원하는 이름으로 수정할 수 있습니다"
                                                            />
                                                            <Edit3 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                        </div>

                                                        {/* Badges & Description */}
                                                        <div className="flex items-center gap-2 flex-wrap text-xs">
                                                            {cand.type === 'image_folder' ? (
                                                                <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800 text-[11px] flex items-center gap-1">
                                                                    <Sparkles className="w-3 h-3 text-emerald-600" />
                                                                    <span>인쇄 원본 ({cand.pageCount}쪽)</span>
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-md font-bold bg-violet-100 text-violet-800 text-[11px]">
                                                                    PDF 파일 ({cand.fileSizeStr})
                                                                </span>
                                                            )}
                                                            <span className="text-[11px] text-slate-500 font-medium truncate max-w-xs">
                                                                {cand.description}
                                                            </span>
                                                        </div>

                                                        {/* Source Path */}
                                                        <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                                                            {cand.sourcePath}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCandidate(cand.id)}
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                                        title="목록에서 제외"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleImportSingle(cand)}
                                                        disabled={isImporting}
                                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                                                    >
                                                        가져오기
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                        {isImporting && (
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{importStatus}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isImporting}
                            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            닫기
                        </button>
                        {mode === 'usb' && candidates.length > 0 && (
                            <button
                                type="button"
                                onClick={handleImportSelected}
                                disabled={isImporting || selectedCount === 0}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                            >
                                <Check className="w-4 h-4" />
                                <span>선택한 교과서 등록 ({selectedCount}개)</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

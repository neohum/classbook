import React, { useEffect, useState } from 'react';
import {
    Edit3,
    Download,
    Upload,
    Trash2,
    Save,
    X,
    Sparkles
} from 'lucide-react';
import {
    KNOWLEDGE_CATEGORY_LABELS,
    KNOWLEDGE_DIFFICULTY_LABELS,
    type KnowledgeAnnotation,
    type KnowledgeCategory,
    type KnowledgeDifficulty,
    type NormalizedBBox
} from '../types/knowledgeOverlay';
import {
    deserializeKnowledgeBundle,
    serializeKnowledgeBundle,
    validateKnowledgeAnnotation
} from '../utils/knowledgeTermMatcher';

export interface TeacherAnnotationDraft {
    id?: string;
    bookId: string;
    pageNumber: number;
    term: string;
    category: KnowledgeCategory;
    partOfSpeech?: string;
    difficulty: KnowledgeDifficulty;
    basicSummary: string;
    deepDive: string;
    examplesText?: string;
    bbox: NormalizedBBox;
}

export function upsertTeacherAnnotation(
    existing: KnowledgeAnnotation[],
    draft: TeacherAnnotationDraft,
    nowIso: string = new Date().toISOString()
): { annotations: KnowledgeAnnotation[]; saved?: KnowledgeAnnotation; errors: string[] } {
    const id =
        draft.id && draft.id.trim().length > 0
            ? draft.id.trim()
            : `teacher-${draft.bookId}-p${draft.pageNumber}-${Date.now()}`;

    const examples = (draft.examplesText || '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const candidate: KnowledgeAnnotation = {
        id,
        bookId: draft.bookId,
        pageNumber: draft.pageNumber,
        term: draft.term,
        category: draft.category,
        partOfSpeech: draft.partOfSpeech || KNOWLEDGE_CATEGORY_LABELS[draft.category],
        difficulty: draft.difficulty,
        basicSummary: draft.basicSummary,
        deepDive: draft.deepDive,
        examples: examples.length > 0 ? examples : undefined,
        bbox: draft.bbox,
        createdBy: 'teacher',
        updatedAt: nowIso
    };

    const check = validateKnowledgeAnnotation(candidate);
    if (!check.valid || !check.annotation) {
        return { annotations: existing, errors: check.errors };
    }

    const idx = existing.findIndex((it) => it.id === check.annotation!.id);
    const next = [...existing];
    if (idx >= 0) {
        next[idx] = check.annotation;
    } else {
        next.push(check.annotation);
    }

    return { annotations: next, saved: check.annotation, errors: [] };
}

export function deleteTeacherAnnotation(
    existing: KnowledgeAnnotation[],
    annotationId: string
): KnowledgeAnnotation[] {
    return existing.filter((it) => it.id !== annotationId);
}

export interface TeacherAnnotationModalProps {
    isOpen: boolean;
    bookId: string;
    pageNumber: number;
    initialAnnotation?: KnowledgeAnnotation | null;
    initialBBox?: NormalizedBBox | null;
    allAnnotations: KnowledgeAnnotation[];
    onClose: () => void;
    onSaveAnnotation: (nextAnnotations: KnowledgeAnnotation[], saved: KnowledgeAnnotation) => void;
    onDeleteAnnotation: (nextAnnotations: KnowledgeAnnotation[], deletedId: string) => void;
    onImportBundle: (importedAnnotations: KnowledgeAnnotation[]) => void;
}

export default function TeacherAnnotationModal({
    isOpen,
    bookId,
    pageNumber,
    initialAnnotation = null,
    initialBBox = null,
    allAnnotations,
    onClose,
    onSaveAnnotation,
    onDeleteAnnotation,
    onImportBundle
}: TeacherAnnotationModalProps) {
    const [term, setTerm] = useState('');
    const [category, setCategory] = useState<KnowledgeCategory>('vocabulary');
    const [partOfSpeech, setPartOfSpeech] = useState('어휘');
    const [difficulty, setDifficulty] = useState<KnowledgeDifficulty>('basic');
    const [basicSummary, setBasicSummary] = useState('');
    const [deepDive, setDeepDive] = useState('');
    const [examplesText, setExamplesText] = useState('');
    const [bbox, setBBox] = useState<NormalizedBBox>({
        x: 0.25,
        y: 0.3,
        width: 0.16,
        height: 0.048
    });
    const [bundleJsonText, setBundleJsonText] = useState('');
    const [showBundlePanel, setShowBundlePanel] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setErrorMsg('');
        if (initialAnnotation) {
            setTerm(initialAnnotation.term);
            setCategory(initialAnnotation.category);
            setPartOfSpeech(
                initialAnnotation.partOfSpeech ||
                    KNOWLEDGE_CATEGORY_LABELS[initialAnnotation.category]
            );
            setDifficulty(initialAnnotation.difficulty);
            setBasicSummary(initialAnnotation.basicSummary);
            setDeepDive(initialAnnotation.deepDive);
            setExamplesText((initialAnnotation.examples || []).join('\n'));
            setBBox(initialAnnotation.bbox);
        } else {
            setTerm('');
            setCategory('vocabulary');
            setPartOfSpeech('명사·핵심어휘');
            setDifficulty('basic');
            setBasicSummary('');
            setDeepDive('');
            setExamplesText('');
            setBBox(
                initialBBox || {
                    x: 0.25,
                    y: 0.3,
                    width: 0.16,
                    height: 0.048
                }
            );
        }
    }, [isOpen, initialAnnotation, initialBBox]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const result = upsertTeacherAnnotation(allAnnotations, {
            id: initialAnnotation?.id,
            bookId,
            pageNumber: initialAnnotation?.pageNumber || pageNumber,
            term,
            category,
            partOfSpeech,
            difficulty,
            basicSummary,
            deepDive,
            examplesText,
            bbox
        });

        if (result.errors.length > 0 || !result.saved) {
            setErrorMsg(result.errors.join(', '));
            return;
        }

        onSaveAnnotation(result.annotations, result.saved);
        onClose();
    };

    const handleExportJson = () => {
        const json = serializeKnowledgeBundle(bookId, allAnnotations);
        setBundleJsonText(json);
        setShowBundlePanel(true);

        try {
            const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${bookId}.cbk-notes.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            // In non-browser environments, setting bundleJsonText is sufficient
        }
    };

    const handleImportJson = () => {
        const res = deserializeKnowledgeBundle(bundleJsonText);
        if (!res.valid || !res.bundle) {
            setErrorMsg(res.errors.join(', '));
            return;
        }
        onImportBundle(res.bundle.annotations);
        setShowBundlePanel(false);
        onClose();
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="교사용 지식 오버레이 주석 편집기"
            data-testid="teacher-annotation-modal"
            className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pointer-events-auto"
        >
            <div className="w-full max-w-xl bg-slate-900 border-2 border-violet-500/60 rounded-3xl shadow-2xl text-slate-100 p-6 max-h-[92vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-800 mb-4">
                    <div className="flex items-center gap-2 text-left">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
                            <Edit3 className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white">
                                {initialAnnotation ? '지식 노트 수정' : '새 지식 노트 추가'} ({pageNumber}쪽)
                            </h3>
                            <p className="text-xs text-slate-400">
                                교과서 본문 어휘·수식 기호·배경지식 해설을 등록하고 배포 번들(.cbk-notes.json)로 내보냅니다.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="편집기 닫기"
                        className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {errorMsg && (
                    <div
                        data-testid="teacher-annotation-error"
                        className="mb-4 px-4 py-2.5 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs font-bold"
                    >
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                학습 용어 / 기호명
                            </label>
                            <input
                                type="text"
                                required
                                value={term}
                                onChange={(e) => setTerm(e.target.value)}
                                placeholder="예: 광합성, 분수, 등호(=)"
                                data-testid="teacher-input-term"
                                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2 text-sm text-white focus:border-violet-400 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                품사 / 분류 표시명
                            </label>
                            <input
                                type="text"
                                value={partOfSpeech}
                                onChange={(e) => setPartOfSpeech(e.target.value)}
                                placeholder="예: 명사, 수식·기호, 과학개념"
                                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2 text-sm text-white focus:border-violet-400 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                지식 유형
                            </label>
                            <select
                                value={category}
                                onChange={(e) =>
                                    setCategory(e.target.value as KnowledgeCategory)
                                }
                                data-testid="teacher-select-category"
                                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:border-violet-400 outline-none"
                            >
                                {(Object.keys(KNOWLEDGE_CATEGORY_LABELS) as KnowledgeCategory[]).map(
                                    (cat) => (
                                        <option key={cat} value={cat}>
                                            {KNOWLEDGE_CATEGORY_LABELS[cat]}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                난이도
                            </label>
                            <select
                                value={difficulty}
                                onChange={(e) =>
                                    setDifficulty(e.target.value as KnowledgeDifficulty)
                                }
                                data-testid="teacher-select-difficulty"
                                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:border-violet-400 outline-none"
                            >
                                {(
                                    Object.keys(
                                        KNOWLEDGE_DIFFICULTY_LABELS
                                    ) as KnowledgeDifficulty[]
                                ).map((diff) => (
                                    <option key={diff} value={diff}>
                                        {KNOWLEDGE_DIFFICULTY_LABELS[diff]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                            기초 설명 (한 줄 쉬운 뜻풀이)
                        </label>
                        <textarea
                            rows={2}
                            required
                            value={basicSummary}
                            onChange={(e) => setBasicSummary(e.target.value)}
                            placeholder="학생이 클릭했을 때 바로 이해할 수 있는 쉬운 한 줄 설명을 입력하세요."
                            data-testid="teacher-input-basic"
                            className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2 text-sm text-white focus:border-violet-400 outline-none resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                            더 알아보기 (심화 설명 및 배경지식)
                        </label>
                        <textarea
                            rows={3}
                            required
                            value={deepDive}
                            onChange={(e) => setDeepDive(e.target.value)}
                            placeholder="‘더 알아보기’를 눌렀을 때 펼쳐질 원리, 배경지식, 보충 설명을 입력하세요."
                            data-testid="teacher-input-deep"
                            className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2 text-sm text-white focus:border-violet-400 outline-none resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                            예문 / 활용 예시 (줄바꿈으로 구분)
                        </label>
                        <textarea
                            rows={2}
                            value={examplesText}
                            onChange={(e) => setExamplesText(e.target.value)}
                            placeholder="교과서 문장이나 실생활 예시를 한 줄에 하나씩 입력하세요."
                            className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2 text-xs text-white focus:border-violet-400 outline-none resize-none"
                        />
                    </div>

                    {/* Normalized Coordinates Summary */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1 font-semibold">
                            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                            <span>정규화 영역 좌표 (0.0~1.0)</span>
                        </span>
                        <span className="font-mono text-violet-300">
                            x:{bbox.x.toFixed(2)}, y:{bbox.y.toFixed(2)}, w:{bbox.width.toFixed(2)}, h:{bbox.height.toFixed(2)}
                        </span>
                    </div>

                    {/* Bundle Export / Import Toggle */}
                    <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleExportJson}
                                data-testid="teacher-export-bundle-btn"
                                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Download className="w-3.5 h-3.5 text-violet-400" />
                                <span>번들 내보내기 (.cbk-notes.json)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowBundlePanel((prev) => !prev)}
                                data-testid="teacher-toggle-import-btn"
                                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                                <span>번들 불러오기</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {initialAnnotation && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const next = deleteTeacherAnnotation(
                                            allAnnotations,
                                            initialAnnotation.id
                                        );
                                        onDeleteAnnotation(next, initialAnnotation.id);
                                        onClose();
                                    }}
                                    data-testid="teacher-delete-btn"
                                    className="py-2 px-3 rounded-xl bg-rose-900/50 hover:bg-rose-700 text-rose-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>삭제</span>
                                </button>
                            )}

                            <button
                                type="submit"
                                data-testid="teacher-save-btn"
                                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-violet-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Save className="w-4 h-4" />
                                <span>저장하기</span>
                            </button>
                        </div>
                    </div>
                </form>

                {showBundlePanel && (
                    <div
                        data-testid="teacher-bundle-panel"
                        className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-left"
                    >
                        <label className="block text-xs font-bold text-violet-300">
                            교사용 지식 번들 JSON (.cbk-notes.json)
                        </label>
                        <textarea
                            rows={5}
                            value={bundleJsonText}
                            onChange={(e) => setBundleJsonText(e.target.value)}
                            placeholder="여기에 .cbk-notes.json 내용을 붙여넣고 'JSON 적용'을 누르세요."
                            data-testid="teacher-bundle-textarea"
                            className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 font-mono text-xs text-slate-200 outline-none"
                        />
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleImportJson}
                                data-testid="teacher-import-apply-btn"
                                className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                <span>JSON 번들 적용</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

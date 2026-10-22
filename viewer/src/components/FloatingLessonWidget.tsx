import React, { useState, useEffect, useMemo } from 'react';
import type {
    LessonMaterialRef,
    LessonSchedulerConfig,
    SelfCheckItem
} from '../types/weeklyPlanMarket';
import {
    recommendMarketMaterials,
    bindMaterialToPeriod,
    unbindMaterialFromPeriod,
    getSelfCheckList,
    toggleSelfCheckItem,
    addSelfCheckTask,
    removeSelfCheckItem
} from '../utils/marketRecommender';
import {
    getLessonSchedulerConfig,
    saveLessonSchedulerConfig
} from '../utils/lessonScheduler';

export interface FloatingLessonWidgetProps {
    currentDay: string;
    currentPeriod: number | null;
    currentPeriodName: string;
    subject: string;
    topic: string;
    activeMaterials: LessonMaterialRef[];
    initialOpen?: boolean;
    initialTab?: 'materials' | 'selfcheck';
    onOpenFullscreenLesson: (material?: LessonMaterialRef) => void;
    onBindingsChanged?: () => void;
}

export function formatFullscreenActionLabel(
    period: number | null,
    periodName: string,
    subject: string
): string {
    const pLabel = periodName?.trim()
        ? periodName.trim()
        : period === 0
            ? '아침활동'
            : period && period > 0
                ? `${period}교시`
                : '현재 교시';
    const sLabel = subject?.trim() || '자율학습';
    return `${pLabel}: ${sLabel} 학습자료 전체화면 열기`;
}

export function calculateSelfCheckProgress(items: SelfCheckItem[]): {
    completedCount: number;
    totalCount: number;
    percent: number;
} {
    const totalCount = items.length;
    if (totalCount === 0) {
        return { completedCount: 0, totalCount: 0, percent: 0 };
    }
    const completedCount = items.filter(it => it.completed).length;
    const percent = Math.round((completedCount / totalCount) * 100);
    return { completedCount, totalCount, percent };
}

export default function FloatingLessonWidget({
    currentDay,
    currentPeriod,
    currentPeriodName,
    subject,
    topic,
    activeMaterials,
    initialOpen = false,
    initialTab = 'materials',
    onOpenFullscreenLesson,
    onBindingsChanged
}: FloatingLessonWidgetProps) {
    const [isOpen, setIsOpen] = useState<boolean>(initialOpen);
    const [activeTab, setActiveTab] = useState<'materials' | 'selfcheck'>(initialTab);
    const [schedulerConfig, setSchedulerConfig] = useState<LessonSchedulerConfig>(() =>
        getLessonSchedulerConfig()
    );
    const [selfCheckItems, setSelfCheckItems] = useState<SelfCheckItem[]>(() =>
        getSelfCheckList()
    );
    const [newTaskInput, setNewTaskInput] = useState<string>('');
    const [taskError, setTaskError] = useState<string | null>(null);

    useEffect(() => {
        setSelfCheckItems(getSelfCheckList());
        if (!isOpen || typeof window === 'undefined') return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const effectivePeriod = currentPeriod !== null ? currentPeriod : 1;
    const hasBoundMaterials = activeMaterials.length > 0;

    const recommendedMaterials = useMemo(() => {
        const recs = recommendMarketMaterials(subject || '공통', topic || '', undefined, 4);
        const boundIds = new Set(activeMaterials.map(m => m.id));
        return recs.filter(r => !boundIds.has(r.id)).slice(0, 3);
    }, [subject, topic, activeMaterials]);

    const progress = useMemo(
        () => calculateSelfCheckProgress(selfCheckItems),
        [selfCheckItems]
    );

    const attendanceItems = useMemo(
        () => selfCheckItems.filter(it => it.category === 'attendance'),
        [selfCheckItems]
    );
    const taskItems = useMemo(
        () => selfCheckItems.filter(it => it.category === 'task'),
        [selfCheckItems]
    );

    const handleToggleAutoFullscreen = () => {
        const updated = saveLessonSchedulerConfig({
            autoFullscreen: !schedulerConfig.autoFullscreen
        });
        setSchedulerConfig(updated);
    };

    const handleBindMaterial = (material: LessonMaterialRef) => {
        bindMaterialToPeriod(
            currentDay || '월',
            effectivePeriod,
            subject || material.subject,
            topic || '',
            material
        );
        onBindingsChanged?.();
    };

    const handleUnbindMaterial = (materialId: string) => {
        unbindMaterialFromPeriod(currentDay || '월', effectivePeriod, materialId);
        onBindingsChanged?.();
    };

    const handleToggleCheck = (id: string) => {
        const updated = toggleSelfCheckItem(id);
        setSelfCheckItems(updated);
    };

    const handleAddDailyTask = (e: React.FormEvent) => {
        e.preventDefault();
        setTaskError(null);
        if (!newTaskInput.trim()) return;
        try {
            const updated = addSelfCheckTask(newTaskInput.trim(), 'task');
            setSelfCheckItems(updated);
            setNewTaskInput('');
        } catch (err: any) {
            setTaskError(err?.message || '할 일을 추가할 수 없습니다.');
        }
    };

    const handleDeleteCheck = (id: string) => {
        const updated = removeSelfCheckItem(id);
        setSelfCheckItems(updated);
    };

    const actionButtonLabel = formatFullscreenActionLabel(
        currentPeriod,
        currentPeriodName,
        subject
    );

    return (
        <div
            className="fixed bottom-14 right-5 z-50 flex flex-col items-end no-drag select-none"
            data-testid="floating-lesson-widget"
        >
            {isOpen && (
                <div
                    className="mb-3 w-[360px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden transition-all"
                    data-testid="floating-lesson-popover"
                >
                    {/* Top Header */}
                    <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shrink-0">
                                <i className="fi fi-rr-graduation-cap text-sm leading-none" />
                            </span>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-extrabold text-emerald-400">
                                        {currentDay || '월'}요일 · {currentPeriodName || `${effectivePeriod}교시`}
                                    </span>
                                    {hasBoundMaterials && (
                                        <span className="inline-flex items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300 leading-none">
                                            자료 {activeMaterials.length}개 준비됨
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-bold text-white truncate break-keep">
                                    {subject || '자율활동'} {topic ? `· ${topic}` : ''}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white leading-none transition-colors"
                            title="위젯 닫기"
                        >
                            <i className="fi fi-rr-cross-small text-sm leading-none" />
                        </button>
                    </div>

                    {/* Tab Bar */}
                    <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 p-1 gap-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('materials')}
                            className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold leading-none transition-all border ${
                                activeTab === 'materials'
                                    ? 'bg-white text-indigo-700 border-slate-200 shadow-xs'
                                    : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
                            }`}
                        >
                            <i className="fi fi-rr-book-alt text-xs leading-none" />
                            <span>수업 자료</span>
                            {hasBoundMaterials && (
                                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-extrabold text-white leading-none">
                                    {activeMaterials.length}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('selfcheck')}
                            className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold leading-none transition-all border ${
                                activeTab === 'selfcheck'
                                    ? 'bg-white text-indigo-700 border-slate-200 shadow-xs'
                                    : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
                            }`}
                        >
                            <i className="fi fi-rr-list-check text-xs leading-none" />
                            <span>셀프체크</span>
                            <span className="inline-flex h-4 min-w-[20px] items-center justify-center rounded-full bg-indigo-100 px-1.5 text-[10px] font-extrabold text-indigo-700 leading-none">
                                {progress.percent}%
                            </span>
                        </button>
                    </div>

                    {/* Tab Content: 수업 자료 */}
                    {activeTab === 'materials' && (
                        <div className="p-4 space-y-3.5 max-h-[420px] overflow-y-auto">
                            {/* 1-Click Fullscreen Lesson Action Button */}
                            <button
                                type="button"
                                onClick={() => onOpenFullscreenLesson(activeMaterials[0])}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-3 border border-indigo-700 shadow-md transition-all leading-none break-keep"
                                data-testid="btn-open-fullscreen-lesson"
                            >
                                <i className="fi fi-rr-expand text-sm leading-none" />
                                <span>[{actionButtonLabel}]</span>
                            </button>

                            {/* Bound Materials for Current Period */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                                        <i className="fi fi-rr-folder-open text-indigo-600 text-xs leading-none" />
                                        <span>현재 교시 연동 자료 ({activeMaterials.length})</span>
                                    </span>
                                </div>

                                {activeMaterials.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center">
                                        <p className="text-xs font-semibold text-slate-600 break-keep">
                                            이 교시에 등록된 학습자료가 없습니다. 아래 올마켓 추천 자료를 1클릭으로 등록해 보세요.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {activeMaterials.map(mat => (
                                            <div
                                                key={mat.id}
                                                className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                                                            {mat.subject}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-800 truncate break-keep">
                                                            {mat.title}
                                                        </span>
                                                    </div>
                                                    {mat.description && (
                                                        <p className="mt-1 text-[11px] text-slate-600 line-clamp-1 break-keep">
                                                            {mat.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenFullscreenLesson(mat)}
                                                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-[11px] font-bold border border-emerald-700 leading-none transition-colors"
                                                        title="자료 바로 열기"
                                                    >
                                                        <i className="fi fi-rr-play text-[10px] leading-none" />
                                                        <span>열기</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUnbindMaterial(mat.id)}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-200 leading-none transition-colors"
                                                        title="교시 연동 해제"
                                                    >
                                                        <i className="fi fi-rr-trash text-xs leading-none" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Quick All-Market Recommendations */}
                            <div className="space-y-2 pt-1 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                                        <i className="fi fi-rr-sparkles text-amber-500 text-xs leading-none" />
                                        <span>올마켓 맞춤 추천 자료</span>
                                    </span>
                                    <span className="text-[11px] font-semibold text-slate-500">
                                        {subject || '공통'} 맞춤
                                    </span>
                                </div>
                                <div className="space-y-1.5">
                                    {recommendedMaterials.map(rec => (
                                        <div
                                            key={rec.id}
                                            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 hover:border-indigo-200 transition-colors"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-slate-800 truncate break-keep">
                                                    {rec.title}
                                                </p>
                                                <p className="text-[11px] text-slate-500 truncate break-keep">
                                                    {rec.description}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleBindMaterial(rec)}
                                                className="inline-flex items-center justify-center gap-1 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1.5 text-[11px] font-extrabold leading-none shrink-0 transition-colors"
                                            >
                                                <i className="fi fi-rr-plus-small text-xs leading-none" />
                                                <span>교시 등록</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Auto-Fullscreen Setting Toggle */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <i className="fi fi-rr-screen text-slate-500 text-xs leading-none" />
                                    <span className="text-xs font-bold text-slate-700 break-keep">
                                        수업 시작 시 자동 전체화면 전환
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={schedulerConfig.autoFullscreen}
                                    onClick={handleToggleAutoFullscreen}
                                    className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-extrabold border leading-none transition-colors ${
                                        schedulerConfig.autoFullscreen
                                            ? 'bg-indigo-600 text-white border-indigo-700'
                                            : 'bg-slate-100 text-slate-600 border-slate-300'
                                    }`}
                                >
                                    {schedulerConfig.autoFullscreen ? '켜짐' : '꺼짐'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab Content: 셀프체크 */}
                    {activeTab === 'selfcheck' && (
                        <div className="p-4 space-y-3.5 max-h-[420px] overflow-y-auto" data-testid="selfcheck-tab-panel">
                            {/* Progress Summary */}
                            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-extrabold text-indigo-900 flex items-center gap-1.5">
                                        <i className="fi fi-rr-check-circle text-indigo-600 text-xs leading-none" />
                                        <span>우리 반 자율 셀프체크 달성률</span>
                                    </span>
                                    <span className="text-xs font-extrabold text-indigo-700">
                                        {progress.completedCount} / {progress.totalCount} 완료 ({progress.percent}%)
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-600 transition-all duration-300"
                                        style={{ width: `${progress.percent}%` }}
                                    />
                                </div>
                                <p className="mt-1.5 text-[11px] text-slate-600 break-keep">
                                    학생 개인정보(실명·학번 등)를 수집하지 않는 익명 학급 자율 점검표입니다.
                                </p>
                            </div>

                            {/* Section 1: 오늘의 출결 확인 */}
                            <div className="space-y-1.5">
                                <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                                    <i className="fi fi-rr-user-check text-emerald-600 text-xs leading-none" />
                                    <span>오늘의 출결 확인</span>
                                </h4>
                                {attendanceItems.map(item => (
                                    <label
                                        key={item.id}
                                        className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 cursor-pointer transition-colors ${
                                            item.completed
                                                ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                                                : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <input
                                                type="checkbox"
                                                checked={item.completed}
                                                onChange={() => handleToggleCheck(item.id)}
                                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span
                                                className={`text-xs font-bold break-keep ${
                                                    item.completed ? 'line-through text-slate-500' : ''
                                                }`}
                                            >
                                                {item.label}
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>

                            {/* Section 2: 오늘 해야 할 일 */}
                            <div className="space-y-1.5">
                                <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                                    <i className="fi fi-rr-clipboard-list-check text-indigo-600 text-xs leading-none" />
                                    <span>오늘 해야 할 일</span>
                                </h4>
                                {taskItems.map(item => (
                                    <div
                                        key={item.id}
                                        className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 transition-colors ${
                                            item.completed
                                                ? 'border-indigo-200 bg-indigo-50/40 text-indigo-900'
                                                : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                                        }`}
                                    >
                                        <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={item.completed}
                                                onChange={() => handleToggleCheck(item.id)}
                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span
                                                className={`text-xs font-bold break-keep ${
                                                    item.completed ? 'line-through text-slate-500' : ''
                                                }`}
                                            >
                                                {item.label}
                                            </span>
                                        </label>
                                        {item.id.startsWith('sc-custom-') && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteCheck(item.id)}
                                                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 leading-none"
                                                title="항목 삭제"
                                            >
                                                <i className="fi fi-rr-trash text-[11px] leading-none" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Add New Mission Form */}
                            <form onSubmit={handleAddDailyTask} className="pt-1 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={newTaskInput}
                                        onChange={e => setNewTaskInput(e.target.value)}
                                        placeholder="오늘의 학급 미션 추가 (개인정보 입력 금지)"
                                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                                    />
                                    <button
                                        type="submit"
                                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 px-3 py-2 text-xs font-extrabold leading-none shrink-0"
                                    >
                                        <i className="fi fi-rr-plus-small text-xs leading-none" />
                                        <span>추가</span>
                                    </button>
                                </div>
                                {taskError && (
                                    <p className="text-[11px] font-bold text-rose-600 break-keep">
                                        {taskError}
                                    </p>
                                )}
                            </form>
                        </div>
                    )}
                </div>
            )}

            {/* Always-on Circular Floating Button */}
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className={`relative inline-flex h-14 w-14 items-center justify-center rounded-full border-2 shadow-xl transition-all leading-none ${
                    hasBoundMaterials
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-300'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-300'
                }`}
                title="수업 자료 및 자율 셀프체크 위젯 열기"
                data-testid="floating-lesson-trigger"
            >
                {hasBoundMaterials && (
                    <span
                        className="absolute -top-1 -right-1 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-amber-400 border-2 border-slate-900 px-1.5 text-[11px] font-black text-slate-950 shadow-sm animate-pulse leading-none"
                        data-testid="bound-materials-badge"
                    >
                        {activeMaterials.length}
                    </span>
                )}
                <i className="fi fi-rr-chalkboard-user text-xl leading-none" />
            </button>
        </div>
    );
}

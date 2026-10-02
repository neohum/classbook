import React, { useState, useEffect } from 'react';
import { 
    X, Clock, Plus, Trash2, Bell, Coffee, Check, RotateCcw, 
    GripVertical, ChevronUp, ChevronDown, ArrowUpDown, Sparkles 
} from 'lucide-react';
import { SaveBellSchedules, GetBellSchedules } from '../../wailsjs/go/main/App';

export interface ScheduleItem {
    id: string;
    period: number;
    name: string;
    startTime: string;
    endTime: string;
    startMessage: string;
    restMessage: string;
}

export function isLunchSchedule(name: string): boolean {
    if (!name) return false;
    const lower = name.toLowerCase().replace(/\s+/g, '');
    return lower.includes('점심') || lower.includes('급식');
}

export function isBreakSchedule(name: string): boolean {
    if (!name) return false;
    const lower = name.toLowerCase().replace(/\s+/g, '');
    if (isLunchSchedule(name)) return false;
    return lower.includes('준비시간') || 
           lower.includes('쉬는시간') || 
           lower.includes('휴식') || 
           lower.includes('청소');
}

export function parsePeriodFromName(name: string, fallbackNum?: number): number {
    if (!name) return fallbackNum !== undefined ? fallbackNum : 1;
    const trimmed = name.trim();
    if (isLunchSchedule(trimmed)) {
        return -1; // Lunch break
    }
    if (isBreakSchedule(trimmed)) {
        return -2; // Preparation or transition break
    }
    if (trimmed.includes('아침')) {
        return 0; // Morning activity
    }
    const match = trimmed.match(/(\d+)\s*교시/);
    if (match) {
        return parseInt(match[1], 10);
    }
    const digits = trimmed.replace(/[^0-9]/g, '');
    if (digits) {
        const parsed = parseInt(digits, 10);
        if (!isNaN(parsed)) return parsed;
    }
    return fallbackNum !== undefined ? fallbackNum : 1;
}

export function sanitizeScheduleItems(items: ScheduleItem[]): ScheduleItem[] {
    return items.map((item, idx) => {
        const name = (item.name || '').trim();
        const deducedPeriod = parsePeriodFromName(name, item.period !== undefined ? item.period : (idx + 1));
        return {
            ...item,
            period: deducedPeriod
        };
    });
}

export const DEFAULT_SCHEDULE: ScheduleItem[] = [
    { id: '0', period: 0, name: '아침활동', startTime: '08:40', endTime: '09:00', startMessage: '아침활동 시간입니다. 하루를 활기차게 시작해요!', restMessage: '1교시 수업 준비 시간입니다' },
    { id: '1', period: 1, name: '1교시', startTime: '09:00', endTime: '09:40', startMessage: '1교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '2', period: 2, name: '2교시', startTime: '09:50', endTime: '10:30', startMessage: '2교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '3', period: 3, name: '3교시', startTime: '10:40', endTime: '11:20', startMessage: '3교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '4', period: 4, name: '4교시', startTime: '11:30', endTime: '12:10', startMessage: '4교시 수업을 시작합니다.', restMessage: '점심시간입니다. 맛있는 점심 드세요!' },
    { id: 'lunch', period: -1, name: '점심시간', startTime: '12:10', endTime: '12:55', startMessage: '점심시간입니다. 즐겁고 안전한 점심시간 되세요!', restMessage: '5분 준비시간입니다' },
    { id: 'prep', period: -2, name: '5분 준비시간', startTime: '12:55', endTime: '13:00', startMessage: '5교시 시작 5분 전입니다. 수업 준비를 해주세요.', restMessage: '5교시 수업 시작합니다' },
    { id: '5', period: 5, name: '5교시', startTime: '13:00', endTime: '13:40', startMessage: '5교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '6', period: 6, name: '6교시', startTime: '13:50', endTime: '14:30', startMessage: '6교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
];

export function getStoredSchedule(): ScheduleItem[] {
    try {
        const saved = localStorage.getItem('classbook_schedule_v3');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return sanitizeScheduleItems(parsed);
            }
        }
    } catch (e) { }
    return DEFAULT_SCHEDULE;
}

export function saveStoredSchedule(schedules: ScheduleItem[]) {
    try {
        const jsonStr = JSON.stringify(schedules);
        localStorage.setItem('classbook_schedule_v3', jsonStr);
        window.dispatchEvent(new CustomEvent('classbook_schedule_updated', { detail: schedules }));
        SaveBellSchedules(jsonStr).catch(console.error);
    } catch (e) { }
}

function getNextDefaultTime(schedules: ScheduleItem[]): { startTime: string; endTime: string } {
    if (schedules.length === 0) {
        return { startTime: '09:00', endTime: '09:40' };
    }
    const last = schedules[schedules.length - 1];
    if (last && last.endTime) {
        const parts = last.endTime.split(':');
        if (parts.length === 2) {
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (!isNaN(h) && !isNaN(m)) {
                let startMinutes = h * 60 + m + 10; // 10분 쉬는 시간
                let endMinutes = startMinutes + 40;  // 40분 수업
                if (endMinutes >= 24 * 60) {
                    endMinutes = 23 * 60 + 59;
                }
                const sh = Math.floor(startMinutes / 60) % 24;
                const sm = startMinutes % 60;
                const eh = Math.floor(endMinutes / 60) % 24;
                const em = endMinutes % 60;
                return {
                    startTime: `${sh.toString().padStart(2, '0')}:${sm.toString().padStart(2, '0')}`,
                    endTime: `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`
                };
            }
        }
    }
    return { startTime: '14:40', endTime: '15:20' };
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onScheduleChanged?: (schedules: ScheduleItem[]) => void;
    extraHeaderButton?: React.ReactNode;
}

export default function ScheduleConfigModal({ isOpen, onClose, onScheduleChanged, extraHeaderButton }: Props) {
    const [localSchedules, setLocalSchedules] = useState<ScheduleItem[]>([]);
    const [highlightId, setHighlightId] = useState<string | null>(null);
    
    // Drag & Drop States
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dropTarget, setDropTarget] = useState<{ index: number; position: 'before' | 'after' } | null>(null);

    // New Time Input Form State
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newStartTime, setNewStartTime] = useState('');
    const [newEndTime, setNewEndTime] = useState('');
    const [newStartMsg, setNewStartMsg] = useState('');
    const [newRestMsg, setNewRestMsg] = useState('쉬는 시간입니다');

    useEffect(() => {
        if (isOpen) {
            const current = getStoredSchedule();
            setLocalSchedules(current);
            const nextTime = getNextDefaultTime(current);
            setNewStartTime(nextTime.startTime);
            setNewEndTime(nextTime.endTime);
            setNewName(`${current.length + 1}교시`);
            setNewStartMsg(`${current.length + 1}교시 수업을 시작합니다.`);
            setShowAddForm(false);
            setDraggedIndex(null);
            setDropTarget(null);

            // Synchronize with backend in case localStorage was modified externally
            GetBellSchedules().then(backendJson => {
                if (backendJson) {
                    try {
                        const parsed = JSON.parse(backendJson);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            const sanitized = sanitizeScheduleItems(parsed);
                            setLocalSchedules(sanitized);
                            try {
                                localStorage.setItem('classbook_schedule_v3', JSON.stringify(sanitized));
                            } catch (e) {}
                        }
                    } catch (e) {}
                }
            }).catch(() => {});
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        let schedulesToSave = [...localSchedules];

        // Critical: If the user opened the form and entered start/end times but forgot to click "추가" before clicking "저장 및 닫기", auto-commit!
        if (showAddForm && newStartTime && newEndTime) {
            const periodNum = parsePeriodFromName(newName, schedulesToSave.length + 1);
            const name = newName.trim() || (periodNum === 0 ? '아침활동' : (periodNum === -1 ? '점심시간' : `${periodNum}교시`));
            const newId = Math.random().toString(36).substring(2, 9);
            const newItem: ScheduleItem = {
                id: newId,
                period: periodNum,
                name: name,
                startTime: newStartTime,
                endTime: newEndTime,
                startMessage: newStartMsg.trim() || (periodNum === -1 ? '점심시간입니다. 즐겁고 안전한 점심시간 되세요!' : `${name} 수업을 시작합니다.`),
                restMessage: newRestMsg.trim() || (periodNum === -1 ? '5분 준비시간입니다' : '쉬는 시간입니다')
            };
            schedulesToSave.push(newItem);
        }

        schedulesToSave = sanitizeScheduleItems(schedulesToSave);
        // Always sort chronologically by startTime
        schedulesToSave.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

        saveStoredSchedule(schedulesToSave);
        if (onScheduleChanged) onScheduleChanged(schedulesToSave);
        onClose();
    };

    const handleReset = () => {
        if (window.confirm("시종 시간표와 알림 문구를 기본값(아침활동 + 1~6교시)으로 복원하시겠습니까?")) {
            setLocalSchedules(DEFAULT_SCHEDULE);
            saveStoredSchedule(DEFAULT_SCHEDULE);
        }
    };

    // Quick Add
    const handleQuickAdd = () => {
        const nextTime = getNextDefaultTime(localSchedules);
        const newPeriod = localSchedules.length + 1;
        const newId = Math.random().toString(36).substring(2, 9);
        const newItem: ScheduleItem = {
            id: newId,
            period: newPeriod,
            name: `${newPeriod}교시`,
            startTime: nextTime.startTime,
            endTime: nextTime.endTime,
            startMessage: `${newPeriod}교시 수업을 시작합니다.`,
            restMessage: '쉬는 시간입니다'
        };
        const updated = sanitizeScheduleItems([...localSchedules, newItem]).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        setLocalSchedules(updated);
        setHighlightId(newId);
        setTimeout(() => setHighlightId(null), 3000);
    };

    // Form Add (새로운 시간 입력)
    const handleFormAdd = () => {
        if (!newStartTime || !newEndTime) {
            alert("시작 시간과 종료 시간을 입력해주세요.");
            return;
        }
        const periodNum = parsePeriodFromName(newName, localSchedules.length + 1);
        const name = newName.trim() || (periodNum === 0 ? '아침활동' : (periodNum === -1 ? '점심시간' : `${periodNum}교시`));
        const newId = Math.random().toString(36).substring(2, 9);
        const newItem: ScheduleItem = {
            id: newId,
            period: periodNum,
            name: name,
            startTime: newStartTime,
            endTime: newEndTime,
            startMessage: newStartMsg.trim() || (periodNum === -1 ? '점심시간입니다. 즐겁고 안전한 점심시간 되세요!' : `${name} 수업을 시작합니다.`),
            restMessage: newRestMsg.trim() || (periodNum === -1 ? '5분 준비시간입니다' : '쉬는 시간입니다')
        };
        const updated = sanitizeScheduleItems([...localSchedules, newItem]).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        setLocalSchedules(updated);
        setHighlightId(newId);
        setTimeout(() => setHighlightId(null), 3000);

        // Prep next defaults
        const nextTime = getNextDefaultTime(updated);
        setNewName(`${updated.length + 1}교시`);
        setNewStartTime(nextTime.startTime);
        setNewEndTime(nextTime.endTime);
        setNewStartMsg(`${updated.length + 1}교시 수업을 시작합니다.`);
        setShowAddForm(false);
    };

    const handleDelete = (id: string) => {
        setLocalSchedules(prev => prev.filter(s => s.id !== id));
    };

    // Move Up/Down buttons
    const handleMoveUp = (index: number) => {
        if (index <= 0) return;
        setLocalSchedules(prev => {
            const next = [...prev];
            const temp = next[index - 1];
            next[index - 1] = next[index];
            next[index] = temp;
            return next;
        });
    };

    const handleMoveDown = (index: number) => {
        if (index >= localSchedules.length - 1) return;
        setLocalSchedules(prev => {
            const next = [...prev];
            const temp = next[index + 1];
            next[index + 1] = next[index];
            next[index] = temp;
            return next;
        });
    };

    // Sort by Time
    const handleSortByTime = () => {
        setLocalSchedules(prev => {
            return [...prev].sort((a, b) => a.startTime.localeCompare(b.startTime));
        });
    };

    // Drag and Drop Handlers
    const handleDragStart = (e: React.DragEvent, index: number) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') {
            e.preventDefault();
            return;
        }
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const position: 'before' | 'after' = e.clientY < midY ? 'before' : 'after';
        
        if (!dropTarget || dropTarget.index !== index || dropTarget.position !== position) {
            setDropTarget({ index, position });
        }
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || !dropTarget) {
            setDraggedIndex(null);
            setDropTarget(null);
            return;
        }

        const { position } = dropTarget;
        
        // Don't reorder if dropping in the same position
        if (draggedIndex === targetIndex) {
            setDraggedIndex(null);
            setDropTarget(null);
            return;
        }

        setLocalSchedules(prev => {
            const next = [...prev];
            const [moved] = next.splice(draggedIndex, 1);
            let insertIndex = targetIndex + (position === 'after' ? 1 : 0);
            if (draggedIndex < insertIndex) {
                insertIndex -= 1;
            }
            next.splice(insertIndex, 0, moved);
            return next;
        });

        setDraggedIndex(null);
        setDropTarget(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDropTarget(null);
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in select-none">
            <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-white">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-violet-600/20 text-violet-400 rounded-2xl border border-violet-500/30">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-white">시종 시간 및 알림 문구 설정</h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                시간을 직접 입력하고, 드래그 앤 드롭으로 순서를 자유롭게 조정할 수 있습니다.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {extraHeaderButton}
                        <button
                            onClick={handleSortByTime}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-slate-700/60 cursor-pointer"
                            title="시작 시간순으로 자동 정렬"
                        >
                            <ArrowUpDown className="w-3.5 h-3.5 text-violet-400" />
                            <span>시간순 정렬</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                            title="닫기"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {/* New Time Input Form Toggle / Container */}
                    {showAddForm ? (
                        <div className="bg-gradient-to-br from-violet-950/40 to-slate-900/90 border-2 border-violet-500/50 rounded-2xl p-4.5 shadow-xl animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-violet-500/20">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-violet-400" />
                                    <span className="font-bold text-sm text-violet-200">새로운 시간 및 알림 문구 입력</span>
                                </div>
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    className="text-xs text-slate-400 hover:text-white transition-colors"
                                >
                                    닫기
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                                        구분 / 교시명
                                    </label>
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleFormAdd(); }}
                                        placeholder="예: 아침활동, 7교시"
                                        className="w-full bg-slate-950 text-white font-bold text-sm px-3 py-2 rounded-xl border border-violet-500/30 focus:border-violet-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                                        시작 시간
                                    </label>
                                    <input
                                        type="time"
                                        value={newStartTime}
                                        onChange={(e) => setNewStartTime(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleFormAdd(); }}
                                        className="w-full bg-slate-950 text-white font-mono font-bold text-sm px-3 py-2 rounded-xl border border-violet-500/30 focus:border-violet-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                                        종료 시간
                                    </label>
                                    <input
                                        type="time"
                                        value={newEndTime}
                                        onChange={(e) => setNewEndTime(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleFormAdd(); }}
                                        className="w-full bg-slate-950 text-white font-mono font-bold text-sm px-3 py-2 rounded-xl border border-violet-500/30 focus:border-violet-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="text-[11px] font-semibold text-violet-300 flex items-center gap-1.5 mb-1">
                                        <Bell className="w-3.5 h-3.5 text-violet-400" />
                                        시작 시 알림 문구
                                    </label>
                                    <input
                                        type="text"
                                        value={newStartMsg}
                                        onChange={(e) => setNewStartMsg(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleFormAdd(); }}
                                        placeholder="수업 시작 시 화면에 뜰 문구"
                                        className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700 focus:border-violet-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
                                        <Coffee className="w-3.5 h-3.5 text-amber-400" />
                                        종료(쉬는 시간) 알림 문구
                                    </label>
                                    <input
                                        type="text"
                                        value={newRestMsg}
                                        onChange={(e) => setNewRestMsg(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleFormAdd(); }}
                                        placeholder="쉬는 시간입니다"
                                        className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700 focus:border-amber-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleFormAdd}
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
                                    title="입력한 시간을 목록에 추가하고 시간순으로 정렬합니다"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>시간표 목록에 추가 (+)</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-2xl p-3">
                            <span className="text-xs text-slate-400 pl-2">
                                💡 각 항목의 왼쪽 손잡이(<GripVertical className="w-3 h-3 inline text-slate-400" />)를 잡고 위아래로 끌어다 놓으면 순서가 바뀝니다.
                            </span>
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/30 hover:bg-violet-600 text-violet-200 hover:text-white border border-violet-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>새로운 시간 직접 입력</span>
                            </button>
                        </div>
                    )}

                    {/* Schedule List with Drag & Drop */}
                    <div className="space-y-3">
                        {localSchedules.map((schedule, idx) => {
                            const isBeingDragged = draggedIndex === idx;
                            const isHighlighted = schedule.id === highlightId;
                            const showLineBefore = dropTarget?.index === idx && dropTarget?.position === 'before' && draggedIndex !== idx;
                            const showLineAfter = dropTarget?.index === idx && dropTarget?.position === 'after' && draggedIndex !== idx;

                            return (
                                <React.Fragment key={schedule.id}>
                                    {showLineBefore && (
                                        <div className="h-1.5 bg-violet-400 rounded-full shadow-[0_0_12px_rgba(167,139,250,0.9)] my-1.5 transition-all animate-pulse" />
                                    )}
                                    <div
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, idx)}
                                        onDragOver={(e) => handleDragOver(e, idx)}
                                        onDrop={(e) => handleDrop(e, idx)}
                                        onDragEnd={handleDragEnd}
                                        className={`bg-slate-800/80 border rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 ${
                                            isBeingDragged 
                                                ? 'opacity-30 scale-[0.98] border-violet-500 ring-2 ring-violet-500/50 bg-slate-900' 
                                                : isHighlighted
                                                    ? 'border-emerald-400 ring-2 ring-emerald-400/80 bg-slate-800/95 shadow-[0_0_20px_rgba(52,211,153,0.3)] animate-pulse'
                                                    : 'border-slate-700/70 hover:border-slate-600'
                                        }`}
                                    >
                                    {/* Top Row: Drag Handle, Number, Name, Times, Reorder Buttons, Delete */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 select-none">
                                        <div className="flex items-center gap-2.5 flex-wrap flex-1">
                                            {/* Drag Handle */}
                                            <div 
                                                className="cursor-grab active:cursor-grabbing p-1.5 text-slate-500 hover:text-violet-300 hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center shrink-0"
                                                title="마우스로 끌어서 순서 변경"
                                            >
                                                <GripVertical className="w-4 h-4" />
                                            </div>

                                            {/* Order Number Badge */}
                                            <span className={`w-8 h-7 px-1 rounded-xl font-black text-xs flex items-center justify-center border shrink-0 ${
                                                schedule.period === 0 || schedule.name.includes('아침')
                                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px]'
                                                    : (isLunchSchedule(schedule.name) || schedule.period === -1)
                                                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 text-[11px]'
                                                        : (isBreakSchedule(schedule.name) || schedule.period === -2)
                                                            ? 'bg-slate-700/60 text-slate-300 border-slate-600/40 text-[11px]'
                                                            : 'bg-violet-600/30 text-violet-300 border-violet-500/30'
                                            }`}>
                                                {schedule.period === 0 || schedule.name.includes('아침') 
                                                    ? '아침' 
                                                    : (isLunchSchedule(schedule.name) || schedule.period === -1)
                                                        ? '점심'
                                                        : (isBreakSchedule(schedule.name) || schedule.period === -2)
                                                            ? '휴식'
                                                            : (schedule.period !== undefined && schedule.period > 0 ? schedule.period : (idx + 1))}
                                            </span>

                                            {/* Name Input */}
                                            <input
                                                type="text"
                                                value={schedule.name}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const autoPeriod = parsePeriodFromName(val, schedule.period);
                                                    setLocalSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, name: val, period: autoPeriod } : s));
                                                }}
                                                className="bg-slate-900 text-white font-bold text-sm sm:text-base px-3 py-1.5 rounded-xl border border-slate-700 focus:border-violet-500 outline-none w-28 sm:w-32"
                                                placeholder="예: 1교시"
                                            />

                                            {/* Time Inputs */}
                                            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-700">
                                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <input
                                                    type="time"
                                                    value={schedule.startTime}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setLocalSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, startTime: val } : s));
                                                    }}
                                                    className="bg-transparent text-white font-mono font-bold outline-none text-xs sm:text-sm"
                                                    title="시작 시간"
                                                />
                                                <span className="text-slate-500 font-bold text-xs">~</span>
                                                <input
                                                    type="time"
                                                    value={schedule.endTime}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setLocalSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, endTime: val } : s));
                                                    }}
                                                    className="bg-transparent text-white font-mono font-bold outline-none text-xs sm:text-sm"
                                                    title="종료 시간"
                                                />
                                            </div>
                                        </div>

                                        {/* Action buttons: Move Up, Move Down, Delete */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => handleMoveUp(idx)}
                                                disabled={idx === 0}
                                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                                    idx === 0 
                                                        ? 'text-slate-600 cursor-not-allowed' 
                                                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                                }`}
                                                title="위로 이동"
                                            >
                                                <ChevronUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleMoveDown(idx)}
                                                disabled={idx === localSchedules.length - 1}
                                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                                    idx === localSchedules.length - 1 
                                                        ? 'text-slate-600 cursor-not-allowed' 
                                                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                                }`}
                                                title="아래로 이동"
                                            >
                                                <ChevronDown className="w-4 h-4" />
                                            </button>
                                            <div className="w-px h-4 bg-slate-700/80 mx-1" />
                                            <button
                                                onClick={() => handleDelete(schedule.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                title="이 교시 삭제"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Bottom Row: Start Message & Rest Message */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2.5 border-t border-slate-700/50">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[11px] font-semibold text-violet-300 flex items-center gap-1.5">
                                                <Bell className="w-3.5 h-3.5 text-violet-400" />
                                                수업 시작 시 알림 문구:
                                            </label>
                                            <input
                                                type="text"
                                                value={schedule.startMessage || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setLocalSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, startMessage: val } : s));
                                                }}
                                                placeholder="수업 시작 시 표시될 문구 입력"
                                                className="bg-slate-900 text-slate-200 text-xs sm:text-sm px-3 py-1.5 rounded-xl border border-slate-700 focus:border-violet-500 outline-none placeholder:text-slate-500"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                                                <Coffee className="w-3.5 h-3.5 text-amber-400" />
                                                수업 종료 (쉬는 시간) 알림 문구:
                                            </label>
                                            <input
                                                type="text"
                                                value={schedule.restMessage || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setLocalSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, restMessage: val } : s));
                                                }}
                                                placeholder="쉬는 시간입니다 (기본)"
                                                className="bg-slate-900 text-slate-200 text-xs sm:text-sm px-3 py-1.5 rounded-xl border border-slate-700 focus:border-amber-500 outline-none placeholder:text-slate-500"
                                            />
                                        </div>
                                    </div>
                                    </div>
                                    {showLineAfter && (
                                        <div className="h-1.5 bg-violet-400 rounded-full shadow-[0_0_12px_rgba(167,139,250,0.9)] my-1.5 transition-all animate-pulse" />
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {/* Drop zone to move item to the very bottom */}
                        {draggedIndex !== null && (
                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (localSchedules.length > 0) {
                                        setDropTarget({ index: localSchedules.length - 1, position: 'after' });
                                    }
                                }}
                                onDrop={(e) => {
                                    if (localSchedules.length > 0) {
                                        handleDrop(e, localSchedules.length - 1);
                                    }
                                }}
                                className={`p-4 border-2 border-dashed rounded-2xl flex items-center justify-center transition-all ${
                                    dropTarget?.index === localSchedules.length - 1 && dropTarget?.position === 'after'
                                        ? 'border-violet-400 bg-violet-950/50 text-violet-300 scale-[1.01] shadow-lg'
                                        : 'border-slate-700/60 hover:border-slate-600 text-slate-500'
                                }`}
                            >
                                <span className="text-xs font-bold">이곳에 놓으면 맨 끝 순서로 이동합니다</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Toolbar */}
                <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
                    <button
                        onClick={handleQuickAdd}
                        className="flex items-center gap-2 px-4 py-2 border border-dashed border-violet-500/50 hover:border-violet-500 hover:bg-violet-500/10 text-violet-300 rounded-xl transition-all font-semibold text-sm cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>다음 교시 자동 추가</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 px-3.5 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>기본값 복원</span>
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-1.5 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl shadow-lg shadow-violet-600/30 transition-all text-sm cursor-pointer active:scale-95"
                        >
                            <Check className="w-4 h-4" />
                            <span>저장 및 닫기</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

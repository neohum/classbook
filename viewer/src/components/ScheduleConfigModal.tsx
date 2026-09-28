import React, { useState, useEffect } from 'react';
import { X, Clock, Plus, Trash2, Bell, Coffee, Check, RotateCcw } from 'lucide-react';

export interface ScheduleItem {
    id: string;
    period: number;
    name: string;
    startTime: string;
    endTime: string;
    startMessage: string;
    restMessage: string;
}

export const DEFAULT_SCHEDULE: ScheduleItem[] = [
    { id: '1', period: 1, name: '1교시', startTime: '09:00', endTime: '09:40', startMessage: '1교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '2', period: 2, name: '2교시', startTime: '09:50', endTime: '10:30', startMessage: '2교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '3', period: 3, name: '3교시', startTime: '10:40', endTime: '11:20', startMessage: '3교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '4', period: 4, name: '4교시', startTime: '11:30', endTime: '12:10', startMessage: '4교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '5', period: 5, name: '5교시', startTime: '13:00', endTime: '13:40', startMessage: '5교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
    { id: '6', period: 6, name: '6교시', startTime: '13:50', endTime: '14:30', startMessage: '6교시 수업을 시작합니다.', restMessage: '쉬는 시간입니다' },
];

export function getStoredSchedule(): ScheduleItem[] {
    try {
        const saved = localStorage.getItem('classbook_schedule_v3');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (e) { }
    return DEFAULT_SCHEDULE;
}

export function saveStoredSchedule(schedules: ScheduleItem[]) {
    try {
        localStorage.setItem('classbook_schedule_v3', JSON.stringify(schedules));
        window.dispatchEvent(new CustomEvent('classbook_schedule_updated', { detail: schedules }));
    } catch (e) { }
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onScheduleChanged?: (schedules: ScheduleItem[]) => void;
}

export default function ScheduleConfigModal({ isOpen, onClose, onScheduleChanged }: Props) {
    const [localSchedules, setLocalSchedules] = useState<ScheduleItem[]>([]);

    useEffect(() => {
        if (isOpen) {
            setLocalSchedules(getStoredSchedule());
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        saveStoredSchedule(localSchedules);
        if (onScheduleChanged) onScheduleChanged(localSchedules);
        onClose();
    };

    const handleReset = () => {
        if (window.confirm("시종 시간표와 알림 문구를 기본값으로 복원하시겠습니까?")) {
            setLocalSchedules(DEFAULT_SCHEDULE);
        }
    };

    const handleAdd = () => {
        const newPeriod = localSchedules.length + 1;
        const newId = Math.random().toString(36).substring(2, 9);
        setLocalSchedules(prev => [
            ...prev,
            {
                id: newId,
                period: newPeriod,
                name: `${newPeriod}교시`,
                startTime: '14:40',
                endTime: '15:20',
                startMessage: `${newPeriod}교시 수업을 시작합니다.`,
                restMessage: '쉬는 시간입니다'
            }
        ]);
    };

    const handleDelete = (id: string) => {
        setLocalSchedules(prev => prev.filter(s => s.id !== id));
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden text-white">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-violet-600/20 text-violet-400 rounded-2xl border border-violet-500/30">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-white">시종 시간 및 알림 문구 설정</h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                교시별 시작/종료 시간과 수업 시작 시 안내, 수업 종료(쉬는 시간) 시 알림 문구를 관리합니다.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        title="닫기"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Schedule List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {localSchedules.map((schedule, idx) => (
                        <div
                            key={schedule.id}
                            className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-4 flex flex-col gap-3 transition-all hover:border-violet-500/50"
                        >
                            {/* Time & Name row */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className="w-7 h-7 rounded-xl bg-violet-600/30 text-violet-300 font-black text-sm flex items-center justify-center border border-violet-500/30">
                                        {idx + 1}
                                    </span>
                                    <input
                                        type="text"
                                        value={schedule.name}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setLocalSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, name: val } : s));
                                        }}
                                        className="bg-slate-900 text-white font-bold text-base px-3 py-1.5 rounded-xl border border-slate-700 focus:border-violet-500 outline-none w-32"
                                        placeholder="예: 1교시"
                                    />
                                    <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
                                        <Clock className="w-4 h-4 text-slate-400" />
                                        <input
                                            type="time"
                                            value={schedule.startTime}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setLocalSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, startTime: val } : s));
                                            }}
                                            className="bg-transparent text-white font-mono font-bold outline-none text-sm"
                                        />
                                        <span className="text-slate-500 font-bold">~</span>
                                        <input
                                            type="time"
                                            value={schedule.endTime}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setLocalSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, endTime: val } : s));
                                            }}
                                            className="bg-transparent text-white font-mono font-bold outline-none text-sm"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDelete(schedule.id)}
                                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                                    title="이 교시 삭제"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Message inputs row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2.5 border-t border-slate-700/50">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
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
                                        className="bg-slate-900 text-slate-200 text-sm px-3 py-2 rounded-xl border border-slate-700 focus:border-violet-500 outline-none placeholder:text-slate-500"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
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
                                        className="bg-slate-900 text-slate-200 text-sm px-3 py-2 rounded-xl border border-slate-700 focus:border-amber-500 outline-none placeholder:text-slate-500"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Toolbar */}
                <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3">
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-violet-500/50 hover:border-violet-500 hover:bg-violet-500/10 text-violet-300 rounded-xl transition-all font-semibold text-sm cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>새 교시 추가</span>
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

import React from 'react';
import { BookOpen, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';

interface Props {
    isOpen: boolean;
    title: string;
    current: number;
    total: number;
    percent: number;
    statusText: string;
    detectedOffset?: number | string | null;
}

export default function ConversionProgressModal({
    isOpen,
    title,
    current,
    total,
    percent,
    statusText,
    detectedOffset
}: Props) {
    if (!isOpen) return null;

    const clampedPercent = Math.min(Math.max(0, percent || 0), 100);

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200 pointer-events-auto">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-7 overflow-hidden text-center relative animate-in zoom-in-95 duration-200">
                {/* Top glow aura */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-violet-400/20 rounded-full blur-2xl pointer-events-none" />

                {/* Animated Icon */}
                <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <div className="absolute inset-0 bg-violet-500/20 rounded-2xl animate-ping opacity-60" />
                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <BookOpen className="w-8 h-8 animate-pulse" />
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-black text-slate-900 mb-1">
                    교과서 가져오기 및 고속 변환
                </h3>
                <div className="inline-block px-3 py-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 max-w-sm truncate mb-5">
                    {title || "교과서 자료"}
                </div>

                {/* Left-to-Right Animated Progress Bar (좌우 막대 애니메이션) */}
                <div className="mb-3">
                    <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 shadow-inner relative">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600 transition-all duration-300 relative overflow-hidden"
                            style={{ width: `${clampedPercent}%` }}
                        >
                            {/* Moving horizontal light stripe (좌우 이동 빛 애니메이션) */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite]" />
                        </div>
                    </div>
                </div>

                {/* Percentage & Page Counter */}
                <div className="flex items-center justify-between mb-4 px-1">
                    <span className="text-xs font-bold text-slate-400">
                        {total > 0 ? `${current} / ${total} 페이지` : "준비 중..."}
                    </span>
                    <span className="text-2xl font-black text-violet-700 font-mono tracking-tight">
                        {clampedPercent}%
                    </span>
                </div>

                {/* Status Description */}
                <div className="p-3 bg-violet-50/70 border border-violet-100 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-violet-900 mb-4 min-h-[44px]">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-600 shrink-0" />
                    <span className="truncate">{statusText || "고화질 페이지 이미지를 안전하게 추출하고 있습니다..."}</span>
                </div>

                {/* Detected Offset Badge */}
                {detectedOffset && detectedOffset !== "" && (
                    <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>실제 교재 시작 쪽수 감지됨 (오프셋: {detectedOffset})</span>
                    </div>
                )}

                {/* Safety Tip */}
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                    대용량 파일(500MB+)도 메모리 부족 없이 안전하게 처리됩니다.<br />
                    변환이 완료될 때까지 잠시만 기다려주세요.
                </p>
            </div>
        </div>
    );
}

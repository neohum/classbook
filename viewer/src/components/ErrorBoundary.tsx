import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallbackTitle?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[200px] p-6 bg-slate-900 text-slate-100 rounded-3xl border border-red-500/30 flex flex-col items-center justify-center text-center gap-4 m-4 shadow-2xl">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">
                            {this.props.fallbackTitle || "화면을 불러오는 중 오류가 발생했습니다"}
                        </h3>
                        <p className="text-xs text-slate-400 max-w-md break-words font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                            {this.state.error?.message || "알 수 없는 오류가 발생했습니다."}
                        </p>
                    </div>
                    <button
                        onClick={this.handleReset}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>다시 시도</span>
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

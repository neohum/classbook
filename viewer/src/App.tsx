import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage';
import ViewerPage from './pages/ViewerPage';
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';
import { DownloadAndInstallUpdate } from '../wailsjs/go/main/App';
import { main } from '../wailsjs/go/models';
import { Loader2 } from 'lucide-react';

import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const [updateStatus, setUpdateStatus] = useState<main.UpdateStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleUpdate = (status: main.UpdateStatus) => {
      setUpdateStatus(status);
      setIsUpdating(true);
      // 무인 자동 업데이트: 교사의 수동 클릭 대기 없이 즉시 다운로드 및 자동 사일런트 설치 진행
      DownloadAndInstallUpdate(status.downloadUrl, status.latestVer);
    };

    EventsOn('update-available', handleUpdate);
    return () => EventsOff('update-available');
  }, []);

  return (
    <>
      <ErrorBoundary title="화면 오류">
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/viewer/:bookId" element={<ViewerPage />} />
        </Routes>
      </ErrorBoundary>

      {/* 무인 자동 업데이트 진행 오버레이 */}
      {updateStatus && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-auto">
          <div className="bg-slate-800/95 border border-violet-500/60 rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="w-16 h-16 bg-violet-600/20 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-violet-500/30">
              <Loader2 className="w-9 h-9 animate-spin text-violet-400" />
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">무인 자동 업데이트 진행 중</h3>
            <p className="text-slate-300 mb-5 text-sm leading-relaxed">
              새로운 최신 버전(<span className="text-violet-400 font-bold">v{updateStatus.latestVer}</span>)이 감지되어<br />
              자동으로 다운로드 및 업데이트를 진행하고 있습니다.<br />
              설치 완료 후 자동으로 프로그램이 다시 시작됩니다.
            </p>

            <div className="py-3 px-4 bg-slate-900/90 rounded-2xl border border-slate-700/80 flex items-center justify-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-slate-300">최신 파일 다운로드 및 무인 사일런트 설치 중...</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;

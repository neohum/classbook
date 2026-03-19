import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage';
import ViewerPage from './pages/ViewerPage';
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';
import { DownloadAndInstallUpdate } from '../wailsjs/go/main/App';
import { main } from '../wailsjs/go/models';
import { Loader2 } from 'lucide-react';

function App() {
  const [updateStatus, setUpdateStatus] = useState<main.UpdateStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleUpdate = (status: main.UpdateStatus) => {
      setUpdateStatus(status);
    };

    EventsOn('update-available', handleUpdate);
    return () => EventsOff('update-available');
  }, []);

  const handleUpdateAccept = () => {
    if (updateStatus) {
      setIsUpdating(true);
      DownloadAndInstallUpdate(updateStatus.downloadUrl, updateStatus.latestVer);
    }
  };

  return (
    <>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/viewer/:bookId" element={<ViewerPage />} />
      </Routes>

      {/* Global Update Modal */}
      {updateStatus && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
          <div className="bg-slate-800 border border-violet-500/50 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="w-16 h-16 bg-violet-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>

            {isUpdating ? (
              <>
                <h3 className="text-xl font-bold text-white mb-2">다운로드 중...</h3>
                <p className="text-slate-300 mb-6 text-sm">
                  업데이트 파일을 받고 있습니다. 완료 후 자동으로 재시작됩니다. 잠시만 기다려주세요.
                </p>
                <div className="flex justify-center mb-2">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-white mb-2">새 업데이트 알림</h3>
                <p className="text-slate-300 mb-6">
                  새로운 버전(v{updateStatus.latestVer})이 출시되었습니다.<br />지금 업데이트 하시겠습니까?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setUpdateStatus(null)}
                    className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors font-medium"
                  >
                    나중에
                  </button>
                  <button
                    onClick={handleUpdateAccept}
                    className="flex-1 py-3 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors font-medium shadow-lg shadow-violet-500/30"
                  >
                    지금 업데이트
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;

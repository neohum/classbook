import { Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage';
import ViewerPage from './pages/ViewerPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/viewer/:bookId" element={<ViewerPage />} />
    </Routes>
  );
}

export default App;

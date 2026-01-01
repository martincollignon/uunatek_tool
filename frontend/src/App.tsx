import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { PageLoadingFallback } from './components/fallbacks/PageLoadingFallback';

const HomePage = lazy(() => import('./pages/HomePage'));
const EditorPage = lazy(() => import('./pages/EditorPage'));
const PlotPage = lazy(() => import('./pages/PlotPage'));

function App() {
  return (
    <div className="app">
      <Header />
      <main className="main">
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/editor/:projectId" element={<EditorPage />} />
            <Route path="/plot/:projectId" element={<PlotPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default App;

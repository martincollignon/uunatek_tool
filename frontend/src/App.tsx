import { Suspense, lazy, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { PageLoadingFallback } from './components/fallbacks/PageLoadingFallback';
import { usePlotterStore } from './stores/plotterStore';
import { isSerialAvailable } from './lib/serial';

const HomePage = lazy(() => import('./pages/HomePage'));
const EditorPage = lazy(() => import('./pages/EditorPage'));
const PlotPage = lazy(() => import('./pages/PlotPage'));

function App() {
  const { initialize, listPorts, connect, status, availablePorts } = usePlotterStore();
  const hasAttemptedAutoConnect = useRef(false);

  // Initialize plotter store on app mount
  useEffect(() => {
    if (isSerialAvailable()) {
      initialize();
      listPorts();
    }
  }, [initialize, listPorts]);

  // Auto-connect when plotter is detected
  useEffect(() => {
    // Only attempt once
    if (hasAttemptedAutoConnect.current) return;

    if (availablePorts.length > 0 && !status?.connected) {
      const timeoutId = setTimeout(async () => {
        try {
          const compatiblePort = availablePorts.find(p => p.isCompatible);
          if (compatiblePort) {
            console.log('[App] Auto-connecting to plotter:', compatiblePort.path);
            await connect(compatiblePort.path);
            hasAttemptedAutoConnect.current = true;
          }
        } catch (err) {
          console.error('[App] Auto-connect failed:', err);
          hasAttemptedAutoConnect.current = true;
        }
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [availablePorts, status?.connected, connect]);

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

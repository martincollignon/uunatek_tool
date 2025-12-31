import { Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { HomePage } from './pages/HomePage';
import { EditorPage } from './pages/EditorPage';
import { PlotPage } from './pages/PlotPage';

function App() {
  return (
    <div className="app">
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/editor/:projectId" element={<EditorPage />} />
          <Route path="/plot/:projectId" element={<PlotPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

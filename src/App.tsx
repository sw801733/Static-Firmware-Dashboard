import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import SessionsPage from './components/sessions/SessionsPage';
import UploadPage from './components/upload/UploadPage';
import ReferenceUploadPage from './components/upload/ReferenceUploadPage';
import OverviewPage from './components/overview/OverviewPage';
import ComparePage from './components/compare/ComparePage';
import HotspotPage from './components/hotspot/HotspotPage';
import TrendsPage from './components/trends/TrendsPage';
import WorkBoardPage from './components/workboard/WorkBoardPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<SessionsPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/reference" element={<ReferenceUploadPage />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/hotspot" element={<HotspotPage />} />
            <Route path="/trends" element={<TrendsPage />} />
            <Route path="/workboard" element={<WorkBoardPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;

import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAppSelector } from './store';
import Layout, { Toasts } from './components/Layout';
import Landing from './pages/Landing';

// The studio and the client portal are code-split: the public site loads without them.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const Proposal = lazy(() => import('./pages/Proposal'));
const Clients = lazy(() => import('./pages/Clients'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectWorkspace = lazy(() => import('./pages/ProjectWorkspace'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Finance = lazy(() => import('./pages/Finance'));
const Insights = lazy(() => import('./pages/Insights'));
const Planner = lazy(() => import('./pages/Planner'));
const PaletteStudio = lazy(() => import('./pages/PaletteStudio'));
const Materials = lazy(() => import('./pages/Materials'));
const Inspirations = lazy(() => import('./pages/Inspirations'));
const Portal = lazy(() => import('./pages/Portal'));

export default function App() {
  const theme = useAppSelector(s => s.ui.theme);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    // HashRouter: deep links work on static hosting (GitHub Pages) without server rewrites.
    <HashRouter>
      <Suspense fallback={<div className="page" />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/portal" element={<Portal />} />
          <Route path="/portal/:projectId" element={<Portal />} />
          <Route path="/studio" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="proposal" element={<Proposal />} />
            <Route path="clients" element={<Clients />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectWorkspace />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="finance" element={<Finance />} />
            <Route path="insights" element={<Insights />} />
            <Route path="planner" element={<Planner />} />
            <Route path="palette" element={<PaletteStudio />} />
            <Route path="materials" element={<Materials />} />
            <Route path="inspirations" element={<Inspirations />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toasts />
    </HashRouter>
  );
}

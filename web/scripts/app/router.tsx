import { createHashRouter, type RouteObject } from 'react-router';
import { AppShell } from './shell/AppShell';
import RouteErrorPage from './RouteErrorPage';
import OverviewPage from './pages/OverviewPage';
import StagePage from './pages/StagePage';
import LessonPage from './pages/LessonPage';
import ProjectPage from './pages/ProjectPage';
import LabPage from './pages/LabPage';
import ReportPage from './pages/ReportPage';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'stage/:stageId', element: <StagePage /> },
      { path: 'lesson/:lessonId', element: <LessonPage /> },
      { path: 'project/:projectId', element: <ProjectPage /> },
      { path: 'lab', element: <LabPage /> },
      { path: 'report', element: <ReportPage /> },
      { path: '*', element: <OverviewPage /> },
    ],
  },
];

export const router = createHashRouter(routes);

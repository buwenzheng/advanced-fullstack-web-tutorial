import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('缺少 #root 挂载点');

createRoot(rootElement).render(
  <StrictMode>
    <Suspense
      fallback={(
        <div className="app" id="app">
          <main className="main" id="main">
            <div className="page">
              <div className="empty-state">正在加载课程…</div>
            </div>
          </main>
        </div>
      )}
    >
      <RouterProvider router={router} />
    </Suspense>
  </StrictMode>,
);
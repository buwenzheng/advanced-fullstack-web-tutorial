import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { ToastProvider } from './ToastProvider';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

function PageFallback() {
  return <div className="page"><div className="empty-state" role="status">正在加载…</div></div>;
}

function ShellLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const lastPathname = useRef(pathname);

  useEffect(() => {
    const isRouteChange = lastPathname.current !== pathname;
    lastPathname.current = pathname;
    window.scrollTo(0, 0);
    setDrawerOpen(false);
    if (isRouteChange) mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
          mainRef.current?.scrollIntoView({ block: 'start' });
        }}
      >
        跳到主要内容
      </a>
      <div className="app" id="app">
        <Topbar drawerOpen={drawerOpen} onToggleDrawer={() => setDrawerOpen((open) => !open)} />
        <Sidebar open={drawerOpen} />
        <main className="main" id="main" tabIndex={-1} ref={mainRef}>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <div
        className="scrim"
        id="scrim"
        hidden={!drawerOpen}
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
      />
    </>
  );
}

export function AppShell() {
  return (
    <ToastProvider>
      <ShellLayout />
    </ToastProvider>
  );
}

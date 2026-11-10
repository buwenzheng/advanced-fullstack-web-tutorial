import { Outlet } from 'react-router';

export function AppShell() {
  return (
    <div className="app" id="app">
      <main className="main" id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

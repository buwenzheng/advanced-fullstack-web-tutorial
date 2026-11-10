import { Link, useRouteError } from 'react-router';

export default function RouteErrorPage() {
  const error = useRouteError();
  const detail = import.meta.env.DEV && error instanceof Error ? error.message : '';

  return (
    <div className="app" id="app">
      <main className="main" id="main" style={{ gridArea: '1 / 1 / -1 / -1' }}>
        <div className="page" role="alert">
          <div className="empty-state">页面加载失败，请刷新重试。</div>
          {detail ? <p style={{ marginTop: 12 }}>{detail}</p> : null}
          <p style={{ marginTop: 16 }}>
            <Link className="btn btn--ghost btn--sm" to="/">返回总览</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

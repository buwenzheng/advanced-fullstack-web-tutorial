import { Link } from 'react-router';

export default function OverviewPage() {
  return (
    <div className="page">
      <section className="hero">
        <div className="hero__inner">
          <span className="eyebrow">Backend for Frontend Engineers</span>
          <h1 style={{ marginTop: 10 }}>把前端的手感，<em>接后端的世界</em></h1>
          <p className="hero__lede">
            这是一条为前端工程师设计的完整进阶路线。E2 先交付路由外壳、侧栏与全局交互，正文、练习与项目内容将在 E3 迁移。
          </p>
          <div className="hero__cta">
            <Link className="btn btn--primary" to="/lesson/s0-l1">从第一讲开始</Link>
            <Link className="btn btn--ghost" to="/lab">打开 HTTP 实验室</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

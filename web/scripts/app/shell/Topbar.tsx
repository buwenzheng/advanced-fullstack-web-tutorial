import { Link } from 'react-router';
import { useProgress } from '../hooks/useProgress';
import LangSwitch from './LangSwitch';
import SearchBox from './SearchBox';

interface TopbarProps {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

export default function Topbar({ drawerOpen, onToggleDrawer }: TopbarProps) {
  const progress = useProgress();
  const offset = 97.4 * (1 - progress.course.percent / 100);

  return (
    <header className="topbar">
      <button
        className="icon-btn topbar__menu"
        id="menu-toggle"
        type="button"
        aria-label="打开课程目录"
        aria-expanded={drawerOpen}
        aria-controls="sidebar"
        onClick={onToggleDrawer}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h14" /></svg>
      </button>

      <Link className="brand" to="/" aria-label="返回学习总览">
        <span className="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 32 32"><path d="M8 11l5 5-5 5" /><path d="M16 21h8" /></svg>
        </span>
        <span className="brand__text">
          <strong>后端进阶实验室</strong>
          <em>Backend for Frontend Engineers</em>
        </span>
      </Link>

      <SearchBox />

      <div className="topbar__actions">
        <LangSwitch />
        <Link className="topbar__link" to="/lab" title="HTTP 实验台">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h9" /></svg>
          <span>实验室</span>
        </Link>
        <Link className="topbar__link" to="/report" title="学习报告">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16V9M8 16V5M12 16v-4M16 16V7" /></svg>
          <span>学习报告</span>
        </Link>
        <div className="progress-chip" id="progress-chip" title="总体完成度">
          <svg className="progress-chip__ring" viewBox="0 0 36 36" aria-hidden="true">
            <circle className="progress-chip__track" cx="18" cy="18" r="15.5" />
            <circle
              className="progress-chip__value"
              cx="18"
              cy="18"
              r="15.5"
              id="progress-ring"
              style={{ strokeDashoffset: String(offset) }}
            />
          </svg>
          <span id="progress-label">{progress.course.percent}%</span>
        </div>
      </div>
    </header>
  );
}

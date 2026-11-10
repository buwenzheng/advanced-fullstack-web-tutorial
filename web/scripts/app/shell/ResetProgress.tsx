import { DRAFT_KEY, store } from '../../state/store';
import { useToast } from './useToast';

export default function ResetProgress() {
  const notify = useToast();

  return (
    <div className="sidebar__foot">
      <p>进度保存在本机浏览器，换设备不会同步。</p>
      <button
        className="text-btn"
        id="reset-progress"
        type="button"
        onClick={() => {
          if (!window.confirm('确定要清空全部学习记录吗？此操作不可撤销。')) return;
          store.reset();
          localStorage.removeItem(DRAFT_KEY);
          notify('学习记录已清空');
        }}
      >
        清空学习记录
      </button>
    </div>
  );
}

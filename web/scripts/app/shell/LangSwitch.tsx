import { LANGUAGES } from '../../state/lang';
import { useLang } from '../hooks/useLang';

export default function LangSwitch() {
  const { current, set } = useLang();

  return (
    <div className="lang-switch" id="lang-switch" role="group" aria-label="代码语言轨道">
      {LANGUAGES.map((item) => (
        <button
          key={item.id}
          className={current === item.id ? 'is-active' : undefined}
          type="button"
          data-lang={item.id}
          title={`切换到 ${item.label} 轨道`}
          aria-pressed={current === item.id}
          onClick={() => {
            if (current === item.id) return;
            const offset = window.scrollY;
            set(item.id);
            window.scrollTo(0, offset);
          }}
        >
          {item.short}
        </button>
      ))}
    </div>
  );
}

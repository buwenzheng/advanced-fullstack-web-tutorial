import { useState } from 'react';
import type { Check } from '../../content/types';
import { store } from '../../state/store';
import { RichText } from '../lesson/RichText';
import { useToast } from '../shell/useToast';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

type Phase = 'idle' | 'graded' | 'saved-wrong';

export function McqTask({ task }: { task: Check }) {
  const notify = useToast();
  const multi = task.type === 'multi';
  const saved = store.answerOf(task.id);
  const [picked, setPicked] = useState<number[]>(() => saved?.picked || []);
  const [phase, setPhase] = useState<Phase>(() => {
    if (!saved) return 'idle';
    return saved.correct ? 'graded' : 'saved-wrong';
  });
  const [right, setRight] = useState(() => Boolean(saved?.correct));
  const locked = phase !== 'idle';
  const hint = (task as Check & { hint?: string }).hint;

  function choose(index: number) {
    if (locked) return;
    if (multi) {
      setPicked((prev) => (prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]));
    } else {
      setPicked([index]);
    }
  }

  function judge() {
    if (!picked.length) {
      notify('请先选择答案');
      return;
    }
    const chosen = [...picked].sort((a, b) => a - b);
    const correctCount = task.options.filter((option) => option.correct).length;
    const ok = multi
      ? chosen.length === correctCount && chosen.every((index) => Boolean(task.options[index]?.correct))
      : chosen.length === 1 && Boolean(task.options[chosen[0]!]?.correct);
    store.recordAnswer(task.id, chosen, ok);
    setPicked(chosen);
    setRight(ok);
    setPhase('graded');
  }

  function reset() {
    setPicked([]);
    setRight(false);
    setPhase('idle');
  }

  return (
    <div className="quiz">
      <div className="quiz__head">
        <span className="badge badge--blue">{multi ? '多选题' : '单选题'}</span>
        <span className="tiny muted">{task.tag || '概念检查'}</span>
      </div>
      <div className="quiz__body">
        <RichText as="p" className="quiz__q" html={task.question} />
        {hint ? <p className="quiz__hint">{`提示：${hint}`}</p> : null}
        <ul className="opt-list">
          {task.options.map((option, index) => {
            const chosen = picked.includes(index);
            const marked = phase === 'graded';
            const classes = ['opt'];
            if (chosen) classes.push('is-picked');
            if (marked && option.correct) classes.push('is-right');
            if (marked && !option.correct && chosen) classes.push('is-wrong');
            return (
              <li key={index}>
                <button
                  className={classes.join(' ')}
                  type="button"
                  disabled={locked}
                  onClick={() => choose(index)}
                >
                  <span className="opt__key">{OPTION_KEYS[index]}</span>
                  <RichText as="span" html={option.text} />
                  {marked && option.correct ? <span className="opt__mark">✓ 正确</span> : null}
                  {marked && !option.correct && chosen ? <span className="opt__mark">✗ 你的选择</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {phase === 'graded' ? (
          <RichText
            className={`quiz__feedback ${right ? 'is-right' : 'is-wrong'}`}
            html={`<b>${right ? '答对了' : '答错了'}</b>\u3000${task.explain || ''}`}
          />
        ) : null}
        {phase === 'saved-wrong' ? (
          <RichText
            className="quiz__feedback is-wrong"
            html="<b>上次答错</b>\u3000再试一次，看看解析里的关键点。"
          />
        ) : null}
        <div className="quiz__actions">
          <button
            className="btn btn--primary btn--sm"
            type="button"
            style={locked ? { display: 'none' } : undefined}
            onClick={judge}
          >
            提交答案
          </button>
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            style={{ display: locked ? 'inline-flex' : 'none' }}
            onClick={reset}
          >
            再试一次
          </button>
        </div>
      </div>
    </div>
  );
}

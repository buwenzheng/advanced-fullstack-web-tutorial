import { useState } from 'react';
import type { Exercise } from '../../content/types';
import { store } from '../../state/store';
import { RichText } from '../lesson/RichText';
import { readDraft, writeDraft } from './drafts';

type DesignExercise = Extract<Exercise, { kind: 'design' }>;

export function DesignTask({ task }: { task: DesignExercise }) {
  const checklist = task.checklist || [];
  const [checked, setChecked] = useState<number[]>(() => store.answerOf(task.id)?.picked || []);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const count = checked.length;
  const complete = checklist.length > 0 && count === checklist.length;

  function toggle(index: number, on: boolean) {
    const next = on
      ? [...checked.filter((item) => item !== index), index].sort((a, b) => a - b)
      : checked.filter((item) => item !== index);
    setChecked(next);
    store.recordChecklist(task.id, next, checklist.length);
  }

  return (
    <div className="exercise">
      <div className="exercise__head">
        <span className="badge badge--teal">方案题</span>
        <h3>{task.title || '设计方案'}</h3>
      </div>
      <div className="exercise__body">
        <RichText as="p" className="exercise__brief" html={task.prompt || task.brief || ''} />
        {task.specs ? (
          <dl className="exercise__specs">
            {task.specs.map((spec) => (
              <div key={spec.label} className="spec-row">
                <dt>{spec.label}</dt>
                <RichText as="dd" html={spec.value} />
              </div>
            ))}
          </dl>
        ) : null}
        <div className="aside-card" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h3>自检清单</h3>
            <span className={complete ? 'tiny' : 'tiny muted'} style={complete ? { color: 'var(--teal)' } : undefined}>
              {checklist.length ? `自检 ${count}/${checklist.length}${complete ? ' · 已完成' : ''}` : ''}
            </span>
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {checklist.map((item, index) => (
              <label
                key={item}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '16px 1fr',
                  gap: 10,
                  fontSize: '13.5px',
                  lineHeight: 1.7,
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  style={{ marginTop: 4, accentColor: 'var(--teal)' }}
                  checked={checked.includes(index)}
                  onChange={(event) => toggle(index, event.target.checked)}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="aside-card" style={{ marginTop: 12 }}>
          <h3>我的方案</h3>
          <textarea
            placeholder="写下你的方案要点：接口设计、状态码、数据结构、边界处理、失败场景……"
            style={{
              minHeight: 140,
              width: '100%',
              padding: '12px 14px',
              background: 'var(--ink-900)',
              border: '1px solid var(--line)',
              borderRadius: 9,
              fontFamily: 'var(--font-ui)',
              fontSize: '13.5px',
              lineHeight: 1.75,
              resize: 'vertical',
              outline: 'none',
            }}
            defaultValue={readDraft(`note:${task.id}`) ?? ''}
            onChange={(event) => writeDraft(`note:${task.id}`, event.target.value)}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            onClick={() => setReferenceOpen((open) => !open)}
          >
            {referenceOpen ? '收起参考要点' : '对照参考要点'}
          </button>
        </div>
        <div className="reference" style={{ display: referenceOpen ? 'block' : 'none' }}>
          <h4>参考要点</h4>
          <RichText
            html={task.reference || ''}
            style={{ fontSize: '13.5px', lineHeight: 1.8, color: 'var(--text-dim)' }}
          />
        </div>
      </div>
    </div>
  );
}

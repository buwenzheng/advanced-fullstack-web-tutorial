import { useRef, useState, useSyncExternalStore } from 'react';
import type { Exercise } from '../../content/types';
import type { QueryOutcome, SqlRow } from '../../engine/sql/index';
import { createDatabase, rowsEqual, runQuery } from '../../engine/sql/index';
import { store } from '../../state/store';
import { RichText } from '../lesson/RichText';
import { readDraft, writeDraft } from './drafts';

type SqlExercise = Extract<Exercise, { kind: 'sql' }>;
type RunState =
  | { kind: 'error'; message: string }
  | { kind: 'result'; outcome: QueryOutcome; ok: boolean };

const PRE_STYLE = {
  margin: 0,
  overflowX: 'auto' as const,
  fontFamily: 'var(--font-code)',
  fontSize: '12.5px',
  lineHeight: 1.7,
  color: 'var(--text-dim)',
};

export function SqlTask({ task }: { task: SqlExercise }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [result, setResult] = useState<RunState | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const solved = Boolean(store.answerOf(task.id)?.solved);

  function execute() {
    const db = createDatabase(task.tables || {});
    let outcome: QueryOutcome;
    try {
      outcome = runQuery(db, editorRef.current?.value ?? '');
    } catch (err) {
      setResult({ kind: 'error', message: (err as Error | null)?.message || String(err) });
      store.recordAnswer(task.id, [], false);
      return;
    }
    const ok = outcome.kind === 'select' && rowsEqual(outcome.rows, task.expected || [], outcome.columns);
    store.recordAnswer(task.id, [], ok);
    setResult({ kind: 'result', outcome, ok });
  }

  function reset() {
    if (editorRef.current) editorRef.current.value = task.query ?? '';
    writeDraft(task.id, task.query ?? '');
    setResult(null);
  }

  return (
    <div className="exercise">
      <div className="exercise__head">
        <span className="badge badge--violet">SQL 题</span>
        <h3>{task.title || '写出查询'}</h3>
        <span className={solved ? 'tiny' : 'tiny muted'} style={solved ? { color: 'var(--teal)' } : undefined}>
          {solved ? '已通过 · 结果与预期一致' : ''}
        </span>
      </div>
      <div className="exercise__body">
        <RichText as="p" className="exercise__brief" html={task.brief || ''} />
        <div className="sql-console">
          {Object.entries(task.tables || {}).map(([name, rows]) => {
            const columns: string[] = [];
            rows.forEach((row) => {
              Object.keys(row).forEach((key) => {
                if (!columns.includes(key)) columns.push(key);
              });
            });
            return (
              <div key={name} className="sql-table">
                <div className="sql-table__name">{name}</div>
                <table>
                  <thead>
                    <tr>
                      {columns.map((col) => (
                        <td key={col} style={{ color: 'var(--text-faint)' }}>
                          {col}
                        </td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {columns.map((col) => (
                          <td key={col} className={row[col] === null || row[col] === undefined ? 'is-null' : undefined}>
                            {row[col] === null || row[col] === undefined ? 'NULL' : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
        <div className="code-editor" style={{ marginTop: 14 }}>
          <div className="code-editor__bar">
            <span>query.sql</span>
          </div>
          <textarea
            ref={editorRef}
            spellCheck={false}
            aria-label="SQL 编辑器"
            style={{ minHeight: 120 }}
            defaultValue={readDraft(task.id) ?? task.query ?? ''}
            onChange={(event) => writeDraft(task.id, event.target.value)}
          />
          <div className="code-editor__foot">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn--primary btn--sm" type="button" onClick={execute}>
                执行 SQL
              </button>
              <button className="btn btn--ghost btn--sm" type="button" onClick={reset}>
                重置
              </button>
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => setHintOpen((open) => !open)}
              >
                {hintOpen ? '收起提示' : '查看提示'}
              </button>
              {task.solution ? (
                <button
                  className="btn btn--ghost btn--sm"
                  type="button"
                  onClick={() => setSolutionOpen((open) => !open)}
                >
                  {solutionOpen ? '收起参考答案' : '查看参考答案'}
                </button>
              ) : null}
            </div>
            <span className="tiny muted">迷你 SQL 引擎 · 浏览器内执行</span>
          </div>
        </div>
        <div>
          {result?.kind === 'error' ? (
            <div className="quiz__feedback is-wrong">
              <b>SQL 执行失败</b>
              {'\u3000'}
              {result.message}
            </div>
          ) : null}
          {result?.kind === 'result' ? (
            <>
              <SqlResult outcome={result.outcome} />
              {result.ok ? (
                <div className="quiz__feedback is-right">
                  <b>正确</b>
                  {'\u3000'}
                  查询结果与预期完全一致。
                </div>
              ) : (
                <div className="quiz__feedback is-wrong">
                  <b>结果与预期不一致</b>
                  <div style={{ marginTop: 8 }}>
                    <div>预期结果：</div>
                    <pre
                      style={{
                        margin: '6px 0 0',
                        fontFamily: 'var(--font-code)',
                        fontSize: '12px',
                        lineHeight: 1.7,
                        color: 'var(--text-dim)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {JSON.stringify(task.expected || [], null, 1)}
                    </pre>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
        <div className="hint-box" style={{ display: hintOpen ? 'block' : 'none' }}>
          {task.hint ? <RichText html={`<b>提示</b>\u3000${task.hint}`} /> : null}
        </div>
        <div className="reference" style={{ display: solutionOpen ? 'block' : 'none' }}>
          {solutionOpen ? (
            <>
              <h4>参考答案</h4>
              <pre style={PRE_STYLE}>{task.solution}</pre>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SqlResult({ outcome }: { outcome: QueryOutcome }) {
  if (outcome.kind !== 'select') {
    return (
      <div className="quiz__feedback" style={{ borderColor: 'var(--line)', background: 'var(--ink-750)' }}>
        <b>执行完成</b>
        {'\u3000'}
        {outcome.message}
      </div>
    );
  }
  if (!outcome.rows.length) {
    return (
      <div className="quiz__feedback" style={{ borderColor: 'var(--line)', background: 'var(--ink-750)' }}>
        <b>查询成功</b>
        {'\u3000'}
        返回 0 行
      </div>
    );
  }
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 可滚动区域需键盘聚焦（axe scrollable-region-focusable）
    <div className="tbl-wrap" style={{ marginTop: 12 }} tabIndex={0} aria-label="查询结果表格">
      <table className="tbl">
        <thead>
          <tr>
            {outcome.columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {outcome.rows.map((row: SqlRow, rowIndex: number) => (
            <tr key={rowIndex}>
              {outcome.columns.map((col) => (
                <td key={col} className={row[col] === null || row[col] === undefined ? 'is-null' : undefined}>
                  {row[col] === null || row[col] === undefined ? 'NULL' : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

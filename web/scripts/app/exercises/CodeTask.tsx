import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CodeExercise } from '../../content/types';
import type { RunResult } from '../../engine/runner/index';
import { runTests } from '../../engine/runner/index';
import { pythonHarness } from '../../engine/python/harness';
import {
  onPythonStatus,
  pythonLoadError,
  pythonReady,
  runPythonTests,
  warmPython,
} from '../../engine/python/index';
import { lang, languageLabel, languageMeta } from '../../state/lang';
import { store } from '../../state/store';
import { RichText } from '../lesson/RichText';
import { useToast } from '../shell/useToast';
import { readDraft, writeDraft } from './drafts';

type Track = 'javascript' | 'python';
type Variant = CodeExercise | NonNullable<CodeExercise['python']>;
type HarnessResult = RunResult & { runtimeError?: boolean };

const SOLUTION_STYLE = {
  margin: 0,
  overflowX: 'auto' as const,
  fontFamily: 'var(--font-code)',
  fontSize: '12.5px',
  lineHeight: 1.7,
  color: 'var(--text-dim)',
};

export function CodeTask({ task }: { task: CodeExercise }) {
  const tracks: Track[] = task.python ? ['javascript', 'python'] : ['javascript'];
  const [track, setTrack] = useState<Track>(() => (task.python && lang.get() === 'python' ? 'python' : 'javascript'));
  useSyncExternalStore(store.subscribe, store.getVersion);

  const meta = languageMeta(track);
  const progressId = track === 'python' ? `${task.id}@py` : task.id;
  const otherId = track === 'python' ? task.id : `${task.id}@py`;
  const otherLabel = languageLabel(track === 'python' ? 'javascript' : 'python');
  const solved = Boolean(store.answerOf(progressId)?.solved);
  const otherDone = Boolean(task.python) && Boolean(store.answerOf(otherId)?.solved);

  return (
    <div className="exercise">
      <div className="exercise__head">
        <span className="badge badge--amber">代码题</span>
        <h3>{task.title || '完成实现'}</h3>
        {tracks.length > 1 ? (
          <div className="track-tabs" role="tablist" aria-label="练习语言">
            {tracks.map((item) => (
              <button
                key={item}
                className={`track-tab${item === track ? ' is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={item === track}
                onClick={() => setTrack(item)}
              >
                {languageLabel(item)}
              </button>
            ))}
          </div>
        ) : null}
        <span
          className={solved ? 'tiny' : 'tiny muted'}
          style={solved ? { color: 'var(--teal)' } : undefined}
        >
          {solved
            ? `已通过 · ${meta.label} 轨道`
            : otherDone
              ? `${otherLabel} 轨道已通过，本轨道待完成`
              : ''}
        </span>
      </div>
      <CodeTrack key={track} task={task} track={track} />
    </div>
  );
}

function CodeTrack({ task, track }: { task: CodeExercise; track: Track }) {
  const notify = useToast();
  const isPython = track === 'python';
  const variant: Variant = isPython ? task.python! : task;
  const meta = languageMeta(track);
  const progressId = isPython ? `${task.id}@py` : task.id;
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [result, setResult] = useState<HarnessResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runLabel, setRunLabel] = useState('运行测试');
  const [pendingName, setPendingName] = useState('正在执行测试…');
  const [hintOpen, setHintOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [runtimeNote, setRuntimeNote] = useState(isPython ? '' : '在浏览器沙箱中执行');

  useEffect(() => {
    if (!isPython) return undefined;
    const unsubscribe = onPythonStatus(() => {
      if (pythonLoadError()) setRuntimeNote('Python 运行时加载失败，请检查网络后重试');
      else if (pythonReady()) setRuntimeNote('Pyodide · Python 3.13 · 浏览器内执行');
      else setRuntimeNote('首次运行需下载 Python 运行时（约 10 MB）');
    });
    warmPython();
    return unsubscribe;
  }, [isPython]);

  async function run() {
    const source = editorRef.current?.value ?? '';
    const waitRuntime = isPython && !pythonReady();
    setRunning(true);
    setRunLabel(waitRuntime ? '加载运行时…' : '运行中…');
    setPendingName(waitRuntime ? '正在加载 Python 运行时，首次约需 10 秒…' : '正在执行测试…');
    const tests = (variant.tests || []).map((test, index) => ({
      name: test.name || `测试 ${index + 1}`,
      code: test.code,
      async: test.async,
    }));
    let outcome: HarnessResult;
    try {
      if (isPython) {
        outcome = await runPythonTests(source, pythonHarness(tests), {
          timeout: (task as CodeExercise & { timeout?: number }).timeout || 8000,
        });
      } else {
        const harness = tests
          .map((test) => `__run(${JSON.stringify(test.name)}, async function () { ${test.code} });`)
          .join('\n');
        outcome = await runTests(source, harness, {
          timeout: (task as CodeExercise & { timeout?: number }).timeout || 6000,
        });
      }
    } catch (err) {
      outcome = {
        runtimeError: true,
        ok: false,
        results: [{ name: '运行环境', ok: false, error: (err as Error | null)?.message || String(err) }],
        logs: [],
      };
    }
    setResult(outcome);
    setRunning(false);
    setRunLabel('运行测试');
    const expected = tests.length;
    const passed = outcome.results.filter((item) => item.ok).length;
    const ok = expected > 0 && outcome.results.length === expected && passed === expected;
    if (!outcome.runtimeError) store.recordAnswer(progressId, [], ok);
    if (outcome.runtimeError) {
      const runtimeError = outcome.results[0]?.error || '';
      notify(/执行超过/.test(runtimeError) ? '运行超时，本次不计入练习记录' : '运行环境没有就绪，本次不计入练习记录');
    } else if (ok) {
      notify(`${meta.label} 轨道全部测试通过`);
    } else if (outcome.results.length !== expected) {
      notify(`测试未全部执行（${outcome.results.length}/${expected}），请查看下方结果`);
    } else {
      notify(`${passed}/${expected} 项测试通过`);
    }
  }

  function reset() {
    const starter = variant.starter ?? '';
    if (editorRef.current) editorRef.current.value = starter;
    writeDraft(progressId, starter);
    setResult(null);
  }

  return (
    <div className="exercise__body">
      <div className="code-editor">
        <div className="code-editor__bar">
          <span>{meta.file}</span>
          <span>{meta.runtime}</span>
        </div>
        <textarea
          ref={editorRef}
          spellCheck={false}
          aria-label={task.title || '代码编辑器'}
          defaultValue={readDraft(progressId) ?? variant.starter ?? ''}
          onChange={(event) => writeDraft(progressId, event.target.value)}
        />
        <div className="code-editor__foot">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn--primary btn--sm" type="button" disabled={running} onClick={run}>
              <span>
                <svg viewBox="0 0 20 20">
                  <path d="M6 4l10 6-10 6z" />
                </svg>
              </span>
              {runLabel}
            </button>
            <button className="btn btn--ghost btn--sm" type="button" onClick={reset}>
              重置代码
            </button>
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => setHintOpen((open) => !open)}
            >
              {hintOpen ? '收起提示' : '查看提示'}
            </button>
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => setSolutionOpen((open) => !open)}
            >
              {solutionOpen ? '收起参考答案' : '查看参考答案'}
            </button>
          </div>
          <span className="tiny muted">{runtimeNote}</span>
        </div>
      </div>
      <ul className="test-list">
        {running ? (
          <li className="test-item is-pending">
            <span className="test-item__icon">…</span>
            <div>
              <span className="test-item__name">{pendingName}</span>
            </div>
          </li>
        ) : result ? (
          result.results.map((item, index) => (
            <li key={index} className={`test-item ${item.ok ? 'is-pass' : 'is-fail'}`}>
              <span className="test-item__icon">{item.ok ? '✓' : '✕'}</span>
              <div>
                <span className="test-item__name">{item.name}</span>
                {item.error ? <span className="test-item__msg">{item.error}</span> : null}
              </div>
            </li>
          ))
        ) : null}
      </ul>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 可滚动区域需键盘聚焦（axe scrollable-region-focusable） */}
      <div className="console-out" tabIndex={0} aria-label="运行日志">
        {result && result.logs.length
          ? result.logs.map((log, index) => (
              <span key={index} className={`log-${log.level}`}>
                {index > 0 ? '\n' : null}
                {log.text}
              </span>
            ))
          : null}
      </div>
      <div className="hint-box" style={{ display: hintOpen ? 'block' : 'none' }}>
        {task.hint ? <RichText html={`<b>提示</b>\u3000${task.hint}`} /> : null}
      </div>
      <div className="reference" style={{ display: solutionOpen ? 'block' : 'none' }}>
        {solutionOpen ? (
          <>
            <h4>{`参考答案 · ${meta.label}`}</h4>
            <pre style={SOLUTION_STYLE}>{variant.solution || '本题不提供标准答案，重点是思路。'}</pre>
          </>
        ) : null}
      </div>
    </div>
  );
}

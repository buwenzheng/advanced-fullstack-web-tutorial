import { h, toast } from '../ui.js';
import { store } from '../store.js';
import { runTests } from './runner.js';
import { createDatabase, runQuery, rowsEqual } from './sql.js';
import { lang, languageLabel, languageMeta } from '../lang.js';
import { runPythonTests, pythonReady, pythonLoadError, warmPython, onPythonStatus } from './python.js';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

function iconCheck() {
  return h('span', { html: '<svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9"/></svg>' });
}

function correctIndex(options) {
  return options.findIndex((option) => option.correct);
}

export function renderTask(task) {
  switch (task.kind) {
    case 'mcq': return renderMcq(task);
    case 'code': return renderCode(task);
    case 'sql': return renderSql(task);
    case 'design': return renderDesign(task);
    default: return h('div', { class: 'empty-state', text: `未知题型：${task.kind}` });
  }
}

/* ---------------- 客观题 ---------------- */
function renderMcq(task) {
  const multi = task.type === 'multi';
  const wrap = h('div', { class: 'quiz' });
  const body = h('div', { class: 'quiz__body' });
  const saved = store.answerOf(task.id);

  const feedback = h('div', { class: 'quiz__feedback', style: 'display:none' });
  const actions = h('div', { class: 'quiz__actions' });
  const submit = h('button', { class: 'btn btn--primary btn--sm', type: 'button', text: '提交答案' });
  const retry = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '再试一次', style: 'display:none' });
  const picked = new Set();

  const optionNodes = task.options.map((option, index) => {
    const node = h('button', {
      class: 'opt',
      type: 'button',
      onclick: () => {
        if (node.disabled) return;
        if (multi) {
          if (picked.has(index)) picked.delete(index); else picked.add(index);
          node.classList.toggle('is-picked', picked.has(index));
        } else {
          picked.clear();
          optionNodes.forEach((other) => other.classList.remove('is-picked'));
          picked.add(index);
          node.classList.add('is-picked');
        }
      },
    },
    h('span', { class: 'opt__key', text: OPTION_KEYS[index] }),
    h('span', { html: option.text }));
    return node;
  });

  function paint(chosen, right) {
    optionNodes.forEach((node, index) => {
      node.disabled = true;
      const option = task.options[index];
      if (option.correct) { node.classList.add('is-right'); node.appendChild(h('span', { class: 'opt__mark', text: '✓ 正确' })); }
      else if (chosen.includes(index)) { node.classList.add('is-wrong'); node.appendChild(h('span', { class: 'opt__mark', text: '✗ 你的选择' })); }
    });

    feedback.style.display = 'block';
    feedback.className = `quiz__feedback ${right ? 'is-right' : 'is-wrong'}`;
    feedback.innerHTML = `<b>${right ? '答对了' : '答错了'}</b>　${task.explain ? task.explain : ''}`;
    submit.style.display = 'none';
    retry.style.display = 'inline-flex';
  }

  function judge() {
    if (!picked.size) { toast('请先选择答案'); return; }
    const chosen = [...picked].sort((a, b) => a - b);
    const right = multi
      ? chosen.length === task.options.filter((o) => o.correct).length && chosen.every((i) => task.options[i].correct)
      : chosen.length === 1 && task.options[chosen[0]].correct;
    store.recordAnswer(task.id, chosen, right);
    paint(chosen, right);
  }

  function reset() {
    picked.clear();
    optionNodes.forEach((node) => {
      node.disabled = false;
      node.className = 'opt';
      const mark = node.querySelector('.opt__mark');
      if (mark) mark.remove();
    });
    feedback.style.display = 'none';
    submit.style.display = 'inline-flex';
    retry.style.display = 'none';
  }

  submit.addEventListener('click', judge);
  retry.addEventListener('click', reset);
  actions.appendChild(submit);
  actions.appendChild(retry);

  body.appendChild(h('p', { class: 'quiz__q', html: task.question }));
  if (task.hint) body.appendChild(h('p', { class: 'quiz__hint', text: `提示：${task.hint}` }));
  body.appendChild(h('ul', { class: 'opt-list' }, optionNodes));
  body.appendChild(feedback);
  body.appendChild(actions);

  wrap.appendChild(h('div', { class: 'quiz__head' },
    h('span', { class: 'badge badge--blue', text: multi ? '多选题' : '单选题' }),
    h('span', { class: 'tiny muted', text: task.tag || '概念检查' })));
  wrap.appendChild(body);

  if (saved) {
    const chosen = saved.picked || [];
    optionNodes.forEach((node, index) => {
      if (chosen.includes(index)) {
        node.classList.add('is-picked');
        picked.add(index);
      }
    });
    if (saved.correct) {
      paint(chosen, true);
    } else {
      optionNodes.forEach((node) => { node.disabled = true; });
      feedback.style.display = 'block';
      feedback.className = 'quiz__feedback is-wrong';
      feedback.innerHTML = '<b>上次答错</b>　再试一次，看看解析里的关键点。';
      submit.style.display = 'none';
      retry.style.display = 'inline-flex';
    }
  }

  return wrap;
}

/* ---------------- 代码题 ---------------- */
function renderCode(task) {
  const tracks = task.python ? ['javascript', 'python'] : ['javascript'];
  const initial = task.python && lang.get() === 'python' ? 'python' : 'javascript';
  const wrap = h('div', { class: 'exercise' });
  const bodyHost = h('div', {});
  const statusSlot = h('span', { class: 'tiny muted' });
  const tabs = tracks.length > 1
    ? h('div', { class: 'track-tabs', role: 'tablist', 'aria-label': '练习语言' })
    : null;
  let current = null;

  const buttons = tracks.map((track) => {
    const button = h('button', {
      class: 'track-tab',
      type: 'button',
      role: 'tab',
      onclick: () => mount(track),
    }, languageLabel(track));
    if (tabs) tabs.appendChild(button);
    return { track, button };
  });

  function mount(track) {
    if (current && typeof current.__dispose === 'function') current.__dispose();
    buttons.forEach((entry) => {
      const active = entry.track === track;
      entry.button.classList.toggle('is-active', active);
      entry.button.setAttribute('aria-selected', String(active));
    });
    current = renderCodeTrack(task, track, statusSlot);
    bodyHost.replaceChildren(current);
  }

  wrap.appendChild(h('div', { class: 'exercise__head' },
    h('span', { class: 'badge badge--amber', text: '代码题' }),
    h('h3', { text: task.title || '完成实现' }),
    tabs,
    statusSlot));
  wrap.appendChild(bodyHost);
  mount(initial);

  wrap.__dispose = () => {
    if (current && typeof current.__dispose === 'function') current.__dispose();
  };
  return wrap;
}

function pythonHarness(tests) {
  return tests.map((test, index) => {
    const fn = `__lab_test_${index}`;
    const name = JSON.stringify(test.name || `测试 ${index + 1}`);
    const body = String(test.code || '')
      .split('\n')
      .map((line) => (line ? `    ${line}` : ''))
      .join('\n');
    return `async def ${fn}():\n${body || '    pass'}\n__run(${name}, ${fn})`;
  }).join('\n\n');
}

function renderCodeTrack(task, track, statusSlot) {
  const isPython = track === 'python';
  const variant = isPython ? task.python : task;
  const meta = languageMeta(track);
  const progressId = isPython ? `${task.id}@py` : task.id;
  const otherId = isPython ? task.id : `${task.id}@py`;
  const otherLabel = languageLabel(isPython ? 'javascript' : 'python');
  const body = h('div', { class: 'exercise__body' });

  const editor = h('textarea', {
    spellcheck: 'false',
    'aria-label': task.title || '代码编辑器',
    oninput: (event) => { persistDraft(progressId, event.target.value); },
  });
  editor.value = loadDraft(progressId) ?? variant.starter ?? '';

  const runBtn = h('button', { class: 'btn btn--primary btn--sm', type: 'button' },
    h('span', { html: '<svg viewBox="0 0 20 20"><path d="M6 4l10 6-10 6z"/></svg>' }),
    '运行测试');
  const resetBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '重置代码' });
  const hintBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '查看提示' });
  const solutionBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '查看参考答案' });

  const testList = h('ul', { class: 'test-list' });
  const consoleOut = h('div', { class: 'console-out' });
  const hintBox = h('div', { class: 'hint-box', style: 'display:none' });
  if (task.hint) hintBox.appendChild(h('div', { html: `<b>提示</b>　${task.hint}` }));
  const solutionBox = h('div', { class: 'reference', style: 'display:none' });

  const status = statusSlot;
  function syncStatus() {
    const ok = Boolean(store.answerOf(progressId)?.solved);
    const otherDone = Boolean(task.python) && Boolean(store.answerOf(otherId)?.solved);
    if (ok) {
      status.textContent = `已通过 · ${meta.label} 轨道`;
      status.className = 'tiny';
      status.style.color = 'var(--teal)';
    } else if (otherDone) {
      status.textContent = `${otherLabel} 轨道已通过，本轨道待完成`;
      status.className = 'tiny muted';
      status.style.color = '';
    } else {
      status.textContent = '';
      status.className = 'tiny muted';
      status.style.color = '';
    }
  }
  syncStatus();

  const runtimeNote = h('span', { class: 'tiny muted' });
  let unsubscribeRuntime = null;
  if (isPython) {
    unsubscribeRuntime = onPythonStatus(() => {
      if (pythonLoadError()) runtimeNote.textContent = 'Python 运行时加载失败，请检查网络后重试';
      else if (pythonReady()) runtimeNote.textContent = 'Pyodide · Python 3.13 · 浏览器内执行';
      else runtimeNote.textContent = '首次运行需下载 Python 运行时（约 10 MB）';
    });
    warmPython();
  } else {
    runtimeNote.textContent = '在浏览器沙箱中执行';
  }

  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    runBtn.textContent = isPython && !pythonReady() ? '加载运行时…' : '运行中…';
    testList.replaceChildren(h('li', { class: 'test-item is-pending' },
      h('span', { class: 'test-item__icon', text: '…' }),
      h('div', {}, h('span', { class: 'test-item__name', text: isPython && !pythonReady()
        ? '正在加载 Python 运行时，首次约需 10 秒…'
        : '正在执行测试…' }))));
    consoleOut.textContent = '';
    const source = editor.value;
    const tests = (variant.tests || []).map((test, index) => ({
      name: test.name || `测试 ${index + 1}`,
      code: test.code,
      async: test.async,
    }));
    let result;
    try {
      if (isPython) {
        result = await runPythonTests(source, pythonHarness(tests), { timeout: task.timeout || 8000 });
      } else {
        const harness = tests
          .map((test) => `__run(${JSON.stringify(test.name)}, async function () { ${test.code} });`)
          .join('\n');
        result = await runTests(source, harness, { timeout: task.timeout || 6000 });
      }
    } catch (err) {
      result = {
        runtimeError: true,
        results: [{ name: '运行环境', ok: false, error: (err && err.message) || String(err) }],
        logs: [],
      };
    }
    testList.replaceChildren(...result.results.map((item) => h('li', {
      class: `test-item ${item.ok ? 'is-pass' : 'is-fail'}`,
    },
    h('span', { class: 'test-item__icon', text: item.ok ? '✓' : '✕' }),
    h('div', {},
      h('span', { class: 'test-item__name', text: item.name }),
      item.error ? h('span', { class: 'test-item__msg', text: item.error }) : null))));
    if (result.logs.length) {
      consoleOut.innerHTML = result.logs
        .map((log) => `<span class="log-${log.level}">${escapeText(log.text)}</span>`)
        .join('\n');
    }
    const expected = tests.length;
    const passed = result.results.filter((item) => item.ok).length;
    const ok = expected > 0 && result.results.length === expected && passed === expected;
    if (!result.runtimeError) store.recordAnswer(progressId, [], ok);
    syncStatus();
    if (result.runtimeError) {
      const runtimeError = result.results[0]?.error || '';
      toast(/执行超过/.test(runtimeError) ? '运行超时，本次不计入练习记录' : '运行环境没有就绪，本次不计入练习记录');
    } else if (ok) {
      toast(`${meta.label} 轨道全部测试通过`);
    } else if (result.results.length !== expected) {
      toast(`测试未全部执行（${result.results.length}/${expected}），请查看下方结果`);
    } else {
      toast(`${passed}/${expected} 项测试通过`);
    }
    runBtn.disabled = false;
    runBtn.textContent = '运行测试';
  });

  resetBtn.addEventListener('click', () => {
    editor.value = variant.starter ?? '';
    persistDraft(progressId, editor.value);
    testList.replaceChildren();
    consoleOut.textContent = '';
  });
  hintBtn.addEventListener('click', () => {
    hintBox.style.display = hintBox.style.display === 'none' ? 'block' : 'none';
    hintBtn.textContent = hintBox.style.display === 'none' ? '查看提示' : '收起提示';
  });
  solutionBtn.addEventListener('click', () => {
    if (solutionBox.style.display === 'none') {
      solutionBox.replaceChildren(
        h('h4', { text: `参考答案 · ${meta.label}` }),
        h('pre', {
          style: 'margin:0;overflow-x:auto;font-family:var(--font-code);font-size:12.5px;line-height:1.7;color:var(--text-dim)',
          text: variant.solution || '本题不提供标准答案，重点是思路。',
        }));
      solutionBox.style.display = 'block';
      solutionBtn.textContent = '收起参考答案';
    } else {
      solutionBox.style.display = 'none';
      solutionBtn.textContent = '查看参考答案';
    }
  });

  body.appendChild(h('div', { class: 'code-editor' },
    h('div', { class: 'code-editor__bar' },
      h('span', { text: meta.file }),
      h('span', { text: meta.runtime })),
    editor,
    h('div', { class: 'code-editor__foot' },
      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, runBtn, resetBtn, hintBtn, solutionBtn),
      runtimeNote)));
  body.appendChild(testList);
  body.appendChild(consoleOut);
  body.appendChild(hintBox);
  body.appendChild(solutionBox);

  body.__dispose = () => {
    if (unsubscribeRuntime) unsubscribeRuntime();
  };
  return body;
}

/* ---------------- SQL 题 ---------------- */
function renderSql(task) {
  const wrap = h('div', { class: 'exercise' });
  const body = h('div', { class: 'exercise__body' });

  const schema = h('div', { class: 'sql-console' });
  Object.entries(task.tables || {}).forEach(([name, rows]) => {
    const columns = [];
    rows.forEach((row) => Object.keys(row).forEach((key) => { if (!columns.includes(key)) columns.push(key); }));
    schema.appendChild(h('div', { class: 'sql-table' },
      h('div', { class: 'sql-table__name', text: name }),
      h('table', {},
        h('thead', {}, h('tr', {}, columns.map((col) => h('td', { style: 'color:var(--text-faint)', text: col })))),
        h('tbody', {}, rows.map((row) => h('tr', {}, columns.map((col) => {
          const value = row[col];
          return h('td', { class: value === null || value === undefined ? 'is-null' : '', text: value === null || value === undefined ? 'NULL' : String(value) });
        })))))));
  });

  const editor = h('textarea', {
    spellcheck: 'false',
    'aria-label': 'SQL 编辑器',
    style: 'min-height:120px',
    oninput: (event) => { persistDraft(task.id, event.target.value); },
  });
  editor.value = loadDraft(task.id) ?? task.query ?? '';

  const runBtn = h('button', { class: 'btn btn--primary btn--sm', type: 'button', text: '执行 SQL' });
  const resetBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '重置' });
  const hintBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '查看提示' });
  const solutionBtn = task.solution
    ? h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '查看参考答案' })
    : null;
  const resultBox = h('div', {});
  const hintBox = h('div', { class: 'hint-box', style: 'display:none' });
  if (task.hint) hintBox.appendChild(h('div', { html: `<b>提示</b>　${task.hint}` }));
  const solutionBox = h('div', { class: 'reference', style: 'display:none' });

  const status = h('span', { class: 'tiny muted' });
  function syncStatus() {
    const ok = Boolean(store.answerOf(task.id)?.solved);
    status.textContent = ok ? '已通过 · 结果与预期一致' : '';
    status.className = ok ? 'tiny' : 'tiny muted';
    status.style.color = ok ? 'var(--teal)' : '';
  }
  syncStatus();

  runBtn.addEventListener('click', () => {
    const db = createDatabase(task.tables || {});
    let outcome;
    try {
      outcome = runQuery(db, editor.value);
    } catch (err) {
      resultBox.replaceChildren(h('div', { class: 'quiz__feedback is-wrong', html: `<b>SQL 执行失败</b>　${escapeText(err.message)}` }));
      store.recordAnswer(task.id, [], false);
      return;
    }
    const ok = outcome.kind === 'select' && rowsEqual(outcome.rows, task.expected || [], outcome.columns);
    store.recordAnswer(task.id, [], ok);
    syncStatus();
    const nodes = [renderSqlResult(outcome)];
    if (!ok) {
      nodes.push(h('div', { class: 'quiz__feedback is-wrong' },
        h('b', { text: '结果与预期不一致' }),
        h('div', { style: 'margin-top:8px' },
          h('div', { text: '预期结果：' }),
          h('pre', {
            style: 'margin:6px 0 0;font-family:var(--font-code);font-size:12px;line-height:1.7;color:var(--text-dim);white-space:pre-wrap',
            text: JSON.stringify(task.expected || [], null, 1),
          }))));
    } else {
      nodes.push(h('div', { class: 'quiz__feedback is-right', html: '<b>正确</b>　查询结果与预期完全一致。' }));
    }
    resultBox.replaceChildren(...nodes);
  });

  resetBtn.addEventListener('click', () => {
    editor.value = task.query ?? '';
    persistDraft(task.id, editor.value);
    resultBox.replaceChildren();
  });
  hintBtn.addEventListener('click', () => {
    hintBox.style.display = hintBox.style.display === 'none' ? 'block' : 'none';
    hintBtn.textContent = hintBox.style.display === 'none' ? '查看提示' : '收起提示';
  });
  if (solutionBtn) {
    solutionBtn.addEventListener('click', () => {
      const showing = solutionBox.style.display !== 'none';
      if (showing) {
        solutionBox.style.display = 'none';
        solutionBtn.textContent = '查看参考答案';
        return;
      }
      solutionBox.replaceChildren(
        h('h4', { text: '参考答案' }),
        h('pre', {
          style: 'margin:0;overflow-x:auto;font-family:var(--font-code);font-size:12.5px;line-height:1.7;color:var(--text-dim)',
          text: task.solution,
        }));
      solutionBox.style.display = 'block';
      solutionBtn.textContent = '收起参考答案';
    });
  }

  body.appendChild(h('p', { class: 'exercise__brief', html: task.brief || '' }));
  body.appendChild(schema);
  body.appendChild(h('div', { class: 'code-editor', style: 'margin-top:14px' },
    h('div', { class: 'code-editor__bar' }, h('span', { text: 'query.sql' })),
    editor,
    h('div', { class: 'code-editor__foot' },
      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, runBtn, resetBtn, hintBtn, solutionBtn),
      h('span', { class: 'tiny muted', text: '迷你 SQL 引擎 · 浏览器内执行' }))));
  body.appendChild(resultBox);
  body.appendChild(hintBox);
  body.appendChild(solutionBox);

  wrap.appendChild(h('div', { class: 'exercise__head' },
    h('span', { class: 'badge badge--violet', text: 'SQL 题' }),
    h('h3', { text: task.title || '写出查询' }),
    status));
  wrap.appendChild(body);
  return wrap;
}

function renderSqlResult(outcome) {
  if (outcome.kind !== 'select') {
    return h('div', { class: 'quiz__feedback', style: 'border-color:var(--line);background:var(--ink-750)', html: `<b>执行完成</b>　${escapeText(outcome.message)}` });
  }
  if (!outcome.rows.length) {
    return h('div', { class: 'quiz__feedback', style: 'border-color:var(--line);background:var(--ink-750)', html: '<b>查询成功</b>　返回 0 行' });
  }
  return h('div', { class: 'tbl-wrap', style: 'margin-top:12px' },
    h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, outcome.columns.map((col) => h('th', { text: col })))),
      h('tbody', {}, outcome.rows.map((row) => h('tr', {}, outcome.columns.map((col) => {
        const value = row[col];
        return h('td', { class: value === null || value === undefined ? 'is-null' : '', text: value === null || value === undefined ? 'NULL' : String(value) });
      }))))));
}

/* ---------------- 设计题 ---------------- */
function renderDesign(task) {
  const wrap = h('div', { class: 'exercise' });
  const body = h('div', { class: 'exercise__body' });

  const checklist = task.checklist || [];
  const savedChecked = new Set(store.answerOf(task.id)?.picked || []);
  const boxes = [];
  const status = h('span', { class: 'tiny muted' });

  const checks = checklist.map((item, index) => {
    const box = h('input', { type: 'checkbox', style: 'margin-top:4px;accent-color:var(--teal)' });
    box.checked = savedChecked.has(index);
    boxes.push(box);
    return h('label', { style: 'display:grid;grid-template-columns:16px 1fr;gap:10px;font-size:13.5px;line-height:1.7;color:var(--text-dim);cursor:pointer' },
      box,
      h('span', { text: typeof item === 'string' ? item : item.text }));
  });

  function checkedIndexes() {
    return boxes.map((box, index) => (box.checked ? index : -1)).filter((index) => index >= 0);
  }

  function renderStatus(checkedCount) {
    const complete = checklist.length > 0 && checkedCount === checklist.length;
    status.textContent = checklist.length
      ? `自检 ${checkedCount}/${checklist.length}${complete ? ' · 已完成' : ''}`
      : '';
    status.className = complete ? 'tiny' : 'tiny muted';
    status.style.color = complete ? 'var(--teal)' : '';
  }

  boxes.forEach((box) => box.addEventListener('change', () => {
    const checked = checkedIndexes();
    store.recordChecklist(task.id, checked, checklist.length);
    renderStatus(checked.length);
  }));
  if (checklist.length) renderStatus(checkedIndexes().length);

  const note = h('textarea', {
    placeholder: '写下你的方案要点：接口设计、状态码、数据结构、边界处理、失败场景……',
    style: 'min-height:140px;width:100%;padding:12px 14px;background:var(--ink-900);border:1px solid var(--line);border-radius:9px;font-family:var(--font-ui);font-size:13.5px;line-height:1.75;resize:vertical;outline:none',
    oninput: (event) => persistDraft(`note:${task.id}`, event.target.value),
  });
  note.value = loadDraft(`note:${task.id}`) ?? '';

  const reference = h('div', { class: 'reference', style: 'display:none' },
    h('h4', { text: '参考要点' }),
    h('div', { style: 'font-size:13.5px;line-height:1.8;color:var(--text-dim)', html: task.reference || '' }));

  const toggle = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '对照参考要点' });
  toggle.addEventListener('click', () => {
    const showing = reference.style.display !== 'none';
    reference.style.display = showing ? 'none' : 'block';
    toggle.textContent = showing ? '对照参考要点' : '收起参考要点';
  });

  body.appendChild(h('p', { class: 'exercise__brief', html: task.prompt || task.brief || '' }));
  if (task.specs) {
    body.appendChild(h('dl', { class: 'exercise__specs' }, task.specs.map((spec) => h('div', { class: 'spec-row' },
      h('dt', { text: spec.label }),
      h('dd', { html: spec.value })))));
  }
  body.appendChild(h('div', { class: 'aside-card', style: 'margin-top:14px' },
    h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:12px' },
      h('h3', { text: '自检清单' }),
      status),
    h('div', { style: 'display:grid;gap:8px;margin-top:8px' }, checks)));
  body.appendChild(h('div', { class: 'aside-card', style: 'margin-top:12px' },
    h('h3', { text: '我的方案' }),
    note));
  body.appendChild(h('div', { style: 'margin-top:12px' }, toggle));
  body.appendChild(reference);

  wrap.appendChild(h('div', { class: 'exercise__head' },
    h('span', { class: 'badge badge--teal', text: '方案题' }),
    h('h3', { text: task.title || '设计方案' })));
  wrap.appendChild(body);
  return wrap;
}

/* ---------------- 草稿 ---------------- */
const DRAFT_KEY = 'bff-lab-drafts-v1';

function loadDraft(id) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const drafts = JSON.parse(raw);
    return drafts[id] ?? null;
  } catch {
    return null;
  }
}

function persistDraft(id, value) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const drafts = raw ? JSON.parse(raw) : {};
    drafts[id] = value;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch {
    /* 忽略写入失败 */
  }
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

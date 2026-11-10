import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderBlock } from '../app/lesson/blocks';
import { highlightCode } from '../app/lesson/highlight';
import type { Block } from '../content/types';
import { lang } from '../state/lang';

beforeEach(() => {
  localStorage.clear();
  lang.set('javascript');
});

afterEach(cleanup);

const text: Block = { type: 'text', title: '正文标题', html: '正文包含 <code>GET</code> 语义。' };
const analogy: Block = { type: 'analogy', title: '类比标题', html: '类比正文' };
const pitfall: Block = { type: 'pitfall', title: '坑标题', html: '坑正文' };
const note: Block = { type: 'note', title: '补充标题', html: '补充正文' };
const tip: Block = { type: 'tip', title: '建议标题', html: '建议正文' };
const unordered: Block = { type: 'list', title: '无序清单', items: ['第一项 <b>加粗</b>', '第二项'] };
const ordered: Block = { type: 'list', title: '有序清单', ordered: true, items: ['步骤一', '步骤二'] };
const steps: Block = {
  type: 'steps',
  title: '操作步骤',
  steps: [
    { title: '第一步', html: '说明一', code: 'curl -v https://example.com', note: '备注一' },
    { title: '第二步', html: '说明二' },
  ],
};
const codeSingle: Block = {
  type: 'code',
  title: '单轨示例',
  lang: 'bash',
  code: 'curl -v https://example.com',
  note: '单轨备注',
};
const codeDual: Block = {
  type: 'code',
  title: '双轨示例',
  lang: 'javascript',
  code: 'const answer = 42;',
  note: '共同备注',
  python: 'answer = 42',
  pythonNote: 'Python 备注',
};
const table: Block = {
  type: 'table',
  title: '状态码',
  head: ['类别', '含义'],
  rows: [
    ['2xx', '成功'],
    ['5xx', '失败'],
  ],
};
const compare: Block = {
  type: 'compare',
  title: '对比',
  cols: [
    { title: '左列', items: ['左一'] },
    { title: '右列', items: ['右一', '右二'] },
  ],
};
const flow: Block = {
  type: 'flow',
  title: '流程',
  steps: [
    { name: 'DNS', detail: '解析域名', body: '展开后的解释' },
    { name: 'TCP', detail: '建立连接' },
  ],
};
const caseBlock: Block = {
  type: 'case',
  title: '一次 502',
  context: '背景',
  symptom: '现象',
  cause: '根因',
  fix: '修复',
  prevention: '预防',
  metric: 'P99 从 3s 降到 200ms',
};

describe('12 类内容块', () => {
  it('text 与四种 callout 输出类名、图标与标题', () => {
    render(
      <>
        {renderBlock(text)}
        {renderBlock(analogy)}
        {renderBlock(pitfall)}
        {renderBlock(note)}
        {renderBlock(tip)}
      </>,
    );
    expect(document.querySelectorAll('.lblock')).toHaveLength(5);
    expect(screen.getByRole('heading', { name: '正文标题' })).toBeInTheDocument();
    expect(screen.getByText('GET')).toBeInTheDocument();

    const variants = ['analogy', 'pitfall', 'note', 'tip'] as const;
    const icons = { analogy: '⇄', pitfall: '!', note: 'i', tip: '✓' };
    for (const variant of variants) {
      const callout = document.querySelector(`.callout.callout--${variant}`);
      expect(callout).not.toBeNull();
      expect(callout?.querySelector('.callout__icon')).toHaveTextContent(icons[variant]);
    }
    expect(screen.getByText('类比标题')).toBeInTheDocument();
    expect(screen.getByText('坑正文')).toBeInTheDocument();
    expect(screen.getByText('补充正文')).toBeInTheDocument();
    expect(screen.getByText('建议正文')).toBeInTheDocument();
  });

  it('list 支持无序与有序', () => {
    render(
      <>
        {renderBlock(unordered)}
        {renderBlock(ordered)}
      </>,
    );
    const sections = document.querySelectorAll('.lblock');
    const ul = sections[0]!.querySelector('ul');
    const ol = sections[1]!.querySelector('ol');
    expect(ul).not.toBeNull();
    expect(ol).not.toBeNull();
    expect(within(ul as HTMLElement).getAllByRole('listitem')).toHaveLength(2);
    expect(ul).toHaveTextContent('第一项 加粗');
    expect(ol).toHaveTextContent('步骤一');
  });

  it('steps 渲染序号、说明、代码与备注', () => {
    render(renderBlock(steps));
    expect(document.querySelector('.steps')).toHaveAttribute('role', 'list');
    expect(document.querySelectorAll('.steps__item')).toHaveLength(2);
    expect(document.querySelector('.steps__idx')).toHaveTextContent('01');
    expect(document.querySelectorAll('.steps__idx')[1]).toHaveTextContent('02');
    expect(screen.getByText('说明一')).toBeInTheDocument();
    expect(document.querySelector('.steps__code')).toHaveTextContent('curl -v https://example.com');
    expect(document.querySelector('.steps__note')).toHaveTextContent('备注一');
  });

  it('code 单轨渲染语言、标题、高亮与备注', () => {
    render(renderBlock(codeSingle));
    expect(document.querySelectorAll('.codeblock')).toHaveLength(1);
    expect(document.querySelector('.codeblock__lang')).toHaveTextContent('bash');
    expect(document.querySelector('.codeblock__bar')).toHaveTextContent('单轨示例');
    expect(document.querySelector('.codeblock pre code')).toHaveTextContent('curl -v https://example.com');
    expect(document.querySelector('.codeblock__note')).toHaveTextContent('单轨备注');
    expect(document.querySelector('.code-tracks')).toBeNull();
  });

  it('code 双轨：tab 切换只改本地状态与 hidden', async () => {
    const user = userEvent.setup();
    render(renderBlock(codeDual));
    expect(document.querySelectorAll('.code-tracks .codeblock')).toHaveLength(2);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Node.js', 'Python']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    const panes = document.querySelectorAll('.code-tracks .codeblock');
    expect(panes[0]).not.toHaveAttribute('hidden');
    expect(panes[1]).toHaveAttribute('hidden');
    expect(panes[1]).toHaveTextContent('Python 备注');

    await user.click(tabs[1]!);
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelectorAll('.code-tracks .codeblock')[0]).toHaveAttribute('hidden');
    expect(document.querySelectorAll('.code-tracks .codeblock')[1]).not.toHaveAttribute('hidden');

    await user.click(screen.getAllByRole('tab')[0]!);
    expect(document.querySelectorAll('.code-tracks .codeblock')[0]).not.toHaveAttribute('hidden');
    expect(document.querySelectorAll('.code-tracks .codeblock')[1]).toHaveAttribute('hidden');
  });

  it('table 渲染表头与行', () => {
    render(renderBlock(table));
    expect(document.querySelectorAll('.tbl thead th')).toHaveLength(2);
    expect(document.querySelectorAll('.tbl tbody tr')).toHaveLength(2);
    expect(document.querySelector('.tbl tbody tr td')).toHaveTextContent('2xx');
    expect(screen.getByText('失败')).toBeInTheDocument();
  });

  it('compare 渲染列与条目', () => {
    render(renderBlock(compare));
    const cols = document.querySelectorAll('.compare__col');
    expect(cols).toHaveLength(2);
    expect(cols[0]!.querySelector('h4')).toHaveTextContent('左列');
    expect(cols[1]!.querySelectorAll('li')).toHaveLength(2);
  });

  it('flow 支持展开与收起', async () => {
    const user = userEvent.setup();
    render(renderBlock(flow));
    const buttons = document.querySelectorAll<HTMLButtonElement>('.flow__step');
    expect(buttons).toHaveLength(2);
    const details = document.querySelectorAll<HTMLElement>('.flow > div > .flow__detail');
    expect(details).toHaveLength(1);
    expect(details[0]).toHaveStyle({ display: 'none' });
    expect(screen.getAllByText('点击展开')).toHaveLength(2);

    await user.click(buttons[0]!);
    expect(buttons[0]).toHaveClass('is-open');
    expect(document.querySelector('.flow > div > .flow__detail')).toHaveStyle({ display: 'block' });
    expect(screen.getByText('收起')).toBeInTheDocument();

    await user.click(buttons[0]!);
    expect(buttons[0]).not.toHaveClass('is-open');
    expect(document.querySelector('.flow > div > .flow__detail')).toHaveStyle({ display: 'none' });
    expect(screen.getAllByText('点击展开')).toHaveLength(2);
  });

  it('case 渲染五段复盘与指标变化', () => {
    render(renderBlock(caseBlock));
    expect(screen.getByText('案例复盘')).toBeInTheDocument();
    expect(document.querySelector('.case__title')).toHaveTextContent('一次 502');
    expect(document.querySelectorAll('.case__row')).toHaveLength(5);
    expect(document.querySelector('.case__row--cause .case__label')).toHaveTextContent('根因');
    expect(document.querySelector('.case__metric')).toHaveTextContent('P99 从 3s 降到 200ms');
  });

  it('未知类型输出固定文案', () => {
    render(renderBlock({ type: 'video' } as unknown as Block));
    expect(screen.getByText('未知内容块：video')).toBeInTheDocument();
  });
});

describe('highlightCode 与 v2 输出一致', () => {
  it('JS 注释、字符串、数字', () => {
    expect(highlightCode('const a = 1; // note', 'javascript')).toBe(
      '<span class="tok-key">const</span> a = <span class="tok-num">1</span>; <span class="tok-com">// note</span>',
    );
    expect(highlightCode('const name = "Ada";', 'javascript')).toBe(
      '<span class="tok-key">const</span> name = <span class="tok-str">"Ada"</span>;',
    );
    expect(highlightCode('return 42;', 'javascript')).toBe(
      '<span class="tok-key">return</span> <span class="tok-num">42</span>;',
    );
  });

  it('Python 三引号与注释', () => {
    expect(highlightCode('def f():\n    """doc"""\n    return 1', 'python')).toBe(
      '<span class="tok-key">def</span> f():\n    <span class="tok-str">"""doc"""</span>\n    <span class="tok-key">return</span> <span class="tok-num">1</span>',
    );
    expect(highlightCode('x = 1  # 注释', 'python')).toBe(
      'x = <span class="tok-num">1</span>  <span class="tok-com"># 注释</span>',
    );
  });

  it('SQL 关键字与注释', () => {
    expect(highlightCode('SELECT id FROM t -- all\nWHERE id = 1', 'sql')).toBe(
      '<span class="tok-key">SELECT</span> id <span class="tok-key">FROM</span> t <span class="tok-com">-- all</span>\n<span class="tok-key">WHERE</span> id = <span class="tok-num">1</span>',
    );
  });
});

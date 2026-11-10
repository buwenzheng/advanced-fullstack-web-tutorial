import { useEffect, useRef, useState } from 'react';
import type { Project } from '../../content/types';
import { useToast } from '../shell/useToast';
import { copyText } from './copy-text';

type Template = NonNullable<Project['templates']>[number];

type CopyStatus = 'idle' | 'copied' | 'failed';

export function TemplateCard({ template }: { template: Template }) {
  const notify = useToast();
  const [status, setStatus] = useState<CopyStatus>('idle');
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  async function handleCopy() {
    const copied = await copyText(template.body);
    setStatus(copied ? 'copied' : 'failed');
    if (copied) notify(`已复制：${template.title}`);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus('idle'), 1600);
  }

  const label = status === 'copied' ? '已复制' : status === 'failed' ? '复制失败' : '复制模板';

  return (
    <article className="template-card">
      <div className="template-card__head">
        <h4>{template.title}</h4>
        <button className="btn btn--ghost btn--sm" type="button" onClick={handleCopy}>
          {label}
        </button>
      </div>
      <p className="template-card__purpose">{template.purpose}</p>
      <p className="template-card__when">使用时机：{template.when}</p>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 可滚动区域需键盘聚焦（axe scrollable-region-focusable） */}
      <pre className="template-card__body" tabIndex={0} aria-label={`模板代码：${template.title}`}><code>{template.body}</code></pre>
    </article>
  );
}

import { useState } from 'react';
import { lang, languageLabel, type LanguageId } from '../../state/lang';
import type { Block } from '../../content/types';
import { CodeCard } from './CodeCard';

type CodeBlockData = Extract<Block, { type: 'code' }>;

interface Variant {
  id: LanguageId;
  code: string;
  lang: string;
  note?: string;
}

export function CodeBlock({ block }: { block: CodeBlockData }) {
  if (!block.python) {
    return <CodeCard code={block.code} lang={block.lang || 'javascript'} title={block.title} note={block.note} />;
  }
  return <CodeTracks block={block} python={block.python} />;
}

function CodeTracks({ block, python }: { block: CodeBlockData; python: string }) {
  const [track, setTrack] = useState<LanguageId>(() => (lang.get() === 'python' ? 'python' : 'javascript'));
  const variants: Variant[] = [
    { id: 'javascript', code: block.code, lang: block.lang || 'javascript', note: block.note },
    { id: 'python', code: python, lang: 'python', note: block.pythonNote ?? block.note },
  ];

  return (
    <div className="code-tracks">
      <div className="code-tracks__head">
        <div className="code-tabs" role="tablist" aria-label="语言实现">
          {variants.map((variant) => (
            <button
              key={variant.id}
              className={`code-tab${track === variant.id ? ' is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={track === variant.id}
              onClick={() => setTrack(variant.id)}
            >
              <span className={`code-tab__dot code-tab__dot--${variant.id}`} />
              {languageLabel(variant.id)}
            </button>
          ))}
        </div>
        <span className="tiny muted">同一概念的两种实现</span>
      </div>
      {variants.map((variant) => (
        <CodeCard
          key={variant.id}
          code={variant.code}
          lang={variant.lang}
          title={block.title}
          note={variant.note}
          hidden={track !== variant.id}
        />
      ))}
    </div>
  );
}

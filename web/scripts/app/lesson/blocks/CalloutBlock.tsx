import type { Block } from '../../../content/types';
import { RichText } from '../RichText';

const CALLOUTS = {
  analogy: { icon: '⇄', title: '前端类比' },
  pitfall: { icon: '!', title: '常见坑' },
  note: { icon: 'i', title: '补充' },
  tip: { icon: '✓', title: '实践建议' },
} as const;

export type CalloutVariant = keyof typeof CALLOUTS;

type CalloutBlockData = Extract<Block, { type: 'analogy' | 'pitfall' | 'note' | 'tip' }>;

export function CalloutBlock({ block, variant }: { block: CalloutBlockData; variant: CalloutVariant }) {
  const meta = CALLOUTS[variant];
  return (
    <section className="lblock">
      <div className={`callout callout--${variant}`}>
        <div className="callout__icon">{meta.icon}</div>
        <div>
          <div className="callout__title">{block.title || meta.title}</div>
          <RichText html={block.html} />
        </div>
      </div>
    </section>
  );
}

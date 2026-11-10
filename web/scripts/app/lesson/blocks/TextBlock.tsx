import type { Block } from '../../../content/types';
import { RichText } from '../RichText';

type TextBlockData = Extract<Block, { type: 'text' }>;

export function TextBlock({ block }: { block: TextBlockData }) {
  return (
    <section className="lblock">
      {block.title ? <h3 className="lblock__title">{block.title}</h3> : null}
      <RichText html={block.html} />
    </section>
  );
}

import type { Block } from '../../../content/types';
import { RichText } from '../RichText';

type ListBlockData = Extract<Block, { type: 'list' }>;

export function ListBlock({ block }: { block: ListBlockData }) {
  const Tag = block.ordered === true ? 'ol' : 'ul';
  return (
    <section className="lblock">
      {block.title ? <h3 className="lblock__title">{block.title}</h3> : null}
      <Tag>
        {block.items.map((item, index) => (
          <RichText key={index} as="li" html={item} />
        ))}
      </Tag>
    </section>
  );
}

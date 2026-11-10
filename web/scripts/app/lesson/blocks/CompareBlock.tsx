import type { Block } from '../../../content/types';
import { RichText } from '../RichText';

type CompareBlockData = Extract<Block, { type: 'compare' }>;

export function CompareBlock({ block }: { block: CompareBlockData }) {
  return (
    <section className="lblock">
      {block.title ? <h3 className="lblock__title">{block.title}</h3> : null}
      <div className="compare">
        {block.cols.map((col) => (
          <div key={col.title} className="compare__col">
            <h4>{col.title}</h4>
            <ul>
              {col.items.map((item, index) => (
                <RichText key={index} as="li" html={item} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

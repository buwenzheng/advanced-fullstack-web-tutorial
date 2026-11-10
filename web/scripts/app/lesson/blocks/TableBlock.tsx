import type { Block } from '../../../content/types';
import { RichText } from '../RichText';

type TableBlockData = Extract<Block, { type: 'table' }>;

export function TableBlock({ block }: { block: TableBlockData }) {
  return (
    <section className="lblock">
      {block.title ? <h3 className="lblock__title">{block.title}</h3> : null}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              {block.head.map((cell, index) => (
                <th key={index}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <RichText key={cellIndex} as="td" html={cell} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

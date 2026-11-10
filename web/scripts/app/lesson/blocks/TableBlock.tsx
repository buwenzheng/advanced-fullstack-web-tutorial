import type { Block } from '../../../content/types';
import { RichText } from '../RichText';

type TableBlockData = Extract<Block, { type: 'table' }>;

export function TableBlock({ block }: { block: TableBlockData }) {
  return (
    <section className="lblock">
      {block.title ? <h3 className="lblock__title">{block.title}</h3> : null}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 可滚动区域需键盘聚焦（axe scrollable-region-focusable） */}
      <div className="tbl-wrap" tabIndex={0} aria-label={block.title ? `表格：${block.title}` : '数据表格'}>
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

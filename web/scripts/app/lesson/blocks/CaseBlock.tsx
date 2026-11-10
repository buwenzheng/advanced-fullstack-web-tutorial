import type { Block } from '../../../content/types';
import { RichText } from '../RichText';

type CaseBlockData = Extract<Block, { type: 'case' }>;

const ROWS: Array<[keyof CaseBlockData, string]> = [
  ['context', '背景'],
  ['symptom', '现象'],
  ['cause', '根因'],
  ['fix', '止损与修复'],
  ['prevention', '预防'],
];

export function CaseBlock({ block }: { block: CaseBlockData }) {
  const rows = ROWS.filter(([field]) => block[field]);
  return (
    <section className="lblock">
      <div className="case">
        <div className="case__head">
          <span className="case__tag">案例复盘</span>
          <h3 className="case__title">{block.title}</h3>
        </div>
        {rows.map(([field, label]) => (
          <div key={field} className={`case__row case__row--${field}`}>
            <span className="case__label">{label}</span>
            <RichText className="case__body" html={block[field] as string} />
          </div>
        ))}
        {block.metric ? (
          <div className="case__metric">
            <span className="case__label">指标变化</span>
            <RichText as="span" html={block.metric} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

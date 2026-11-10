import { useState } from 'react';
import type { Block } from '../../../content/types';
import { RichText } from '../RichText';

type FlowBlockData = Extract<Block, { type: 'flow' }>;
type FlowStep = FlowBlockData['steps'][number];

function FlowStepItem({ step, index }: { step: FlowStep; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className={`flow__step${open ? ' is-open' : ''}`}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flow__idx">{index + 1}</span>
        <span>
          <span className="flow__name">{step.name}</span>
          <RichText as="span" className="flow__detail" html={step.detail} />
        </span>
        <span className="tiny muted">{open ? '收起' : '点击展开'}</span>
      </button>
      <RichText
        className="flow__detail"
        style={{ display: open ? 'block' : 'none', marginTop: 8, color: 'var(--text-dim)' }}
        html={step.body || ''}
      />
    </div>
  );
}

export function FlowBlock({ block }: { block: FlowBlockData }) {
  return (
    <section className="lblock">
      {block.title ? <h3 className="lblock__title">{block.title}</h3> : null}
      <div className="flow">
        {block.steps.map((step, index) => (
          <FlowStepItem key={index} step={step} index={index} />
        ))}
      </div>
    </section>
  );
}

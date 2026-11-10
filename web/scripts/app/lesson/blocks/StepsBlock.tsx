import type { Block } from '../../../content/types';
import { RichText } from '../RichText';

type StepsBlockData = Extract<Block, { type: 'steps' }>;

export function StepsBlock({ block }: { block: StepsBlockData }) {
  return (
    <section className="lblock">
      {block.title ? <h3 className="lblock__title">{block.title}</h3> : null}
      <div className="steps" role="list">
        {block.steps.map((step, index) => (
          <div key={index} className="steps__item" role="listitem">
            <span className="steps__idx">{String(index + 1).padStart(2, '0')}</span>
            <div className="steps__body">
              <div className="steps__name">{step.title}</div>
              <RichText className="steps__text" html={step.html} />
              {step.code ? <pre className="steps__code">{step.code}</pre> : null}
              {step.note ? <RichText className="steps__note" html={step.note} /> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

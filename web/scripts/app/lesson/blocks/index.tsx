import type { Block } from '../../../content/types';
import { CodeBlock } from '../CodeBlock';
import { TextBlock } from './TextBlock';
import { CalloutBlock } from './CalloutBlock';
import { ListBlock } from './ListBlock';
import { StepsBlock } from './StepsBlock';
import { TableBlock } from './TableBlock';
import { CompareBlock } from './CompareBlock';
import { FlowBlock } from './FlowBlock';
import { CaseBlock } from './CaseBlock';

export function renderBlock(block: Block) {
  switch (block.type) {
    case 'text':
      return <TextBlock block={block} />;
    case 'analogy':
      return <CalloutBlock block={block} variant="analogy" />;
    case 'pitfall':
      return <CalloutBlock block={block} variant="pitfall" />;
    case 'note':
      return <CalloutBlock block={block} variant="note" />;
    case 'tip':
      return <CalloutBlock block={block} variant="tip" />;
    case 'list':
      return <ListBlock block={block} />;
    case 'steps':
      return <StepsBlock block={block} />;
    case 'code':
      return (
        <section className="lblock">
          {block.title ? <h3 className="lblock__title">{block.title}</h3> : null}
          <CodeBlock block={block} />
        </section>
      );
    case 'table':
      return <TableBlock block={block} />;
    case 'compare':
      return <CompareBlock block={block} />;
    case 'flow':
      return <FlowBlock block={block} />;
    case 'case':
      return <CaseBlock block={block} />;
    default:
      return (
        <section className="lblock">
          <p>{`未知内容块：${(block as { type: string }).type}`}</p>
        </section>
      );
  }
}

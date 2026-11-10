import type { Stage } from '../../content/types';

export function stageLabel(stage: Stage | null): string {
  if (!stage) return '';
  return stage.appendix ? '附录' : `阶段 ${stage.index}`;
}
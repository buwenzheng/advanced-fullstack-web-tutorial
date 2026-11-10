import type { Check, Exercise } from '../../content/types';
import { CodeTask } from './CodeTask';
import { DesignTask } from './DesignTask';
import { McqTask } from './McqTask';
import { SqlTask } from './SqlTask';

export function TaskRenderer({ task }: { task: Check | Exercise }) {
  switch (task.kind) {
    case 'mcq':
      return <McqTask task={task} />;
    case 'code':
      return <CodeTask task={task} />;
    case 'sql':
      return <SqlTask task={task} />;
    case 'design':
      return <DesignTask task={task} />;
    default:
      return <div className="empty-state">{`未知题型：${(task as { kind: string }).kind}`}</div>;
  }
}

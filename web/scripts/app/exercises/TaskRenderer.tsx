import type { Check, Exercise } from '../../content/types';
import { McqTask } from './McqTask';

export function TaskRenderer({ task }: { task: Check | Exercise }) {
  switch (task.kind) {
    case 'mcq':
      return <McqTask task={task} />;
    default:
      return <div className="empty-state">{`未知题型：${task.kind}`}</div>;
  }
}

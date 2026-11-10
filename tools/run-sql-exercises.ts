import { eachExercise } from './lib/content.js';
import { createDatabase, runQuery, rowsEqual } from '../web/scripts/engine/sql.js';

let exercises = 0;
let failing = 0;
const errors: string[] = [];

eachExercise((task, lesson) => {
  if (task.kind !== 'sql') return;
  exercises += 1;

  const missing = (['tables', 'expected', 'solution'] as const).filter(
    (key) => task[key] === undefined,
  );
  if (missing.length) {
    failing += 1;
    errors.push(`${lesson.id}/${task.id}: 缺少字段 ${missing.join(', ')}`);
    return;
  }

  try {
    const db = createDatabase(task.tables || {});
    const outcome = runQuery(db, task.solution);
    if (outcome.kind !== 'select') {
      failing += 1;
      errors.push(`${lesson.id}/${task.id}: solution 不是 SELECT（得到 ${outcome.kind}）`);
      return;
    }
    if (!rowsEqual(outcome.rows, task.expected || [], outcome.columns)) {
      failing += 1;
      errors.push(`${lesson.id}/${task.id}: 结果不匹配\n  actual: ${JSON.stringify(outcome.rows)}\n  expected: ${JSON.stringify(task.expected)}`);
    }
  } catch (error) {
    failing += 1;
    errors.push(`${lesson.id}/${task.id}: ${String((error && (error as Error).message) || error)}`);
  }
});

if (errors.length) console.error(errors.join('\n'));
console.log(`sql exercises=${exercises} failing=${failing}`);
process.exit(failing ? 1 : 0);

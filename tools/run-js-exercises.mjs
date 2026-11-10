import { eachExercise } from './lib/content.mjs';
import { runSourceSuite } from './lib/js-runner.mjs';

const tasks = [];
eachExercise((task, lesson) => {
  if (task.kind === 'code') tasks.push({ task, lesson });
});

let failing = 0;
let starterFailing = 0;
const errors = [];

for (const { task, lesson } of tasks) {
  const tests = Array.isArray(task.tests) ? task.tests : [];
  if (!Array.isArray(task.tests) || tests.length === 0) {
    errors.push(`${lesson.id}/${task.id}: 缺少 tests`);
    failing += 1;
    continue;
  }

  const solutionResults = await runSourceSuite({ source: task.solution, tests });
  if (solutionResults.length !== tests.length) {
    errors.push(`${lesson.id}/${task.id}: 执行测试数 ${solutionResults.length} != 声明 ${tests.length}`);
    failing += 1;
  }
  if (solutionResults.some((result) => !result.ok)) {
    failing += 1;
    const detail = solutionResults
      .map((result, index) => (result.ok ? null : `  - ${result.name}: ${result.error}`))
      .filter(Boolean)
      .join('\n');
    errors.push(`${lesson.id}/${task.id}: solution 未通过\n${detail}`);
  }

  const starterResults = await runSourceSuite({ source: task.starter, tests });
  if (starterResults.some((result) => !result.ok)) starterFailing += 1;
  else {
    errors.push(`${lesson.id}/${task.id}: starter 全部通过，练习没有区分度`);
  }
}

if (errors.length) console.error(errors.join('\n'));
console.log(`js code exercises=${tasks.length} failing=${failing} starterFailing=${starterFailing}`);
process.exit(failing || errors.length ? 1 : 0);

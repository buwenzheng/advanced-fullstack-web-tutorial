import { content, manifest, EXPECTED } from './lib/content.js';
import type { Stage } from '../web/scripts/content/types.js';

type Stats = Record<'lessons' | 'minutes' | 'checks' | 'code' | 'sql' | 'design', number>;

function statsOf(stage: Stage): Stats {
  const stat: Stats = { lessons: stage.lessons.length, minutes: 0, checks: 0, code: 0, sql: 0, design: 0 };
  for (const lesson of stage.lessons) {
    stat.minutes += lesson.duration || 0;
    stat.checks += lesson.checks.length;
    for (const task of lesson.exercises) {
      if (task.kind === 'code') stat.code += 1;
      else if (task.kind === 'sql') stat.sql += 1;
      else if (task.kind === 'design') stat.design += 1;
    }
  }
  return stat;
}

const totals: Stats = { lessons: 0, minutes: 0, checks: 0, code: 0, sql: 0, design: 0 };
const core = { lessons: 0, minutes: 0 };
const appendix = { lessons: 0, minutes: 0 };
const errors: string[] = [];

for (const stage of content.curriculum) {
  const stat = statsOf(stage);
  for (const key of Object.keys(totals) as Array<keyof Stats>) totals[key] += stat[key];
  if (stage.appendix) {
    appendix.lessons += stat.lessons;
    appendix.minutes += stat.minutes;
  } else {
    core.lessons += stat.lessons;
    core.minutes += stat.minutes;
  }
  console.log(`${stage.id}: lessons=${stat.lessons} minutes=${stat.minutes} checks=${stat.checks} code=${stat.code} sql=${stat.sql} design=${stat.design}`);

  const manifestStage = manifest.stages.find((entry) => entry.id === stage.id);
  if (!stage.appendix) {
    if (!manifestStage) errors.push(`${stage.id}: 清单缺少该阶段`);
    else if (manifestStage.duration !== stat.minutes) errors.push(`${stage.id}: 时长 ${stat.minutes} != 清单 ${manifestStage.duration}`);
  }
}

if (manifest.appendix.duration !== appendix.minutes) {
  errors.push(`appendix: 时长 ${appendix.minutes} != 清单 ${manifest.appendix.duration}`);
}
if (manifest.totals.lessons !== totals.lessons) errors.push(`清单 lessons=${manifest.totals.lessons} 实际 ${totals.lessons}`);
if (manifest.totals.coreMinutes !== core.minutes) errors.push(`清单 coreMinutes=${manifest.totals.coreMinutes} 实际 ${core.minutes}`);
if (manifest.totals.appendixMinutes !== appendix.minutes) errors.push(`清单 appendixMinutes=${manifest.totals.appendixMinutes} 实际 ${appendix.minutes}`);
if (manifest.totals.minutes !== totals.minutes) errors.push(`清单 minutes=${manifest.totals.minutes} 实际 ${totals.minutes}`);

if (totals.lessons !== EXPECTED.lessons) errors.push(`lessons ${totals.lessons} != ${EXPECTED.lessons}`);
if (core.lessons !== EXPECTED.core) errors.push(`core lessons ${core.lessons} != ${EXPECTED.core}`);
if (appendix.lessons !== EXPECTED.appendix) errors.push(`appendix lessons ${appendix.lessons} != ${EXPECTED.appendix}`);
if (core.minutes !== EXPECTED.coreMinutes) errors.push(`core minutes ${core.minutes} != ${EXPECTED.coreMinutes}`);
if (appendix.minutes !== EXPECTED.appendixMinutes) errors.push(`appendix minutes ${appendix.minutes} != ${EXPECTED.appendixMinutes}`);

if (errors.length) console.error(errors.join('\n'));
console.log(`lessons: ${totals.lessons} core: ${core.lessons} ${core.minutes} appendix: ${appendix.lessons} ${appendix.minutes} total: ${totals.minutes}`);
process.exit(errors.length ? 1 : 0);

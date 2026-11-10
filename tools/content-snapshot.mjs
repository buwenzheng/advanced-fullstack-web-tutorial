import { createHash } from 'node:crypto';
import { curriculum, graduationProject } from '../web/scripts/content/index.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const source = value;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [key, canonical(source[key])]),
    );
  }
  return value;
}

const payload = canonical({ curriculum, graduationProject });
const sha256 = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

const stages = Object.values(curriculum);
const lessons = stages.flatMap((stage) => stage.lessons);
const checks = lessons.reduce((sum, lesson) => sum + (lesson.checks?.length ?? 0), 0);
const exercises = lessons.reduce((sum, lesson) => sum + (lesson.exercises?.length ?? 0), 0);
const projects = stages.filter((stage) => stage.project).length + (graduationProject ? 1 : 0);

process.stdout.write(
  `sha256=${sha256}\n` +
    `stages=${stages.length} lessons=${lessons.length} projects=${projects} checks=${checks} exercises=${exercises}\n`,
);

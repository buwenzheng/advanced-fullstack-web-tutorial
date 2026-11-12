import fs from 'node:fs';
import { content } from './lib/content.js';

const routes = [
  '#/',
  ...content.curriculum.map((stage) => `#/stage/${stage.id}`),
  ...content.allLessons.map((lesson) => `#/lesson/${lesson.id}`),
  ...content.curriculum
    .flatMap((stage) => stage.projects ?? (stage.project ? [stage.project] : []))
    .map((project) => project.id)
    .map((id) => `#/project/${id}`),
  `#/project/${content.graduationProject.id}`,
  '#/lab',
  '#/report',
];

const unique = [...new Set(routes)];
fs.writeFileSync('e2e/routes.json', `${JSON.stringify(unique)}\n`);
console.log('routes ok', unique.length);

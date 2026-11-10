import { content, walkStrings } from './lib/content.js';

const lessonIds = new Set(content.allLessons.map((lesson) => lesson.id));
const stageIds = new Set(content.curriculum.map((stage) => stage.id));
const projectIds = new Set([
  content.graduationProject.id,
  ...content.curriculum.map((stage) => stage.project?.id).filter(Boolean),
]);
const knownRoutes = new Set(['#/', '#/lab', '#/report']);

const broken: string[] = [];

function checkRoute(route: string, where: string) {
  if (knownRoutes.has(route)) return;
  const match = route.match(/^#\/(lesson|stage|project)\/([A-Za-z0-9_-]+)$/);
  if (!match) return;
  const kind = match[1];
  const id = match[2] ?? '';
  const pool = kind === 'lesson' ? lessonIds : kind === 'stage' ? stageIds : projectIds;
  if (!pool.has(id)) broken.push(`${where}: ${route} 目标不存在`);
}

walkStrings(content.curriculum, (value, keyPath) => {
  const matches = value.match(/#\/(?:lesson|stage|project)\/[A-Za-z0-9_-]+/g) || [];
  matches.forEach((route) => checkRoute(route, keyPath));
});

walkStrings(content.graduationProject, (value, keyPath) => {
  const matches = value.match(/#\/(?:lesson|stage|project)\/[A-Za-z0-9_-]+/g) || [];
  matches.forEach((route) => checkRoute(route, `graduation.${keyPath}`));
});

if (broken.length) {
  console.error(broken.join('\n'));
  console.log(`links broken=${broken.length}`);
  process.exit(1);
}

console.log('links broken=0');

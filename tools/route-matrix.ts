import { curriculum, graduationProject } from '../web/scripts/content/index.js';

const stages = Object.values(curriculum);
const routes = ['#/'];

for (const stage of stages) routes.push(`#/stage/${stage.id}`);
for (const stage of stages) for (const lesson of stage.lessons) routes.push(`#/lesson/${lesson.id}`);
for (const stage of stages) if (stage.project?.id) routes.push(`#/project/${stage.project.id}`);
if (graduationProject?.id) routes.push(`#/project/${graduationProject.id}`);
routes.push('#/lab', '#/report');

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(routes)}\n`);
} else {
  process.stdout.write(`${routes.join('\n')}\n`);
}

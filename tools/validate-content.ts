import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content.js';
import { graduationProject } from '../web/scripts/content/graduation.js';
import { stageInputs } from '../web/scripts/content/sources.js';
import { validateContent } from '../web/scripts/content/validate.js';

const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs/content-manifest.json'), 'utf8'),
) as unknown;

const { stats, issues } = validateContent(stageInputs, graduationProject, manifest);

if (issues.length) {
  for (const issue of issues) console.error(`${issue.path}: ${issue.message}`);
  console.log(`content invalid issues=${issues.length}`);
  process.exit(1);
}

console.log(
  `content ok stages=${stats.stages} lessons=${stats.lessons} projects=${stats.projects} checks=${stats.checks} exercises=${stats.exercises} pythonLessons=${stats.pythonLessons} pythonBlocks=${stats.pythonBlocks} pythonTracks=${stats.pythonTracks} duration=${stats.duration}`,
);

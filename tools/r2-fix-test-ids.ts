import fs from 'node:fs';
import { LESSON_ID_MAP, PROJECT_ID_MAP } from '../web/scripts/content/id-map.js';

const pairs = [
  ...Object.entries(LESSON_ID_MAP).sort((a, b) => b[0].length - a[0].length),
  ...Object.entries(PROJECT_ID_MAP)
    .filter(([from, to]) => from !== to)
    .sort((a, b) => b[0].length - a[0].length),
];

const files = [
  'web/scripts/test/lesson-page.test.tsx',
  'web/scripts/test/report.test.tsx',
  'web/scripts/test/project-page.test.tsx',
  'web/scripts/test/shell.test.tsx',
  'web/scripts/test/overview-page.test.tsx',
  'web/scripts/test/stage-page.test.tsx',
  'web/scripts/test/mastery.test.ts',
  'web/scripts/test/search.test.ts',
  'web/scripts/test/state-store.test.ts',
  'web/scripts/test/content-assemble.test.ts',
];

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  for (const [from, to] of pairs) {
    text = text.split(from).join(to);
  }
  // 旧导出名残留
  text = text.replace(/\bs0L1\b/g, 'm1Http');
  if (text !== before) {
    fs.writeFileSync(file, text);
    console.log('updated', file);
  } else {
    console.log('unchanged', file);
  }
}

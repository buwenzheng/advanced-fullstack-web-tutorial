import fs from 'node:fs';
import path from 'node:path';
import { LESSON_ID_MAP } from '../web/scripts/content/id-map.js';

const dir = 'docs/content-specs';
const files = new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.md')));
const deleted: string[] = [];

for (const [oldId, newId] of Object.entries(LESSON_ID_MAP)) {
  const oldFile = `${oldId}.md`;
  const newFile = `${newId}.md`;
  if (files.has(oldFile) && files.has(newFile)) {
    fs.unlinkSync(path.join(dir, oldFile));
    deleted.push(oldFile);
  }
}

if (files.has('p-graduation.md')) {
  if (!files.has('x-linkhub.md')) {
    fs.renameSync(path.join(dir, 'p-graduation.md'), path.join(dir, 'x-linkhub.md'));
    console.log('renamed p-graduation.md -> x-linkhub.md');
  } else {
    fs.unlinkSync(path.join(dir, 'p-graduation.md'));
    deleted.push('p-graduation.md');
  }
}

console.log('deleted', deleted.length, deleted.join(', ') || '(none)');
console.log('remaining', fs.readdirSync(dir).filter((f) => f.endsWith('.md')).length);

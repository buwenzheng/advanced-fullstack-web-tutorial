import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LESSON_ID_MAP } from '../web/scripts/content/id-map.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT, 'docs/content-manifest.json');
const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as {
  blocks: Array<{
    lessons: Array<{ id: string; newId: string; duration: number }>;
    chapters: Array<{ id: string; title: string; lessonIds: string[] }>;
  }>;
  capstone: { id: string; legacyId: string; milestones?: number };
};

for (const block of doc.blocks) {
  for (const lesson of block.lessons) {
    const legacy = lesson.id;
    const next = lesson.newId || LESSON_ID_MAP[legacy];
    if (!next) throw new Error(`no mapping for ${legacy}`);
    (lesson as { id: string; legacyId?: string; newId?: string }).id = next;
    (lesson as { legacyId?: string }).legacyId = legacy;
    delete (lesson as { newId?: string }).newId;
  }
  for (const chapter of block.chapters) {
    chapter.lessonIds = chapter.lessonIds.map((id) => LESSON_ID_MAP[id] || id);
  }
}

doc.capstone.legacyId = 'p-graduation';
doc.capstone.id = 'x-linkhub';

fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
console.log('manifest flipped to new lesson ids');

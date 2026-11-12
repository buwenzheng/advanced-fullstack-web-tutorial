import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LESSON_ID_MAP } from '../web/scripts/content/id-map.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function toCamel(id: string): string {
  return id.replace(/-([a-zA-Z0-9])/g, (_, ch: string) => ch.toUpperCase());
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.ts')) files.push(full);
  }
  return files;
}

const invalidIds = Object.values(LESSON_ID_MAP).filter((id) => id.includes('-'));
invalidIds.sort((a, b) => b.length - a.length);

let changed = 0;
for (const file of walk(path.join(ROOT, 'web/scripts/content'))) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  for (const id of invalidIds) {
    const camel = toCamel(id);
    // export const b-bigO
    text = text.replaceAll(`export const ${id}`, `export const ${camel}`);
    // import { b-bigO }
    text = text.replaceAll(`{ ${id} }`, `{ ${camel} }`);
    // lessons array references: b-bigO,  or [b-bigO]
    text = text.replaceAll(`[${id},`, `[${camel},`);
    text = text.replaceAll(`[${id}]`, `[${camel}]`);
    text = text.replaceAll(`, ${id},`, `, ${camel},`);
    text = text.replaceAll(`, ${id}]`, `, ${camel}]`);
  }
  if (text !== before) {
    fs.writeFileSync(file, text);
    changed += 1;
    console.log('fixed', path.relative(ROOT, file));
  }
}
console.log(`done ${changed}`);

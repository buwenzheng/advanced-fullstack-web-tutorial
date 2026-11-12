/**
 * R2 辅助：在现有 stages 目录内把旧课时/题目/项目 ID 替换为新 ID（不改目录结构）。
 * 用法：npx tsx tools/r2-remap-lesson-ids.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LESSON_ID_MAP, PROJECT_ID_MAP } from '../web/scripts/content/id-map.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = [
  path.join(ROOT, 'web/scripts/content'),
  path.join(ROOT, 'docs/content-specs'),
];

function toCamel(id: string): string {
  return id.replace(/-([a-zA-Z0-9])/g, (_, ch: string) => ch.toUpperCase());
}

const pairs: Array<[string, string]> = [
  ...Object.entries(LESSON_ID_MAP),
  ...Object.entries(PROJECT_ID_MAP),
];

for (const [from, to] of Object.entries(LESSON_ID_MAP)) {
  const fromCamel = toCamel(from);
  const toCamelId = toCamel(to);
  if (fromCamel !== from) pairs.push([fromCamel, toCamelId]);
}

pairs.sort((a, b) => b[0].length - a[0].length);

function remapText(input: string): string {
  let out = input;
  for (const [from, to] of pairs) {
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    out = out.replace(re, to);
  }
  return out;
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|md|json)$/.test(entry.name)) files.push(full);
  }
  return files;
}

let changed = 0;
for (const root of TARGETS) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    if (file.endsWith(`${path.sep}id-map.ts`)) continue;
    const before = fs.readFileSync(file, 'utf8');
    const after = remapText(before);
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed += 1;
      console.log('updated', path.relative(ROOT, file));
    }
  }
}

// 重命名课时文件 s0-l1.ts → m1-http.ts 等
const stagesRoot = path.join(ROOT, 'web/scripts/content/stages');
for (const [from, to] of Object.entries(LESSON_ID_MAP)) {
  const matches = walk(stagesRoot).filter((file) => path.basename(file) === `${from}.ts`);
  for (const file of matches) {
    const dest = path.join(path.dirname(file), `${to}.ts`);
    if (file !== dest) {
      fs.renameSync(file, dest);
      console.log('renamed', path.relative(ROOT, file), '->', path.relative(ROOT, dest));
      changed += 1;
    }
  }
}

for (const [from, to] of Object.entries(LESSON_ID_MAP)) {
  const specFrom = path.join(ROOT, 'docs/content-specs', `${from}.md`);
  const specTo = path.join(ROOT, 'docs/content-specs', `${to}.md`);
  if (fs.existsSync(specFrom) && !fs.existsSync(specTo)) {
    fs.renameSync(specFrom, specTo);
    console.log('renamed', path.relative(ROOT, specFrom), '->', path.relative(ROOT, specTo));
    changed += 1;
  }
}

console.log(`done filesTouched≈${changed}`);

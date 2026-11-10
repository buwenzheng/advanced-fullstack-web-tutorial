import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');

export const content = await import(pathToFileURL(path.join(ROOT, 'web/scripts/content/index.js')).href);

export const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs/content-manifest.json'), 'utf8'),
);

export const EXPECTED = {
  lessons: 45,
  core: 32,
  appendix: 13,
  coreMinutes: 2510,
  appendixMinutes: 890,
  minutes: 3400,
};

export const LESSON_ID_RE = /^s[0-7]-(l\d+|cli|schema|perf|resilience|data-scale)$|^a\d+$/;

export function walkStrings(value, visit, keyPath = '') {
  if (typeof value === 'string') {
    visit(value, keyPath);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, visit, `${keyPath}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      walkStrings(item, visit, keyPath ? `${keyPath}.${key}` : key);
    }
  }
}

export function stripHtml(html) {
  return String(html || '')
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<code[\s\S]*?<\/code>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function blockText(block) {
  const parts = [];
  walkStrings(block, (value, keyPath) => {
    if (keyPath.endsWith('.type')) return;
    parts.push(keyPath.includes('html') || keyPath.includes('text') ? stripHtml(value) : value);
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function eachExercise(callback) {
  for (const stage of content.curriculum) {
    for (const lesson of stage.lessons) {
      lesson.exercises.forEach((task, index) => callback(task, lesson, stage, index));
    }
  }
}

export function eachCheck(callback) {
  for (const stage of content.curriculum) {
    for (const lesson of stage.lessons) {
      lesson.checks.forEach((check, index) => callback(check, lesson, stage, index));
    }
  }
}

export function loadPythonMaps() {
  return { blocks: content.PYTHON_BLOCKS, tracks: content.PYTHON_TRACKS };
}

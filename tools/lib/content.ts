import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  curriculum,
  graduationProject,
  allLessons,
  PYTHON_BLOCKS,
  PYTHON_TRACKS,
} from '../../web/scripts/content/index.js';
import {
  flattenManifestLessons,
  parseContentManifest,
  type ContentManifestV3,
  type ManifestLessonRef,
} from '../../web/scripts/content/manifest.js';
import type {
  Check,
  Exercise,
  Lesson,
  Project,
  PythonBlockMap,
  PythonTrackMap,
  Stage,
} from '../../web/scripts/content/types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');

export const content = {
  curriculum: curriculum as unknown as Stage[],
  graduationProject: graduationProject as unknown as Project,
  allLessons: allLessons as unknown as Lesson[],
  PYTHON_BLOCKS: PYTHON_BLOCKS as unknown as PythonBlockMap,
  PYTHON_TRACKS: PYTHON_TRACKS as unknown as PythonTrackMap,
};

export type Manifest = ContentManifestV3;
export type ManifestLesson = ManifestLessonRef;

export const manifest: Manifest = parseContentManifest(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/content-manifest.json'), 'utf8')),
);

export const manifestLessons = flattenManifestLessons(manifest);

export const EXPECTED = {
  lessons: 45,
  core: 32,
  appendix: 13,
  coreMinutes: 2510,
  appendixMinutes: 890,
  minutes: 3400,
};

/** R1：内容仍用旧 ID；R2 后改为新 ID 正则 */
/** R2 起：m1-m4 / e1 / b 语义 ID；仍兼容历史形态便于审计过渡日志 */
export const LESSON_ID_RE = /^(?:m[1-4]|e1|b)-[a-zA-Z0-9-]+$|^s[0-7]-(l\d+|cli|schema|perf|resilience|data-scale)$|^a\d+$/;

export type WalkVisitor = (value: string, keyPath: string) => void;

export function walkStrings(value: unknown, visit: WalkVisitor, keyPath = ''): void {
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

export function stripHtml(html: unknown): string {
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

export function sumMinutes(lessons: Array<{ duration?: number }>): number {
  return lessons.reduce((sum, lesson) => sum + (lesson.duration || 0), 0);
}

export function blockText(block: unknown): string {
  const parts: string[] = [];
  walkStrings(block, (value, keyPath) => {
    if (keyPath.endsWith('.type')) return;
    parts.push(keyPath.includes('html') || keyPath.includes('text') ? stripHtml(value) : value);
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export type ExerciseVisitor = (
  task: Exercise,
  lesson: Lesson,
  stage: Stage,
  index: number,
) => void;

export function eachExercise(callback: ExerciseVisitor): void {
  for (const stage of content.curriculum) {
    for (const lesson of stage.lessons) {
      lesson.exercises.forEach((task, index) => callback(task, lesson, stage, index));
    }
  }
}

export type CheckVisitor = (check: Check, lesson: Lesson, stage: Stage, index: number) => void;

export function eachCheck(callback: CheckVisitor): void {
  for (const stage of content.curriculum) {
    for (const lesson of stage.lessons) {
      lesson.checks.forEach((check, index) => callback(check, lesson, stage, index));
    }
  }
}

export function loadPythonMaps(): { blocks: PythonBlockMap; tracks: PythonTrackMap } {
  return { blocks: content.PYTHON_BLOCKS, tracks: content.PYTHON_TRACKS };
}

export type { Check, Exercise, Lesson, Project, Stage };

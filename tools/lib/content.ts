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

export interface ManifestLesson {
  id: string;
  duration: number;
}
export interface ManifestStage {
  id: string;
  index: number;
  title: string;
  duration: number;
  lessons: ManifestLesson[];
}
export interface Manifest {
  version: number;
  stages: ManifestStage[];
  appendix: { id: string; duration: number; lessons: string[] };
  graduation: { id: string; milestones: number };
  totals: {
    lessons: number;
    coreMinutes: number;
    appendixMinutes: number;
    minutes: number;
  };
}

export const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs/content-manifest.json'), 'utf8'),
) as Manifest;

export const EXPECTED = {
  lessons: 45,
  core: 32,
  appendix: 13,
  coreMinutes: 2510,
  appendixMinutes: 890,
  minutes: 3400,
};

export const LESSON_ID_RE = /^s[0-7]-(l\d+|cli|schema|perf|resilience|data-scale)$|^a\d+$/;

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

import type { Block, Lesson } from './types.js';

export interface SearchDocument {
  kind: 'stage' | 'lesson' | 'project';
  id: string;
  href: string;
  title: string;
  sub: string;
  text: string;
}

export function blockText(block: Block): string {
  const parts: Array<string | undefined> = [
    block.title,
    'html' in block ? block.html : undefined,
    'note' in block ? block.note : undefined,
    'code' in block ? block.code : undefined,
  ];
  if ('items' in block) parts.push(...block.items);
  if ('head' in block) parts.push(...block.head);
  if ('rows' in block) block.rows.forEach((row) => parts.push(...row));
  if ('steps' in block) block.steps.forEach((step) => parts.push(
    'name' in step ? step.name : undefined,
    'title' in step ? step.title : undefined,
    'detail' in step ? step.detail : undefined,
    'body' in step ? step.body : undefined,
    'html' in step ? step.html : undefined,
  ));
  if ('cols' in block) block.cols.forEach((col) => parts.push(col.title, ...col.items));
  if (block.type === 'case') parts.push(block.context, block.symptom, block.cause, block.fix, block.prevention, block.metric);
  return parts.filter(Boolean).join(' ');
}

const haystackCache = new Map<string, string>();

export function lessonHaystack(lesson: Lesson): string {
  const cached = haystackCache.get(lesson.id);
  if (cached !== undefined) return cached;
  const parts: Array<string | undefined> = [lesson.title, lesson.subtitle, ...(lesson.keywords || [])];
  lesson.blocks.forEach((block) => parts.push(blockText(block)));
  lesson.checks.forEach((check) => parts.push(check.prompt || check.question, check.explain, ...check.options.map((option) => option.text)));
  lesson.exercises.forEach((exercise) => {
    parts.push(exercise.title);
    if ('brief' in exercise) parts.push(exercise.brief);
    if ('prompt' in exercise) parts.push(exercise.prompt);
  });
  const text = parts.filter(Boolean).join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  haystackCache.set(lesson.id, text);
  return text;
}

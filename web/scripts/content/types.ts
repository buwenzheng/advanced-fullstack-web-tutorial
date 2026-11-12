import type { z } from 'zod';
import type {
  blockSchema,
  blockKindSchema,
  chapterSchema,
  checkSchema,
  exerciseSchema,
  learningPathSchema,
  lessonSchema,
  pathStepSchema,
  projectSchema,
  stageSchema,
  pythonBlockMapSchema,
  pythonTrackMapSchema,
} from './schema.js';

export type Block = z.infer<typeof blockSchema>;
export type Check = z.infer<typeof checkSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type CodeExercise = Extract<Exercise, { kind: 'code' }>;
export type LessonData = z.infer<typeof lessonSchema>;
export type Lesson = LessonData & { stageId: string };
export type Project = z.infer<typeof projectSchema>;
export type StageData = z.infer<typeof stageSchema>;
export type Stage = Omit<StageData, 'lessons'> & { lessons: Lesson[] };
export type PythonBlockMap = z.infer<typeof pythonBlockMapSchema>;
export type PythonTrackMap = z.infer<typeof pythonTrackMapSchema>;
export type BlockKind = z.infer<typeof blockKindSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type PathStep = z.infer<typeof pathStepSchema>;
export type LearningPath = z.infer<typeof learningPathSchema>;

export interface StageInput {
  data: StageData;
  pythonBlocks: PythonBlockMap;
  pythonTracks: PythonTrackMap;
}

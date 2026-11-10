import { assembleProject, assembleStage } from '../../content/assemble';
import type { Catalog } from '../../content/catalog';
import type { Project, Stage, StageInput } from '../../content/types';
import type { SearchDocument } from '../shell/search-docs';
import type { LessonContext } from './types';

const STAGE_LOADERS: Record<string, () => Promise<StageInput>> = {
  s0: async () => {
    const module = await import('../../content/stages/s0/index.js');
    return {
      data: module.stage0,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
  s1: async () => {
    const module = await import('../../content/stages/s1/index.js');
    return {
      data: module.stage1,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
  s2: async () => {
    const module = await import('../../content/stages/s2/index.js');
    return {
      data: module.stage2,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
  s3: async () => {
    const module = await import('../../content/stages/s3/index.js');
    return {
      data: module.stage3,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
  s4: async () => {
    const module = await import('../../content/stages/s4/index.js');
    return {
      data: module.stage4,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
  s5: async () => {
    const module = await import('../../content/stages/s5/index.js');
    return {
      data: module.stage5,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
  s6: async () => {
    const module = await import('../../content/stages/s6/index.js');
    return {
      data: module.stage6,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
  s7: async () => {
    const module = await import('../../content/stages/s7/index.js');
    return {
      data: module.stage7,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
  appendix: async () => {
    const module = await import('../../content/stages/appendix/index.js');
    return {
      data: module.stageAppendix,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
};

const STAGE_IDS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 'appendix'];

const stageCache = new Map<string, Promise<Stage | null>>();

export function loadStage(id: string): Promise<Stage | null> {
  let task = stageCache.get(id);
  if (!task) {
    const loader = STAGE_LOADERS[id];
    task = loader ? importStage(id, loader) : Promise.resolve(null);
    stageCache.set(id, task);
  }
  return task;
}

async function importStage(id: string, loader: () => Promise<StageInput>): Promise<Stage | null> {
  const input = await loader();
  return assembleStage(input, id);
}

let catalogPromise: Promise<Catalog> | null = null;

export function loadCatalog(): Promise<Catalog> {
  if (!catalogPromise) {
    catalogPromise = import('../../../generated/catalog.json').then(
      (module) => module.default as unknown as Catalog,
    );
  }
  return catalogPromise;
}

let graduationPromise: Promise<Project> | null = null;

export function loadGraduation(): Promise<Project> {
  if (!graduationPromise) {
    graduationPromise = import('../../content/graduation.js').then((module) => (
      assembleProject(module.graduationProject)
    ));
  }
  return graduationPromise;
}

let allStagesPromise: Promise<Stage[]> | null = null;

export function loadAllStages(): Promise<Stage[]> {
  if (!allStagesPromise) {
    allStagesPromise = Promise.all(STAGE_IDS.map((id) => loadStage(id))).then((stages) => (
      stages.filter((stage): stage is Stage => Boolean(stage))
    ));
  }
  return allStagesPromise;
}

const lessonCache = new Map<string, Promise<LessonContext | null>>();

export function loadLessonContext(lessonId: string): Promise<LessonContext | null> {
  let task = lessonCache.get(lessonId);
  if (!task) {
    task = loadCatalog().then(async (catalog) => {
      const summary = catalog.lessons.find((lesson) => lesson.id === lessonId);
      if (!summary) return null;
      const stage = await loadStage(summary.stageId);
      if (!stage) return null;
      const index = stage.lessons.findIndex((lesson) => lesson.id === lessonId);
      if (index < 0) return null;
      return {
        lesson: stage.lessons[index]!,
        stage,
        prev: index > 0 ? stage.lessons[index - 1] ?? null : null,
        next: index < stage.lessons.length - 1 ? stage.lessons[index + 1] ?? null : null,
      };
    });
    lessonCache.set(lessonId, task);
  }
  return task;
}

const projectCache = new Map<string, Promise<Project | null>>();

export function loadProject(projectId: string): Promise<Project | null> {
  let task = projectCache.get(projectId);
  if (!task) {
    task = loadCatalog().then(async (catalog) => {
      if (!catalog.projects.some((project) => project.id === projectId)) return null;
      const owner = catalog.stages.find((stage) => stage.projectId === projectId);
      if (owner) {
        const stage = await loadStage(owner.id);
        return stage?.project ?? null;
      }
      const graduation = await loadGraduation();
      return graduation.id === projectId ? graduation : null;
    });
    projectCache.set(projectId, task);
  }
  return task;
}

let searchIndexPromise: Promise<SearchDocument[]> | null = null;

export function loadSearchIndex(): Promise<SearchDocument[]> {
  if (!searchIndexPromise) {
    searchIndexPromise = import('../../../generated/search-index.json').then(
      (module) => module.default as unknown as SearchDocument[],
    );
  }
  return searchIndexPromise;
}

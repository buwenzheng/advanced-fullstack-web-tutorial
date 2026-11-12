import { assembleProject, assembleStage } from '../../content/assemble';
import catalogData from '../../../generated/catalog.json';
import type { Catalog } from '../../content/catalog';
import type { Project, Stage, StageInput } from '../../content/types';
import type { SearchDocument } from '../shell/search-docs';
import type { LessonContext } from './types';

const STAGE_LOADERS: Record<string, () => Promise<StageInput>> = {
  m1: async () => {
    const module = await import('../../content/stages/m1/index.js');
    return {
      data: module.stageM1,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
  m2: async () => {
    const module = await import('../../content/stages/m2/index.js');
    return {
      data: module.stageM2,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
  m3: async () => {
    const module = await import('../../content/stages/m3/index.js');
    return {
      data: module.stageM3,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
  m4: async () => {
    const module = await import('../../content/stages/m4/index.js');
    return {
      data: module.stageM4,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
  e1: async () => {
    const module = await import('../../content/stages/e1/index.js');
    return {
      data: module.stageE1,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
  b: async () => {
    const module = await import('../../content/stages/b/index.js');
    return {
      data: module.stageB,
      pythonBlocks: module.PYTHON_BLOCKS ?? {},
      pythonTracks: module.PYTHON_TRACKS ?? {},
    };
  },
};

const STAGE_IDS = ['m1', 'm2', 'm3', 'm4', 'e1', 'b'];

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
    catalogPromise = Promise.resolve(catalogData as unknown as Catalog);
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
      const stages = await loadAllStages();
      for (const stage of stages) {
        const projects = stage.projects ?? (stage.project ? [stage.project] : []);
        const project = projects.find((candidate) => candidate.id === projectId);
        if (project) return project;
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

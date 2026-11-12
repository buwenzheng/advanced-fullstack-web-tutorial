import { describe, expect, it } from 'vitest';
import { buildCatalog, buildSearchIndex } from '../content/build.js';
import {
  curriculum,
  findProject,
  graduationProject,
  lessonById,
  stageById,
  stageLabel,
} from '../content/index.js';
import { lessonHaystack } from '../content/search.js';

describe('content catalog', () => {
  const catalog = buildCatalog();

  it('覆盖全部阶段、课时、项目与题目且 ID 唯一', () => {
    expect(catalog.version).toBe(1);
    expect(catalog.stages).toHaveLength(6);
    expect(catalog.lessons).toHaveLength(45);
    expect(catalog.projects).toHaveLength(8);
    expect(catalog.tasks).toHaveLength(214);
    expect(new Set(catalog.stages.map((stage) => stage.id)).size).toBe(catalog.stages.length);
    expect(new Set(catalog.lessons.map((lesson) => lesson.id)).size).toBe(catalog.lessons.length);
    expect(new Set(catalog.projects.map((project) => project.id)).size).toBe(catalog.projects.length);
    expect(new Set(catalog.tasks.map((task) => task.id)).size).toBe(catalog.tasks.length);
  });

  it('阶段与课时字段逐项来自课程内容', () => {
    for (const stage of curriculum) {
      expect(catalog.stages.find((item) => item.id === stage.id)).toEqual({
        id: stage.id,
        index: stage.index,
        title: stage.title,
        subtitle: stage.subtitle,
        duration: stage.duration,
        appendix: Boolean(stage.appendix),
        kind: stage.kind,
        chapterCount: stage.chapters?.length ?? 0,
        chapters: stage.chapters ?? [],
        lessonCount: stage.lessons.length,
        projectId: stage.project ? stage.project.id : null,
        projectIds: (stage.projects ?? (stage.project ? [stage.project] : [])).map((project) => project.id),
        accent: stage.accent,
      });
      for (const lesson of stage.lessons) {
        expect(catalog.lessons.find((item) => item.id === lesson.id)).toEqual({
          id: lesson.id,
          stageId: stage.id,
          title: lesson.title,
          subtitle: lesson.subtitle,
          duration: lesson.duration,
          status: lesson.status,
          keywords: lesson.keywords,
          checks: lesson.checks.length,
          exercises: lesson.exercises.length,
        });
      }
    }

    const toolbox = catalog.stages.find((stage) => stage.kind === 'toolbox')!;
    expect(toolbox.id).toBe('b');
    expect(toolbox.projectId).toBeNull();
    expect(catalog.stages.filter((stage) => stage.kind !== 'toolbox')).toHaveLength(5);
  });

  it('检查题与练习映射为目录任务并保留 Python 标记', () => {
    const tasks = new Map(catalog.tasks.map((task) => [task.id, task]));
    for (const stage of curriculum) {
      for (const lesson of stage.lessons) {
        for (const check of lesson.checks) {
          expect(tasks.get(check.id)).toEqual({
            id: check.id,
            kind: 'mcq',
            title: check.prompt,
            lessonId: lesson.id,
            stageId: stage.id,
            python: false,
          });
        }
        for (const exercise of lesson.exercises) {
          expect(tasks.get(exercise.id)).toMatchObject({
            id: exercise.id,
            kind: exercise.kind,
            title: exercise.title,
            lessonId: lesson.id,
            stageId: stage.id,
            python: exercise.kind === 'code' && Boolean(exercise.python),
          });
        }
      }
    }

    expect(new Set(catalog.tasks.map((task) => task.kind))).toEqual(
      new Set(['mcq', 'code', 'sql', 'design']),
    );
    expect(catalog.tasks.some((task) => task.python)).toBe(true);
    expect(catalog.tasks.filter((task) => task.kind === 'code').every((task) => task.python)).toBe(true);
    expect(catalog.tasks.filter((task) => task.kind === 'mcq')).toHaveLength(135);
    expect(catalog.tasks.filter((task) => task.kind !== 'mcq')).toHaveLength(79);
  });

  it('项目目录包含七个块项目与毕业项目', () => {
    expect(catalog.projects.find((project) => project.id === graduationProject.id)).toEqual({
      id: graduationProject.id,
      stageLabel: graduationProject.stageLabel,
      title: graduationProject.title,
      milestones: graduationProject.milestones.length,
    });
    for (const stage of curriculum) {
      for (const project of stage.projects ?? (stage.project ? [stage.project] : [])) {
        expect(catalog.projects.find((item) => item.id === project.id)).toEqual({
          id: project.id,
          stageLabel: project.stageLabel,
          title: project.title,
          milestones: project.milestones.length,
        });
      }
    }
    expect(catalog.projects.filter((project) => project.stageLabel === '毕业项目')).toHaveLength(1);
  });
});

describe('search index build', () => {
  const docs = buildSearchIndex();

  it('生成 6 块、45 课时与 8 项目的 59 条文档', () => {
    expect(docs).toHaveLength(59);
    expect(
      docs.reduce<Record<string, number>>((counts, doc) => {
        counts[doc.kind] = (counts[doc.kind] ?? 0) + 1;
        return counts;
      }, {}),
    ).toEqual({ stage: 6, lesson: 45, project: 8 });
    expect(new Set(docs.map((doc) => doc.id)).size).toBe(docs.length);
    for (const doc of docs) {
      expect(doc.href).toBe(`#/${doc.kind}/${doc.id}`);
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.sub.length).toBeGreaterThan(0);
      expect(doc.text.length).toBeGreaterThan(0);
    }
  });

  it('阶段文档带标签、关键词与附录前缀', () => {
    const firstStage = curriculum[0]!;
    expect(docs.find((doc) => doc.kind === 'stage' && doc.id === firstStage.id)).toEqual({
      kind: 'stage',
      id: firstStage.id,
      href: `#/stage/${firstStage.id}`,
      title: firstStage.title,
      sub: `${stageLabel(firstStage)} · ${firstStage.subtitle}`,
      text: [firstStage.title, ...(firstStage.keywords || [])].join(' '),
    });
    const appendix = curriculum.find((stage) => stage.appendix)!;
    expect(docs.find((doc) => doc.id === appendix.id)!.sub.startsWith('附录 · ')).toBe(true);
  });

  it('课时文档复用检索串、项目文档包含简介与毕业项目技术栈', () => {
    const stage = curriculum[0]!;
    const lesson = stage.lessons[0]!;
    const lessonDoc = docs.find((doc) => doc.kind === 'lesson' && doc.id === lesson.id)!;
    expect(lessonDoc.href).toBe(`#/lesson/${lesson.id}`);
    expect(lessonDoc.sub).toBe(`${stageLabel(stage)} · ${lesson.subtitle || ''}`);
    expect(lessonDoc.text).toBe(lessonHaystack(lesson));

    const stageProject = curriculum.find((item) => item.project)!.project!;
    expect(docs.find((doc) => doc.id === stageProject.id)).toMatchObject({
      kind: 'project',
      href: `#/project/${stageProject.id}`,
      sub: '阶段项目',
      text: `${stageProject.title} ${stageProject.brief}`,
    });
    const graduationDoc = docs.find((doc) => doc.id === graduationProject.id)!;
    expect(graduationDoc.sub).toBe('毕业项目');
    expect(graduationDoc.text).toBe(
      `${graduationProject.title} ${graduationProject.brief} ${(graduationProject.stack || []).join(' ')}`,
    );
  });
});

describe('content 查找与标签', () => {
  it('stageLabel 区分附录、普通阶段与空值', () => {
    expect(stageLabel(null)).toBe('');
    expect(stageLabel(curriculum[0]!)).toBe('阶段 0');
    expect(stageLabel(curriculum.find((stage) => stage.appendix)!)).toBe('附录');
  });

  it('lessonById、stageById 与 findProject 命中并处理未命中', () => {
    const stage = curriculum[0]!;
    const lesson = stage.lessons[0]!;
    expect(lessonById(lesson.id)).toBe(lesson);
    expect(lessonById('missing-lesson')).toBeNull();
    expect(stageById(stage.id)).toBe(stage);
    expect(stageById('missing-stage')).toBeNull();
    expect(findProject(graduationProject.id)).toBe(graduationProject);
    const projectStage = curriculum.find((item) => item.project)!;
    expect(findProject(projectStage.project!.id)).toBe(projectStage.project);
    expect(findProject('missing-project')).toBeNull();
  });
});
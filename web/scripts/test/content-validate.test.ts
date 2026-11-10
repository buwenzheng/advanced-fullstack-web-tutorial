import { describe, expect, it } from 'vitest';
import manifest from '../../../docs/content-manifest.json';
import { graduationProject } from '../content/graduation.js';
import { stageInputs } from '../content/sources.js';
import { validateContent } from '../content/validate.js';
import type { StageInput } from '../content/types.js';

function readManifest(): unknown {
  return structuredClone(manifest) as unknown;
}

function cloneInputs(): StageInput[] {
  return stageInputs.map((input) => structuredClone(input));
}

function issuesOf(inputs: StageInput[], manifest: unknown = readManifest()) {
  return validateContent(inputs, graduationProject, manifest);
}

describe('content validate', () => {
  it('当前内容满足全部语义不变量', () => {
    const { stats, issues } = issuesOf(cloneInputs());
    expect(issues).toEqual([]);
    expect(stats).toMatchObject({
      stages: 9,
      lessons: 45,
      projects: 9,
      checks: 135,
      exercises: 79,
      tasks: 214,
      pythonLessons: 34,
      pythonBlocks: 60,
      pythonTracks: 38,
      milestones: 54,
      templates: 6,
      duration: 3400,
    });
  });

  it('总时长或清单不一致会报错', () => {
    const inputs = cloneInputs();
    inputs[0]!.data.lessons[0]!.duration += 5;
    const { issues } = issuesOf(inputs);
    expect(issues.some((issue) => issue.message.includes('总时长应为 3400'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('时长'))).toBe(true);
  });

  it('清单结构无效被拒绝', () => {
    const { issues } = issuesOf(cloneInputs(), null);
    expect(issues).toContainEqual({ path: 'manifest', message: '清单结构无效' });
  });

  it('阶段顺序与附录规则被校验', () => {
    const swapped = cloneInputs();
    const [first, second] = [swapped[0]!, swapped[1]!];
    swapped[0] = second;
    swapped[1] = first;
    expect(issuesOf(swapped).issues.some((issue) => issue.message.includes('阶段顺序应为 s0'))).toBe(true);

    const appendix = cloneInputs();
    const last = appendix[appendix.length - 1]!;
    last.data.project = structuredClone(appendix[0]!.data.project);
    expect(issuesOf(appendix).issues.some((issue) => issue.message === '附录阶段项目应为 null')).toBe(true);
  });

  it('重复课时 ID 被校验', () => {
    const inputs = cloneInputs();
    inputs[0]!.data.lessons[1]!.id = inputs[0]!.data.lessons[0]!.id;
    expect(issuesOf(inputs).issues.some((issue) => issue.message === '课时 ID 重复')).toBe(true);
  });

  it('检查题题型约束被校验', () => {
    const inputs = cloneInputs();
    const check = inputs
      .flatMap((input) => input.data.lessons)
      .flatMap((lesson) => lesson.checks)
      .find((item) => item.type === 'multi');
    expect(check).toBeTruthy();
    check!.options.forEach((option, index) => {
      option.correct = index === 0;
    });
    expect(issuesOf(inputs).issues.some((issue) => issue.message.includes('多选题应有 3-5 个正确'))).toBe(true);

    const promptInputs = cloneInputs();
    promptInputs[0]!.data.lessons[0]!.checks[0]!.question = '被改写的题干';
    expect(issuesOf(promptInputs).issues.some((issue) => issue.message === 'prompt 与 question 必须一致')).toBe(true);
  });

  it('design 练习 brief/prompt 必须二选一', () => {
    const inputs = cloneInputs();
    const design = inputs
      .flatMap((input) => input.data.lessons)
      .flatMap((lesson) => lesson.exercises)
      .find((exercise) => exercise.kind === 'design');
    expect(design).toBeTruthy();
    if (design && design.kind === 'design') {
      design.brief = '双字段';
      design.prompt = '双字段';
    }
    expect(
      issuesOf(inputs).issues.some((issue) => issue.message === 'design 必须且只能有 brief/prompt 之一'),
    ).toBe(true);
  });

  it('区块结构约束被校验', () => {
    const inputs = cloneInputs();
    const table = inputs
      .flatMap((input) => input.data.lessons)
      .flatMap((lesson) => lesson.blocks)
      .find((block) => block.type === 'table');
    expect(table).toBeTruthy();
    if (table && table.type === 'table') table.rows[0]!.push('多余列');
    expect(issuesOf(inputs).issues.some((issue) => issue.message.includes('不一致'))).toBe(true);

    const unknown = cloneInputs();
    (unknown[0]!.data.lessons[0]!.blocks[0] as { type: string }).type = 'unknown';
    expect(issuesOf(unknown).issues.some((issue) => issue.message.includes('未知区块类型'))).toBe(true);
  });

  it('Python 映射数量与轨道缺失被校验', () => {
    const mismatch = cloneInputs();
    const inputWithBlocks = mismatch.find((input) => Object.keys(input.pythonBlocks).length > 0)!;
    const lessonId = Object.keys(inputWithBlocks.pythonBlocks)[0]!;
    inputWithBlocks.pythonBlocks[lessonId] = [];
    const { issues } = issuesOf(mismatch);
    expect(issues.some((issue) => issue.path === `python.${lessonId}`)).toBe(true);
    expect(issues.some((issue) => issue.message.includes('组装')) || issues.some((issue) => issue.message.includes('Python 映射'))).toBe(true);

    const missingTrack = cloneInputs();
    const trackInput = missingTrack.find((input) => Object.keys(input.pythonTracks).length > 0)!;
    delete trackInput.pythonTracks[Object.keys(trackInput.pythonTracks)[0]!];
    const missingIssues = issuesOf(missingTrack).issues;
    expect(missingIssues.some((issue) => issue.message === '代码练习缺少 Python 轨道')).toBe(true);
    expect(missingIssues.some((issue) => issue.message.includes('缺少 Python 轨道'))).toBe(true);
  });

  it('项目模板、里程碑字段与 reuse 引用被校验', () => {
    const inputs = cloneInputs();
    const stageWithProject = inputs.find((input) => input.data.project)!;
    stageWithProject.data.project!.milestones[0]!.delivery = '不允许';
    stageWithProject.data.project!.templates = [
      { id: 't', title: 't', purpose: 'p', when: 'w', body: 'b' },
    ];
    expect(issuesOf(inputs).issues.some((issue) => issue.message.includes('阶段项目里程碑不应包含'))).toBe(true);
    expect(issuesOf(inputs).issues.some((issue) => issue.message === '只有毕业项目可以包含 templates')).toBe(true);

    const reuse = cloneInputs();
    reuse[0]!.data.project!.milestones[0]!.reuse = ['missing-project'];
    expect(
      issuesOf(reuse).issues.some((issue) => issue.message.includes('reuse 指向不存在的项目')),
    ).toBe(true);
  });
});

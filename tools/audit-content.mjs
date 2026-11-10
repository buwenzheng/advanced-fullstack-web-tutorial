import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, content, manifest, EXPECTED, LESSON_ID_RE, walkStrings, stripHtml } from './lib/content.mjs';
import { runSourceSuite } from './lib/js-runner.mjs';
import { createDatabase, runQuery, rowsEqual } from '../web/scripts/engine/sql.js';

const allowDrafts = process.argv.includes('--drafts');
const errors = [];
const warnings = [];

const ALLOWED_BLOCKS = new Set([
  'text', 'analogy', 'code', 'table', 'pitfall', 'tip', 'note', 'compare', 'list', 'flow', 'steps', 'case',
]);
const CASE_FIELDS = ['title', 'context', 'symptom', 'cause', 'fix', 'prevention'];
const BAD_CONTENT = [/<script\b/i, /<img[^>]+src=["']https?:/i, /!\[[^\]]*\]\((?:https?:)?\/\//i, /\bTODO\b/i, /待补充|占位|lorem ipsum/i];
// 浏览器 worker（web/scripts/engine/runner.js）只实现这些断言方法，CLI 不得放宽。
const BROWSER_ASSERT_METHODS = new Set(['equal', 'deepEqual', 'deepStrictEqual', 'strictEqual', 'throws', 'rejects', 'ok']);

function error(message) { errors.push(message); }
function warn(message) { warnings.push(message); }
function isReady(lesson) { return lesson.status === 'ready'; }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }

function sumMinutes(lessons) {
  return lessons.reduce((total, lesson) => total + (lesson.duration || 0), 0);
}

/* 1. 阶段 */
const stageIds = new Set();
content.curriculum.forEach((stage, position) => {
  if (stageIds.has(stage.id)) error(`阶段 ID 重复：${stage.id}`);
  stageIds.add(stage.id);

  if (stage.appendix) {
    if (position !== content.curriculum.length - 1) error(`附录阶段必须位于最后：${stage.id}`);
    if (stage.index !== 8) error(`附录阶段 index 应为 8，实际 ${stage.index}`);
  } else if (stage.index !== position) {
    error(`阶段 ${stage.id} index=${stage.index}，期望 ${position}`);
  }

  const minutes = sumMinutes(stage.lessons);
  if (stage.duration !== minutes) error(`阶段 ${stage.id} duration=${stage.duration}，课时合计 ${minutes}`);
});

/* 2. 课时与文件 */
const lessonIds = new Set();
const taskIds = new Set();
const codeExercises = [];

for (const stage of content.curriculum) {
  let designCount = 0;

  for (const lesson of stage.lessons) {
    const where = lesson.id;
    if (lessonIds.has(lesson.id)) error(`课时 ID 重复：${lesson.id}`);
    lessonIds.add(lesson.id);

    if (!LESSON_ID_RE.test(lesson.id)) error(`${where}: ID 不符合命名规则`);
    if (lesson.stageId !== stage.id) error(`${where}: stageId=${lesson.stageId} != ${stage.id}`);

    const lessonFile = path.join(ROOT, `web/scripts/content/stages/${stage.id}/${lesson.id}.js`);
    if (!fs.existsSync(lessonFile)) error(`${where}: 缺少文件 ${path.relative(ROOT, lessonFile)}`);

    if (lesson.status !== 'draft' && lesson.status !== 'ready') error(`${where}: 非法 status=${lesson.status}`);
    if (!allowDrafts && !isReady(lesson)) error(`${where}: 仍为 draft（正式审计不允许）`);

    if (!Array.isArray(lesson.objectives) || lesson.objectives.length < (isReady(lesson) ? 3 : 1)) {
      error(`${where}: objectives 不足`);
    }
    if (isReady(lesson)) {
      if (lesson.objectives.length > 4) error(`${where}: objectives=${lesson.objectives.length}，最多 4 条`);
      if (lesson.blocks.length < 8 || lesson.blocks.length > 14) error(`${where}: blocks=${lesson.blocks.length}，应为 8-14`);
      if (lesson.checks.length !== 3) error(`${where}: checks=${lesson.checks.length}，应为 3`);
      if (lesson.exercises.length < 1) error(`${where}: 缺少可验证练习`);
    }

    /* 4. 内容块 */
    const blockTypes = new Set();
    let deepText = 0;
    lesson.blocks.forEach((block, index) => {
      const blockWhere = `${where}.blocks[${index}]`;
      if (!ALLOWED_BLOCKS.has(block.type)) { error(`${blockWhere}: 未知块类型 ${block.type}`); return; }
      blockTypes.add(block.type);

      const required = {
        text: ['html'], analogy: ['html'], pitfall: ['html'], tip: ['html'], note: ['html'],
        list: ['items'], steps: ['steps'], code: ['code'], table: ['head', 'rows'],
        compare: ['cols'], flow: ['steps'], case: CASE_FIELDS,
      }[block.type] || [];
      for (const field of required) {
        const value = block[field];
        const ok = Array.isArray(value) ? value.length > 0 : nonEmpty(value);
        if (!ok) error(`${blockWhere}: ${block.type} 缺少 ${field}`);
      }

      if (block.type === 'case' && block.metric !== undefined && block.metric !== '' && !nonEmpty(block.metric)) {
        error(`${blockWhere}: case.metric 必须是非空字符串或省略`);
      }
      if (block.type === 'text' && stripHtml(block.html).length >= 200) deepText += 1;

      if (isReady(lesson) && block.type !== 'code') {
        const text = JSON.stringify(block);
        for (const pattern of BAD_CONTENT) {
          if (pattern.test(text)) error(`${blockWhere}: 含禁用内容 ${pattern}`);
        }
      }
    });

    if (isReady(lesson)) {
      if (!blockTypes.has('analogy')) error(`${where}: 缺少 analogy 块`);
      if (!blockTypes.has('code')) error(`${where}: 缺少 code 块`);
      if (!blockTypes.has('pitfall') && !blockTypes.has('tip')) error(`${where}: 缺少 pitfall/tip 块`);
      if (!['table', 'compare', 'flow', 'steps'].some((type) => blockTypes.has(type))) {
        error(`${where}: 缺少 table/compare/flow/steps 块`);
      }
      if (!deepText) error(`${where}: 缺少深挖 text（≥200 字）`);
    }

    /* 5. 检查题 */
    lesson.checks.forEach((check, index) => {
      const checkWhere = `${where}.checks[${index}]`;
      if (taskIds.has(check.id)) error(`题目 ID 重复：${check.id}`);
      taskIds.add(check.id);
      if (check.kind !== 'mcq') { error(`${checkWhere}: kind 必须为 mcq`); return; }
      if (!nonEmpty(check.prompt)) error(`${checkWhere}: prompt 为空`);
      if (!nonEmpty(check.explain)) error(`${checkWhere}: explain 为空`);
      if (!Array.isArray(check.options) || check.options.length < 2) { error(`${checkWhere}: options 不足`); return; }
      const correct = check.options.filter((option) => option.correct).length;
      if (check.type === 'multi') {
        if (correct < 2) error(`${checkWhere}: 多选题 correct=${correct}，至少 2 个`);
      } else if (correct !== 1) {
        error(`${checkWhere}: 单选题 correct=${correct}，必须恰好 1 个`);
      }
      check.options.forEach((option, optionIndex) => {
        if (!nonEmpty(option.text)) error(`${checkWhere}.options[${optionIndex}]: text 为空`);
      });
    });

    /* 6-8. 练习 */
    for (let index = 0; index < lesson.exercises.length; index += 1) {
      const task = lesson.exercises[index];
      const taskWhere = `${where}.exercises[${index}]`;
      if (taskIds.has(task.id)) error(`题目 ID 重复：${task.id}`);
      taskIds.add(task.id);

      if (task.kind === 'code') {
        codeExercises.push({ task, lesson });
        const tests = Array.isArray(task.tests) ? task.tests : [];
        if (!nonEmpty(task.starter)) error(`${taskWhere}: starter 为空`);
        if (!nonEmpty(task.solution)) error(`${taskWhere}: solution 为空`);
        if (tests.length < 4) error(`${taskWhere}: tests=${tests.length}，至少 4 条`);
        tests.forEach((test, testIndex) => {
          if (!nonEmpty(test.name)) error(`${taskWhere}.tests[${testIndex}]: name 为空`);
          if (!nonEmpty(test.code)) error(`${taskWhere}.tests[${testIndex}]: code 为空`);
          for (const match of String(test.code || '').matchAll(/\bassert\.([A-Za-z_$][\w$]*)/g)) {
            if (!BROWSER_ASSERT_METHODS.has(match[1])) {
              error(`${taskWhere}.tests[${testIndex}]: assert.${match[1]} 不在浏览器断言子集内`);
            }
          }
        });
        if (isReady(lesson) && tests.length >= 4) {
          const solutionResults = await runSourceSuite({ source: task.solution, tests });
          if (solutionResults.some((result) => !result.ok)) error(`${taskWhere}: solution 未全部通过`);
          const starterResults = await runSourceSuite({ source: task.starter, tests });
          if (!starterResults.some((result) => !result.ok)) error(`${taskWhere}: starter 未失败，缺少区分度`);
        }
        if (!task.python) {
          error(`${taskWhere}: 缺少 Python track`);
        } else {
          if (!nonEmpty(task.python.starter)) error(`${taskWhere}: Python starter 为空`);
          if (!nonEmpty(task.python.solution)) error(`${taskWhere}: Python solution 为空`);
          const pythonTests = Array.isArray(task.python.tests) ? task.python.tests : [];
          if (pythonTests.length !== tests.length) {
            error(`${taskWhere}: Python tests=${pythonTests.length} 与 Node tests=${tests.length} 不一致`);
          }
        }
      } else if (task.kind === 'sql') {
        if (task.tables === undefined) error(`${taskWhere}: 缺少 tables`);
        if (!Array.isArray(task.expected)) error(`${taskWhere}: 缺少 expected`);
        if (!nonEmpty(task.solution)) error(`${taskWhere}: solution 为空`);
        if (isReady(lesson) && task.tables !== undefined && Array.isArray(task.expected) && nonEmpty(task.solution)) {
          try {
            const db = createDatabase(task.tables);
            const outcome = runQuery(db, task.solution);
            if (outcome.kind !== 'select') error(`${taskWhere}: solution 不是 SELECT`);
            else if (!rowsEqual(outcome.rows, task.expected, outcome.columns)) error(`${taskWhere}: solution 结果与 expected 不一致`);
          } catch (caught) {
            error(`${taskWhere}: SQL 执行失败 ${(caught && caught.message) || caught}`);
          }
        }
      } else if (task.kind === 'design') {
        designCount += 1;
        if (!nonEmpty(task.prompt) && !nonEmpty(task.brief)) error(`${taskWhere}: prompt/brief 为空`);
        if (!Array.isArray(task.checklist) || task.checklist.length < 6) error(`${taskWhere}: checklist 至少 6 条`);
        if (!nonEmpty(task.reference)) error(`${taskWhere}: reference 为空`);
      } else {
        error(`${taskWhere}: 未知练习类型 ${task.kind}`);
      }
    }
  }

  if (stage.lessons.length && stage.lessons.every(isReady) && designCount < 1) {
    error(`阶段 ${stage.id}: 至少需要 1 道 design 练习`);
  }
}

/* 9. 项目 */
for (const stage of content.curriculum) {
  if (!stage.project) {
    if (!stage.appendix) error(`阶段 ${stage.id}: 缺少项目`);
    continue;
  }
  const project = stage.project;
  const where = `项目 ${project.id}`;
  if (!Array.isArray(project.steps) || project.steps.length < 5) error(`${where}: steps 至少 5 条`);
  if (!Array.isArray(project.milestones) || project.milestones.length < 4) error(`${where}: milestones 至少 4 个`);
  if (!Array.isArray(project.deliverables) || project.deliverables.length < 5) error(`${where}: deliverables 至少 5 条`);
  if (!Array.isArray(project.checklist) || project.checklist.length < 5) error(`${where}: checklist 至少 5 条`);
  (project.milestones || []).forEach((milestone, index) => {
    if (!nonEmpty(milestone.id)) error(`${where}.milestones[${index}]: id 为空`);
    if (!nonEmpty(milestone.criteria)) error(`${where}.milestones[${index}]: criteria 为空`);
  });
}

{
  const graduation = content.graduationProject;
  const where = `项目 ${graduation.id}`;
  if (!Array.isArray(graduation.milestones) || graduation.milestones.length !== 11) {
    error(`${where}: 应有 11 个里程碑`);
  }
  const expectedReuse = {
    m1: ['p2'],
    m2: ['p1', 'p2'],
    m3: ['p3', 'p5'],
    m4: ['p3', 'p4'],
    m5: ['p4'],
    m6: ['p4'],
    m7: ['p6'],
    m8: ['p6'],
    m9: ['p2', 'p6'],
    m10: ['p7'],
    m11: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
  };
  graduation.milestones.forEach((milestone, index) => {
    if (milestone.id !== `m${index + 1}`) error(`${where}.milestones[${index}]: id 应为 m${index + 1}`);
    if (!nonEmpty(milestone.criteria)) error(`${where}.milestones[${index}]: criteria 为空`);
    if (!nonEmpty(milestone.delivery)) error(`${where}.milestones[${index}]: delivery 为空`);
    if (!Array.isArray(milestone.acceptance) || milestone.acceptance.length < 2) {
      error(`${where}.milestones[${index}]: acceptance 至少 2 条可观察验收`);
    }
    if (!Array.isArray(milestone.evidence) || milestone.evidence.length < 2) {
      error(`${where}.milestones[${index}]: evidence 至少 2 条`);
    }
    if (!Array.isArray(milestone.related) || milestone.related.length < 1) {
      error(`${where}.milestones[${index}]: related 至少 1 条`);
    }
    const expected = expectedReuse[milestone.id];
    const actual = Array.isArray(milestone.reuse) ? [...milestone.reuse].sort() : [];
    if (expected && expected.join(',') !== actual.join(',')) {
      error(`${where}.milestones[${index}]: reuse 应为 ${expected.join('/')}，实际 ${actual.join('/') || '空'}`);
    }
    (milestone.acceptance || []).forEach((item, itemIndex) => {
      if (!nonEmpty(item)) error(`${where}.milestones[${index}].acceptance[${itemIndex}]: 为空`);
    });
  });
  if (!Array.isArray(graduation.steps) || graduation.steps.length < 5) error(`${where}: steps 至少 5 条`);
  if (!Array.isArray(graduation.deliverables) || graduation.deliverables.length < 5) error(`${where}: deliverables 至少 5 条`);
  if (!Array.isArray(graduation.checklist) || graduation.checklist.length < 5) error(`${where}: checklist 至少 5 条`);

  const requiredTemplates = {
    adr: ['备选', '后果', '反悔'],
    capacity: ['三场景', '冗余', '成本', '压测'],
    incident: ['时间线', '影响', '根因', '行动项'],
    'ai-eval': ['用例', '阈值', '失败样例', '成本'],
    'ai-collab': ['任务', '上下文', '执行', '验证', '系统', '回滚'],
    defense: ['维度', '硬门槛', '必问', '扣分'],
  };
  if (!Array.isArray(graduation.templates) || graduation.templates.length !== 6) {
    error(`${where}: 应有 6 份答辩模板`);
  }
  const templateIds = new Set();
  (graduation.templates || []).forEach((template, index) => {
    const templateWhere = `${where}.templates[${index}]`;
    if (!nonEmpty(template.id)) error(`${templateWhere}: id 为空`);
    if (templateIds.has(template.id)) error(`${templateWhere}: id 重复 ${template.id}`);
    templateIds.add(template.id);
    if (!nonEmpty(template.title)) error(`${templateWhere}: title 为空`);
    if (!nonEmpty(template.purpose)) error(`${templateWhere}: purpose 为空`);
    if (!nonEmpty(template.when)) error(`${templateWhere}: when 为空`);
    if (!nonEmpty(template.body) || template.body.trim().length < 200) error(`${templateWhere}: body 少于 200 字`);
    const required = requiredTemplates[template.id];
    if (!required) error(`${templateWhere}: 未知模板 id ${template.id}`);
    else required.forEach((keyword) => {
      if (!template.body.includes(keyword)) error(`${templateWhere}: 模板缺少「${keyword}」`);
    });
  });
}

/* 10. Python 映射 */
const pythonBlocks = content.PYTHON_BLOCKS || {};
const pythonTracks = content.PYTHON_TRACKS || {};
const lessonById = new Map(content.allLessons.map((lesson) => [lesson.id, lesson]));
const codeTaskIds = new Set(codeExercises.map(({ task }) => task.id));

for (const [lessonId, entries] of Object.entries(pythonBlocks)) {
  const lesson = lessonById.get(lessonId);
  if (!lesson) { error(`PYTHON_BLOCKS: 多余键 ${lessonId}`); continue; }
  if (!Array.isArray(entries)) { error(`PYTHON_BLOCKS.${lessonId}: 必须是数组`); continue; }
  const jsBlocks = lesson.blocks.filter((block) => block.type === 'code' && (block.lang || 'javascript') === 'javascript');
  if (entries.length > jsBlocks.length) error(`PYTHON_BLOCKS.${lessonId}: ${entries.length} 条映射超过 ${jsBlocks.length} 个 JS 代码块`);
  entries.forEach((entry, index) => {
    if (!entry || !nonEmpty(entry.code)) error(`PYTHON_BLOCKS.${lessonId}[${index}]: code 为空`);
  });
  if (entries.length === 0) warn(`PYTHON_BLOCKS.${lessonId}: 空数组，可直接删除该键`);
}

for (const [taskId, track] of Object.entries(pythonTracks)) {
  if (!codeTaskIds.has(taskId)) error(`PYTHON_TRACKS: 多余键 ${taskId}（无对应代码题）`);
  if (!track || !nonEmpty(track.starter) || !nonEmpty(track.solution) || !Array.isArray(track.tests)) {
    error(`PYTHON_TRACKS.${taskId}: starter/solution/tests 不完整`);
  }
}

/* 11. 清单与统计 */
const manifestStageIds = manifest.stages.map((stage) => stage.id);
const coreStageIds = content.curriculum.filter((stage) => !stage.appendix).map((stage) => stage.id);
if (manifestStageIds.join(',') !== coreStageIds.join(',')) error(`清单阶段顺序不一致：${manifestStageIds.join(',')} vs ${coreStageIds.join(',')}`);

for (const manifestStage of manifest.stages) {
  const stage = content.curriculum.find((entry) => entry.id === manifestStage.id);
  if (!stage) continue;
  if (manifestStage.duration !== sumMinutes(stage.lessons)) error(`清单 ${stage.id} 时长不一致`);
  const manifestLessonIds = manifestStage.lessons.map((lesson) => lesson.id);
  const actualIds = stage.lessons.map((lesson) => lesson.id);
  if (manifestLessonIds.join(',') !== actualIds.join(',')) error(`清单 ${stage.id} 课时顺序不一致`);
  for (const entry of manifestStage.lessons) {
    const lesson = stage.lessons.find((item) => item.id === entry.id);
    if (!lesson) error(`清单 ${stage.id} 含不存在的课时 ${entry.id}`);
    else if (lesson.duration !== entry.duration) error(`清单 ${entry.id} 时长不一致`);
  }
}

const appendix = content.curriculum.find((stage) => stage.appendix);
if (!appendix) error('缺少附录阶段');
else {
  const appendixIds = appendix.lessons.map((lesson) => lesson.id);
  if (manifest.appendix.lessons.join(',') !== appendixIds.join(',')) error('清单附录课时顺序不一致');
  if (manifest.appendix.duration !== sumMinutes(appendix.lessons)) error('清单附录时长不一致');
  if (appendix.project !== null) error('附录阶段不应有项目');
}

const coreLessons = content.curriculum.filter((stage) => !stage.appendix).flatMap((stage) => stage.lessons);
const coreMinutes = sumMinutes(coreLessons);
const appendixMinutes = appendix ? sumMinutes(appendix.lessons) : 0;
if (coreMinutes !== manifest.totals.coreMinutes) error(`清单 coreMinutes=${manifest.totals.coreMinutes}，实际 ${coreMinutes}`);
if (appendixMinutes !== manifest.totals.appendixMinutes) error(`清单 appendixMinutes=${manifest.totals.appendixMinutes}，实际 ${appendixMinutes}`);
if (content.allLessons.length !== manifest.totals.lessons) error(`清单 lessons=${manifest.totals.lessons}，实际 ${content.allLessons.length}`);
if (content.allLessons.length !== EXPECTED.lessons) error(`应有 ${EXPECTED.lessons} 讲，实际 ${content.allLessons.length}`);
if (coreLessons.length !== EXPECTED.core) error(`核心应有 ${EXPECTED.core} 讲，实际 ${coreLessons.length}`);
if (appendix.lessons.length !== EXPECTED.appendix) error(`附录应有 ${EXPECTED.appendix} 讲`);
if (coreMinutes !== EXPECTED.coreMinutes) error(`核心时长应为 ${EXPECTED.coreMinutes}，实际 ${coreMinutes}`);
if (appendixMinutes !== EXPECTED.appendixMinutes) error(`附录时长应为 ${EXPECTED.appendixMinutes}，实际 ${appendixMinutes}`);

/* 12-13. 重复与事实 */
for (const tool of ['check-duplication.mjs', 'check-facts.mjs']) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'tools', tool)], { encoding: 'utf8', cwd: ROOT });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.status !== 0) {
    error(`${tool} 未通过\n${output}`);
  } else if (output) {
    output.split('\n').filter((line) => line.startsWith('WARN')).forEach((line) => warn(`${tool}: ${line}`));
  }
}

const draftCount = content.allLessons.filter((lesson) => !isReady(lesson)).length;
for (const message of warnings) console.warn(`WARN ${message}`);
for (const message of errors) console.error(`ERROR ${message}`);
console.log(`audit mode=${allowDrafts ? 'drafts' : 'ready'} lessons=${content.allLessons.length} draft=${draftCount} errors=${errors.length} warnings=${warnings.length}`);
process.exit(errors.length ? 1 : 0);

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { eachExercise } from './lib/content.js';
import type { CodeExercise, Lesson } from '../web/scripts/content/types.js';

const MARKER = '<<<BFF_RESULTS>>>';
const TIMEOUT_MS = 5000;

interface PythonTest {
  name?: string;
  code: string;
}

interface PythonTrack {
  starter: string;
  solution: string;
  tests: PythonTest[];
}

type PythonTask = CodeExercise & { python: PythonTrack };

function indent(code: unknown, spaces = 4) {
  const pad = ' '.repeat(spaces);
  const lines = String(code || '').split('\n');
  const body = lines.map((line) => (line ? pad + line : '')).join('\n');
  return body.trim() ? body : `${pad}pass`;
}

function buildFile(source: string, tests: PythonTest[]) {
  const blocks = tests.map((test, index) => `
async def __t${index}():
${indent(test.code)}

run_test(${JSON.stringify(test.name || `test-${index}`)}, __t${index})
`).join('\n');

  return `# -*- coding: utf-8 -*-
import asyncio
import json
import traceback


def assert_eq(actual, expected):
    assert actual == expected, "assert_eq failed: expected %r, got %r" % (expected, actual)


RESULTS = []


def run_test(name, fn):
    try:
        asyncio.run(fn())
        RESULTS.append([name, True, ""])
    except Exception:
        RESULTS.append([name, False, traceback.format_exc(limit=3)])

${source || ''}
${blocks}
print(${JSON.stringify(MARKER)})
print(json.dumps(RESULTS, ensure_ascii=True))
`;
}

function runSuite(source: string, tests: PythonTest[]) {
  const file = path.join(os.tmpdir(), `bff-py-${process.pid}-${Math.random().toString(36).slice(2)}.py`);
  fs.writeFileSync(file, buildFile(source, tests), 'utf8');
  try {
    const result = spawnSync('python', [file], {
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    const stdout = result.stdout || '';
    const markerIndex = stdout.indexOf(MARKER);
    if (result.error || result.status !== 0 || markerIndex === -1) {
      const detail = (result.error && result.error.message) || result.stderr || stdout || 'python 执行失败';
      return tests.map((test) => ({ name: test.name, ok: false, error: String(detail).trim().slice(0, 800) }));
    }
    const payload = stdout.slice(markerIndex + MARKER.length).trim().split('\n')[0] ?? '';
    const raw = JSON.parse(payload) as Array<[string, boolean, string]>;
    return tests.map((test, index) => ({
      name: test.name,
      ok: Boolean(raw[index]?.[1]),
      error: raw[index]?.[2] || '',
    }));
  } finally {
    fs.rmSync(file, { force: true });
  }
}

const tasks: Array<{ task: PythonTask; lesson: Lesson }> = [];
eachExercise((task, lesson) => {
  if (task.kind === 'code' && task.python) tasks.push({ task: task as PythonTask, lesson });
});

let failing = 0;
let starterFailing = 0;
const errors: string[] = [];

for (const { task, lesson } of tasks) {
  const tests = Array.isArray(task.python.tests) ? task.python.tests : [];
  if (!tests.length) {
    errors.push(`${lesson.id}/${task.id}: Python track 缺少 tests`);
    failing += 1;
    continue;
  }

  const solutionResults = runSuite(task.python.solution, tests);  if (solutionResults.some((result) => !result.ok)) {
    failing += 1;
    const detail = solutionResults
      .map((result) => (result.ok ? null : `  - ${result.name}: ${result.error}`))
      .filter(Boolean)
      .join('\n');
    errors.push(`${lesson.id}/${task.id}: Python solution 未通过\n${detail}`);
  }

  const starterResults = runSuite(task.python.starter, tests);
  if (starterResults.some((result) => !result.ok)) starterFailing += 1;
  else errors.push(`${lesson.id}/${task.id}: Python starter 全部通过，练习没有区分度`);
}

if (errors.length) console.error(errors.join('\n'));
console.log(`python exercises=${tasks.length} failing=${failing} starterFailing=${starterFailing}`);
process.exit(failing || errors.length ? 1 : 0);

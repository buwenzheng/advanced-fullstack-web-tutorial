export interface PythonHarnessTest {
  name?: string;
  code?: string;
}

export function pythonHarness(tests: ReadonlyArray<PythonHarnessTest>): string {
  return tests.map((test, index) => {
    const fn = `__lab_test_${index}`;
    const name = JSON.stringify(test.name || `测试 ${index + 1}`);
    const body = String(test.code || '')
      .split('\n')
      .map((line) => (line ? `    ${line}` : ''))
      .join('\n');
    return `async def ${fn}():\n${body || '    pass'}\n__run(${name}, ${fn})`;
  }).join('\n\n');
}

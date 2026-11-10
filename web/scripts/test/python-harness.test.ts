import { describe, expect, it } from 'vitest';
import { pythonHarness } from '../engine/python/harness.js';

describe('python harness', () => {
  it('逐行缩进并在测试之间空一行', () => {
    const output = pythonHarness([
      { name: '加法', code: 'assert add(1, 2) == 3\nassert add(0, 0) == 0' },
      { name: '减法', code: 'assert sub(3, 1) == 2' },
    ]);
    expect(output).toBe(
      [
        'async def __lab_test_0():',
        '    assert add(1, 2) == 3',
        '    assert add(0, 0) == 0',
        '__run("加法", __lab_test_0)',
        '',
        'async def __lab_test_1():',
        '    assert sub(3, 1) == 2',
        '__run("减法", __lab_test_1)',
      ].join('\n'),
    );
  });

  it('空行保持空行，不补缩进', () => {
    const output = pythonHarness([{ name: '空行', code: 'x = 1\n\nassert x == 1' }]);
    expect(output).toBe(
      ['async def __lab_test_0():', '    x = 1', '', '    assert x == 1', '__run("空行", __lab_test_0)'].join('\n'),
    );
  });

  it('空代码补 pass，缺省名按序号生成', () => {
    expect(pythonHarness([{}])).toBe(
      ['async def __lab_test_0():', '    pass', '__run("测试 1", __lab_test_0)'].join('\n'),
    );
    expect(pythonHarness([{ name: '', code: '' }])).toContain('__run("测试 1", __lab_test_0)');
    expect(pythonHarness([{ name: '有名字' }, { code: 'pass' }])).toBe(
      [
        'async def __lab_test_0():',
        '    pass',
        '__run("有名字", __lab_test_0)',
        '',
        'async def __lab_test_1():',
        '    pass',
        '__run("测试 2", __lab_test_1)',
      ].join('\n'),
    );
  });

  it('测试名通过 JSON 转义并逐个注册 __run', () => {
    const output = pythonHarness([
      { name: '引号 "与" 反斜杠 \\', code: "assert 'ok'" },
      { name: '换行\n名字', code: 'pass' },
    ]);
    expect(output).toContain('__run("引号 \\"与\\" 反斜杠 \\\\", __lab_test_0)');
    expect(output).toContain('__run("换行\\n名字", __lab_test_1)');
    expect(output.match(/__run\(/g)).toHaveLength(2);
    expect(output.match(/async def /g)).toHaveLength(2);
  });

  it('空测试列表输出空字符串', () => {
    expect(pythonHarness([])).toBe('');
  });

  it('样例一逐字节快照', () => {
    const snapshot = [
      'async def __lab_test_0():',
      '    assert sum_range(1, 3) == 6',
      '    assert sum_range(5, 5) == 5',
      '__run("闭区间求和", __lab_test_0)',
      '',
      'async def __lab_test_1():',
      '    assert sum_range(4, 2) == 0',
      '__run("空区间返回 0", __lab_test_1)',
    ].join('\n');
    expect(
      pythonHarness([
        { name: '闭区间求和', code: 'assert sum_range(1, 3) == 6\nassert sum_range(5, 5) == 5' },
        { name: '空区间返回 0', code: 'assert sum_range(4, 2) == 0' },
      ]),
    ).toBe(snapshot);
  });

  it('样例二逐字节快照', () => {
    const snapshot = [
      'async def __lab_test_0():',
      '    data = {"a": 1}',
      '',
      '    assert data["a"] == 1',
      '__run("字典读写", __lab_test_0)',
      '',
      'async def __lab_test_1():',
      '    pass',
      '__run("测试 2", __lab_test_1)',
    ].join('\n');
    expect(
      pythonHarness([
        { name: '字典读写', code: 'data = {"a": 1}\n\nassert data["a"] == 1' },
        { code: '' },
      ]),
    ).toBe(snapshot);
  });
});

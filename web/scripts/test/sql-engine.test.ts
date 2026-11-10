import { describe, expect, it } from 'vitest';
import { createDatabase, rowsEqual, runQuery } from '../engine/sql/index.js';

const seed = () =>
  createDatabase({
    users: [
      { id: 1, name: 'Ada', city: 'Berlin' },
      { id: 2, name: 'Lin', city: 'Shanghai' },
      { id: 3, name: 'Kai', city: null },
    ],
    orders: [
      { id: 10, user_id: 1, amount: 30 },
      { id: 11, user_id: 1, amount: 20 },
      { id: 12, user_id: 2, amount: 50 },
    ],
  });

describe('sql engine', () => {
  it('SELECT / WHERE / 大小写与别名', () => {
    const db = seed();
    const outcome = runQuery(db, "select id, name as who from users where name = 'Ada'");
    expect(outcome.kind).toBe('select');
    expect(outcome.columns).toEqual(['id', 'who']);
    expect(outcome.rows).toEqual([{ id: 1, who: 'Ada' }]);
    expect(outcome.message).toBe('返回 1 行');
  });

  it('ORDER BY / LIMIT / OFFSET', () => {
    const db = seed();
    const outcome = runQuery(db, 'SELECT id FROM orders ORDER BY amount DESC LIMIT 1 OFFSET 1');
    expect(outcome.rows).toEqual([{ id: 10 }]);
    expect(runQuery(db, 'SELECT id FROM orders ORDER BY amount DESC LIMIT 2').rows).toEqual([
      { id: 12 },
      { id: 10 },
    ]);
    expect(runQuery(db, 'SELECT id FROM orders ORDER BY amount OFFSET 2').rows).toEqual([{ id: 12 }]);
  });

  it('聚合、GROUP BY、HAVING 与 DISTINCT', () => {
    const db = seed();
    const summary = runQuery(
      db,
      'SELECT COUNT(*) AS n, SUM(amount) AS total, AVG(amount) AS avg, MIN(amount) AS lo, MAX(amount) AS hi FROM orders',
    );
    expect(summary.rows).toHaveLength(1);
    const row = summary.rows[0]!;
    expect(row.n).toBe(3);
    expect(row.total).toBe(100);
    expect(row.avg).toBeCloseTo(100 / 3);
    expect(row.lo).toBe(20);
    expect(row.hi).toBe(50);

    const grouped = runQuery(
      db,
      'SELECT user_id, COUNT(*) AS n FROM orders GROUP BY user_id HAVING n >= 2 ORDER BY user_id',
    );
    expect(grouped.columns).toEqual(['user_id', 'n']);
    expect(grouped.rows).toEqual([{ user_id: 1, n: 2 }]);

    expect(runQuery(db, 'SELECT DISTINCT user_id FROM orders ORDER BY user_id').rows).toEqual([
      { user_id: 1 },
      { user_id: 2 },
    ]);
    expect(runQuery(db, 'SELECT COUNT(DISTINCT user_id) AS n FROM orders').rows).toEqual([{ n: 2 }]);
  });

  it('JOIN：LEFT JOIN 保留空行，COUNT(col) 计为 0', () => {
    const db = seed();
    const left = runQuery(
      db,
      'SELECT u.id AS user_id, COUNT(o.id) AS orders FROM users u LEFT JOIN orders o ON o.user_id = u.id GROUP BY u.id ORDER BY user_id',
    );
    expect(left.rows).toEqual([
      { user_id: 1, orders: 2 },
      { user_id: 2, orders: 1 },
      { user_id: 3, orders: 0 },
    ]);

    const inner = runQuery(
      db,
      'SELECT u.name AS name, o.id AS order_id FROM users u JOIN orders o ON o.user_id = u.id ORDER BY order_id',
    );
    expect(inner.rows.map((row) => row.order_id)).toEqual([10, 11, 12]);
  });

  it('SELECT * 在单表与 JOIN 下的列名', () => {
    const db = seed();
    const single = runQuery(db, 'SELECT * FROM users WHERE id = 1');
    expect(single.columns).toEqual(['id', 'name', 'city']);
    expect(single.rows).toEqual([{ id: 1, name: 'Ada', city: 'Berlin' }]);

    const joined = runQuery(db, 'SELECT * FROM users u JOIN orders o ON o.user_id = u.id WHERE o.id = 10');
    expect(joined.columns).toEqual(['u.id', 'u.name', 'u.city', 'o.id', 'o.user_id', 'o.amount']);
    expect(joined.rows).toHaveLength(1);
    expect(joined.rows[0]).toMatchObject({ 'u.name': 'Ada', 'o.amount': 30 });
  });

  it('NULL 三值逻辑：只能通过 IS [NOT] NULL 匹配', () => {
    const db = seed();
    expect(runQuery(db, 'SELECT id FROM users WHERE city IS NULL').rows).toEqual([{ id: 3 }]);
    expect(runQuery(db, 'SELECT id FROM users WHERE city IS NOT NULL ORDER BY id').rows).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    expect(runQuery(db, 'SELECT id FROM users WHERE NOT city IS NULL ORDER BY id').rows).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    expect(runQuery(db, 'SELECT id FROM users WHERE city = NULL').rows).toEqual([]);
    expect(
      runQuery(db, "SELECT id FROM users WHERE city IS NOT NULL AND (id = 1 OR id = 2) ORDER BY id").rows,
    ).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('CREATE / INSERT / UPDATE / DELETE / DROP', () => {
    const db = createDatabase({});
    expect(runQuery(db, 'CREATE TABLE notes (id INTEGER, body TEXT)').kind).toBe('create');
    expect(() => runQuery(db, 'CREATE TABLE notes (id INTEGER)')).toThrow('表 notes 已存在');

    const inserted = runQuery(db, "INSERT INTO notes (id, body) VALUES (1, 'hello'), (2, NULL)");
    expect(inserted).toMatchObject({ kind: 'insert', affected: 2 });
    expect(runQuery(db, "INSERT INTO notes VALUES (3, 'three')").affected).toBe(1);
    expect(runQuery(db, 'SELECT * FROM notes ORDER BY id').rows).toEqual([
      { id: 1, body: 'hello' },
      { id: 2, body: null },
      { id: 3, body: 'three' },
    ]);

    expect(runQuery(db, "UPDATE notes SET body = 'updated' WHERE id = 2")).toMatchObject({
      kind: 'update',
      affected: 1,
    });
    expect(runQuery(db, 'SELECT body FROM notes WHERE id = 2').rows).toEqual([{ body: 'updated' }]);

    expect(runQuery(db, 'DELETE FROM notes WHERE id = 3')).toMatchObject({ kind: 'delete', affected: 1 });
    expect(runQuery(db, 'SELECT COUNT(*) AS n FROM notes').rows).toEqual([{ n: 2 }]);

    expect(runQuery(db, 'DROP TABLE notes').kind).toBe('drop');
    expect(() => runQuery(db, 'SELECT * FROM notes')).toThrow('表 notes 不存在');
  });

  it('注释被跳过', () => {
    const db = seed();
    const outcome = runQuery(db, '-- 取第一行\n/* 块注释 */ SELECT id FROM users ORDER BY id LIMIT 1');
    expect(outcome.rows).toEqual([{ id: 1 }]);
  });

  it('错误路径给出可读信息', () => {
    const db = seed();
    expect(() => runQuery(db, '   ')).toThrow('请输入要执行的 SQL');
    expect(() => runQuery(db, 'ALTER TABLE users ADD COLUMN x')).toThrow('暂不支持的语句：ALTER');
    expect(() => runQuery(db, 'SELECT FROM users')).toThrow('语法错误：期望 ident，实际得到 FROM');
    expect(() => runQuery(db, 'SELECT * FROM users #')).toThrow('无法识别的字符 "#"');
    expect(() => runQuery(db, 'SELECT id FROM users; SELECT id FROM users')).toThrow(
      '无法解析的内容：; SELECT id FROM users（迷你引擎不支持该语法）',
    );
    expect(() => runQuery(db, 'SELECT MEDIAN(amount) FROM orders')).toThrow(
      '暂不支持的函数 MEDIAN（迷你引擎只支持 COUNT/SUM/MIN/MAX/AVG）',
    );
    expect(() => runQuery(db, 'INSERT INTO users (nope) VALUES (1)')).toThrow('未知列 nope');
    expect(() => runQuery(db, 'INSERT INTO users (id) VALUES (1, 2)')).toThrow(
      '列数不匹配：期望 1 个，实际 2 个',
    );
    expect(() => runQuery(db, 'UPDATE users SET nope = 1')).toThrow('未知列 nope');
  });

  it('同名列需要别名限定', () => {
    const db = createDatabase({
      a: [{ id: 1 }],
      b: [{ id: 1 }],
    });
    expect(() => runQuery(db, 'SELECT id FROM a JOIN b ON a.id = b.id')).toThrow(
      '列 id 有歧义，请使用表别名限定',
    );
    const outcome = runQuery(db, 'SELECT a.id AS aid, b.id AS bid FROM a JOIN b ON a.id = b.id');
    expect(outcome.rows).toEqual([{ aid: 1, bid: 1 }]);
  });

  it('rowsEqual 对齐列名并忽略多余实际列', () => {
    const db = seed();
    const outcome = runQuery(db, 'SELECT id, name FROM users WHERE id = 1');
    expect(rowsEqual(outcome.rows, [{ ID: 1, Name: 'Ada' }], outcome.columns)).toBe(true);
    expect(rowsEqual(outcome.rows, [{ id: 1 }], outcome.columns)).toBe(true);
    expect(rowsEqual(outcome.rows, [{ id: 1, missing: 'x' }], outcome.columns)).toBe(false);
    expect(rowsEqual(outcome.rows, [{ id: 2, name: 'Ada' }], outcome.columns)).toBe(false);
  });

  it('课程 SQL 练习 s1-l1-ex-1：左连接与计数', () => {
    const task = {
      tables: {
        users: [
          { id: 1, name: 'Ada' },
          { id: 2, name: 'Lin' },
          { id: 3, name: 'Kai' },
          { id: 4, name: 'Mo' },
        ],
        links: [
          { id: 10, user_id: 1, slug: 'ada-docs', created_at: '2026-10-01T09:00:00Z' },
          { id: 11, user_id: 1, slug: 'ada-notes', created_at: '2026-10-15T09:00:00Z' },
          { id: 12, user_id: 2, slug: 'lin-api', created_at: '2026-10-20T09:00:00Z' },
          { id: 13, user_id: 3, slug: 'kai-empty', created_at: '2026-10-25T09:00:00Z' },
          { id: 14, user_id: 4, slug: 'mo-old', created_at: '2026-10-28T09:00:00Z' },
        ],
        click_events: [
          { id: 100, link_id: 10, clicked_at: '2026-11-02T00:00:00Z' },
          { id: 101, link_id: 10, clicked_at: '2026-11-05T10:00:00Z' },
          { id: 102, link_id: 10, clicked_at: '2026-11-09T00:00:00Z' },
          { id: 103, link_id: 11, clicked_at: '2026-11-03T12:00:00Z' },
          { id: 104, link_id: 12, clicked_at: '2026-11-04T08:00:00Z' },
          { id: 105, link_id: 12, clicked_at: '2026-11-06T23:59:59Z' },
          { id: 106, link_id: 14, clicked_at: '2026-10-20T10:00:00Z' },
          { id: 107, link_id: 14, clicked_at: '2026-11-10T10:00:00Z' },
          { id: 108, link_id: 10, clicked_at: null },
        ],
      },
      expected: [
        { user_id: 1, link_id: 10, clicks: 2 },
        { user_id: 1, link_id: 11, clicks: 1 },
        { user_id: 2, link_id: 12, clicks: 2 },
        { user_id: 3, link_id: 13, clicks: 0 },
        { user_id: 4, link_id: 14, clicks: 0 },
      ],
      solution: [
        'SELECT u.id AS user_id, l.id AS link_id, COUNT(c.id) AS clicks',
        'FROM users u',
        'LEFT JOIN links l ON l.user_id = u.id',
        'LEFT JOIN click_events c',
        '  ON c.link_id = l.id',
        " AND c.clicked_at >= '2026-11-02T00:00:00Z'",
        " AND c.clicked_at < '2026-11-09T00:00:00Z'",
        'GROUP BY u.id, l.id',
        'ORDER BY user_id ASC, clicks DESC, link_id ASC;',
      ].join('\n'),
    };
    const db = createDatabase(task.tables);
    const outcome = runQuery(db, task.solution);
    expect(outcome.kind).toBe('select');
    expect(outcome.rows).toHaveLength(task.expected.length);
    expect(rowsEqual(outcome.rows, task.expected, outcome.columns)).toBe(true);
  });

  it('课程 SQL 练习 s1-l2-ex-2：稳定分页', () => {
    const task = {
      tables: {
        links: [
          { id: 21, user_id: 1, slug: 'a1', created_at: '2026-11-01T10:00:00Z' },
          { id: 22, user_id: 1, slug: 'a2', created_at: '2026-11-02T10:00:00Z' },
          { id: 23, user_id: 1, slug: 'a3', created_at: '2026-11-02T10:00:00Z' },
          { id: 24, user_id: 1, slug: 'a4', created_at: '2026-11-03T10:00:00Z' },
          { id: 25, user_id: 1, slug: 'a5', created_at: '2026-11-04T10:00:00Z' },
          { id: 26, user_id: 2, slug: 'b1', created_at: '2026-11-05T10:00:00Z' },
        ],
      },
      expected: [
        { id: 25, slug: 'a5', created_at: '2026-11-04T10:00:00Z' },
        { id: 24, slug: 'a4', created_at: '2026-11-03T10:00:00Z' },
        { id: 23, slug: 'a3', created_at: '2026-11-02T10:00:00Z' },
      ],
      solution:
        'SELECT id, slug, created_at\nFROM links\nWHERE user_id = 1\nORDER BY created_at DESC, id DESC\nLIMIT 3;',
    };
    const db = createDatabase(task.tables);
    const outcome = runQuery(db, task.solution);
    expect(outcome.kind).toBe('select');
    expect(rowsEqual(outcome.rows, task.expected, outcome.columns)).toBe(true);
  });
});

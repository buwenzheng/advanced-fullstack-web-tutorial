/**
 * 教学用迷你 SQL 引擎：支持 CREATE TABLE / INSERT / SELECT / UPDATE / DELETE。
 * 只实现课程与练习需要到的子集，语义贴近 SQLite。
 */

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE',
  'DROP', 'AND', 'OR', 'NOT', 'IS', 'NULL', 'TRUE', 'FALSE', 'AS', 'DISTINCT', 'ON',
  'JOIN', 'LEFT', 'INNER', 'OUTER', 'GROUP', 'HAVING',
]);

const PUNCT = new Set(['(', ')', ',', ';', '*', '.']);

const AGGREGATES = new Set(['COUNT', 'SUM', 'MIN', 'MAX', 'AVG']);

function tokenize(sql) {
  const tokens = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let value = '';
      i += 1;
      while (i < sql.length) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) { value += quote; i += 2; continue; }
          break;
        }
        value += sql[i];
        i += 1;
      }
      i += 1;
      tokens.push({ type: 'str', value });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(sql[i + 1] || ''))) {
      let raw = '';
      while (i < sql.length && /[0-9.]/.test(sql[i])) { raw += sql[i]; i += 1; }
      tokens.push({ type: 'num', value: Number(raw) });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let raw = '';
      while (i < sql.length && /[A-Za-z0-9_]/.test(sql[i])) { raw += sql[i]; i += 1; }
      const upper = raw.toUpperCase();
      if (KEYWORDS.has(upper)) tokens.push({ type: 'kw', value: upper });
      else tokens.push({ type: 'ident', value: raw });
      continue;
    }
    const two = sql.slice(i, i + 2);
    if (['!=', '<>', '<=', '>=', '||'].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }
    if ('=<>+-*/%'.includes(ch)) { tokens.push({ type: 'op', value: ch }); i += 1; continue; }
    if (PUNCT.has(ch)) { tokens.push({ type: 'punc', value: ch }); i += 1; continue; }
    throw new Error(`无法识别的字符 "${ch}"`);
  }
  return tokens;
}

function isNumericLike(value) {
  if (typeof value === 'number') return true;
  if (typeof value !== 'string') return false;
  return value.trim() !== '' && !Number.isNaN(Number(value));
}

function compareValues(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  if (isNumericLike(a) && isNumericLike(b)) {
    const na = Number(a);
    const nb = Number(b);
    return na < nb ? -1 : na > nb ? 1 : 0;
  }
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function lookupValue(row, col) {
  if (!row || typeof row !== 'object') return undefined;
  const lower = String(col).toLowerCase();
  const exact = Object.keys(row).find((name) => name.toLowerCase() === lower);
  if (exact !== undefined) return row[exact];
  const suffix = `.${lower}`;
  const matches = Object.keys(row).filter((name) => name.toLowerCase().endsWith(suffix));
  if (matches.length > 1) throw new Error(`列 ${col} 有歧义，请使用表别名限定`);
  return matches.length === 1 ? row[matches[0]] : undefined;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset] || null;
  }

  next() {
    const token = this.tokens[this.pos];
    this.pos += 1;
    return token || null;
  }

  expect(type, value) {
    const token = this.next();
    if (!token || token.type !== type || (value && token.value !== value)) {
      throw new Error(`语法错误：期望 ${value || type}，实际得到 ${token ? token.value : '结尾'}`);
    }
    return token;
  }

  eat(type, value) {
    const token = this.peek();
    if (token && token.type === type && (!value || token.value === value)) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  parseStatement() {
    const token = this.peek();
    if (!token) throw new Error('语句为空');
    if (token.type === 'kw') {
      switch (token.value) {
        case 'SELECT': return this.parseSelect();
        case 'INSERT': return this.parseInsert();
        case 'UPDATE': return this.parseUpdate();
        case 'DELETE': return this.parseDelete();
        case 'CREATE': return this.parseCreate();
        case 'DROP': return this.parseDrop();
        default: break;
      }
    }
    throw new Error(`暂不支持的语句：${token.value}`);
  }

  parseSelect() {
    this.expect('kw', 'SELECT');
    const distinct = this.eat('kw', 'DISTINCT');
    const columns = [];
    do {
      columns.push(this.parseSelectItem());
    } while (this.eat('punc', ','));

    this.expect('kw', 'FROM');
    const from = this.parseFromItem();

    const joins = [];
    for (;;) {
      const token = this.peek();
      if (!token || token.type !== 'kw') break;
      let type = 'inner';
      if (token.value === 'JOIN') {
        this.next();
      } else if (token.value === 'INNER') {
        this.next();
        this.expect('kw', 'JOIN');
      } else if (token.value === 'LEFT') {
        this.next();
        this.eat('kw', 'OUTER');
        this.expect('kw', 'JOIN');
        type = 'left';
      } else {
        break;
      }
      const target = this.parseFromItem();
      this.expect('kw', 'ON');
      joins.push({ type, table: target.table, alias: target.alias, on: this.parseExpression() });
    }

    let where = null;
    if (this.eat('kw', 'WHERE')) where = this.parseExpression();

    const groupBy = [];
    if (this.eat('kw', 'GROUP')) {
      this.expect('kw', 'BY');
      do {
        groupBy.push(this.parseColumnRef());
      } while (this.eat('punc', ','));
    }

    let having = null;
    if (this.eat('kw', 'HAVING')) having = this.parseExpression();

    const orderBy = [];
    if (this.eat('kw', 'ORDER')) {
      this.expect('kw', 'BY');
      do {
        const col = this.parseColumnRef();
        let dir = 'ASC';
        if (this.eat('kw', 'DESC')) dir = 'DESC';
        else this.eat('kw', 'ASC');
        orderBy.push({ col, dir });
      } while (this.eat('punc', ','));
    }

    let limit = null;
    let offset = null;
    if (this.eat('kw', 'LIMIT')) limit = Number(this.expect('num').value);
    if (this.eat('kw', 'OFFSET')) offset = Number(this.expect('num').value);
    return { type: 'select', distinct, columns, from, joins, where, groupBy, having, orderBy, limit, offset };
  }

  parseFromItem() {
    const table = this.expect('ident').value;
    let alias = table;
    if (this.peek()?.type === 'ident') alias = this.next().value;
    return { table, alias };
  }

  parseColumnRef() {
    const first = this.expect('ident').value;
    if (this.eat('punc', '.')) return `${first}.${this.expect('ident').value}`;
    return first;
  }

  parseSelectItem() {
    if (this.eat('op', '*')) return { star: true };
    const name = this.parseColumnRef();
    if (this.peek()?.type === 'punc' && this.peek()?.value === '(') {
      const fn = name.toUpperCase();
      if (!AGGREGATES.has(fn)) throw new Error(`暂不支持的函数 ${name}（迷你引擎只支持 ${[...AGGREGATES].join('/')}）`);
      this.expect('punc', '(');
      const distinctArg = this.eat('kw', 'DISTINCT');
      const arg = this.eat('op', '*') ? '*' : this.parseColumnRef();
      this.expect('punc', ')');
      let alias = fn.toLowerCase();
      if (this.eat('kw', 'AS')) alias = this.expect('ident').value;
      return { agg: fn, arg, distinct: distinctArg, alias };
    }
    let alias = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : name;
    if (this.eat('kw', 'AS')) alias = this.expect('ident').value;
    return { name, alias };
  }

  parseInsert() {
    this.expect('kw', 'INSERT');
    this.expect('kw', 'INTO');
    const table = this.expect('ident').value;
    let columns = null;
    if (this.peek()?.type === 'punc' && this.peek()?.value === '(') {
      this.expect('punc', '(');
      columns = [];
      do { columns.push(this.expect('ident').value); } while (this.eat('punc', ','));
      this.expect('punc', ')');
    }
    this.expect('kw', 'VALUES');
    const rows = [];
    do {
      this.expect('punc', '(');
      const values = [];
      do {
        const token = this.next();
        if (!token) throw new Error('语法错误：VALUES 缺少值');
        if (token.type === 'num' || token.type === 'str') values.push(token.value);
        else if (token.type === 'kw' && token.value === 'NULL') values.push(null);
        else if (token.type === 'kw' && token.value === 'TRUE') values.push(true);
        else if (token.type === 'kw' && token.value === 'FALSE') values.push(false);
        else throw new Error(`VALUES 中不支持 ${token.value}`);
      } while (this.eat('punc', ','));
      this.expect('punc', ')');
      rows.push(values);
    } while (this.eat('punc', ','));
    return { type: 'insert', table, columns, rows };
  }

  parseUpdate() {
    this.expect('kw', 'UPDATE');
    const table = this.expect('ident').value;
    this.expect('kw', 'SET');
    const sets = [];
    do {
      const column = this.expect('ident').value;
      this.expect('op', '=');
      sets.push({ column, value: this.parseExpression() });
    } while (this.eat('punc', ','));
    let where = null;
    if (this.eat('kw', 'WHERE')) where = this.parseExpression();
    return { type: 'update', table, sets, where };
  }

  parseDelete() {
    this.expect('kw', 'DELETE');
    this.expect('kw', 'FROM');
    const table = this.expect('ident').value;
    let where = null;
    if (this.eat('kw', 'WHERE')) where = this.parseExpression();
    return { type: 'delete', table, where };
  }

  parseCreate() {
    this.expect('kw', 'CREATE');
    this.expect('kw', 'TABLE');
    const name = this.expect('ident').value;
    this.expect('punc', '(');
    const columns = [];
    do {
      const colName = this.expect('ident').value;
      let type = 'TEXT';
      if (this.peek()?.type === 'ident' || (this.peek()?.type === 'kw' && !KEYWORDS.has(this.peek().value))) {
        type = this.next().value.toUpperCase();
      }
      let primaryKey = false;
      if (this.eat('kw', 'ON')) {
        this.expect('kw', 'NOT') && null;
      }
      while (this.peek() && this.peek().type === 'kw') {
        const kw = this.peek().value;
        if (kw === 'NOT') {
          this.next();
          const nxt = this.next();
          if (nxt && nxt.value === 'NULL') { /* 允许但暂不强制 */ }
          else break;
          continue;
        }
        if (kw === 'PRIMARY') {
          this.next();
          this.expect('kw', 'KEY');
          primaryKey = true;
          continue;
        }
        break;
      }
      columns.push({ name: colName, type, primaryKey });
    } while (this.eat('punc', ','));
    this.expect('punc', ')');
    return { type: 'create', table: name, columns };
  }

  parseDrop() {
    this.expect('kw', 'DROP');
    this.expect('kw', 'TABLE');
    return { type: 'drop', table: this.expect('ident').value };
  }

  parseExpression() {
    return this.parseOr();
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.eat('kw', 'OR')) {
      const right = this.parseAnd();
      left = { kind: 'logic', op: 'OR', left, right };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseNot();
    while (this.eat('kw', 'AND')) {
      const right = this.parseNot();
      left = { kind: 'logic', op: 'AND', left, right };
    }
    return left;
  }

  parseNot() {
    if (this.eat('kw', 'NOT')) {
      const operand = this.parseNot();
      return { kind: 'not', operand };
    }
    return this.parseComparison();
  }

  parseComparison() {
    const left = this.parsePrimary();
    const token = this.peek();
    if (token && token.type === 'op' && ['=', '!=', '<>', '<', '<=', '>', '>='].includes(token.value)) {
      this.next();
      const right = this.parsePrimary();
      return { kind: 'compare', op: token.value === '<>' ? '!=' : token.value, left, right };
    }
    if (token && token.type === 'kw' && token.value === 'IS') {
      this.next();
      const negated = this.eat('kw', 'NOT');
      this.expect('kw', 'NULL');
      return { kind: 'isNull', operand: left, negated };
    }
    return left;
  }

  parsePrimary() {
    const token = this.next();
    if (!token) throw new Error('语法错误：表达式意外结束');
    if (token.type === 'num' || token.type === 'str') return { kind: 'literal', value: token.value };
    if (token.type === 'kw') {
      if (token.value === 'NULL') return { kind: 'literal', value: null };
      if (token.value === 'TRUE') return { kind: 'literal', value: true };
      if (token.value === 'FALSE') return { kind: 'literal', value: false };
    }
    if (token.type === 'ident') {
      let name = token.value;
      if (this.eat('punc', '.')) name += `.${this.expect('ident').value}`;
      return { kind: 'column', name };
    }
    if (token.type === 'punc' && token.value === '(') {
      const inner = this.parseExpression();
      this.expect('punc', ')');
      return inner;
    }
    throw new Error(`表达式中不支持 ${token.value}`);
  }
}

function evalExpr(node, row) {
  switch (node.kind) {
    case 'literal': return node.value;
    case 'column': return lookupValue(row, node.name) ?? null;
    case 'not': return !truthy(evalExpr(node.operand, row));
    case 'logic': {
      const left = truthy(evalExpr(node.left, row));
      if (node.op === 'AND') return left ? truthy(evalExpr(node.right, row)) : false;
      return left ? true : truthy(evalExpr(node.right, row));
    }
    case 'isNull': {
      const value = evalExpr(node.operand, row);
      const isNull = value === null || value === undefined;
      return node.negated ? !isNull : isNull;
    }
    case 'compare': {
      const a = evalExpr(node.left, row);
      const b = evalExpr(node.right, row);
      /* 三值逻辑：任何一侧为 NULL 的比较都不成立，空值只能用 IS [NOT] NULL 判断 */
      if (a === null || a === undefined || b === null || b === undefined) return false;
      switch (node.op) {
        case '=': return compareValues(a, b) === 0;
        case '!=': return compareValues(a, b) !== 0;
        case '<': return compareValues(a, b) < 0;
        case '<=': return compareValues(a, b) <= 0;
        case '>': return compareValues(a, b) > 0;
        case '>=': return compareValues(a, b) >= 0;
        default: throw new Error(`不支持的比较符 ${node.op}`);
      }
    }
    default: throw new Error('无法求值的表达式');
  }
}

function truthy(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return Boolean(value);
}

export function createDatabase(seed = {}) {
  const tables = {};
  Object.entries(seed).forEach(([name, rows]) => {
    const columns = [];
    const seen = new Set();
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!seen.has(key)) { seen.add(key); columns.push({ name: key, type: 'TEXT', primaryKey: false }); }
      });
    });
    tables[name] = { columns, rows: rows.map((row) => ({ ...row })) };
  });
  return { tables };
}

function tableOf(db, name) {
  const table = db.tables[name];
  if (!table) throw new Error(`表 ${name} 不存在`);
  return table;
}

function qualifiedRow(alias, row) {
  const out = {};
  Object.keys(row).forEach((key) => { out[`${alias}.${key}`] = row[key]; });
  return out;
}

function emptyQualifiedRow(alias, columns) {
  const out = {};
  columns.forEach((column) => { out[`${alias}.${column.name}`] = null; });
  return out;
}

function buildFromRows(db, from, joins) {
  const base = tableOf(db, from.table);
  const sources = [{ alias: from.alias, columns: base.columns }];
  let rows = base.rows.map((row) => qualifiedRow(from.alias, row));
  for (const join of joins) {
    const right = tableOf(db, join.table);
    sources.push({ alias: join.alias, columns: right.columns });
    const joined = [];
    rows.forEach((leftRow) => {
      let matched = false;
      right.rows.forEach((rightRow) => {
        const combined = { ...leftRow, ...qualifiedRow(join.alias, rightRow) };
        if (truthy(evalExpr(join.on, combined))) {
          joined.push(combined);
          matched = true;
        }
      });
      if (!matched && join.type === 'left') {
        joined.push({ ...leftRow, ...emptyQualifiedRow(join.alias, right.columns) });
      }
    });
    rows = joined;
  }
  return { rows, sources };
}

function computeAggregate(column, rows) {
  if (column.agg === 'COUNT') {
    if (column.arg === '*') return rows.length;
    const values = rows
      .map((row) => lookupValue(row, column.arg))
      .filter((value) => value !== null && value !== undefined);
    if (column.distinct) return new Set(values.map((value) => JSON.stringify(value))).size;
    return values.length;
  }
  let values = rows
    .map((row) => lookupValue(row, column.arg))
    .filter((value) => value !== null && value !== undefined);
  if (column.distinct) {
    const seen = new Set();
    values = values.filter((value) => {
      const key = JSON.stringify(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if (!values.length) return null;
  if (column.agg === 'SUM' || column.agg === 'AVG') {
    const numbers = values.map((value) => Number(value)).filter((value) => !Number.isNaN(value));
    if (!numbers.length) return null;
    const sum = numbers.reduce((total, value) => total + value, 0);
    return column.agg === 'SUM' ? sum : sum / numbers.length;
  }
  let best = values[0];
  for (const value of values.slice(1)) {
    const cmp = compareValues(value, best);
    if ((column.agg === 'MIN' && cmp < 0) || (column.agg === 'MAX' && cmp > 0)) best = value;
  }
  return best;
}

export function runQuery(db, sql) {
  const text = String(sql || '').trim().replace(/;\s*$/, '');
  if (!text) throw new Error('请输入要执行的 SQL');
  const parser = new Parser(tokenize(text));
  const stmt = parser.parseStatement();
  if (parser.pos < parser.tokens.length) {
    const rest = parser.tokens.slice(parser.pos).map((token) => token.value).join(' ');
    throw new Error(`无法解析的内容：${rest}（迷你引擎不支持该语法）`);
  }

  if (stmt.type === 'create') {
    if (db.tables[stmt.table]) throw new Error(`表 ${stmt.table} 已存在`);
    db.tables[stmt.table] = { columns: stmt.columns, rows: [] };
    return { kind: 'create', message: `已创建表 ${stmt.table}`, columns: stmt.columns.map((c) => c.name), rows: [] };
  }

  if (stmt.type === 'drop') {
    if (!db.tables[stmt.table]) throw new Error(`表 ${stmt.table} 不存在`);
    delete db.tables[stmt.table];
    return { kind: 'drop', message: `已删除表 ${stmt.table}`, columns: [], rows: [] };
  }

  if (stmt.type === 'insert') {
    const table = tableOf(db, stmt.table);
    const cols = stmt.columns || table.columns.map((c) => c.name);
    stmt.rows.forEach((values) => {
      if (values.length !== cols.length) {
        throw new Error(`列数不匹配：期望 ${cols.length} 个，实际 ${values.length} 个`);
      }
      const row = {};
      table.columns.forEach((c) => { row[c.name] = null; });
      cols.forEach((name, index) => {
        const target = table.columns.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (!target) throw new Error(`未知列 ${name}`);
        row[target.name] = values[index];
      });
      table.rows.push(row);
    });
    return { kind: 'insert', message: `插入 ${stmt.rows.length} 行`, affected: stmt.rows.length, columns: cols, rows: [] };
  }

  if (stmt.type === 'update') {
    const table = tableOf(db, stmt.table);
    let affected = 0;
    table.rows.forEach((row) => {
      if (stmt.where && !truthy(evalExpr(stmt.where, row))) return;
      stmt.sets.forEach((set) => {
        const target = table.columns.find((c) => c.name.toLowerCase() === set.column.toLowerCase());
        if (!target) throw new Error(`未知列 ${set.column}`);
        row[target.name] = evalExpr(set.value, row);
      });
      affected += 1;
    });
    return { kind: 'update', message: `更新 ${affected} 行`, affected, columns: [], rows: [] };
  }

  if (stmt.type === 'delete') {
    const table = tableOf(db, stmt.table);
    const before = table.rows.length;
    table.rows = table.rows.filter((row) => !(stmt.where && truthy(evalExpr(stmt.where, row))));
    const affected = before - table.rows.length;
    return { kind: 'delete', message: `删除 ${affected} 行`, affected, columns: [], rows: [] };
  }

  const fromRows = buildFromRows(db, stmt.from, stmt.joins);
  const candidates = stmt.where
    ? fromRows.rows.filter((row) => truthy(evalExpr(stmt.where, row)))
    : fromRows.rows;

  const grouped = stmt.columns.some((column) => column.agg) || stmt.groupBy.length > 0;
  let columns = [];
  let projected = [];
  let sourceRows = [];

  if (grouped) {
    stmt.columns.forEach((column) => {
      if (column.star) {
        fromRows.sources.forEach((source) => {
          source.columns.forEach((col) => columns.push(`${source.alias}.${col.name}`));
        });
      } else {
        columns.push(column.alias);
      }
    });

    const groups = new Map();
    if (stmt.groupBy.length) {
      candidates.forEach((row) => {
        const key = JSON.stringify(stmt.groupBy.map((name) => lookupValue(row, name) ?? null));
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      });
    } else {
      groups.set('__all__', candidates);
    }

    groups.forEach((group) => {
      const representative = group[0] || null;
      const context = representative ? { ...representative } : {};
      const output = {};
      stmt.columns.forEach((column) => {
        if (column.star) {
          fromRows.sources.forEach((source) => {
            source.columns.forEach((col) => {
              const key = `${source.alias}.${col.name}`;
              output[key] = representative ? (lookupValue(representative, key) ?? null) : null;
            });
          });
          return;
        }
        const value = column.agg
          ? computeAggregate(column, group)
          : (representative ? (lookupValue(representative, column.name) ?? null) : null);
        output[column.alias] = value;
        context[column.alias] = value;
      });
      if (stmt.having && !truthy(evalExpr(stmt.having, context))) return;
      projected.push(output);
      sourceRows.push(representative);
    });
  } else if (stmt.columns.some((column) => column.star)) {
    if (fromRows.sources.length === 1) {
      columns = fromRows.sources[0].columns.map((col) => col.name);
    } else {
      columns = fromRows.sources.flatMap((source) =>
        source.columns.map((col) => `${source.alias}.${col.name}`),
      );
    }
    projected = candidates.map((row) => {
      const copy = {};
      columns.forEach((name) => { copy[name] = lookupValue(row, name) ?? null; });
      return copy;
    });
    sourceRows = candidates.slice();
  } else {
    columns = stmt.columns.map((column) => column.alias);
    projected = candidates.map((row) => {
      const copy = {};
      stmt.columns.forEach((column) => { copy[column.alias] = lookupValue(row, column.name) ?? null; });
      return copy;
    });
    sourceRows = candidates.slice();
  }

  if (stmt.distinct) {
    const seen = new Set();
    const keep = [];
    projected.forEach((row, index) => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return;
      seen.add(key);
      keep.push(index);
    });
    projected = keep.map((index) => projected[index]);
    sourceRows = keep.map((index) => sourceRows[index]);
  }

  if (stmt.orderBy.length) {
    const order = projected.map((_, index) => index);
    order.sort((x, y) => {
      for (const { col, dir } of stmt.orderBy) {
        let left = lookupValue(projected[x], col);
        let right = lookupValue(projected[y], col);
        if (left === undefined) left = sourceRows[x] ? lookupValue(sourceRows[x], col) : null;
        if (right === undefined) right = sourceRows[y] ? lookupValue(sourceRows[y], col) : null;
        const cmp = compareValues(left ?? null, right ?? null);
        if (cmp !== 0) return dir === 'DESC' ? -cmp : cmp;
      }
      return 0;
    });
    projected = order.map((index) => projected[index]);
  }

  if (stmt.offset) projected = projected.slice(stmt.offset);
  if (stmt.limit !== null && stmt.limit !== undefined) projected = projected.slice(0, stmt.limit);

  return { kind: 'select', columns, rows: projected, message: `返回 ${projected.length} 行` };
}

export function rowsEqual(actual, expected, columns) {
  const expectedRows = Array.isArray(expected) ? expected : [];
  const actualRows = Array.isArray(actual) ? actual : [];
  const expectedCols = Object.keys(expectedRows[0] || {});
  const actualCols = (columns && columns.length) ? columns : Object.keys(actualRows[0] || {});

  const missing = expectedCols.filter((col) => !actualCols.some((name) => name.toLowerCase() === col.toLowerCase()));
  if (missing.length) return false;

  const norm = (rows) => rows.map((row) => {
    const obj = {};
    expectedCols.forEach((col) => {
      const key = Object.keys(row).find((name) => name.toLowerCase() === col.toLowerCase());
      obj[col] = key === undefined ? null : row[key];
    });
    return obj;
  });

  return JSON.stringify(norm(actualRows)) === JSON.stringify(norm(expectedRows));
}

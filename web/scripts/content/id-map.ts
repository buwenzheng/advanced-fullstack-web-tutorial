/** 旧 ID → 新 ID。R2 进度迁移与内容搬家共用；勿手改，改规划对照表后同步。 */

export const LESSON_ID_MAP: Record<string, string> = {
  's0-l1': 'm1-http',
  's0-l2': 'm1-runtime',
  's0-cli': 'm1-cli',
  's1-l1': 'm2-sql',
  's1-l2': 'm2-index',
  's1-l3': 'm2-tx',
  's1-schema': 'm2-schema',
  's2-l1': 'm2-resource',
  's2-l2': 'm2-errors',
  's2-l3': 'm2-auth',
  's2-l4': 'm2-contract',
  's3-l1': 'm3-cache',
  's3-l2': 'm3-queue',
  's3-l3': 'm3-ratelimit',
  's3-resilience': 'm3-resilience',
  's4-l1': 'm3-otel',
  's4-perf': 'm3-perf',
  's4-l3': 'm3-container',
  's4-l4': 'm3-cicd',
  's6-l1': 'm3-bff',
  's6-l2': 'm3-render',
  's6-l3': 'm3-realtime',
  's6-l4': 'm3-edge',
  's7-l1': 'm4-llm',
  's7-l2': 'm4-rag',
  's7-l3': 'm4-eval',
  's7-l4': 'm4-coding-system',
  's7-l5': 'm4-coding-team',
  's5-l1': 'e1-modular',
  's5-l2': 'e1-consistency',
  's5-l3': 'e1-failures',
  's5-data-scale': 'e1-datascale',
  a1: 'b-bigO',
  a2: 'b-hash',
  a3: 'b-btree',
  a4: 'b-heap',
  a5: 'b-lru',
  a6: 'b-prob',
  a7: 'b-capacity',
  a8: 'b-linux',
  a9: 'b-sysdesign',
  a10: 'b-adr',
  a11: 'b-quality',
  a12: 'b-incident',
  a13: 'b-ai-infra',
};

export const BLOCK_ID_MAP: Record<string, string> = {
  s0: 'm1',
  s1: 'm2',
  s2: 'm2',
  s3: 'm3',
  s4: 'm3',
  s5: 'e1',
  s6: 'm3',
  s7: 'm4',
  appendix: 'b',
};

export const PROJECT_ID_MAP: Record<string, string> = {
  p0: 'p-m1-probe',
  p1: 'p-m2-data',
  p2: 'p-m2-api',
  p3: 'p-m3-ship',
  /** D2=A：进度/重定向并入 p-m3-ship；物理文件合并留 R2b */
  p4: 'p-m3-ship',
  p5: 'p-e1-stats',
  p6: 'p-m3-web',
  p7: 'p-m4-ai',
  'p-graduation': 'x-linkhub',
};

/** p4 生产化里程碑并入 p-m3-ship 的 m6–m10（与 p3 的 m1–m5 错开） */
export const P4_MILESTONE_ID_MAP: Record<string, string> = {
  'p4-m1': 'p-m3-ship-m6',
  'p4-m2': 'p-m3-ship-m7',
  'p4-m3': 'p-m3-ship-m8',
  'p4-m4': 'p-m3-ship-m9',
  'p4-m5': 'p-m3-ship-m10',
};

const LEGACY_S6_TO_A = /^s6-l([1-6])(?=$|[-@])/;
const P4_MILESTONE_RE = /^p4-m([1-5])(?=$|[-@])/;

/** 历史附录迁移：s6-l1..l6 → a1..a6（仅 v1→v2；勿在 v3 remap 内调用） */
export function mapHistoricAppendixId(id: string): string {
  return typeof id === 'string' ? id.replace(LEGACY_S6_TO_A, 'a$1') : id;
}

/**
 * 将任意进度/草稿键中的课时或项目前缀映射到新 ID。
 * 保留 `-c-N` / `-ex-N` / `@py` 等后缀。
 * 不含 historic s6→a；那一步只在 migrateToV2。
 */
export function remapId(id: string): string {
  if (typeof id !== 'string' || !id) return id;

  if (P4_MILESTONE_ID_MAP[id]) return P4_MILESTONE_ID_MAP[id];
  const p4 = id.match(P4_MILESTONE_RE);
  if (p4) {
    return `p-m3-ship-m${Number(p4[1]) + 5}${id.slice(p4[0].length)}`;
  }

  if (PROJECT_ID_MAP[id]) return PROJECT_ID_MAP[id];
  if (BLOCK_ID_MAP[id]) return BLOCK_ID_MAP[id];
  if (LESSON_ID_MAP[id]) return LESSON_ID_MAP[id];

  const lessonPrefixes = Object.entries(LESSON_ID_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of lessonPrefixes) {
    if (id.startsWith(`${from}-`) || id.startsWith(`${from}@`)) {
      return `${to}${id.slice(from.length)}`;
    }
  }

  const projectPrefixes = Object.entries(PROJECT_ID_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of projectPrefixes) {
    if (from === to) continue;
    // p4-m* 已在上方专项处理，避免落到 p-m3-ship-m1
    if (from === 'p4' && P4_MILESTONE_RE.test(id)) continue;
    if (id.startsWith(`${from}-`) || id.startsWith(`${from}@`)) {
      return `${to}${id.slice(from.length)}`;
    }
  }

  return id;
}

export function invertMap(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [from, to] of Object.entries(map)) {
    if (!(to in out)) out[to] = from;
  }
  return out;
}

export const LESSON_ID_MAP_COUNT = Object.keys(LESSON_ID_MAP).length;

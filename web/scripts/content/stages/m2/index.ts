import type { LessonData, StageData } from '../../types.js';
import { m2Sql } from './m2-sql.js';
import { m2Index } from './m2-index.js';
import { m2Tx } from './m2-tx.js';
import { m2Schema } from './m2-schema.js';
import { m2Resource } from './m2-resource.js';
import { m2Errors } from './m2-errors.js';
import { m2Auth } from './m2-auth.js';
import { m2Contract } from './m2-contract.js';
import { project as dataProject } from './project-data.js';
import { project as apiProject } from './project-api.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stageM2 = {
  id: 'm2',
  index: 1,
  kind: 'required',
  chapters: [
    { id: 'data', title: '数据', lessonIds: ['m2-sql', 'm2-index', 'm2-tx', 'm2-schema'] },
    { id: 'api', title: 'API', lessonIds: ['m2-resource', 'm2-errors', 'm2-auth', 'm2-contract'] },
  ],
  projectIds: ['p-m2-data', 'p-m2-api'],
  title: '后端交付：数据与 API 契约',
  subtitle: '让数据可信任，再把实现封装成第三方敢依赖的契约。',
  accent: 'blue',
  duration: 620,
  goal: '建立可信的数据层，并交付可验证、可演进的 API 契约。',
  outcome: [
    '能为业务域设计表、约束、索引、事务与迁移',
    '能按 HTTP 语义设计资源、错误、认证授权与多租户隔离',
    '能用查询计划、集成测试与契约测试证明实现符合预期',
  ],
  keywords: ['SQL', '索引', '事务', '迁移', 'REST', 'JWT', '幂等键', 'OpenAPI'],
  lessons: [m2Sql, m2Index, m2Tx, m2Schema, m2Resource, m2Errors, m2Auth, m2Contract] as LessonData[],
  projects: [dataProject, apiProject],
  project: dataProject,
} satisfies StageData;

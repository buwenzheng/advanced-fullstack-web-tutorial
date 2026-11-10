export const tenantId = 't1';
export const query = '回滚发布';
export const queryEmbedding = [1, 0, 0, 0];

export const docs = [
  {
    id: 'd1-c0',
    docId: 'd1',
    chunkIndex: 0,
    text: '短链创建失败时先检查配额与域名状态。',
    tenantId: 't1',
    updatedAt: '2026-08-01T00:00:00Z',
    embedding: [0.6, 0.4, 0, 0]
  },
  {
    id: 'd1-c1',
    docId: 'd1',
    chunkIndex: 1,
    text: '回滚发布前先停止流量再切换版本。',
    tenantId: 't1',
    updatedAt: '2026-05-01T00:00:00Z',
    embedding: [0.9, 0.1, 0, 0]
  },
  {
    id: 'd2-c0',
    docId: 'd2',
    chunkIndex: 0,
    text: '统计口径以点击去重后的独立访客为准。',
    tenantId: 't1',
    updatedAt: '2026-09-01T00:00:00Z',
    embedding: [0, 1, 0, 0]
  },
  {
    id: 'd2-c1',
    docId: 'd2',
    chunkIndex: 1,
    text: '回滚看板按分钟聚合，延迟约十秒。',
    tenantId: 't1',
    updatedAt: '2026-10-01T00:00:00Z'
  },
  {
    id: 'd3-c0',
    docId: 'd3',
    chunkIndex: 0,
    text: '回滚发布手册旧版，保留供审计。',
    tenantId: 't1',
    updatedAt: '2025-01-01T00:00:00Z',
    embedding: [1, 0, 0, 0]
  },
  {
    id: 'x1-c0',
    docId: 'x1',
    chunkIndex: 0,
    text: '其他租户回滚发布流程的机密文档。',
    tenantId: 't2',
    updatedAt: '2026-11-01T00:00:00Z',
    embedding: [1, 0, 0, 0]
  },
  {
    id: 'x1-c1',
    docId: 'x1',
    chunkIndex: 1,
    text: '其他租户的索引补充说明。',
    tenantId: 't2',
    updatedAt: '2026-11-02T00:00:00Z'
  }
];

export const embedTable = {
  '回滚看板按分钟聚合，延迟约十秒。': [1, 0, 0, 0],
  '其他租户的索引补充说明。': [1, 0, 0, 0]
};

export const dimMismatchDocs = [
  {
    id: 'bad-c0',
    docId: 'bad',
    chunkIndex: 0,
    text: '维度错误的向量。',
    tenantId: 't1',
    updatedAt: '2026-10-01T00:00:00Z',
    embedding: [1, 0, 0]
  },
  {
    id: 'bad-c1',
    docId: 'bad',
    chunkIndex: 1,
    text: '正常维度的向量。',
    tenantId: 't1',
    updatedAt: '2026-10-02T00:00:00Z',
    embedding: [1, 0, 0, 0]
  }
];

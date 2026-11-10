export const pricing = {
  cheap: { inputPer1k: 1, outputPer1k: 2 },
  strong: { inputPer1k: 10, outputPer1k: 20 }
};

export const requests = {
  low: {
    task: { complexity: 'low', risk: 'low' },
    messages: [{ role: 'user', content: '给这条短链生成三个标签' }]
  },
  highRisk: {
    task: { complexity: 'low', risk: 'high' },
    messages: [{ role: 'user', content: '生成面向客户的删除操作说明' }]
  },
  highComplexity: {
    task: { complexity: 'high', risk: 'low' },
    messages: [{ role: 'user', content: '把这段发布记录压缩成 120 字摘要' }]
  },
  idempotent: {
    task: { complexity: 'low', risk: 'low' },
    messages: [{ role: 'user', content: '给这条短链生成三个标签' }],
    idempotencyKey: 'req-2026-11-09-001'
  }
};

export const mockResponses = {
  cheap: {
    text: '标签：发布、运维、回滚',
    model: 'cheap-mini',
    usage: { inputTokens: 800, outputTokens: 400 }
  },
  strong: {
    text: '客户可见的删除说明需要二次确认，并保留操作审计。',
    model: 'strong-pro',
    usage: { inputTokens: 1200, outputTokens: 600 }
  },
  missingUsage: {
    text: '没有用量字段的返回',
    model: 'cheap-mini'
  },
  negativeUsage: {
    text: '带负数用量的返回',
    model: 'cheap-mini',
    usage: { inputTokens: -1, outputTokens: 10 }
  }
};

export const mockErrors = {
  rateLimited: { code: 'RATE_LIMITED', retryable: true },
  timeout: { code: 'TIMEOUT', retryable: true },
  invalidJson: { code: 'INVALID_JSON', retryable: false }
};

export const budgets = {
  cheapOk: 5,
  strongOk: 30,
  tooSmall: 1
};

export const allowedMetrics = ['clicks', 'unique_visitors'];
export const contextTenant = 't1';

export const statCalls = {
  ok: {
    call: { tool: 'topLinks', metric: 'clicks', rangeDays: 7, limit: 10 },
    reason: null
  },
  okTruncate: {
    call: { tool: 'topLinks', metric: 'unique_visitors', rangeDays: 30, limit: 2 },
    reason: null
  },
  unknownTool: {
    call: { tool: 'dropLinks', metric: 'clicks', rangeDays: 7, limit: 10 },
    reason: 'UNKNOWN_TOOL'
  },
  tenantMismatch: {
    call: { tool: 'topLinks', metric: 'clicks', rangeDays: 7, limit: 10, tenantId: 't2' },
    reason: 'TENANT_MISMATCH'
  },
  rangeExceeded: {
    call: { tool: 'topLinks', metric: 'clicks', rangeDays: 120, limit: 10 },
    reason: 'RANGE_EXCEEDED'
  },
  limitExceeded: {
    call: { tool: 'topLinks', metric: 'clicks', rangeDays: 7, limit: 500 },
    reason: 'LIMIT_EXCEEDED'
  },
  metricNotAllowed: {
    call: { tool: 'topLinks', metric: 'revenue', rangeDays: 7, limit: 10 },
    reason: 'METRIC_NOT_ALLOWED'
  },
  invalidArgument: {
    call: { tool: 'topLinks', metric: 'clicks', rangeDays: 0, limit: 10 },
    reason: 'INVALID_ARGUMENT'
  }
};

export const statRows = [
  { linkId: 'l1', clicks: 1200, uniqueVisitors: 800 },
  { linkId: 'l2', clicks: 900, uniqueVisitors: 620 },
  { linkId: 'l3', clicks: 700, uniqueVisitors: 510 },
  { linkId: 'l4', clicks: 500, uniqueVisitors: 380 },
  { linkId: 'l5', clicks: 300, uniqueVisitors: 210 }
];

import type { LabResult } from './lab-data';
import { statusClass } from './lab-data';

export function LabResponse({ result }: { result: LabResult | null }) {
  if (!result) return null;
  const entries = Object.entries(result.headers || {});

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className={`badge ${statusClass(result.status)}`}>{result.status} {result.statusText}</span>
        <span className="tiny muted">{result.timeMs ?? '-'} ms</span>
        {result.headers?.['idempotency-replayed'] ? (
          <span className="badge badge--violet">幂等重放</span>
        ) : null}
      </div>
      {entries.length ? (
        <div className="tbl-wrap" style={{ marginTop: 14 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>响应头</th>
                <th>值</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key}>
                  <td style={{ fontFamily: 'var(--font-code)', fontSize: 12, color: 'var(--teal)', whiteSpace: 'nowrap' }}>
                    {key}
                  </td>
                  <td style={{ fontFamily: 'var(--font-code)', fontSize: 12, wordBreak: 'break-all' }}>
                    {String(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="console-out" style={{ maxHeight: 'none', marginTop: 14 }}>
        {result.body || '(空响应体)'}
      </div>
    </>
  );
}

import type { HeaderRow } from './lab-data';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

interface LabRequestBuilderProps {
  method: string;
  path: string;
  headers: HeaderRow[];
  body: string;
  sending: boolean;
  curlFallback: string | null;
  onMethodChange: (method: string) => void;
  onPathChange: (path: string) => void;
  onHeadersChange: (headers: HeaderRow[]) => void;
  onBodyChange: (body: string) => void;
  onSend: () => void;
  onCopyCurl: () => void;
  onReset: () => void;
}

export function LabRequestBuilder({
  method,
  path,
  headers,
  body,
  sending,
  curlFallback,
  onMethodChange,
  onPathChange,
  onHeadersChange,
  onBodyChange,
  onSend,
  onCopyCurl,
  onReset,
}: LabRequestBuilderProps) {
  const updateHeader = (index: number, patch: Partial<HeaderRow>) => {
    onHeadersChange(headers.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...patch } : row
    )));
  };

  return (
    <div className="panel">
      <div className="panel__head">
        <h3>请求构造器</h3>
        <div className="lab-panel-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost btn--sm" type="button" onClick={onCopyCurl}>复制为 curl</button>
          <button className="btn btn--ghost btn--sm" type="button" onClick={onReset}>重置</button>
        </div>
      </div>
      <div className="panel__body">
        <div className="lab-request-line" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            aria-label="HTTP 方法"
            style={{
              background: 'var(--ink-900)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '7px 10px',
              fontFamily: 'var(--font-code)',
              fontSize: 12.5,
            }}
            value={method}
            onChange={(event) => onMethodChange(event.target.value)}
          >
            {METHODS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input
            type="text"
            className="mono lab-path-input"
            aria-label="请求路径"
            style={{
              flex: 1,
              background: 'var(--ink-900)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '8px 11px',
              fontSize: 13,
            }}
            value={path}
            onChange={(event) => onPathChange(event.target.value)}
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>请求头</p>
          <div className="list-stack">
            {headers.map((row, index) => (
              <div className="lab-header-row" style={{ display: 'flex', gap: 8 }} key={index}>
                <input
                  type="text"
                  placeholder="Header"
                  style={{
                    flex: 1,
                    background: 'var(--ink-900)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: '7px 10px',
                    fontFamily: 'var(--font-code)',
                    fontSize: 12.5,
                  }}
                  value={row.key}
                  onChange={(event) => updateHeader(index, { key: event.target.value })}
                />
                <input
                  type="text"
                  placeholder="Value"
                  style={{
                    flex: 1.4,
                    background: 'var(--ink-900)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: '7px 10px',
                    fontFamily: 'var(--font-code)',
                    fontSize: 12.5,
                  }}
                  value={row.value}
                  onChange={(event) => updateHeader(index, { value: event.target.value })}
                />
                <button
                  className="btn btn--ghost btn--sm"
                  type="button"
                  onClick={() => onHeadersChange(headers.filter((_, rowIndex) => rowIndex !== index))}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => onHeadersChange([...headers, { key: '', value: '' }])}
            >
              + 添加请求头
            </button>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>请求体</p>
          <textarea
            placeholder="{ }"
            className="mono"
            style={{
              width: '100%',
              minHeight: 110,
              background: 'var(--ink-900)',
              border: '1px solid var(--line)',
              borderRadius: 9,
              padding: '11px 13px',
              fontFamily: 'var(--font-code)',
              fontSize: 12.5,
              lineHeight: 1.7,
              resize: 'vertical',
            }}
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
          />
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn--primary" type="button" disabled={sending} onClick={onSend}>
            {sending ? '请求中…' : '发送请求'}
          </button>
          <span className="tiny muted">发送后可在下方查看状态码、响应头与响应体</span>
        </div>
        {curlFallback ? (
          <pre
            style={{
              margin: '0 18px 18px',
              padding: 12,
              background: 'var(--ink-900)',
              border: '1px solid var(--line)',
              borderRadius: 9,
              fontFamily: 'var(--font-code)',
              fontSize: 12,
              overflowX: 'auto',
            }}
          >
            {curlFallback}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

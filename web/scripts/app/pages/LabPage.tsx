import { useRef, useState } from 'react';
import { buildCurl } from '../lab/curl';
import type { HeaderRow, LabRequest, LabResult, MockState } from '../lab/lab-data';
import {
  createMockState,
  SCENARIOS,
  TEACH_IDLE,
  TEACH_LIVE,
  TEACH_MOCK,
  statusClass,
} from '../lab/lab-data';
import { LabRequestBuilder } from '../lab/LabRequestBuilder';
import { LabResponse } from '../lab/LabResponse';
import { runLive } from '../lab/live';
import { runMock } from '../lab/mock-server';
import { copyText } from '../project/copy-text';
import { useToast } from '../shell/useToast';

type Target = 'mock' | 'live';

interface HistoryEntry {
  request: LabRequest;
  result: LabResult;
}

const DEFAULT_PATH = '/api/users?page=1&limit=3';
const DEFAULT_HEADERS: HeaderRow[] = [{ key: 'Accept', value: 'application/json' }];

export default function LabPage() {
  const notify = useToast();
  const mockRef = useRef<MockState>(createMockState());
  const [target, setTarget] = useState<Target>('mock');
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState(DEFAULT_PATH);
  const [headers, setHeaders] = useState<HeaderRow[]>(DEFAULT_HEADERS);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<LabResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [teach, setTeach] = useState(TEACH_IDLE);
  const [curlFallback, setCurlFallback] = useState<string | null>(null);

  const currentRequest = (): LabRequest => ({
    method,
    path,
    headers: headers.filter((row) => row.key.trim()),
    body,
  });

  const applyScenario = (index: number) => {
    const scenario = SCENARIOS[index];
    if (!scenario) return;
    setMethod(scenario.request.method);
    setPath(scenario.request.path);
    setHeaders(scenario.request.headers.map((row) => ({ ...row })));
    setBody(scenario.request.body);
    setTeach(scenario.teach);
    notify(`已载入场景：${scenario.title}`);
  };

  const handleSend = async () => {
    setSending(true);
    const request = currentRequest();
    const nextResult = target === 'live'
      ? await runLive(request)
      : { ...(await runMock(request, mockRef.current)), timeMs: Math.round(60 + Math.random() * 90) };
    setResult(nextResult);
    setHistory((prev) => [{ request, result: nextResult }, ...prev].slice(0, 6));
    setSending(false);
  };

  const handleCopyCurl = async () => {
    const command = buildCurl(currentRequest());
    const copied = await copyText(command);
    if (copied) {
      notify('curl 命令已复制');
      setCurlFallback(null);
    } else {
      setCurlFallback(command);
    }
  };

  const handleReset = () => {
    setMethod('GET');
    setPath(DEFAULT_PATH);
    setHeaders(DEFAULT_HEADERS.map((row) => ({ ...row })));
    setBody('');
    mockRef.current = createMockState();
    setHistory([]);
    setResult(null);
    setTeach(target === 'live' ? TEACH_LIVE : TEACH_IDLE);
  };

  const switchTarget = (next: Target) => {
    setTarget(next);
    setTeach(next === 'live' ? TEACH_LIVE : TEACH_MOCK);
  };

  return (
    <div className="page page--wide">
      <div className="section__head" style={{ marginBottom: 16 }}>
        <div>
          <h1>HTTP 实验室</h1>
          <p>亲手发请求，看状态码、响应头与错误体到底长什么样。左边是教学场景，点一下自动填好请求。</p>
        </div>
        <div className="tabs" style={{ width: 280 }}>
          <button
            className={`tab${target === 'mock' ? ' is-active' : ''}`}
            type="button"
            id="tab-mock"
            onClick={() => switchTarget('mock')}
          >
            内置模拟服务
          </button>
          <button
            className={`tab${target === 'live' ? ' is-active' : ''}`}
            type="button"
            id="tab-live"
            onClick={() => switchTarget('live')}
          >
            真实端点
          </button>
        </div>
      </div>

      <div className="split lab-layout">
        <div className="list-stack">
          {SCENARIOS.map((scenario, index) => (
            <button
              key={scenario.id}
              className="btn btn--ghost btn--sm"
              type="button"
              style={{ justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.6 }}
              onClick={() => applyScenario(index)}
            >
              {scenario.title}
            </button>
          ))}
        </div>

        <div className="list-stack">
          <LabRequestBuilder
            method={method}
            path={path}
            headers={headers}
            body={body}
            sending={sending}
            curlFallback={curlFallback}
            onMethodChange={setMethod}
            onPathChange={setPath}
            onHeadersChange={setHeaders}
            onBodyChange={setBody}
            onSend={handleSend}
            onCopyCurl={handleCopyCurl}
            onReset={handleReset}
          />

          <div className="panel">
            <div className="panel__head">
              <h3>响应</h3>
            </div>
            <div className="panel__body">
              <LabResponse result={result} />
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h3>最近请求</h3>
            </div>
            <div className="panel__body">
              <div className="list-stack">
                {history.length ? history.map((entry, index) => (
                  <div
                    key={`${index}-${entry.request.method}-${entry.request.path}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 10px',
                      border: '1px solid var(--line-soft)',
                      borderRadius: 8,
                      fontSize: 12.5,
                    }}
                  >
                    <span className={`badge ${statusClass(entry.result.status)}`}>
                      {String(entry.result.status)}
                    </span>
                    <span
                      className="mono tiny"
                      style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {entry.request.method} {entry.request.path}
                    </span>
                    <span className="tiny muted">{entry.result.timeMs ?? '-'} ms</span>
                  </div>
                )) : (
                  <div className="empty-state">还没有请求记录。</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 24 }}>
        <div className="panel__head">
          <h3>这个场景在教什么</h3>
        </div>
        <div className="panel__body">
          <p className="tiny muted" style={{ lineHeight: 1.75 }}>{teach}</p>
        </div>
      </div>
    </div>
  );
}

export interface RunLog {
  level: string;
  text: string;
}

export interface RunCaseResult {
  name: string;
  ok: boolean;
  error?: string;
}

export interface RunResult {
  ok: boolean;
  results: RunCaseResult[];
  logs: RunLog[];
}

const STORAGE_KEY = 'bff-lab-lang-v1';

export type LanguageId = 'javascript' | 'python';

export interface LanguageMeta {
  id: LanguageId;
  label: string;
  short: string;
  file: string;
  runtime: string;
}

export const LANGUAGES: ReadonlyArray<LanguageMeta> = [
  { id: 'javascript', label: 'Node.js', short: 'Node', file: 'solution.js', runtime: 'JavaScript · Node 风格' },
  { id: 'python', label: 'Python', short: 'Python', file: 'solution.py', runtime: 'Python 3.13 · 标准库' },
];

const LABELS: Record<string, string> = Object.fromEntries(LANGUAGES.map((item) => [item.id, item.label]));

function read(): LanguageId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'python' ? 'python' : 'javascript';
  } catch {
    return 'javascript';
  }
}

let current = read();
const listeners = new Set<(value: LanguageId) => void>();

export function languageLabel(id: string): string {
  return LABELS[id] || id;
}

export function languageMeta(id: string): LanguageMeta {
  return LANGUAGES.find((item) => item.id === id) || LANGUAGES[0]!;
}

export const lang = {
  get(): LanguageId {
    return current;
  },

  set(value: LanguageId): void {
    if (!LABELS[value] || value === current) return;
    current = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* 隐私模式下保留内存态 */
    }
    listeners.forEach((fn) => fn(current));
  },

  subscribe(fn: (value: LanguageId) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

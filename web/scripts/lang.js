const STORAGE_KEY = 'bff-lab-lang-v1';

export const LANGUAGES = [
  { id: 'javascript', label: 'Node.js', short: 'Node', file: 'solution.js', runtime: 'JavaScript · Node 风格' },
  { id: 'python', label: 'Python', short: 'Python', file: 'solution.py', runtime: 'Python 3.13 · 标准库' },
];

const LABELS = Object.fromEntries(LANGUAGES.map((item) => [item.id, item.label]));

function read() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'python' ? 'python' : 'javascript';
  } catch {
    return 'javascript';
  }
}

let current = read();
const listeners = new Set();

export function languageLabel(id) {
  return LABELS[id] || id;
}

export function languageMeta(id) {
  return LANGUAGES.find((item) => item.id === id) || LANGUAGES[0];
}

export const lang = {
  get() {
    return current;
  },

  set(value) {
    if (!LABELS[value] || value === current) return;
    current = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* 隐私模式下保留内存态 */
    }
    listeners.forEach((fn) => fn(current));
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

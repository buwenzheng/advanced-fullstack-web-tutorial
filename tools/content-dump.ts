import { curriculum, graduationProject } from '../web/scripts/content/index.js';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(source).sort().map((key) => [key, canonical(source[key])]));
  }
  return value;
}

const payload = canonical({ curriculum, graduationProject });
process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, content, walkStrings } from './lib/content.mjs';

const REGISTRY = path.join(ROOT, 'docs/facts/registry.md');
const DATE_RE = /\d{4}-\d{2}-\d{2}/;

const PATTERNS = [
  /Node(?:\.js)? \d+(?:\.\d+)*/g,
  /Python \d+\.\d+/g,
  /HTTP\/\d(?:\.\d)?/g,
  /TLS 1\.\d/g,
  /Redis \d+(?:\.\d+)*/g,
  /PostgreSQL \d+(?:\.\d+)?/g,
  /RabbitMQ \d+(?:\.\d+)*/g,
  /Docker \d+(?:\.\d+)*/g,
  /OpenTelemetry/g,
  /k6/g,
  /pgvector/g,
  /HNSW/g,
  /Pyodide \d+\.\d+\.\d+/g,
  /React \d+(?:\.\d+)*/g,
  /Next\.js \d+(?:\.\d+)*/g,
];

const findings = new Map();

walkStrings(content.curriculum, (value, keyPath) => {
  for (const pattern of PATTERNS) {
    const matches = value.match(pattern) || [];
    for (const match of matches) {
      const key = match.trim();
      if (!findings.has(key)) findings.set(key, new Set());
      findings.get(key).add(keyPath);
    }
  }
});

if (!findings.size) {
  console.log('facts unregistered=0');
  process.exit(0);
}

if (!fs.existsSync(REGISTRY)) {
  console.error('docs/facts/registry.md 不存在，无法核对以下事实：');
  for (const [fact, where] of findings) console.error(`- ${fact} @ ${[...where].slice(0, 3).join(', ')}`);
  console.log(`facts unregistered=${findings.size}`);
  process.exit(1);
}

const registryText = fs.readFileSync(REGISTRY, 'utf8');
const registered = new Set(
  registryText
    .split('\n')
    .filter((line) => DATE_RE.test(line))
    .map((line) => line.toLowerCase()),
);

const missing = [];
for (const [fact, where] of findings) {
  const hit = [...registered].some((line) => line.includes(fact.toLowerCase()));
  if (!hit) missing.push(`${fact} @ ${[...where].slice(0, 3).join(', ')}`);
}

if (missing.length) {
  console.error('未在 docs/facts/registry.md 登记（需带日期）：');
  console.error(missing.join('\n'));
  console.log(`facts unregistered=${missing.length}`);
  process.exit(1);
}

console.log(`facts unregistered=0 total=${findings.size}`);

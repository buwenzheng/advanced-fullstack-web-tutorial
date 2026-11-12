import fs from 'node:fs';

const path = 'docs/content-manifest.json';
const doc = JSON.parse(fs.readFileSync(path, 'utf8')) as {
  blocks: Array<{ id: string; projects?: string[] }>;
};

const map: Record<string, string> = {
  p0: 'p-m1-probe',
  p1: 'p-m2-data',
  p2: 'p-m2-api',
  p3: 'p-m3-ship',
  p4: 'p-m3-ship',
  p5: 'p-e1-stats',
  p6: 'p-m3-web',
  p7: 'p-m4-ai',
};

for (const block of doc.blocks) {
  block.projects = [...new Set((block.projects || []).map((id) => map[id] || id))];
}

fs.writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
console.log(doc.blocks.map((b) => ({ id: b.id, projects: b.projects })));

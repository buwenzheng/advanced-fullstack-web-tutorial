import { content, walkStrings, stripHtml } from './lib/content.mjs';

const MIN_PARAGRAPH = 40;
const SHINGLE = 5;
const WARN = 0.3;
const FAIL = 0.4;

function paragraphsOf(lesson) {
  const paragraphs = [];
  for (const block of lesson.blocks || []) {
    if (block.type === 'code') continue;
    walkStrings(block, (value, keyPath) => {
      if (keyPath.endsWith('.type') || keyPath.endsWith('.lang') || keyPath.endsWith('.title')) return;
      const text = stripHtml(value);
      text.split(/[。！？!?；;\n]+/).forEach((part) => {
        const clean = part.replace(/[\s"'“”‘’（）()、，,：:]/g, '');
        if (clean.length >= MIN_PARAGRAPH) paragraphs.push(clean);
      });
    });
  }
  return paragraphs;
}

function shinglesOf(paragraphs) {
  const shingles = new Set();
  for (const paragraph of paragraphs) {
    for (let index = 0; index + SHINGLE <= paragraph.length; index += 1) {
      shingles.add(paragraph.slice(index, index + SHINGLE));
    }
  }
  return shingles;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of small) if (large.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

const entries = content.allLessons
  .map((lesson) => ({ lesson, shingles: shinglesOf(paragraphsOf(lesson)) }))
  .filter((entry) => entry.shingles.size > 0);

const pairs = [];
for (let i = 0; i < entries.length; i += 1) {
  for (let j = i + 1; j < entries.length; j += 1) {
    const score = jaccard(entries[i].shingles, entries[j].shingles);
    if (score >= WARN) {
      pairs.push({ a: entries[i].lesson.id, b: entries[j].lesson.id, score });
    }
  }
}

pairs.sort((left, right) => right.score - left.score);
pairs.slice(0, 20).forEach((pair) => {
  const tag = pair.score > FAIL ? 'FAIL' : 'WARN';
  console.log(`${tag} ${pair.a} ~ ${pair.b}: ${pair.score.toFixed(3)}`);
});

const failing = pairs.filter((pair) => pair.score > FAIL);
console.log(`duplication lessons=${entries.length} pairs=${pairs.length} failing=${failing.length}`);
process.exit(failing.length ? 1 : 0);

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const MANIFEST = path.join(DIST, '.vite/manifest.json');
const REPORT = 'docs/reviews/frontend-engineering/e4/bundle.json';
const LIMITS = { entry: 180 * 1024, lazy: 150 * 1024, search: 300 * 1024 };

type ManifestItem = {
  file: string;
  src?: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
};

function gzipBytes(file: string): number {
  return gzipSync(readFileSync(path.join(DIST, file)), { level: 9 }).length;
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

let manifest: Record<string, ManifestItem>;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, ManifestItem>;
} catch {
  console.error(`FAIL 找不到 ${MANIFEST}，请先运行 npm run build`);
  process.exit(1);
}

const reactKey = Object.keys(manifest).find(
  (key) => manifest[key]?.isEntry && key.endsWith('index.next.html'),
);
if (!reactKey) {
  console.error('FAIL manifest 中找不到 index.next.html 入口');
  process.exit(1);
}

const staticClosure = new Set<string>();
(function walk(key: string) {
  const item = manifest[key];
  if (!item || staticClosure.has(item.file)) return;
  staticClosure.add(item.file);
  (item.imports ?? []).forEach(walk);
})(reactKey);

const sumGzip = (files: Iterable<string>) =>
  [...files].reduce((total, file) => total + gzipBytes(file), 0);

const entryGzip = sumGzip(staticClosure);
const entryCss = [
  ...new Set(
    [...staticClosure].flatMap((file) => {
      const key = Object.keys(manifest).find((candidate) => manifest[candidate]?.file === file);
      return key ? (manifest[key]?.css ?? []) : [];
    }),
  ),
];

const searchItem = Object.entries(manifest).find(([key]) => key.includes('search-index.json'));
if (!searchItem) {
  console.error('FAIL manifest 中找不到 search-index.json');
  process.exit(1);
}
const searchFile = searchItem[1].file;
const searchGzip = gzipBytes(searchFile);

// search-index 由 JSON 模块生成，独立按 300KB 预算计量，不计入懒加载 JS chunk（§6.3）
const lazyGzip = Object.keys(manifest)
  .map((key) => manifest[key])
  .filter((item): item is ManifestItem => Boolean(item))
  .filter(
    (item) =>
      item.file.endsWith('.js') && !staticClosure.has(item.file) && item.file !== searchFile,
  )
  .map((item) => ({ file: item.file, gzip: gzipBytes(item.file) }))
  .sort((a, b) => b.gzip - a.gzip);
const maxLazy = lazyGzip[0] ?? { file: '-', gzip: 0 };

const allJs = [...new Set(Object.values(manifest).map((item) => item.file))].filter((file) =>
  file.endsWith('.js'),
);

const rows = [
  ['entry (index.next.html)', entryGzip, LIMITS.entry],
  [`lazy max (${maxLazy.file})`, maxLazy.gzip, LIMITS.lazy],
  ['search index', searchGzip, LIMITS.search],
] as const;

for (const [name, value, limit] of rows) {
  const status = value <= limit ? 'PASS' : 'FAIL';
  console.log(`${status} ${name.padEnd(36)} ${kb(value)} / ${kb(limit)}`);
}
console.log(`INFO css (entry)                         ${kb(sumGzip(entryCss))}`);
console.log(`INFO total js (${allJs.length} files)              ${kb(sumGzip(allJs))}`);
console.log(`INFO entry closure (${staticClosure.size} files)`);
[...staticClosure].sort().forEach((file) => console.log(`  closure ${file}`));

const failed = rows.some(([, value, limit]) => value > limit);

if (process.argv.includes('--json')) {
  const report = {
    generatedAt: new Date().toISOString(),
    budgets: {
      entry: {
        label: 'entry (index.next.html)',
        limit: LIMITS.entry,
        gzip: entryGzip,
        pass: entryGzip <= LIMITS.entry,
        files: [...staticClosure].sort(),
      },
      lazyMax: {
        label: 'lazy max',
        limit: LIMITS.lazy,
        gzip: maxLazy.gzip,
        pass: maxLazy.gzip <= LIMITS.lazy,
        file: maxLazy.file,
        chunks: lazyGzip,
      },
      search: {
        label: 'search index',
        limit: LIMITS.search,
        gzip: searchGzip,
        pass: searchGzip <= LIMITS.search,
        file: searchItem[1].file,
      },
    },
    reportOnly: {
      entryCss: { gzip: sumGzip(entryCss), files: entryCss },
      totalJs: { gzip: sumGzip(allJs), files: allJs.length },
    },
    pass: !failed,
  };
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`INFO wrote ${REPORT}`);
}

process.exit(failed ? 1 : 0);

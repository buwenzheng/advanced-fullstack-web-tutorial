import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCatalog, buildSearchIndex } from '../web/scripts/content/build.js';

export { buildCatalog, buildSearchIndex } from '../web/scripts/content/build.js';

function write(file: string, payload: unknown): { bytes: number; gzip: number; sha: string } {
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  writeFileSync(file, text, 'utf8');
  return {
    bytes: Buffer.byteLength(text, 'utf8'),
    gzip: gzipSync(Buffer.from(text, 'utf8')).length,
    sha: createHash('sha256').update(text, 'utf8').digest('hex'),
  };
}

function main(): void {
  const outDir = join(process.cwd(), 'web', 'generated');
  mkdirSync(outDir, { recursive: true });

  const catalog = write(join(outDir, 'catalog.json'), buildCatalog());
  const search = write(join(outDir, 'search-index.json'), buildSearchIndex());

  console.log(`catalog bytes=${catalog.bytes} gzip=${catalog.gzip} sha256=${catalog.sha}`);
  console.log(`search bytes=${search.bytes} gzip=${search.gzip} sha256=${search.sha}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

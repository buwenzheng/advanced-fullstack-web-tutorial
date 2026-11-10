import { readFileSync } from 'node:fs';

type ManifestItem = {
  file: string;
  isEntry?: boolean;
  imports?: string[];
};

export function entryClosure(): Set<string> {
  const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8')) as Record<
    string,
    ManifestItem
  >;
  const key = Object.keys(manifest).find(
    (item) => manifest[item]?.isEntry && item.endsWith('index.html'),
  );
  if (!key) throw new Error('manifest 中找不到 index.html 入口');
  const files = new Set<string>();
  (function walk(current: string) {
    const item = manifest[current];
    if (!item || files.has(item.file)) return;
    files.add(item.file);
    (item.imports ?? []).forEach(walk);
  })(key);
  return files;
}

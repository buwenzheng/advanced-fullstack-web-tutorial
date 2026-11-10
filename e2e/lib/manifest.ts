import { readFileSync } from 'node:fs';

const ENTRY_HTML = 'index.next.html';

type ManifestItem = {
  file: string;
  isEntry?: boolean;
  imports?: string[];
};

function entryKey(manifest: Record<string, ManifestItem>): string {
  const direct = Object.keys(manifest).find(
    (item) => manifest[item]?.isEntry && item.endsWith(ENTRY_HTML),
  );
  if (direct) return direct;
  // 多 HTML 入口共享同一脚本时 Vite 会合并入口 chunk，manifest 不保留 HTML 键，改从产物 HTML 定位
  const html = readFileSync(`dist/${ENTRY_HTML}`, 'utf8');
  const src = html.match(/<script[^>]*\ssrc="([^"]+)"/)?.[1]?.replace(/^\.\//, '');
  const key = src
    ? Object.keys(manifest).find((item) => manifest[item]?.file === src)
    : undefined;
  if (!key) throw new Error(`manifest 中找不到 ${ENTRY_HTML} 入口`);
  return key;
}

export function entryClosure(): Set<string> {
  const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8')) as Record<
    string,
    ManifestItem
  >;
  const key = entryKey(manifest);
  const files = new Set<string>();
  (function walk(current: string) {
    const item = manifest[current];
    if (!item || files.has(item.file)) return;
    files.add(item.file);
    (item.imports ?? []).forEach(walk);
  })(key);
  return files;
}

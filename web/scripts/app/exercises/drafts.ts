import { DRAFT_KEY } from '../../state/store';

export function readDraft(id: string): string | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const drafts = JSON.parse(raw) as Record<string, string>;
    return drafts[id] ?? null;
  } catch {
    return null;
  }
}

export function writeDraft(id: string, value: string): void {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const drafts = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    drafts[id] = value;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch {
    /* 写入失败不影响交互 */
  }
}

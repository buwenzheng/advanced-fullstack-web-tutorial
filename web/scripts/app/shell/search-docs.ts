export interface SearchDocument {
  href: string;
  title: string;
  sub: string;
  text: string;
}

export interface SearchDocumentHit {
  title: string;
  sub: string;
  href: string;
}

export function searchFromDocs(docs: readonly SearchDocument[], query: string): SearchDocumentHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchDocumentHit[] = [];
  for (const doc of docs) {
    if (doc.text.toLowerCase().includes(q)) {
      hits.push({ title: doc.title, sub: doc.sub, href: doc.href });
      if (hits.length >= 12) break;
    }
  }
  return hits;
}
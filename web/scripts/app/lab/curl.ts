import type { LabRequest } from './lab-data';

export function buildCurl(request: LabRequest): string {
  const method = request.method.toUpperCase();
  const parts = [`curl -i -X ${method} "http://localhost:3000${request.path}"`];
  request.headers.filter((row) => row.key.trim()).forEach((row) => {
    parts.push(`  -H "${row.key}: ${row.value}"`);
  });
  if (request.body.trim() && method !== 'GET') {
    parts.push(`  -d '${request.body.replace(/'/g, "'\\''")}'`);
  }
  return parts.join(' \\\n');
}

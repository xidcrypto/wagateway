import { headers } from 'next/headers';
import { ApiDocsContent } from '@/components/docs/ApiDocsContent';

export default async function ApiDocsPage() {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const hostHeader = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const host = hostHeader ? `${proto}://${hostHeader}` : '';
  // Guard login sudah ditangani shell dashboard (cek /api/me, 401 → /login).
  return <ApiDocsContent host={host} />;
}

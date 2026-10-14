import { appleAppSiteAssociation } from '@/lib/app-site-association';

export function GET() {
  return Response.json(appleAppSiteAssociation, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}

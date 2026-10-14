import { assetLinks } from '@/lib/app-site-association';

export function GET() {
  return Response.json(assetLinks, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}

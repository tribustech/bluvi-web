import { type NextRequest, NextResponse } from 'next/server';
import { AuthInputError, isSocialProvider, providerBody } from '@/lib/server/auth-providers';
import { isSameOrigin } from '@/lib/server/proxy';
import { signInThroughCms } from '@/lib/server/sign-in';

type Ctx = { params: Promise<{ provider: string }> };

/**
 * POST /api/auth/{google|facebook|apple|local}
 * Exchanges the provider credential for a Strapi JWT (via the CMS routes fish uses) and stores
 * it in the httpOnly session cookie. `local` exists only when ENABLE_LOCAL_AUTH=1 (QA).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { provider } = await params;
  if (!isSameOrigin(req.url, req.headers.get('origin'), req.headers.get('sec-fetch-site'))) {
    return NextResponse.json({ error: { status: 403, message: 'Forbidden' } }, { status: 403 });
  }

  let input: Record<string, unknown>;
  try {
    input = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: { status: 400, message: 'Formatul cererii nu este valid.' } }, { status: 400 });
  }

  if (provider === 'local') {
    if (process.env.ENABLE_LOCAL_AUTH !== '1') return NextResponse.json({ error: { status: 404 } }, { status: 404 });
    const body = JSON.stringify({ identifier: input.identifier, password: input.password });
    return signInThroughCms(req.url, '/auth/local', body, 'application/json');
  }

  if (!isSocialProvider(provider)) return NextResponse.json({ error: { status: 404 } }, { status: 404 });

  try {
    const body = JSON.stringify(await providerBody(provider, input));
    return signInThroughCms(req.url, `/auth/${provider}`, body, 'text/plain;charset=UTF-8');
  } catch (e) {
    if (e instanceof AuthInputError) {
      return NextResponse.json({ error: { status: 400, message: e.message } }, { status: 400 });
    }
    throw e;
  }
}

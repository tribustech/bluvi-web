import { e2ePublicStubStore } from '../_components/e2e-faults';

/*
 * Development-only: stubs the public header read of one angler (../_components/e2e-faults.ts
 * e2ePublicStub). POST {"profile": {…DTO}} | {"missing": true} | {"unavailable": true} | {} (clear).
 * 404 in production.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { profile?: unknown; missing?: unknown; unavailable?: unknown };
  const store = e2ePublicStubStore();
  if (body.missing === true) store.set(id, { kind: 'missing' });
  else if (body.unavailable === true) store.set(id, { kind: 'unavailable' });
  else if (body.profile && typeof body.profile === 'object') store.set(id, { kind: 'ok', profile: body.profile });
  else store.delete(id);
  return Response.json({ id, stub: store.get(id)?.kind ?? null });
}

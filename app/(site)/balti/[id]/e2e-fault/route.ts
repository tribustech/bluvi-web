import { e2eFaultsEnabled, e2eFaultStore } from '../_components/e2e-faults';

/*
 * Development-only: sets the lake page's e2e faults (../_components/e2e-faults.ts) for one lake.
 * POST {"faults": ["reviews", "no-photos"]} — an empty list clears them. 404 in production.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!e2eFaultsEnabled()) return new Response(null, { status: 404 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { faults?: unknown };
  const faults = Array.isArray(body.faults) ? body.faults.filter((f): f is string => typeof f === 'string') : [];
  const store = e2eFaultStore();
  if (faults.length) store.set(id, new Set(faults));
  else store.delete(id);
  return Response.json({ id, faults });
}

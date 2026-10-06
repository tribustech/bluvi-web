import { e2eFaultsEnabled, e2eFaultStore } from '../e2e-faults';

/*
 * Development-only: sets the ranking image page's e2e faults (../e2e-faults.ts) for one
 * competition. POST {"faults": ["competition-slow"]} — an empty list clears them. 404 in production.
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

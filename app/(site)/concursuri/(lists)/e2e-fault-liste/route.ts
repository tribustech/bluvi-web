import { setStatusListFaults, statusListFaultsEnabled } from '../_status/faults';

/*
 * Development-only: fails the status lists' server reads (../_status/faults.ts).
 * POST {"faults": ["viitoare", "live", "incheiate"]} — an empty list clears them. 404 in production.
 */
export async function POST(request: Request) {
  if (!statusListFaultsEnabled()) return new Response(null, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { faults?: unknown };
  const faults = Array.isArray(body.faults) ? body.faults.filter((f): f is string => typeof f === 'string') : [];
  setStatusListFaults(faults);
  return Response.json({ faults });
}

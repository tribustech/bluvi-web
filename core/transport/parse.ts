import type { z } from 'zod';
import { ApiError } from './errors';
import type { Transport, TransportRequest } from './types';

/**
 * Validates a CMS response with its zod schema. A mismatch is a contract break between
 * the web and the CMS: it throws `INVALID_RESPONSE` with the zod issues in `details`,
 * so it surfaces in tests and in error reporting instead of as `undefined` deep in the UI.
 */
export function parseResponse<S extends z.ZodType>(schema: S, data: unknown, path: string): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError({
      message: `Răspuns neașteptat de la server (${path})`,
      status: 200,
      code: 'INVALID_RESPONSE',
      path,
      details: { issues: result.error.issues.slice(0, 20) },
    });
  }
  return result.data;
}

/** Request + validate. The standard shape of every API function in `core/`. */
export async function call<S extends z.ZodType>(t: Transport, req: TransportRequest, schema: S): Promise<z.output<S>> {
  const res = await t.request(req);
  return parseResponse(schema, res.data, req.path);
}

/** Request whose response body is irrelevant (204s, fire-and-forget writes). */
export async function callVoid(t: Transport, req: TransportRequest): Promise<void> {
  await t.request(req);
}

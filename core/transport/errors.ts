/**
 * Normalised CMS error, same fields fish rejects with (`fish/services/api/api.ts`):
 * `bluCode` comes from Strapi's `error.details.bluCode` and marks errors the app handles
 * explicitly; everything else carries a generic Romanian message.
 */
export const GENERIC_ERROR_MESSAGE = 'A apărut o eroare necunoscută. Te rugăm să reîncerci mai târziu.';

/** 401 with one of these messages means the JWT is dead (expired, revoked, secret rotated). */
const DEAD_SESSION_MESSAGES = new Set(['Missing or invalid credentials', 'Invalid credentials']);

export type ApiErrorCode = 'SESSION_DEAD' | 'NETWORK' | 'INVALID_RESPONSE' | 'HTTP';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly bluCode?: string;
  readonly details?: Record<string, unknown>;
  readonly path?: string;

  constructor(init: {
    message: string;
    status: number;
    code: ApiErrorCode;
    bluCode?: string;
    details?: Record<string, unknown>;
    path?: string;
    cause?: unknown;
  }) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.bluCode = init.bluCode;
    this.details = init.details;
    this.path = init.path;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

type StrapiErrorBody = {
  error?: { message?: unknown; details?: Record<string, unknown> | null };
};

/** Builds the ApiError for a non-2xx response body (already parsed JSON, or null when not JSON). */
export function apiErrorFromResponse(status: number, body: unknown, path?: string): ApiError {
  const err = (body as StrapiErrorBody | null)?.error;
  const message = typeof err?.message === 'string' ? err.message : undefined;
  const details = err?.details ?? undefined;
  const bluCode = typeof details?.bluCode === 'string' ? details.bluCode : undefined;

  if (bluCode) {
    return new ApiError({ message: message ?? GENERIC_ERROR_MESSAGE, status, code: 'HTTP', bluCode, details, path });
  }
  if (status === 401 && message && DEAD_SESSION_MESSAGES.has(message)) {
    return new ApiError({ message, status, code: 'SESSION_DEAD', details, path });
  }
  return new ApiError({ message: GENERIC_ERROR_MESSAGE, status, code: 'HTTP', details, path });
}

export function networkError(path: string, cause: unknown): ApiError {
  return new ApiError({ message: GENERIC_ERROR_MESSAGE, status: 0, code: 'NETWORK', path, cause });
}

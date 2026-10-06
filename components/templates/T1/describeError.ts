import { isApiError } from '@/core/transport';

/*
 * fish helpers/errors/describeError.ts, for the ApiError the web transport throws: what a failed
 * list says and which buttons it offers (fish ErrorScreen: «Încearcă din nou», and
 * «Deconectează-te» only for a dead session — signing out fixes nothing else).
 * Shared by the T1 lists and Acasă's error card (HomeErrorGate) — production code, so it lives in
 * the template kit, never under app/dev. TODO(core): move to core/shared next to ApiError.
 */

export type ErrorKind = 'offline' | 'server' | 'auth' | 'forbidden' | 'notFound' | 'unknown';

export type ErrorDescription = {
  kind: ErrorKind;
  title: string;
  message: string;
  canRetry: boolean;
  showSignOut: boolean;
};

const OFFLINE: ErrorDescription = {
  kind: 'offline',
  title: 'Nu putem ajunge la server',
  message: 'Verifică conexiunea la internet și încearcă din nou.',
  canRetry: true,
  showSignOut: false,
};
const SERVER: ErrorDescription = {
  kind: 'server',
  title: 'Serverul nu răspunde',
  message: 'Lucrăm la asta. Încearcă din nou în câteva minute.',
  canRetry: true,
  showSignOut: false,
};
const AUTH: ErrorDescription = {
  kind: 'auth',
  title: 'Sesiunea a expirat',
  message: 'Autentifică-te din nou ca să continui.',
  canRetry: false,
  showSignOut: true,
};
const FORBIDDEN: ErrorDescription = {
  kind: 'forbidden',
  title: 'Nu ai acces',
  message: 'Contul tău nu are drepturi pentru aceste date.',
  canRetry: true,
  showSignOut: false,
};
const NOT_FOUND: ErrorDescription = {
  kind: 'notFound',
  title: 'Nu am găsit datele',
  message: 'Poate au fost șterse între timp.',
  canRetry: true,
  showSignOut: false,
};
const UNKNOWN: ErrorDescription = {
  kind: 'unknown',
  title: 'A apărut o eroare',
  message: 'Încearcă din nou. Dacă persistă, scrie-ne.',
  canRetry: true,
  showSignOut: false,
};

/** The interceptor's placeholder (core GENERIC_ERROR_MESSAGE) is not a server message. */
const GENERIC = 'A apărut o eroare necunoscută. Te rugăm să reîncerci mai târziu.';
const CODE_LIKE = /^[A-Z][A-Z0-9_]*$/;

export function describeError(error: unknown): ErrorDescription {
  if (!isApiError(error)) return UNKNOWN;
  if (error.code === 'NETWORK') return OFFLINE;
  if (error.code === 'SESSION_DEAD' || error.status === 401) return AUTH;
  if (error.status >= 500) return SERVER;
  if (error.status === 403) return FORBIDDEN;
  if (error.status === 404) return NOT_FOUND;
  const serverMessage = error.message && error.message !== GENERIC && !CODE_LIKE.test(error.message) ? error.message : undefined;
  if (error.status === 400 && serverMessage) return { ...UNKNOWN, message: serverMessage, canRetry: false };
  return serverMessage ? { ...UNKNOWN, message: serverMessage } : UNKNOWN;
}

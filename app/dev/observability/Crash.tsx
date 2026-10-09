'use client';

import { useSearchParams } from 'next/navigation';

export function Crash() {
  if (useSearchParams().get('crash') === 'render') throw new Error('m8.sentry: forced render error');
  return <p className="t-body">Adaugă ?crash=render pentru o eroare de randare.</p>;
}

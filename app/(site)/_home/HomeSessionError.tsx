'use client';

import { DashboardError } from '@/components/templates/T5/DashboardError';

/**
 * Acasă when the session could not be read (a session cookie, but /users/me failed or gave no
 * answer — ../_shell/session.ts «unknown»): fish keeps the session and shows its ErrorScreen
 * ((tabs)/index.tsx isErrorProfile); the web never falls back to the signed-out page («Bine ai
 * venit», «Intră ca să sugerezi»). The main column opens with T5's page-state card (Acasă is a T5
 * dashboard): «Încearcă din nou» re-reads the session on the server, and a retry that fails again
 * says so («Tot nu merge. Încercarea N.») — DashboardError owns that logic.
 */
export function HomeSessionError() {
  return (
    <DashboardError
      title="Nu am putut verifica contul tău"
      description="Datele tale nu s-au încărcat. Încearcă din nou în câteva momente."
      retry
    />
  );
}

'use client';

import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, MagnifyingGlassIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import { useBack } from '@/components/nav/useBack';
import { SignInGate } from '@/components/templates/SignInGate';
import { T4Frame, T4Gate, T4Header, type T4Back } from '@/components/templates/T4';
import { Button, ButtonLink } from '@/components/ui/Button';
import { isApiError } from '@/core/transport';
import { routes } from '@/lib/routes';

/*
 * The disclaimer's page-level states, each in the page's own frame (the header still says where the
 * visitor is): the session died / is unknown (from the server gate), the competition could not be
 * read / does not exist (from the client read), the viewer cannot register (c6, ./access).
 */

const TITLE = 'Câteva lucruri de menționat';

function Frame({ back, eyebrow, children }: { back: T4Back; eyebrow?: string; children: ReactNode }) {
  return (
    <T4Frame pageState label={TITLE} header={<T4Header title={TITLE} eyebrow={eyebrow} back={back} />}>
      {children}
    </T4Frame>
  );
}

/**
 * dead: the cookie is there but the CMS refused it — the template's one sign-in gate, back to this
 * page. unknown: the CMS did not answer the session read — never shown as signed out (owner rule 4):
 * «Serverul nu răspunde» and a retry that re-renders the server gate.
 */
export function DisclaimerSessionGate({ kind, competitionId }: { kind: 'dead' | 'unknown'; competitionId: string }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const goBack = useBack(routes.competition(competitionId));
  const back: T4Back = { label: 'Înapoi', onClick: goBack };
  if (kind === 'dead') {
    return (
      <Frame back={back}>
        <SignInGate
          title="Sesiunea ta a expirat"
          description="Intră din nou în cont, apoi revino aici pentru a-ți finaliza înscrierea."
          next={routes.competitionTeamDisclaimer(competitionId)}
          secondaryAction={
            <ButtonLink variant="secondary" href={routes.competition(competitionId)}>
              Înapoi la concurs
            </ButtonLink>
          }
        />
      </Frame>
    );
  }
  return (
    <Frame back={back}>
      <T4Gate
        tone="danger"
        role="alert"
        icon={<ExclamationTriangleIcon />}
        title="Serverul nu răspunde"
        description="Lucrăm la asta. Încearcă din nou în câteva minute."
        actions={
          <Button onClick={() => startRetry(() => router.refresh())} disabled={retrying} aria-busy={retrying || undefined}>
            Încearcă din nou
          </Button>
        }
      />
    </Frame>
  );
}

/** The competition read failed: unknown competition (404), or anything else with a retry. */
export function DisclaimerLoadError({
  back,
  error,
  retrying,
  onRetry,
}: {
  competitionId: string;
  back: T4Back;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
}) {
  if (isApiError(error) && error.status === 404) {
    return (
      <Frame back={back}>
        <T4Gate
          role="alert"
          icon={<MagnifyingGlassIcon />}
          title="Concursul nu există"
          description="Este posibil să fi fost șters sau ca linkul să fie greșit."
          actions={<ButtonLink href={routes.competitions()}>Vezi competițiile</ButtonLink>}
        />
      </Frame>
    );
  }
  return (
    <Frame back={back}>
      <T4Gate
        tone="danger"
        role="alert"
        icon={<ExclamationTriangleIcon />}
        title="Concursul nu a putut fi încărcat"
        description="Ceva nu a mers bine. Încearcă din nou în câteva momente."
        actions={
          <Button onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined}>
            Încearcă din nou
          </Button>
        }
      />
    </Frame>
  );
}

/**
 * c6 — the viewer cannot register here (rejected, the deadline passed, the limit reached, the
 * competition started / ended / was cancelled): fish's reason (NormalUserSheetItems
 * registrationDisabledMessage) and the way back to the competition. Never the copy, never an
 * active «Am înțeles» to the form.
 */
export function DisclaimerClosedGate({
  competitionId,
  competitionName,
  back,
  title,
  reason,
}: {
  competitionId: string;
  competitionName: string;
  back: T4Back;
  title: string;
  reason: string;
}) {
  return (
    <Frame back={back} eyebrow={competitionName}>
      <T4Gate
        role="status"
        icon={<NoSymbolIcon />}
        title={title}
        description={reason}
        actions={<ButtonLink href={routes.competition(competitionId)}>Înapoi la concurs</ButtonLink>}
      />
    </Frame>
  );
}

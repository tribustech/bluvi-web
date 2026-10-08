"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PencilSquareIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useBack } from "@/components/nav/useBack";
import {
  T4ActionBar,
  T4Frame,
  T4Header,
  T4Summary,
  type T4Back,
} from "@/components/templates/T4";
import { ButtonLink } from "@/components/ui/Button";
import {
  competitionQuery,
  type CompetitionWithMyStatus,
} from "@/core/competitions";
import { createBrowserTransport } from "@/lib/client/transport";
import { routes } from "@/lib/routes";
import { SetBreadcrumb } from "@/app/(site)/_shell/SiteHeader";
import { FishermanArt } from "../../_form/FishermanArt";
import { competitionFacts, disclaimerAccess } from "./access";
import { DisclaimerClosedGate, DisclaimerLoadError } from "./DisclaimerGates";
import { ART, CARDS, COLUMN, INTRO, RULE_CARD, RULE_DISC } from "./layout";
import { TeamDisclaimerSkeleton } from "./TeamDisclaimerSkeleton";

/*
 * «Câteva lucruri de menționat» — fish app/(app)/register/team-competition-disclaimer.tsx (parity
 * participant.team-disclaimer), T4 single step:
 *  - c1 the back control (fish BackButton: back when the page before is the site's, else the
 *    competition), the fisherman illustration, the title (the T4 header's h1; the competition's
 *    name is its eyebrow);
 *  - c2 the intro with «echipe» in accent ink AND semibold (never colour alone);
 *  - c3 / c4 the two cards with fish's exact copy, the emphasised spans in ink + semibold (fish
 *    sets them in the default ink against the grey body);
 *  - c5 «Am înțeles» is a link to the registration form (the shell's NavigationGuard drops a fast
 *    second activation — fish guardNavigation);
 *  - c6 only on the way to a NEW team registration (./access): a viewer who cannot register
 *    (rejected, deadline passed, limit reached, started / ended / cancelled — core
 *    registrationAction `disabled`, fish NormalUserSheetItems:24-35, 74-95) gets the reason and the
 *    way back, never the copy; a single competition, or a viewer who already has a pending /
 *    approved entry (target «register»), is replaced by the registration form. Until the
 *    competition is known the skeleton stands (owner rule 4), so nothing flashes.
 * Load failure: «Concursul nu a putut fi încărcat» + retry; an unknown competition: «Concursul nu
 * există» + the way back to the competitions.
 * Layout (./layout): phone = fish (centred column, the CTA in a bar on the bottom edge); from 768
 * the column on the header's axis, the cards side by side from 1024; from 1280 the column under
 * the title text and, on the right, the competition's facts (lake, dates, team size) with «Am
 * înțeles» docked under them. The cards keep fish's indigo outline (DisclaimerItem).
 *
 * «Modificări» (parity b.disclaimer-copy-mismatch, owner 2026-10-08): the behaviour stays fish's
 * (core registrationAction: an approved team can still edit its entry until the competition
 * starts) and the web copy says so. fish still has the old «nicio modificare» copy.
 */

const TITLE = "Câteva lucruri de menționat";

type Props = { competitionId: string; viewerId: string };

export function TeamDisclaimerScreen({ competitionId, viewerId }: Props) {
  const t = useMemo(() => createBrowserTransport(), []);
  const router = useRouter();
  const goBack = useBack(routes.competition(competitionId));
  const back: T4Back = { label: "Înapoi", onClick: goBack };
  const query = useQuery(
    competitionQuery(t, competitionId, { isAuthenticated: true }),
  );
  const competition = query.data;
  const register = routes.competitionRegister(competitionId);

  // c6: decided on the competition and the viewer's own registration (the /my-status overlay).
  const access = competition
    ? disclaimerAccess(competition, viewerId, new Date())
    : null;
  const sendOn = access?.kind === "sendOn";
  useEffect(() => {
    if (sendOn) router.replace(register);
  }, [sendOn, register, router]);

  if (!competition) {
    if (query.isError) {
      return (
        <DisclaimerLoadError
          competitionId={competitionId}
          back={back}
          error={query.error}
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      );
    }
    return <TeamDisclaimerSkeleton back={back} />;
  }
  if (access?.kind === "closed") {
    return (
      <DisclaimerClosedGate
        competitionId={competitionId}
        competitionName={competition.name}
        back={back}
        title={access.title}
        reason={access.reason}
      />
    );
  }
  if (sendOn)
    return <TeamDisclaimerSkeleton back={back} eyebrow={competition.name} />;
  return (
    <Disclaimer competition={competition} back={back} register={register} />
  );
}

function Disclaimer({
  competition,
  back,
  register,
}: {
  competition: CompetitionWithMyStatus;
  back: T4Back;
  register: string;
}) {
  const facts = competitionFacts(competition);
  const cta = (
    <ButtonLink href={register} data-testid="team-disclaimer-continue">
      Am înțeles
    </ButtonLink>
  );
  return (
    <>
      <SetBreadcrumb
        trail={[
          { label: "Competiții", href: routes.competitions() },
          {
            label: competition.name,
            href: routes.competition(competition.documentId),
          },
          { label: "Înscriere" },
        ]}
      />
      <T4Frame
        label={TITLE}
        header={
          <T4Header title={TITLE} eyebrow={competition.name} back={back} />
        }
        // From 1280: the facts in the right column, the CTA docked under them. Below: the bar on the
        // bottom edge (fish's footer button). One CTA element at every width.
        aside={
          facts.length ? (
            <T4Summary title="Despre concurs" rows={facts} />
          ) : undefined
        }
        actions={<T4ActionBar primary={cta} />}
      >
        <div className={COLUMN}>
          <FishermanArt className={ART} />
          <p className={INTRO}>
            Acesta este un concurs pe{" "}
            <strong className="font-semibold text-accent-ink">echipe</strong>,
            astfel vă rugăm să luați în considerare următoarele:
          </p>
          <div className={CARDS}>
            <RuleCard title="Înscrierea în concurs" icon={<UserGroupIcon />}>
              Doar{" "}
              <strong className="font-semibold text-ink">
                o singură persoană din echipă
              </strong>{" "}
              trebuie să facă înregistrarea în concurs și să adauge toți
              coechipierii. Aceștia vor fi înregistrați și notificați automat.
            </RuleCard>
            <RuleCard title="Modificări" icon={<PencilSquareIcon />}>
              Datele înscrierii pot fi modificate cât timp înscrierea așteaptă
              aprobarea organizatorului. După aprobare,{" "}
              <strong className="font-semibold text-ink">
                mai poți modifica echipa doar până începe concursul.
              </strong>
            </RuleCard>
          </div>
        </div>
      </T4Frame>
    </>
  );
}

/** fish DisclaimerItem: the indigo-outlined card, an accent-filled disc, the h2, the paragraph. */
function RuleCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={RULE_CARD}>
      <div className="flex items-start gap-3">
        <span aria-hidden className={RULE_DISC}>
          {icon}
        </span>
        <h2 className="t-heading min-w-0 flex-1 pt-0.5 text-ink">{title}</h2>
      </div>
      <p className="t-body text-muted">{children}</p>
    </section>
  );
}

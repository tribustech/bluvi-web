import { feederRoundActions, type CompetitionWithMyStatus } from '@/core/competitions';
import { supportsPenalties, type AllocatedParticipantsResponse } from '@/core/organizer';
import { routes } from '@/lib/routes';

/*
 * The organizer side of the competition page (parity competition-page.organizare, organizer.b.*),
 * as pure functions — the screens (OrganizerMenu, ActionsSheet, ActionBar) only draw what these say.
 *
 *  - organizerMenuOptions: fish CompetitionRanking `organizerMenuOptions` (the «Organizare» submenu
 *    of the bar, the header menu from 768).
 *  - organizerSheetItems / refereeSheetItems: fish OrganizerSheetItems / RefereeSheetItems (the
 *    «Acțiuni» sheet of the route tabs other than Clasament), with the disabled reasons.
 *  - addScaleItem: fish AddCantarSheetItem (organizer.b.scale-entries).
 *  - the conditions fish computes inline (stands exist, someone allocated, limit reached).
 *
 * fish's «Cere extra cântar» organizer-menu entry needs the author to be registered and not
 * registered at once, so fish never shows it (organizare.c8): it is not ported.
 */

export type CompetitionRole = 'author' | 'referee' | null;

/** Statute → the bar's role (fish UserRoleForBar): anything but author / referee is nobody. */
export const roleOf = (userRole: string | null | undefined): CompetitionRole =>
  userRole === 'author' ? 'author' : userRole === 'referee' ? 'referee' : null;

export type OrganizerCompetition = Pick<
  CompetitionWithMyStatus,
  | 'documentId'
  | 'competitionStatus'
  | 'rankingType'
  | 'sectors'
  | 'registrations'
  | 'participantsLimit'
  | 'roundsCount'
  | 'currentRound'
  | 'roundStatus'
>;

export type OrganizerIcon =
  | 'edit'
  | 'sectors'
  | 'participants'
  | 'guests'
  | 'start'
  | 'end'
  | 'scale'
  | 'weighings'
  | 'addReferee'
  | 'removeReferee'
  | 'penalties'
  | 'register';

/** A write that asks first (fish requiresConfirmation / the sheet's Alert). */
export type ConfirmRun = 'start' | 'end' | 'closeRound' | 'startNext';

export type OrganizerAction =
  | { type: 'link'; href: string }
  | { type: 'confirm'; run: ConfirmRun; round?: number; message: string }
  | { type: 'dialog'; dialog: 'cannotEdit' | 'addReferee' | 'removeReferee' };

export type OrganizerOption = {
  key: string;
  label: string;
  icon: OrganizerIcon;
  action: OrganizerAction;
};

/** One row of the «Acțiuni» sheet: closed rows say why (fish SheetItem disabledMessage). */
export type SheetItem = OrganizerOption & { disabled?: boolean; reason?: string };

/** fish doStandAllocationsExist: some sector has stands. */
export const standsExist = (c: Pick<OrganizerCompetition, 'sectors'>): boolean => c.sectors.some(s => s.stands.length > 0);

/** fish areSomeParticipantsAllocated: some stand of a sector has someone on it. */
export const someoneAllocated = (c: Pick<OrganizerCompetition, 'sectors'>, allocated: AllocatedParticipantsResponse | undefined): boolean =>
  !!allocated && c.sectors.some(s => s.stands.some(st => !!allocated[st.documentId]));

/** fish hasReachedParticipantsLimit: the approved count equals the limit (no limit → never). */
export const participantsLimitReached = (c: Pick<OrganizerCompetition, 'registrations' | 'participantsLimit'>): boolean =>
  c.participantsLimit === c.registrations.filter(r => r.registrationStatus === 'registered').length;

/** fish isLegClosed: a feeder leg closed, waiting for the next one (no weighing can be added). */
export const legClosed = (c: Pick<OrganizerCompetition, 'rankingType' | 'roundStatus'>): boolean =>
  c.rankingType === 'feederRounds' && c.roundStatus === 'closed';

export const START_QUESTION = 'Ești sigur că vrei să dai start competiției?';
export const END_QUESTION = 'Ești sigur că vrei să închei competiția?';
/** fish OrganizerSheetItems: a closed action says why under its label. */
export const STARTED_REASON = 'Competiția a început deja, nu se mai pot face modificări';
export const LIMIT_REASON = 'Numărul maxim de participanți a fost atins';
export const NO_STANDS_REASON = 'Te rugăm să aloci mai întâi standurile pe fiecare sector';

type MenuInput = {
  competition: OrganizerCompetition;
  role: CompetitionRole;
  /** Unknown while it loads: «Adaugă cântar» waits for it (owner rule 4), never shown on a guess. */
  allocated: AllocatedParticipantsResponse | undefined;
  /** Where the wizard returns to (fish returnTo: this page). */
  returnTo: string;
};

/** fish CompetitionRanking organizerMenuOptions (parity organizare c1, c2, c4, c7; organizer.b.competition-menu). */
export function organizerMenuOptions({ competition: c, role, allocated, returnTo }: MenuInput): OrganizerOption[] {
  if (role !== 'author') return [];
  const status = c.competitionStatus;
  if (status !== 'notStarted' && status !== 'started') return [];
  const id = c.documentId;
  const opts: OrganizerOption[] = [
    {
      key: 'modifica-competitia',
      label: 'Modifică competiția',
      icon: 'edit',
      action:
        status === 'notStarted'
          ? { type: 'link', href: routes.competitionEdit(id, 'detalii', { inapoi: returnTo }) }
          : { type: 'dialog', dialog: 'cannotEdit' },
    },
  ];
  const referees: OrganizerOption[] = [
    { key: 'adauga-arbitru', label: 'Adaugă arbitru', icon: 'addReferee', action: { type: 'dialog', dialog: 'addReferee' } },
    { key: 'sterge-arbitru', label: 'Șterge arbitru', icon: 'removeReferee', action: { type: 'dialog', dialog: 'removeReferee' } },
  ];

  if (status === 'notStarted') {
    opts.push({ key: 'aloca-standuri', label: 'Alocă standuri pe sectoare', icon: 'sectors', action: { type: 'link', href: routes.competitionSectors(id) } });
    if (standsExist(c)) {
      opts.push({
        key: 'aloca-participanti',
        label: 'Alocă participanții pe standuri',
        icon: 'participants',
        action: { type: 'link', href: routes.competitionAllocation(id) },
      });
    }
    if (!participantsLimitReached(c)) {
      opts.push({
        key: 'participanti-fara-cont',
        label: 'Adaugă participanți fără cont',
        icon: 'guests',
        action: { type: 'link', href: routes.competitionRegisterGuests(id) },
      });
    }
    opts.push({ key: 'start-end', label: 'Start concurs', icon: 'start', action: { type: 'confirm', run: 'start', message: START_QUESTION } });
    opts.push(...referees);
    return opts;
  }

  // started
  if (standsExist(c) && someoneAllocated(c, allocated) && !legClosed(c)) {
    opts.push({ key: 'adauga-cantar', label: 'Adaugă cântar', icon: 'scale', action: { type: 'link', href: routes.competitionScale(id) } });
  }
  opts.push(...referees);
  if (supportsPenalties(c.rankingType)) {
    opts.push({ key: 'penalizari', label: 'Penalizări', icon: 'penalties', action: { type: 'link', href: routes.competitionPenalties(id) } });
  }
  opts.push(...endOptions(c));
  return opts;
}

/** The feeder leg actions, or «Încheie concurs» (fish legItems / start-end; organizare c6 c7). */
export function endOptions(c: OrganizerCompetition): OrganizerOption[] {
  const legItems = (feederRoundActions(c) ?? []).filter(a => a.kind !== 'end');
  if (legItems.length === 0) {
    return [{ key: 'start-end', label: 'Încheie concurs', icon: 'end', action: { type: 'confirm', run: 'end', message: END_QUESTION } }];
  }
  return legItems.map(a =>
    a.kind === 'allocateNext'
      ? { key: `leg-${a.kind}`, label: a.label, icon: 'participants', action: { type: 'link', href: routes.competitionAllocation(c.documentId, a.round) } }
      : {
          key: `leg-${a.kind}`,
          label: a.label,
          icon: a.kind === 'startNext' ? 'start' : 'end',
          action: { type: 'confirm', run: a.kind as 'closeRound' | 'startNext', round: a.round, message: a.confirmation ?? '' },
        },
  );
}

/**
 * fish AddCantarSheetItem (organizare c13, organizer.b.scale-entries): «Adaugă cântar» while it
 * runs, «Vezi cântarele din concurs» otherwise; closed before the start or until someone is seated.
 */
export function addScaleItem(c: OrganizerCompetition, allocated: AllocatedParticipantsResponse | undefined): SheetItem {
  const status = c.competitionStatus;
  const disabled = status === 'notStarted' || !(standsExist(c) && someoneAllocated(c, allocated));
  return {
    key: 'adauga-cantar',
    label: status === 'started' ? 'Adaugă cântar' : 'Vezi cântarele din concurs',
    icon: 'scale',
    action: { type: 'link', href: routes.competitionScale(c.documentId) },
    disabled,
    reason: disabled ? (status !== 'started' ? 'Competiția încă nu a început' : 'Te rugăm să aloci mai întâi participanții pe standuri') : undefined,
  };
}

/** fish OrganizerSheetItems' «Înscrie-te» (its own rule, not the angler's): label, closed state, why. */
export function organizerRegisterItem(
  c: OrganizerCompetition & Pick<CompetitionWithMyStatus, 'userRegistrationStatus' | 'registrationDeadline'>,
  href: string,
  now: Date,
): SheetItem {
  const status = c.userRegistrationStatus;
  const registrationClosed =
    c.competitionStatus === 'started' || (c.registrationDeadline ? now.getTime() > new Date(c.registrationDeadline).getTime() : false);
  const limit = participantsLimitReached(c);
  let reason = status === 'rejected' ? 'Cererea ta de a te înscrie în această competiție a fost respinsă.' : status === 'registered' ? 'Nu se mai pot face modificări' : 'Termenul pentru înscriere a expirat';
  if (limit && status !== 'registered') reason = LIMIT_REASON;
  const disabled = registrationClosed || status === 'rejected' || limit;
  return {
    key: 'inscrie-te',
    label: status === 'pending' || status === 'registered' ? 'Modifică înscrierea' : 'Înscrie-te',
    icon: 'register',
    action: { type: 'link', href },
    disabled,
    reason: disabled ? reason : undefined,
  };
}

/**
 * fish OrganizerSheetItems (organizare c12): completed → only «Vezi cântarele din concurs»;
 * otherwise Înscrie-te, Start / Încheie concurs, the referees, the guests, the two allocations, the
 * add-weighing item (the extra-scale item is the page's, ActionsSheet). Web: on a feeder competition
 * that runs, the leg actions stand where «Încheie concurs» is (the bar's rule, organizare c7) — fish's
 * sheet would end the competition in the middle of a leg.
 */
export function organizerSheetItems({
  competition: c,
  allocated,
  registrationHref,
  now,
}: {
  competition: OrganizerCompetition & Pick<CompetitionWithMyStatus, 'userRegistrationStatus' | 'registrationDeadline'>;
  allocated: AllocatedParticipantsResponse | undefined;
  registrationHref: string;
  now: Date;
}): SheetItem[] {
  const id = c.documentId;
  const status = c.competitionStatus;
  if (status === 'completed') {
    return [{ key: 'vezi-cantare', label: 'Vezi cântarele din concurs', icon: 'weighings', action: { type: 'link', href: routes.competitionScale(id) } }];
  }
  const notStarted = status === 'notStarted';
  const limit = participantsLimitReached(c);
  const startEnd: SheetItem[] = notStarted
    ? [{ key: 'start-end', label: 'Start concurs', icon: 'start', action: { type: 'confirm', run: 'start', message: START_QUESTION } }]
    : endOptions(c);
  return [
    organizerRegisterItem(c, registrationHref, now),
    ...startEnd,
    { key: 'adauga-arbitru', label: 'Adaugă arbitru', icon: 'addReferee', action: { type: 'dialog', dialog: 'addReferee' } },
    { key: 'sterge-arbitru', label: 'Șterge arbitru', icon: 'removeReferee', action: { type: 'dialog', dialog: 'removeReferee' } },
    {
      key: 'participanti-fara-cont',
      label: 'Adaugă participanți fără cont',
      icon: 'guests',
      action: { type: 'link', href: routes.competitionRegisterGuests(id) },
      disabled: !notStarted || limit,
      reason: !notStarted ? STARTED_REASON : limit ? LIMIT_REASON : undefined,
    },
    {
      key: 'aloca-standuri',
      label: 'Alocă standuri pe sectoare',
      icon: 'sectors',
      action: { type: 'link', href: routes.competitionSectors(id) },
      disabled: !notStarted,
      reason: !notStarted ? STARTED_REASON : undefined,
    },
    {
      key: 'aloca-participanti',
      label: 'Alocă participanții pe standuri',
      icon: 'participants',
      action: { type: 'link', href: routes.competitionAllocation(id) },
      disabled: !notStarted || !standsExist(c),
      reason: !notStarted ? STARTED_REASON : !standsExist(c) ? NO_STANDS_REASON : undefined,
    },
    addScaleItem(c, allocated),
  ];
}

/** fish RefereeSheetItems: the add-weighing item only. */
export const refereeSheetItems = (c: OrganizerCompetition, allocated: AllocatedParticipantsResponse | undefined): SheetItem[] => [addScaleItem(c, allocated)];

/** fish actionsAllowed && competitionStarted (organizare c14): the scale is open to the author or a referee while it runs. */
export const canWeigh = (role: CompetitionRole, status: string | undefined): boolean => role !== null && status === 'started';

/**
 * fish RankingActionBar «Penalizări» (bara-actiuni c10): everyone but the author (who has it in the
 * menu), on a ranking type that supports penalties, once the ranking shows (not before the start).
 */
export const penaltiesTile = (role: CompetitionRole, rankingType: string | null | undefined, status: string | undefined): boolean =>
  role !== 'author' && supportsPenalties(rankingType) && !!status && status !== 'notStarted';

/** fish RankingActionBar «Adaugă cântar» (organizare c11): a referee once the ranking shows. */
export const refereeScaleTile = (role: CompetitionRole, status: string | undefined): boolean =>
  role === 'referee' && (status === 'started' || status === 'completed');

/** The toast of a successful write (fish showSuccessToast). */
export function successToast(run: ConfirmRun, round?: number): string {
  switch (run) {
    case 'start':
      return 'Competiția a fost începută cu succes';
    case 'end':
      return 'Competiția a fost încheiată cu succes';
    case 'closeRound':
      return `Manșa ${round} a fost închisă`;
    case 'startNext':
      return `Manșa ${round} a început`;
  }
}

/**
 * fish's Alert style 'destructive' (CompetitionActionSheet.tsx:160,190): the irreversible writes that
 * notify every participant and follower (start, end, close a leg) confirm with the danger button.
 */
export const confirmTone = (run: ConfirmRun): 'danger' | 'primary' => (run === 'startNext' ? 'primary' : 'danger');

/** The sheet's own confirmation (fish Alert): «Închide» and the verb («Start» / «Încheie»). */
export function sheetConfirmLabel(run: ConfirmRun): string {
  return run === 'start' ? 'Start' : run === 'end' ? 'Încheie' : run === 'closeRound' ? 'Închide manșa' : 'Pornește';
}

/** fish RefereeRemoverBottomSheet: the competition's referees whose name holds the search (any case). */
export function refereeOptions(referees: { documentId: string; username: string }[], search: string): { id: string; label: string }[] {
  const q = search.toLowerCase();
  return referees.map(r => ({ id: r.documentId, label: r.username })).filter(o => o.label.toLowerCase().includes(q));
}

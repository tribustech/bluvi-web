'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CDN_PURGE_SETTLE_MS, competitionsKeys, rankingsKeys, type CompetitionWithMyStatus } from '@/core/competitions';
import {
  addCompetitionRefereeMutation,
  closeFeederRoundMutation,
  deleteCompetitionRefereeMutation,
  endCompetitionMutation,
  startCompetitionMutation,
  startNextFeederRoundMutation,
  type AllocatedParticipantsResponse,
} from '@/core/organizer';
import type { Transport } from '@/core/transport';
import { useSiteToast } from '../../../../_shell/Toast';
import type { BarConfirm } from '../ActionBar';
import { CannotEditDialog } from './CannotEditDialog';
import { ConfirmActionDialog } from './ConfirmActionDialog';
import { confirmTone, organizerMenuOptions, sheetConfirmLabel, successToast, type CompetitionRole, type ConfirmRun, type OrganizerOption } from './model';
import { RefereeAddDialog } from './RefereeAddDialog';
import { RefereeRemoveDialog } from './RefereeRemoveDialog';

/*
 * The organizer's actions on the competition page (parity competition-page.organizare): the menu's
 * options (model.ts), the questions before a write, the writes themselves and their toasts, and the
 * dialogs they open (cannot edit, add / remove a referee). One owner for every entry point: the
 * phone bar's «Organizare» submenu (asks in the bar, as fish's RankingActionBar), the header menu
 * from 768 and the «Acțiuni» sheet (an alert dialog, as fish's Alert).
 *
 * The writes notify REAL people (start / end push to every participant and the followers): they run
 * only from an answered question, never twice while one is in flight. After a write fish re-reads
 * the competition (and, after the start, the ranking); the competition is edge-cached, so the web
 * reads it again once the CDN purge has landed (CDN_PURGE_SETTLE_MS, as the registration form).
 */

type Ask = { run: ConfirmRun; round?: number; message: string; from: 'menu' | 'sheet' | 'bar' };

export function useOrganizer({
  t,
  competition,
  role,
  allocated,
}: {
  t: Transport;
  competition: CompetitionWithMyStatus | undefined;
  role: CompetitionRole;
  allocated: AllocatedParticipantsResponse | undefined;
}) {
  const qc = useQueryClient();
  const toast = useSiteToast();
  const pathname = usePathname() ?? '';
  const id = competition?.documentId ?? '';
  const start = useMutation(startCompetitionMutation(t, qc));
  const end = useMutation(endCompetitionMutation(t, qc));
  const closeRound = useMutation(closeFeederRoundMutation(t, qc));
  const startNext = useMutation(startNextFeederRoundMutation(t, qc));
  const addReferee = useMutation(addCompetitionRefereeMutation(t));
  const removeReferee = useMutation(deleteCompetitionRefereeMutation(t));
  const [ask, setAsk] = useState<Ask | null>(null);
  const [dialog, setDialog] = useState<'cannotEdit' | 'addReferee' | 'removeReferee' | null>(null);
  const writing = start.isPending || end.isPending || closeRound.isPending || startNext.isPending;

  const menu: OrganizerOption[] = competition ? organizerMenuOptions({ competition, role, allocated, returnTo: pathname }) : [];

  const rereadCompetition = (alsoRanking = false) => {
    const read = () => {
      void qc.invalidateQueries({ queryKey: competitionsKeys.byId(id) });
      if (alsoRanking) void qc.invalidateQueries({ queryKey: rankingsKeys.byCompetitionId(id) });
    };
    read();
    window.setTimeout(read, CDN_PURGE_SETTLE_MS);
  };

  const run = (a: Ask) => {
    setAsk(null);
    if (writing || !id) return;
    const onSuccess = () => toast(successToast(a.run, a.round), 'success');
    const onError = (err: Error) => toast(err.message, 'danger');
    if (a.run === 'start') start.mutate(id, { onSuccess, onError, onSettled: () => rereadCompetition(true) });
    else if (a.run === 'end') end.mutate(id, { onSuccess, onError, onSettled: () => rereadCompetition() });
    // core invalidateLegState re-reads the competition, the seating, the ranking, the weighings.
    else if (a.run === 'closeRound') closeRound.mutate(id, { onSuccess, onError, onSettled: () => rereadCompetition() });
    else startNext.mutate(id, { onSuccess, onError, onSettled: () => rereadCompetition() });
  };

  /** A non-link entry was chosen (links navigate by themselves). */
  const choose = (option: Pick<OrganizerOption, 'action'>, from: Ask['from']) => {
    const a = option.action;
    if (a.type === 'dialog') setDialog(a.dialog);
    else if (a.type === 'confirm' && !writing) setAsk({ run: a.run, round: a.round, message: a.message, from });
  };

  const refereeSettled = () => rereadCompetition();
  const onAddReferee = (documentId: string) =>
    addReferee.mutate(
      { competitionId: id, documentId },
      {
        onSuccess: () => {
          setDialog(null);
          toast('Arbitrul a fost adăugat cu succes', 'success');
        },
        onError: err => {
          setDialog(null);
          toast(err.message, 'danger');
        },
        onSettled: refereeSettled,
      },
    );
  const onRemoveReferee = (refereeId: string) =>
    removeReferee.mutate(
      { competitionId: id, refereeId },
      {
        onSuccess: () => {
          setDialog(null);
          toast('Arbitrul a fost șters cu succes', 'success');
        },
        onError: err => {
          setDialog(null);
          toast(err.message, 'danger');
        },
        onSettled: refereeSettled,
      },
    );

  /** The phone bar's question (fish pendingConfirm): «Anulează» / «Confirmă» in place of the tiles. */
  const barConfirm: BarConfirm | null =
    ask?.from === 'bar' ? { question: ask.message, tone: confirmTone(ask.run), onConfirm: () => run(ask), onCancel: () => setAsk(null) } : null;

  const dialogs: ReactNode =
    role === 'author' && competition ? (
      <>
        <ConfirmActionDialog
          open={!!ask && ask.from !== 'bar'}
          question={ask?.message ?? ''}
          cancelLabel={ask?.from === 'sheet' ? 'Închide' : 'Anulează'}
          confirmLabel={ask?.from === 'sheet' ? sheetConfirmLabel(ask.run) : 'Confirmă'}
          confirmVariant={ask ? confirmTone(ask.run) : 'primary'}
          onCancel={() => setAsk(null)}
          onConfirm={() => ask && run(ask)}
        />
        <CannotEditDialog open={dialog === 'cannotEdit'} onClose={() => setDialog(null)} />
        <RefereeAddDialog open={dialog === 'addReferee'} onClose={() => setDialog(null)} t={t} busy={addReferee.isPending} onAdd={onAddReferee} />
        <RefereeRemoveDialog
          open={dialog === 'removeReferee'}
          onClose={() => setDialog(null)}
          referees={competition.referees}
          busy={removeReferee.isPending}
          onRemove={onRemoveReferee}
        />
      </>
    ) : null;

  return { menu, choose, barConfirm, dialogs, writing };
}

export type OrganizerController = ReturnType<typeof useOrganizer>;

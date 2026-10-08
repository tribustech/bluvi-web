'use client';

import { useLivePartide } from '../../../../_live';
import type { MemberTabProps } from '../types';
import { CoopCard } from './CoopCard';
import { DetailsList } from './DetailsList';
import { EditRows } from './EditRows';
import { MemberActions, ReportRow } from './MemberActions';
import { PublicSwitch } from './PublicSwitch';
import { SyncRow } from './SyncRow';

/*
 * The member view's «Setări» tab (parity partide.partida-setari; fish features/partide/scenes/
 * InfoScene.tsx): the co-op card (c1, c2), «Raportează o problemă» (c3), «Detalii» (c4),
 * «Editează» (c5, c6), «Sincronizare» (c7), «Partidă publică» (c8) and the member actions (c9).
 *
 * Every confirmation (finish, leave, kick, rotate, delete, feedback) and the adjust map are the
 * frame's (MemberView); this tab only triggers them. Its own writes — target species, stand +
 * anchor, visibility — go to the CMS (PATCH /feed/sessions/:id via the live repo), never Firestore.
 *
 * Editing needs the live, subscribed partidă (fish: the meta setters work on the live session only):
 * an ended partidă — or one still open but not followed live here — lists its settings read-only
 * under «Detalii» and has no «Editează».
 *
 * Layout: one column on the phone, in fish's order; from 1024 two columns — Detalii + Editează on
 * the left, the co-op card, the switches and the actions on the right.
 */

export default function SetariTab(props: MemberTabProps) {
  const { session, isEnded, isOwner, isLive, canMutateMembership, canDelete } = props;
  const { uid } = useLivePartide();
  const editable = isLive && !isEnded;
  const active = !isEnded && canMutateMembership;

  return (
    <div data-testid="partida-setari" className="flex flex-col gap-3 px-4 md:px-0 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
      <div className="flex flex-col gap-3 max-lg:contents lg:gap-5">
        <div className="max-lg:order-3">
          <DetailsList session={session} isEnded={isEnded} readOnly={!editable} />
        </div>
        {editable ? (
          <div className="max-lg:order-4">
            <EditRows session={session} onAdjustPosition={props.onAdjustPosition} />
          </div>
        ) : null}
      </div>

      {/* lg:pt-5.5 — the left column's first card starts under its «DETALII» label (14 + 8): the card tops align. */}
      <div className="flex flex-col gap-3 max-lg:contents lg:gap-5 lg:pt-5.5">
        {session.joinCode ? (
          <div className="max-lg:order-1">
            <CoopCard
              joinCode={session.joinCode}
              members={session.members ?? []}
              hostUid={session.hostUid ?? null}
              viewerUid={uid ?? null}
              canShareJoinCode={!isEnded}
              canManageMembers={active && isOwner}
              canRotateJoinCode={active && isOwner}
              onKickMember={props.onKickMember}
              onRotateJoinCode={props.onRotateJoinCode}
            />
          </div>
        ) : null}
        <div className="max-lg:order-2">
          <ReportRow onReport={props.onReportProblem} />
        </div>
        <div className="max-lg:order-5">
          <SyncRow />
        </div>
        <div className="max-lg:order-6">
          <PublicSwitch session={session} editable={editable && isOwner} />
        </div>
        <div className="max-lg:order-7 lg:order-last">
          <MemberActions
            showLeave={active && !isOwner}
            showFinish={active && isOwner}
            canDelete={canDelete}
            onLeave={props.onLeaveSession}
            onFinish={props.onFinish}
            onDelete={props.onDeleteSession}
          />
        </div>
      </div>
    </div>
  );
}

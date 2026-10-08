import type { LocalEvent, LocalSession, SessionMember } from '@/core/partide';

/*
 * The contract every member-view tab receives from the frame (fish helpers/partidaTabs.ts
 * `SceneProps`). The frame owns every confirmation surface and its handler; a tab only triggers
 * them (fish: a modal mounted inside a pager page wedged its touch responder — on the web the
 * reason is simply one host per page).
 */
export type MemberTabProps = {
  /** The Strapi documentId (the route id). */
  documentId: string;
  session: LocalSession;
  /** Ascending by occurredAt. */
  events: LocalEvent[];
  isEnded: boolean;
  isOwner: boolean;
  /** The live, subscribed partidă (the realtime projection), not a CMS history read. */
  isLive: boolean;
  /** Active membership actions stay hidden until host identity and a Strapi documentId are known. */
  canMutateMembership: boolean;
  /** Owner + resolved documentId — delete works on live AND ended partide. */
  canDelete: boolean;
  onFinish: () => void;
  onLeaveSession: () => void;
  onKickMember: (member: SessionMember) => void;
  onRotateJoinCode: () => void;
  /** Opens the adjust map — on `center` when given (a stand just chosen), else on the anchor. */
  onAdjustPosition: (center?: { lat: number; lng: number }) => void;
  onDeleteSession: () => void;
  onReportProblem: () => void;
};

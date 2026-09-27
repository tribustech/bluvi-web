/** fish `features/chat/domain/systemMessages.ts` — ported verbatim (pure). */
import type { ChatSystemLink } from './types';

export type SystemIcon = 'flag' | 'scale' | 'trophy' | 'warning' | 'user' | 'lock' | 'users' | 'pin' | 'info';

const ICONS: Record<string, SystemIcon> = {
  'competition:start': 'flag',
  'competition:end': 'flag',
  'competition:participants-allocation': 'pin',
  'competition:weighing-end': 'scale',
  'competition:weighing-modified': 'scale',
  'competition:extra-request': 'scale',
  'competition:podium': 'trophy',
  'competition:penalty': 'warning',
  'registration:registered': 'user',
  'registration:cancelled': 'user',
  'chat:closing': 'lock',
  'chat:closed': 'lock',
};

/** Unknown events (newer CMS) get a neutral icon — never a crash. */
export function systemIconFor(event: string | undefined): SystemIcon {
  return (event && ICONS[event]) || 'info';
}

/** Call-to-action text for a tappable system card; null when the link is not tappable. */
export function systemLinkLabel(link: ChatSystemLink | undefined): string | null {
  if (!hasSystemLink(link)) return null;
  switch (link?.kind) {
    case 'ranking':
      return 'Vezi clasamentul';
    case 'allocation':
      return 'Vezi alocarea';
    case 'registrations':
      return 'Vezi participanții';
    case 'penalties':
      return 'Vezi penalizările';
    case 'weighing':
      return 'Vezi cântărirea';
    default:
      return null;
  }
}

/**
 * Cheap render-time check: does this link produce a tappable href? This is the single source of
 * truth for "is this link valid" — `systemLinkHref` calls it first, so the two can never diverge.
 * Deliberately does not need a `competitionId` (that's an href concern, checked separately by
 * `systemLinkHref`) or compute a (timestamped) href — for deciding whether to show the chevron /
 * wrap the row in a pressable, not for navigating.
 */
export function hasSystemLink(link: ChatSystemLink | undefined): boolean {
  if (!link) return false;
  switch (link.kind) {
    case 'ranking':
    case 'allocation':
    case 'registrations':
    case 'penalties':
      return true;
    case 'weighing': {
      const { standId, standName } = link.params ?? {};
      return !!link.id && !!standId && !!standName;
    }
    default:
      return false;
  }
}

// fish `systemLinkHref` (expo-router href builder) is not ported: navigation targets are a UI
// concern and the web's routes differ. `hasSystemLink` stays the single validity check.

/** Emoji prefixes the CMS copy starts with; the app shows its own icon instead. */
const COPY_EMOJI = ['🏁', '📍', '⚖️', '⚖', '🥇', '🥈', '🥉', '🏆', '⚠️', '⚠', '⛔', '👤', '🔒'];

/** The copy without its leading emoji, for rows that draw their own icon. */
export function systemBodyFor(text: string | undefined): string {
  const trimmed = (text ?? '').trim();
  const emoji = COPY_EMOJI.find(prefix => trimmed.startsWith(prefix));
  return emoji ? trimmed.slice(emoji.length).trim() : trimmed;
}

/** Only the room itself (closing) is announced in Participanți; competition events live in General. */
const PARTICIPANTS_ROOM_EVENTS = new Set(['chat:closing', 'chat:closed']);

/**
 * Whether a message belongs on screen in a room. Older CMS builds posted every event to both rooms
 * (and sign-ups to Participanți only); those docs stay in Firestore, so the app filters them out.
 */
export function isVisibleInRoom(message: { type?: string; event?: string }, roomId: string): boolean {
  if (roomId !== 'participants' || message.type !== 'system') return true;
  return !!message.event && PARTICIPANTS_ROOM_EVENTS.has(message.event);
}

export type PodiumInfo = { place: number; stand: string | null; name: string };

/**
 * Place and team of a podium message: from `data` (CMS ≥ 2026-09-25) or, for older docs, read back
 * from the copy ("🥇 F6 · Ana Dinu urcă pe locul 1 [cu 18,300 kg]."; older still: "trece pe locul").
 * The team label is "<stand> · <name>" when the stand is known.
 */
export function podiumInfoOf(message: {
  event?: string;
  text?: string;
  data?: Record<string, string | number>;
}): PodiumInfo | null {
  if (message.event !== 'competition:podium') return null;
  const body = systemBodyFor(message.text);
  const match = /^(.*?)\s+(?:urcă|trece) pe locul (\d+)\b/.exec(body);
  const dataPlace = Number(message.data?.place);
  const place = Number.isFinite(dataPlace) && dataPlace > 0 ? dataPlace : match ? Number(match[2]) : NaN;
  if (!Number.isFinite(place)) return null;
  if (message.data?.name != null) {
    return {
      place,
      stand: message.data.stand != null ? String(message.data.stand) : null,
      name: String(message.data.name),
    };
  }
  const team = String(message.data?.team ?? match?.[1] ?? '').trim();
  const [first, ...rest] = team.split(' · ');
  return rest.length ? { place, stand: first, name: rest.join(' · ') } : { place, stand: null, name: team };
}

export type SystemParts = {
  /** Stand label ("A1", "S3/12"), drawn as a chip. */
  stand?: string;
  /** Team / angler name, or the whole line for events that are not about a team. */
  name?: string;
  /** What happened, e.g. "Cântar · 2 pești, 12,450 kg". */
  detail?: string;
};

const splitTeam = (label: string): SystemParts => {
  const [first, ...rest] = label.split(' · ');
  return rest.length ? { stand: first, name: rest.join(' · ') } : { name: label };
};

/**
 * A system message broken into stand / name / detail, so the row can lead with who it is about.
 * `data` (CMS ≥ 2026-09-25) gives stand and name directly; older docs are read back from the copy,
 * which follows the CMS templates in `chat-system-messages.ts`. Anything unrecognised is shown whole.
 */
export function systemPartsFor(message: {
  event?: string;
  text?: string;
  data?: Record<string, string | number>;
}): SystemParts {
  const body = systemBodyFor(message.text).replace(/\.$/, '');
  let parts: SystemParts | null = null;
  let match: RegExpExecArray | null;
  switch (message.event) {
    case 'competition:weighing-end':
      if ((match = /^(.+?): (.+)$/.exec(body))) parts = { ...splitTeam(match[1]), detail: `Cântar · ${match[2]}` };
      break;
    case 'competition:penalty':
      if ((match = /^Avertisment pentru (.+?): (.+)$/.exec(body)))
        parts = { ...splitTeam(match[1]), detail: `Avertisment · ${match[2]}` };
      else if ((match = /^Eliminare (.+?): (.+)$/.exec(body)))
        parts = { ...splitTeam(match[1]), detail: `Eliminare · ${match[2]}` };
      else if ((match = /^(.+?): penalizare (.+)$/.exec(body)))
        parts = { ...splitTeam(match[1]), detail: `Penalizare ${match[2]}` };
      break;
    case 'competition:podium': {
      const podium = podiumInfoOf(message);
      if (podium)
        parts = {
          ...(podium.stand ? { stand: podium.stand } : {}),
          name: podium.name,
          detail: `Urcă pe locul ${podium.place}`,
        };
      break;
    }
    case 'registration:registered':
      if ((match = /^(.+) s-a înscris$/.exec(body))) parts = { name: match[1], detail: 'S-a înscris' };
      break;
    case 'registration:cancelled':
      if ((match = /^(.+) a renunțat$/.exec(body))) parts = { name: match[1], detail: 'A renunțat' };
      break;
    case 'competition:weighing-modified':
      if ((match = /^Cântarul de la (.+) a fost modificat$/.exec(body)))
        parts = { stand: match[1], detail: 'Cântar modificat' };
      break;
    case 'competition:extra-request':
      if ((match = /^(.+) a cerut cântar extra$/.exec(body)))
        parts = { stand: match[1], detail: 'A cerut cântar extra' };
      break;
  }
  if (!parts) return { name: systemBodyFor(message.text) };
  const stand = message.data?.stand != null ? String(message.data.stand) : parts.stand;
  const name = message.data?.name != null ? String(message.data.name) : parts.name;
  return { ...(stand ? { stand } : {}), ...(name ? { name } : {}), ...(parts.detail ? { detail: parts.detail } : {}) };
}

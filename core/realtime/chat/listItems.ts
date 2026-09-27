/** fish `features/chat/domain/listItems.ts` — ported verbatim (pure). */
import { formatCount, formatDayLabel, getDayKey } from './format';
import { podiumInfoOf } from './systemMessages';
import type {
  ChatListItem,
  ChatListMessage,
  ChatMessageItem,
  DateSeparatorItem,
  NewMessagesSeparatorItem,
  SystemGroupItem,
} from './types';

export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function isDateSeparatorItem(item: ChatListItem): item is DateSeparatorItem {
  return item.type === 'date-separator';
}
export function isNewMessagesSeparatorItem(item: ChatListItem): item is NewMessagesSeparatorItem {
  return item.type === 'new-messages-separator';
}
export function isSystemGroupItem(item: ChatListItem): item is SystemGroupItem {
  return item.type === 'system-group';
}
export function isMessageItem(item: ChatListItem): item is ChatMessageItem {
  return !isDateSeparatorItem(item) && !isNewMessagesSeparatorItem(item) && !isSystemGroupItem(item);
}

/** The messages a row stands for: one for a message row, all of them for a group. */
export function messagesOfItem(item: ChatListItem): ChatListMessage[] {
  if (isMessageItem(item)) return [item];
  if (isSystemGroupItem(item)) return item.messages;
  return [];
}

/** Newest message of a room vs the reader's own receipt. */
export function hasUnreadMessage(
  newest: { createdAtMs: number; senderId: string } | null,
  lastReadAtMs: number,
  currentUserId?: string
): boolean {
  if (!newest) return false;
  if (currentUserId && newest.senderId === currentUserId) return false;
  return newest.createdAtMs > lastReadAtMs;
}

const timeOf = (message: ChatListMessage, nowMs: number) => message.createdAt?.toMillis?.() ?? nowMs;
const dayKeyOf = (message: ChatListMessage, now: Date) => getDayKey(message.createdAt?.toDate?.() ?? now);

/**
 * Chronological messages → list rows: date chips, the "Mesaje noi" divider and each message with
 * its position inside a sender group (same sender, ≤ 5 min apart, nothing in between).
 */
export function buildChatListItems(
  messages: ChatListMessage[],
  {
    unreadAfterMs,
    unreadBoundaryLoaded,
    currentUserId,
    now = new Date(),
  }: { unreadAfterMs: number; unreadBoundaryLoaded: boolean; currentUserId?: string; now?: Date }
): ChatListItem[] {
  const nowMs = now.getTime();
  const items: ChatListItem[] = [];
  // Whether the previous message row can still be extended by the next message.
  let openGroupSender: string | null = null;
  let openGroupLastTime = 0;
  let openGroupLastIndex = -1; // index in `items` of the last message of the open group

  let prevDay: string | null = null;
  let prevTime = 0;
  messages.forEach((message, index) => {
    const prev = messages[index - 1];
    const time = timeOf(message, nowMs);
    const day = dayKeyOf(message, now);

    let separated = false;
    if (day !== prevDay) {
      items.push({
        id: `date-${day}`,
        type: 'date-separator',
        label: formatDayLabel(message.createdAt?.toDate?.(), now),
      });
      separated = true;
    }
    const isUnreadBoundary =
      unreadBoundaryLoaded &&
      unreadAfterMs > 0 &&
      message.senderId !== currentUserId &&
      time > unreadAfterMs &&
      (!prev || prevTime <= unreadAfterMs);
    if (isUnreadBoundary) {
      items.push({ id: 'new-messages', type: 'new-messages-separator' });
      separated = true;
    }

    const isSystem = message.type === 'system';
    const continuesGroup =
      !separated && !isSystem && openGroupSender === message.senderId && time - openGroupLastTime <= GROUP_WINDOW_MS;

    if (continuesGroup) {
      const prevItem = items[openGroupLastIndex] as ChatMessageItem;
      prevItem.groupPosition = prevItem.groupPosition === 'single' ? 'first' : 'middle';
      items.push({ ...message, groupPosition: 'last' });
    } else {
      items.push({ ...message, groupPosition: 'single' });
    }
    openGroupLastIndex = items.length - 1;
    openGroupSender = isSystem ? null : message.senderId;
    openGroupLastTime = time;
    prevDay = day;
    prevTime = time;
  });

  return items;
}

/**
 * Routine, high-volume events that fold into a group. Everything else — start/end, allocation,
 * penalties, chat closing, and any event this build does not know — always stays on its own row:
 * those are the moments the room must not hide. Podium moves follow almost every weighing, so they
 * fold too, except the latest change of leader (see `latestLeaderMessageId`).
 */
const GROUPABLE_EVENTS = new Set([
  'competition:podium',
  'competition:weighing-end',
  'competition:weighing-modified',
  'competition:extra-request',
  'registration:registered',
  'registration:cancelled',
]);
export const MIN_SYSTEM_GROUP_SIZE = 2;

const PODIUM_EVENT = 'competition:podium';

/** The place a podium message announces; null when unknown — the message then folds with the others. */
export function podiumPlaceOf(message: Pick<ChatListMessage, 'event' | 'text' | 'data'>): number | null {
  return podiumInfoOf(message)?.place ?? null;
}

/** Newest "new leader" message of the loaded room: the one podium move shown on its own, highlighted. */
export function latestLeaderMessageId(chronological: ChatListMessage[]): string | null {
  for (let index = chronological.length - 1; index >= 0; index--) {
    const message = chronological[index];
    if (!message.deletedAt && podiumPlaceOf(message) === 1) return message.id;
  }
  return null;
}

const isGroupable = (item: ChatListItem, leaderId: string | null): item is ChatMessageItem =>
  isMessageItem(item) &&
  item.type === 'system' &&
  !!item.event &&
  GROUPABLE_EVENTS.has(item.event) &&
  item.id !== leaderId;

/**
 * Folds runs of ≥ 2 consecutive routine system rows into one `system-group` row. Date chips, the
 * "Mesaje noi" divider, people's messages and important events all break a run. The group is keyed
 * by its oldest event, so new events joining the run keep it open/closed as the reader left it.
 * Open or closed, a group is ONE row: expanded, it draws its events inside its own card, so they
 * never read as loose messages.
 */
export function collapseSystemRuns(
  items: ChatListItem[],
  expandedIds: ReadonlySet<string>,
  leaderId: string | null = null
): ChatListItem[] {
  const result: ChatListItem[] = [];
  let run: ChatMessageItem[] = [];
  const flush = () => {
    if (run.length >= MIN_SYSTEM_GROUP_SIZE) {
      const id = `system-group-${run[0].id}`;
      result.push({ id, type: 'system-group', messages: run, expanded: expandedIds.has(id) });
    } else {
      result.push(...run);
    }
    run = [];
  };
  for (const item of items) {
    if (isGroupable(item, leaderId)) {
      run.push(item);
      continue;
    }
    flush();
    result.push(item);
  }
  flush();
  return result;
}

type SystemFamily = { events: string[]; singular: string; plural: string };
const FAMILIES: SystemFamily[] = [
  { events: ['competition:weighing-end'], singular: 'cântărire', plural: 'cântăriri' },
  { events: [PODIUM_EVENT], singular: 'schimbare pe podium', plural: 'schimbări pe podium' },
  { events: ['competition:weighing-modified'], singular: 'cântărire modificată', plural: 'cântăriri modificate' },
  { events: ['competition:extra-request'], singular: 'cerere de cântar extra', plural: 'cereri de cântar extra' },
  { events: ['registration:registered'], singular: 'înscriere', plural: 'înscrieri' },
  { events: ['registration:cancelled'], singular: 'retragere', plural: 'retrageri' },
];

/** "8 cântăriri · 3 înscrieri", biggest family first. */
export function systemGroupBreakdown(messages: ChatListMessage[]): string {
  return FAMILIES.map(family => ({
    family,
    count: messages.filter(message => !!message.event && family.events.includes(message.event)).length,
  }))
    .filter(entry => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .map(entry => formatCount(entry.count, entry.family.singular, entry.family.plural))
    .join(' · ');
}

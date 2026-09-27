import type { NotificationPreferenceGroup, NotificationPreferences } from '../schemas';

/*
 * fish `features/notifications/domain/preferenceState.ts` — per-competition notification mute
 * state, over the DTO of fish `models/notification-preferences.type.ts`.
 */

export function mutedTypesOf(dto: NotificationPreferences): string[] {
  const fromCatalog = dto.groups.flatMap(group => group.types.filter(type => type.muted).map(type => type.key));
  const deduped = [...fromCatalog];
  for (const key of dto.extraMuted ?? []) {
    if (!deduped.includes(key)) deduped.push(key);
  }
  return deduped;
}

/** `on` = the user wants the notification, i.e. the key leaves the muted list. */
export function toggleType(muted: string[], key: string, on: boolean): string[] {
  if (on) return muted.filter(k => k !== key);
  return muted.includes(key) ? muted : [...muted, key];
}

export function toggleGroup(muted: string[], group: NotificationPreferenceGroup, on: boolean): string[] {
  return group.types.reduce((acc, type) => toggleType(acc, type.key, on), muted);
}

export function groupState(muted: string[], group: NotificationPreferenceGroup): 'on' | 'off' | 'partial' {
  const count = group.types.filter(type => muted.includes(type.key)).length;
  if (count === 0) return 'on';
  if (count === group.types.length) return 'off';
  return 'partial';
}

/**
 * Applies a submitted `mutedTypes` list to a DTO for an optimistic cache write:
 * each catalog type's `muted` is recomputed from the list, and any submitted
 * key the catalog doesn't know about (e.g. a chat-room key) becomes the new
 * `extraMuted`, in the order it appears in `mutedTypes`.
 */
export function applyMutedTypes(dto: NotificationPreferences, mutedTypes: string[]): NotificationPreferences {
  const catalogKeys = new Set(dto.groups.flatMap(group => group.types.map(type => type.key)));
  const muted = new Set(mutedTypes);
  return {
    ...dto,
    groups: dto.groups.map(group => ({
      ...group,
      types: group.types.map(type => ({ ...type, muted: muted.has(type.key) })),
    })),
    extraMuted: mutedTypes.filter(key => !catalogKeys.has(key)),
  };
}

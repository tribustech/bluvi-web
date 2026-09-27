import type { NotificationPreferences } from '../schemas';

/**
 * fish `features/notifications/domain/preferenceState.ts#applyMutedTypes`.
 *
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

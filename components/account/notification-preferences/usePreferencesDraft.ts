'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  competitionNotificationPreferencesQuery,
  mutedTypesOf,
  toggleGroup,
  toggleType,
  updateCompetitionNotificationPreferencesMutation,
  type NotificationPreferenceGroup,
} from '@/core/competitions';
import { createBrowserTransport } from '@/lib/client/transport';

/**
 * The panel's state — fish FollowNotificationsSheet lines 49-69 (parity account.notification-
 * preferences c6, c10, c12):
 *  - the competition's preference groups load only while the panel is open (core query, staleTime
 *    60 s — a follow prefetches them, so the celebrate panel opens filled);
 *  - the switches edit a LOCAL muted list; nothing is written until `save`;
 *  - the draft follows the server's state until the angler touches a switch (fish's [isOpen, data]
 *    effect, done in render: no frame with the stale list): every opening takes the cached answer,
 *    and a fresher one (the refetch the opening triggers, after a mute set on the phone) replaces
 *    it while the draft is untouched — so «Salvează» never PUTs a stale list. The first toggle
 *    makes the draft `dirty`; from then on no answer overwrites it. Web deviation: fish's effect
 *    also re-ran on the optimistic write and its rollback after a failed save and threw the
 *    angler's choices away; here a failed save keeps them (dirty stays set), ready for the retry
 *    the toast asks for. While a save is in flight nothing syncs (the cache holds the optimistic
 *    value). Closing clears `dirty`, so a close without saving never shows its edits next time;
 *    a successful save clears it too;
 *  - `save` PUTs the whole list: mutedTypesOf keeps the `extraMuted` keys the catalog does not show
 *    (the chat bell's rooms), so the panel never unmutes them. The core mutation updates the cache
 *    optimistically, rolls it back on an error and refetches the followed-competitions list.
 */
export function usePreferencesDraft(competitionId: string, open: boolean) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const query = useQuery(competitionNotificationPreferencesQuery(t, competitionId, open));
  const update = useMutation(updateCompetitionNotificationPreferencesMutation(t, qc, competitionId));
  const [muted, setMuted] = useState<string[]>([]);
  // The server answer the draft last took (undefined: none this opening) and whether the angler
  // has touched a switch since.
  const [synced, setSynced] = useState<typeof query.data>(undefined);
  const [dirty, setDirty] = useState(false);
  if (open && query.data && query.data !== synced && !dirty && !update.isPending) {
    setSynced(query.data);
    setMuted(mutedTypesOf(query.data));
  }
  if (!open && (synced !== undefined || dirty)) {
    setSynced(undefined);
    setDirty(false);
  }

  return {
    data: query.data,
    /** Nothing to show yet (the panel's four skeleton rows). */
    loading: open && query.isPending,
    /** The groups could not be read (and none are cached). */
    failed: query.isError && !query.data,
    muted,
    setGroup: (group: NotificationPreferenceGroup, on: boolean) => {
      setDirty(true);
      setMuted(m => toggleGroup(m, group, on));
    },
    setType: (key: string, on: boolean) => {
      setDirty(true);
      setMuted(m => toggleType(m, key, on));
    },
    saving: update.isPending,
    /**
     * Resolves on success (the draft is clean again), rejects on failure (the cache is already
     * rolled back; the draft keeps the angler's edits).
     */
    save: async () => {
      const saved = await update.mutateAsync(muted);
      setDirty(false);
      return saved;
    },
  };
}

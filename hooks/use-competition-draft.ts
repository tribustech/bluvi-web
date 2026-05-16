"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CompetitionDraftState,
  defaultCompetitionDraft,
  organizerDraftStorageKey,
} from "@/lib/organizer-draft";

export function useCompetitionDraft() {
  const [draft, setDraft] = useState<CompetitionDraftState>(defaultCompetitionDraft);

  useEffect(() => {
    const raw = window.localStorage.getItem(organizerDraftStorageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as CompetitionDraftState;
      setDraft({
        ...defaultCompetitionDraft,
        ...parsed,
      });
    } catch {
      window.localStorage.removeItem(organizerDraftStorageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(organizerDraftStorageKey, JSON.stringify(draft));
  }, [draft]);

  return useMemo(
    () => ({
      draft,
      setDraft,
      resetDraft: () => setDraft(defaultCompetitionDraft),
    }),
    [draft],
  );
}

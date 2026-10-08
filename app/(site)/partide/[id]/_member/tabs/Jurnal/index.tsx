"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MapIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useSiteToast } from "@/app/(site)/_shell/Toast";
import {
  fakeLive,
  liveSource,
  OFFLINE_WRITE_MESSAGE,
  useLivePartide,
  useOnline,
} from "@/app/(site)/partide/_live";
import { useCaptureFlow } from "@/components/partide/capture";
import { ConfirmSurface } from "@/components/partide/dialogs/shared";
import {
  MarkerTypeIcon,
  PartidaMapDialog,
  PartidaMapView,
} from "@/components/partide/map/PartidaMap";
import {
  ShareCatchSheet,
  type ShareCatchRecord,
  type ShareCatchTarget,
} from "@/components/partide/share/ShareCatchSheet";
import { ResponsiveSurface } from "@/components/surfaces/ResponsiveSurface";
import { useBreakpoint } from "@/components/surfaces/useBreakpoint";
import { COLUMN_STICKY_TOP_BELOW_TABS } from "@/components/templates/T3/metrics";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import {
  EMPTY_JURNAL_FILTER,
  eventMeta,
  eventPhotoUri,
  fmtClock,
  invalidateCommunityAfterCatch,
  MAP_MARKER_LABEL,
  MARKER_SCOPE,
  retryWrite,
  sameVenue,
  sessionVenueRef,
  filterEvents,
  type JurnalFilter,
  type LocalEvent,
  type LocalMarker,
  type MapMarkerType,
  type OutcomeFilter,
} from "@/core/partide";
import { eventGone, waitForProjection } from "@/core/realtime/partide/live";
import { venueName } from "../../model";
import type { MemberTabProps } from "../types";
import { EmptyJurnal } from "./EmptyJurnal";
import { FilterChips } from "./FilterChips";
import { JurnalRow, JurnalTableHead } from "./JurnalRow";

/*
 * The member view's «Jurnal» tab (parity partide.partida-jurnal; fish
 * features/partide/scenes/JurnalScene.tsx, spec fish docs/superpowers/specs/2026-08-07-jurnal-registru-design.md).
 *
 *  - c1 filter chips (outcome × rod, combined; a change resets the paging);
 *  - c2 newest first, 30 rows at a time (more as the end of the list comes into view, or «Arată
 *    mai multe»);
 *  - c3 the register row (./JurnalRow): fish's row below 1280, a timeline with every column from
 *    1280 (owner rule 14);
 *  - c4/c5 a row opens the share dialog (components/partide/share): a capture's card, or the record
 *    of a scăpat / fără trăsătură; on a live partidă also «Editează captura» (the capture flow in
 *    edit mode) and «Șterge captura»;
 *  - c6 delete: «Ștergi această înregistrare?» → the row dims with «Ștergem captura…» until the
 *    projection drops it (fish waitForProjection + eventGone, capped at 2.5 s); offline refused at
 *    once; failure → toast. Also fish's long-press shortcut (./JurnalRow);
 *  - c7 empty / filtered-empty; c8 «Captură» (live only, dimmed offline) + «Hartă» — floating at the
 *    bottom on the phone (fish), in the toolbar from 768;
 *  - c9/c10 the map (components/partide/map/PartidaMap): the filtered non-blank located events and
 *    the venue's markers; long-press / right-click / «Adaugă reper» → «Adaugă un reper» (off until
 *    the projection carries markers — see markersProjected); a marker → «Ștergi reperul?». A dialog
 *    below 1280; from 1280 a side panel beside the timeline (open by itself only from 1440, and only
 *    with something to plot).
 *
 * Writes mirror fish exactly: a catch delete is an HTTP DELETE to the CMS (the live repo's
 * deleteCatch, retried — fish useRodActions.removeEvent — then the community refresh); a marker is
 * the ONE write fish makes straight to Firestore (sessionRepo writeMarker / deleteMarker on the live
 * session's `markers` subcollection, fire-and-report), through the live source — the e2e fake
 * records it instead. fish's write gates are kept, and made honest: every action needs the live,
 * subscribed partidă (fish reads the event / the active session from the live store — on a partidă
 * not followed here its delete silently did nothing and a marker landed on whatever was live).
 */

/** fish PAGE_SIZE: the register mounts 30 rows at a time. */
const PAGE_SIZE = 30;

/*
 * Adding a marker is OFF on the web until the CMS projection carries markers (it is built with
 * `markers: []` — fish parks the feature): a reper the user places would never appear, so they
 * would retry, and every retry leaves an orphan document in the ONE shared Firestore project.
 * Owner rule 4 — don't offer what we can't show. Proposal: docs/private/cms-patches/M4-markers.md.
 * The e2e fake can switch it on (`markersProjected`) so the add flow stays tested for the day the
 * projection carries them; never in a production build (fakeLive() is null there).
 */
const markersProjected = (): boolean =>
  (fakeLive() as { markersProjected?: boolean } | null)?.markersProjected ===
  true;

/** From 1440 the map panel may open by itself — at 1280 it would squeeze the timeline. */
const WIDE_QUERY = "(min-width: 1440px)";
const subscribeWide = (cb: () => void) => {
  const l = window.matchMedia(WIDE_QUERY);
  l.addEventListener("change", cb);
  return () => l.removeEventListener("change", cb);
};
const useWide = () =>
  useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );

const toTarget = (e: LocalEvent): ShareCatchTarget => ({
  key: e.clientId,
  photoUrl: eventPhotoUri(e),
  weightKg: e.weightKg,
  species: e.species,
  occurredAt: new Date(e.occurredAt).toISOString(),
});

const toRecord = (e: LocalEvent): ShareCatchRecord | null =>
  e.outcome === "capture"
    ? null
    : {
        outcome: e.outcome,
        rodIndex: e.rodIndex,
        rodColor: e.rodColor,
        meta: eventMeta(e),
        time: fmtClock(e.occurredAt),
      };

export default function JurnalTab({
  documentId,
  session,
  events,
  isEnded,
  isLive,
}: MemberTabProps) {
  const live = useLivePartide();
  const qc = useQueryClient();
  const toast = useSiteToast();
  const online = useOnline();
  const capture = useCaptureFlow(documentId);
  const desktop = useBreakpoint() === "desktop";
  const canWrite = isLive && !isEnded;
  const name = venueName(session);

  /* ── filter + paging (c1, c2) ──────────────────────────────────────── */
  const [filter, setFilter] = useState<JurnalFilter>(EMPTY_JURNAL_FILTER);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const toggleOutcome = useCallback((o: OutcomeFilter) => {
    setFilter((f) => ({
      ...f,
      outcomes: f.outcomes.includes(o)
        ? f.outcomes.filter((x) => x !== o)
        : [...f.outcomes, o],
    }));
    setVisibleCount(PAGE_SIZE);
  }, []);
  const toggleRod = useCallback((idx: number) => {
    setFilter((f) => ({
      ...f,
      rodIndexes: f.rodIndexes.includes(idx)
        ? f.rodIndexes.filter((x) => x !== idx)
        : [...f.rodIndexes, idx],
    }));
    setVisibleCount(PAGE_SIZE);
  }, []);
  // Events arrive ascending (the stats depend on it); the Jurnal shows the newest first.
  const filtered = useMemo(
    () =>
      [...filterEvents(events, filter)].sort(
        (a, b) => b.occurredAt - a.occurredAt,
      ),
    [events, filter],
  );
  const rows = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const hasMore = visibleCount < filtered.length;
  const loadMore = useCallback(
    () => setVisibleCount((c) => (c >= filtered.length ? c : c + PAGE_SIZE)),
    [filtered.length],
  );
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "0px 0px 400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  /* ── share / edit (c4, c5) ─────────────────────────────────────────── */
  const [shareEvent, setShareEvent] = useState<LocalEvent | null>(null);
  const openShare = useCallback((e: LocalEvent) => setShareEvent(e), []);
  const shareTarget = useMemo(
    () => (shareEvent ? toTarget(shareEvent) : null),
    [shareEvent],
  );
  const shareRecord = useMemo(
    () => (shareEvent ? toRecord(shareEvent) : null),
    [shareEvent],
  );

  /* ── delete (c6) ───────────────────────────────────────────────────── */
  // Deletes in flight — local on purpose (fish): the next snapshot would flatten a global layer.
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const runDelete = useCallback(
    async (clientId: string) => {
      // Offline is a certain failure — say so at once instead of a dimmed row through 5.5 s of backoff.
      if (!online) {
        toast(OFFLINE_WRITE_MESSAGE, "danger");
        return;
      }
      setPendingDeleteIds((ids) =>
        ids.includes(clientId) ? ids : [...ids, clientId],
      );
      try {
        // fish removeEvent: only an event of this session's projection; the CMS deletes it in
        // Postgres and rebuilds the projection (retried on transient failures — idempotent by id).
        const e = live.read().events[clientId];
        if (e && e.sessionClientId === session.clientId) {
          const repo = await live.repo();
          const removed = retryWrite(() =>
            repo.deleteCatch(session.clientId, clientId),
          );
          void removed.then(
            () => invalidateCommunityAfterCatch(qc),
            () => {},
          );
          await removed;
        }
      } catch (err) {
        console.error("[partide jurnal delete]", err);
        setPendingDeleteIds((ids) => ids.filter((id) => id !== clientId));
        toast("Nu am putut șterge captura. Încearcă din nou.", "danger");
        return;
      }
      // Keep the pending look until the projection drops the row — never a flicker back to normal.
      await waitForProjection(
        live.subscribeState,
        eventGone(live.read, clientId),
      );
      setPendingDeleteIds((ids) => ids.filter((id) => id !== clientId));
    },
    [live, online, qc, session.clientId, toast],
  );
  const confirmDelete = useCallback(
    (e: LocalEvent) => {
      if (!canWrite) return;
      setConfirmDeleteId(e.clientId);
    },
    [canWrite],
  );

  /* ── capture (c8) ──────────────────────────────────────────────────── */
  const onCapture = () => {
    // Offline blocks actions — a capture is a write.
    if (!online) {
      toast(OFFLINE_WRITE_MESSAGE, "danger");
      return;
    }
    capture.open({ kind: "free" });
  };

  /* ── map + markers (c9, c10) ───────────────────────────────────────── */
  const [mapOpen, setMapOpen] = useState(false);
  const wide = useWide();
  // null = the viewer has not chosen: open by itself only from 1440 and only with something to
  // plot (owner rule 4 — no empty dark map beside «Liniște pe baltă…»). «Hartă» opens it on demand.
  const [panelPref, setPanelPref] = useState<boolean | null>(null);
  const anchor = useMemo(
    () => ({ lat: session.anchorLat, lng: session.anchorLng }),
    [session.anchorLat, session.anchorLng],
  );
  const venue = useMemo(() => sessionVenueRef(session), [session]);
  const markersMap = live.state.markers;
  const markers = useMemo(
    () => Object.values(markersMap).filter((m) => sameVenue(m.venue, venue)),
    [markersMap, venue],
  );
  const mapEvents = useMemo(
    () =>
      filtered.filter(
        (e) => e.outcome !== "blank" && e.lat != null && e.lng != null,
      ),
    [filtered],
  );
  const plottable = useMemo(
    () =>
      events.some(
        (e) => e.outcome !== "blank" && e.lat != null && e.lng != null,
      ),
    [events],
  );
  const panelOpen = panelPref ?? (wide && (plottable || markers.length > 0));
  const setPanelOpen = setPanelPref;
  const [canAddMarker] = useState(markersProjected);
  const [addAt, setAddAt] = useState<{ lat: number; lng: number } | null>(null);
  const [removeMarkerId, setRemoveMarkerId] = useState<string | null>(null);

  const addMarkerAt = useCallback(
    (coord: { lat: number; lng: number }) => {
      // A marker is a write — offline is refused with fish's toast.
      if (!online) {
        toast(OFFLINE_WRITE_MESSAGE, "danger");
        return;
      }
      setAddAt(coord);
    },
    [online, toast],
  );
  const dropMarker = useCallback(
    (type: MapMarkerType) => {
      const coord = addAt;
      setAddAt(null);
      // fish useMapMarkers.add: markers attach to the LIVE session's subcollection; none → no-op.
      const active = live.read().active;
      if (!coord || !active || !live.uid) return;
      const scope = MARKER_SCOPE[type];
      const marker: LocalMarker = {
        type,
        lat: coord.lat,
        lng: coord.lng,
        label: null,
        venue,
        clientId: crypto.randomUUID(),
        serverId: null,
        syncStatus: "pending",
        clientUpdatedAt: Date.now(),
        scope,
        sessionClientId: scope === "session" ? active.sessionId : null,
      };
      void liveSource()
        .writeMarker(active.sessionId, live.uid, marker)
        .catch((err) => console.error("[partide marker]", err));
    },
    [addAt, live, venue],
  );
  const onPressMarker = useCallback(
    (clientId: string) => setRemoveMarkerId(clientId),
    [],
  );
  const removeMarker = () => {
    const clientId = removeMarkerId;
    setRemoveMarkerId(null);
    // fish useMapMarkers.removeMarker: the live session, a marker it knows.
    const active = live.read().active;
    if (!clientId || !active || !live.uid || !live.read().markers[clientId])
      return;
    void liveSource()
      .deleteMarker(active.sessionId, live.uid, clientId)
      .catch((err) => console.error("[partide marker]", err));
  };

  const mapProps = {
    center: anchor,
    captures: mapEvents,
    markers,
    onAddAt: canWrite && canAddMarker ? addMarkerAt : undefined,
    onPressMarker: canWrite ? onPressMarker : undefined,
  };
  const panel = desktop && panelOpen;
  const onMap = () => (desktop ? setPanelOpen(!panelOpen) : setMapOpen(true));

  /* ── render ────────────────────────────────────────────────────────── */
  const captureButton = (floating: boolean) =>
    !isEnded && isLive ? (
      <button
        type="button"
        onClick={onCapture}
        aria-disabled={!online || undefined}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-1.75 rounded-full bg-ink t-body-strong text-surface transition-[opacity,filter] duration-(--duration-fast) ease-fast hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-85",
          floating ? "h-12 px-6 shadow-e2" : "h-10 px-4.5",
          !online && "opacity-50",
        )}
      >
        <PlusIcon aria-hidden className="size-4.5 stroke-[2.6]" />
        Captură
      </button>
    ) : null;
  const mapButton = (floating: boolean) => (
    <button
      type="button"
      data-testid="jurnal-map-button"
      onClick={onMap}
      aria-haspopup={desktop ? undefined : "dialog"}
      aria-expanded={desktop ? panelOpen : undefined}
      aria-controls={desktop ? "jurnal-map-panel" : undefined}
      className={cn(
        "flex cursor-pointer items-center justify-center gap-1.75 rounded-full t-body-strong transition-colors duration-(--duration-fast) ease-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-85",
        floating
          ? "h-12 bg-surface px-6 text-ink shadow-e2"
          : "h-10 border-[1.5px] px-4",
        !floating &&
          (desktop && panelOpen
            ? "border-accent bg-accent-tint text-accent-ink"
            : "border-hairline bg-surface text-ink hover:bg-soft-fill"),
      )}
    >
      <MapIcon aria-hidden className="size-4.5" />
      Hartă
    </button>
  );

  return (
    <div
      data-testid="jurnal"
      data-count={filtered.length}
      data-shown={rows.length}
      className="flex flex-col md:gap-4"
    >
      {/* toolbar: the chips; from 768 the actions beside them */}
      <div className="flex flex-col gap-3 border-b border-hairline bg-surface px-4 pt-2.5 pb-2.5 md:flex-row md:items-center md:justify-between md:rounded-card md:border-0 md:px-4 md:py-3 md:shadow-e0">
        <FilterChips
          filter={filter}
          rods={session.rods}
          onToggleOutcome={toggleOutcome}
          onToggleRod={toggleRod}
        />
        <div className="flex shrink-0 items-center gap-2 max-md:hidden">
          {captureButton(false)}
          {mapButton(false)}
        </div>
      </div>

      <div
        className={cn(
          "flex flex-col",
          panel &&
            // The register keeps its compact width (owner rule 16); the map takes the rest.
            "xl:grid xl:grid-cols-[minmax(527px,max-content)_minmax(280px,1fr)] xl:items-start xl:gap-4",
        )}
      >
        <section
          aria-label="Înregistrări"
          className={cn(
            "overflow-hidden bg-surface md:rounded-card md:shadow-e0",
            panel && "xl:max-w-[720px]",
          )}
        >
          {rows.length ? (
            <>
              <JurnalTableHead />
              <ol data-testid="jurnal-list">
                {rows.map((e) => (
                  <JurnalRow
                    key={e.clientId}
                    event={e}
                    pending={pendingDeleteIds.includes(e.clientId)}
                    onOpen={openShare}
                    onDelete={canWrite ? confirmDelete : undefined}
                  />
                ))}
              </ol>
              {hasMore ? (
                <div
                  ref={sentinel}
                  className="flex justify-center border-t border-hairline p-3"
                >
                  <Button variant="ghost" size="compact" onClick={loadMore}>
                    Arată mai multe
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyJurnal hasEvents={events.length > 0} />
          )}
        </section>

        {panel ? (
          <aside
            id="jurnal-map-panel"
            aria-labelledby="jurnal-map-title"
            data-testid="jurnal-map-panel"
            className={cn(
              "hidden flex-col overflow-hidden rounded-card bg-surface shadow-e0 xl:sticky xl:flex xl:h-[calc(100dvh_-_--spacing(39)_-_var(--shell-banner-h,0px))] xl:max-h-[760px]",
              COLUMN_STICKY_TOP_BELOW_TABS,
            )}
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline py-2 pr-2 pl-4">
              <h2 id="jurnal-map-title" className="t-heading">
                Hartă
              </h2>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Închide harta"
                className="flex size-9 cursor-pointer items-center justify-center rounded-control text-ink-2 hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-accent"
              >
                <XMarkIcon aria-hidden className="size-5" />
              </button>
            </header>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <PartidaMapView
                {...mapProps}
                variant="panel"
                onClose={() => setPanelOpen(false)}
              />
            </div>
          </aside>
        ) : null}
      </div>

      {/* phone: fish's floating action row, bottom centre — sticky to the screen's bottom edge while
          the register is in view, so it never covers the summary that follows the tab */}
      <div className="sticky bottom-[max(--spacing(4),env(safe-area-inset-bottom))] z-sticky flex justify-center gap-2.5 pt-4 pb-2 md:hidden">
        {captureButton(true)}
        {mapButton(true)}
      </div>

      {capture.guard}

      <ShareCatchSheet
        target={shareTarget}
        record={shareRecord}
        lakeName={name}
        onClose={() => setShareEvent(null)}
        // No editing once the partidă is over (fish: the write path drops edits to a finished one).
        onEdit={
          canWrite && shareEvent?.outcome === "capture"
            ? () => {
                const id = shareEvent.clientId;
                setShareEvent(null);
                capture.open({ kind: "edit", eventClientId: id });
              }
            : undefined
        }
        onDelete={
          canWrite && shareEvent
            ? () => {
                const ev = shareEvent;
                setShareEvent(null);
                confirmDelete(ev);
              }
            : undefined
        }
      />

      <ConfirmSurface
        open={confirmDeleteId != null}
        onClose={() => setConfirmDeleteId(null)}
        title="Ștergi această înregistrare?"
        dismissLabel="Închide"
        confirmLabel="Șterge"
        testId="jurnal-delete"
        onConfirm={() => {
          const id = confirmDeleteId;
          setConfirmDeleteId(null);
          if (id) void runDelete(id);
        }}
      />

      <PartidaMapDialog
        open={mapOpen && !desktop}
        {...mapProps}
        onClose={() => setMapOpen(false)}
      />

      <ResponsiveSurface
        open={addAt != null}
        onClose={() => setAddAt(null)}
        intent="decision"
        title="Adaugă un reper"
        sheetSnap="fit"
        actions={
          <Button
            type="button"
            variant="outline"
            className="max-md:w-full"
            onClick={() => setAddAt(null)}
          >
            Anulează
          </Button>
        }
      >
        <div data-testid="jurnal-add-marker" className="flex flex-col gap-3">
          <p className="t-body text-muted">Ce ai găsit aici?</p>
          <div className="grid gap-2 md:grid-cols-3">
            {(["hardSpot", "baited", "snag"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => dropMarker(t)}
                className="flex h-12 cursor-pointer items-center gap-2.5 rounded-control border-[1.5px] border-hairline bg-surface px-3.5 t-body-strong text-ink hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:flex-col md:justify-center md:gap-1 md:py-3 md:h-auto"
              >
                <MarkerTypeIcon
                  type={t}
                  className={cn(
                    "size-5",
                    t === "hardSpot"
                      ? "text-yellow-6"
                      : t === "baited"
                        ? "text-success"
                        : "text-muted",
                  )}
                />
                {MAP_MARKER_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      </ResponsiveSurface>

      <ConfirmSurface
        open={removeMarkerId != null}
        onClose={() => setRemoveMarkerId(null)}
        title="Ștergi reperul?"
        dismissLabel="Închide"
        confirmLabel="Șterge"
        testId="jurnal-remove-marker"
        onConfirm={removeMarker}
      />
    </div>
  );
}

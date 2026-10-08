'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fishesQuery, getLakeLocationSubtitle, lakeQuery, PUBLIC_WATER_TYPE_LABEL, type LakeDetailStand } from '@/core/lakes';
import {
  anchorCoord,
  mergeSpeciesChips,
  resolveDefaultTargets,
  sameSpecies,
  sessionFromInput,
  sortCatalog,
  toCatalogFish,
  type TargetSpecies,
  type VenueSelection,
} from '@/core/partide';
import { ANCHOR_ZOOM, COUNTRY_ZOOM, MapPointPicker, ROMANIA_CENTER } from '@/components/partide/map/MapPointPicker';
import { SpeciesPicker } from '@/components/partide/species/SpeciesPicker';
import { StandPicker } from '@/components/partide/stand/StandPicker';
import { useBack } from '@/components/nav/useBack';
import { T4ActionBar, T4Frame, T4Header, T4Progress, type T4Step } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { browserPublicWaters } from '../../../ape-publice/_components/client-source';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { useSiteToast } from '../../../_shell/Toast';
import { useLivePartide } from '../../_live';
import { AnchorPreview } from './AnchorPreview';
import { DurationSection, PositionAside, PositionSection, PublicSection, SpeciesSection, VenueCard } from './DetailStep';
import { useStartLocation } from './location';
import { ALREADY_ACTIVE, DEFAULT_DURATION_MS, START_ERROR, parseCoordinates, startFailureOf, startInput, venueLocalityLine, type Coord } from './model';
import { countyOfPoint } from './pinPoint';
import { DetailSkeleton } from './StartSkeleton';
import { VenueStep } from './VenueStep';

/*
 * «Începe o partidă» (fish app/(app)/partide/start.tsx; parity partide.incepe, T4 — two steps):
 *   1. the venue (./VenueStep): search, suggestions, a pin on the map;
 *   2. the details (./DetailStep): stand / position, duration, species, visibility, «Începe partida».
 * `?balta=<lakeId>` / `?apa=<linkCode>` (the «Începe o partidă aici» buttons of a lake / water page)
 * preselect that venue once and open step 2 (c15).
 *
 * The write is fish's useStartPartida: the CMS creates the session (POST /feed/sessions, through
 * the live repo — it mints the Firestore projection and the join code; the web writes NOTHING to
 * Firestore), the pointer is claimed (useLivePartide().setActive, which follows the new session),
 * then the page is replaced with /partide/[documentId] (c13). A live pointer on this browser refuses
 * locally, the CMS's one-live-partidă guard remotely: both → «Ai deja o partidă activă» + that
 * partidă (c14).
 *
 * Layout: T4 — the header (back · «Începe o partidă» · «Pasul n din 2») with the segment bar; from
 * 1280 the same segments at the top of the step (no rail: two steps need no column) and, on step 2,
 * the position preview large in the right column with «Începe partida» docked under it.
 */

const STEP_TITLES = { venue: 'Locul', detail: 'Detalii' } as const;
const TRAIL = [{ label: 'Partide', href: routes.partide() }, { label: 'Începe o partidă' }];
const TITLE = 'Începe o partidă';
const TITLE_ID = 'start-partida-title';

type Step = 'venue' | 'detail';

export function StartFlow({ balta, apa }: { balta: string | null; apa: string | null }) {
  const live = useLivePartide();
  const t = live.transport;
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useSiteToast();
  const leave = useBack(routes.partide());
  const location = useStartLocation();

  const [step, setStep] = useState<Step>(balta || apa ? 'detail' : 'venue');
  const [sel, setSel] = useState<VenueSelection | null>(null);
  const [anchor, setAnchor] = useState<Coord | null>(null);
  const [anchorName, setAnchorName] = useState('');
  const [stand, setStand] = useState<LakeDetailStand | null>(null);
  const [pinCounty, setPinCounty] = useState<string | null>(null);
  const [plannedDurationMs, setPlannedDurationMs] = useState(DEFAULT_DURATION_MS);
  const [customDuration, setCustomDuration] = useState(false);
  const [targetSpecies, setTargetSpecies] = useState<TargetSpecies[]>([]);
  const [visibleOnProfile, setVisibleOnProfile] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustCenter, setAdjustCenter] = useState<Coord | null>(null);
  const [standOpen, setStandOpen] = useState(false);
  const [speciesOpen, setSpeciesOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  // The lake's detail: its coordinates seed the anchor when the selection has none (a search
  // result), its stands drive the «Stand» selector.
  const lakeId = sel?.kind === 'lake' ? sel.lakeId : null;
  const lake = useQuery({ ...lakeQuery(t, lakeId ?? '', { enabled: !!lakeId }), retry: 1 });
  const lakeCoord = useMemo(() => (lakeId ? parseCoordinates(lake.data?.coordinates) : null), [lakeId, lake.data]);
  const stands = useMemo(() => (lakeId ? (lake.data?.stands ?? []) : []), [lakeId, lake.data]);
  // fish: the anchor once the detail lands (`setAnchor(prev => prev ?? c)`), derived here.
  const effectiveAnchor = anchor ?? lakeCoord;
  // The red «fix the position» prompt only once we KNOW the lake has no coordinates.
  const lakeHasNoCoord = !!lakeId && lake.isFetched && !lakeCoord;
  const anchorLoading = !effectiveAnchor && !!lakeId && !lakeHasNoCoord;

  /* ── venue selection ──────────────────────────────────────────────────── */
  const handleSelect = useCallback(
    (venue: VenueSelection, county?: string | null) => {
      setSel(venue);
      setStand(null);
      setAnchorName('');
      if (venue.kind === 'lake') {
        // Same 0/0 junk-row rejection as parseCoordinates (fish).
        setAnchor(anchorCoord(venue.coordinates?.lat, venue.coordinates?.lng));
        setPinCounty(null);
      } else if (venue.kind === 'publicWater') {
        setAnchor(venue.center);
        setPinCounty(null);
      } else {
        setAnchor(venue.coord);
        // fish: the county is inferred offline from the nearest ANAR water (best effort).
        setPinCounty(county ?? null);
        if (county == null) void countyOfPoint(qc, venue.coord).then(c => setPinCounty(c));
      }
      setStep('detail');
    },
    [qc],
  );

  const changeVenue = useCallback(() => {
    setStep('venue');
    setSel(null);
    setAnchor(null);
    setAnchorName('');
    setStand(null);
  }, []);

  /* ── ?balta / ?apa preselect, once ─────────────────────────────────────── */
  const preLake = useQuery({ ...lakeQuery(t, balta ?? '', { enabled: !!balta }), retry: 1 });
  const preWater = useQuery({
    queryKey: ['partide', 'start', 'water', apa] as const,
    queryFn: () => browserPublicWaters().getPublicWaterByLinkCode(apa!),
    enabled: !balta && !!apa,
    staleTime: Infinity,
    retry: 1,
  });
  // Adjusted during render, once (not an effect): the selection is derived from data that arrived.
  const [preselected, setPreselected] = useState(false);
  const [preselectFailed, setPreselectFailed] = useState(false);
  if (!preselected && balta && (preLake.data || preLake.isError)) {
    setPreselected(true);
    if (preLake.data) {
      const l = preLake.data;
      handleSelect({ kind: 'lake', lakeId: l.documentId, name: l.name, locality: getLakeLocationSubtitle(l, { includeAddress: false }), coordinates: parseCoordinates(l.coordinates) });
    } else {
      // An unknown lake drops back to the picker, with a word about it.
      setPreselectFailed(true);
      setStep('venue');
    }
  } else if (!preselected && !balta && apa && (preWater.data || preWater.isError || (preWater.isFetched && preWater.data === null))) {
    setPreselected(true);
    const w = preWater.data;
    if (w) {
      handleSelect({ kind: 'publicWater', linkCode: w.linkCode ?? apa, name: w.name ?? 'Apă publică', typeLabel: PUBLIC_WATER_TYPE_LABEL[w.type], center: { lat: w.centerLat, lng: w.centerLng } });
    } else {
      setPreselectFailed(true);
      setStep('venue');
    }
  }

  /* ── stand ─────────────────────────────────────────────────────────────── */
  // fish pendingAdjustRef: picking a stand re-anchors to it and opens the adjust map once the list
  // has closed (StandPicker calls onSelect, then onClose).
  const adjustAfterStand = useRef<Coord | null | false>(false);
  const selectStand = (next: LakeDetailStand | null) => {
    setStand(next);
    if (next) {
      const c = parseCoordinates(next.coordinates);
      if (c) setAnchor(c);
      adjustAfterStand.current = c ?? effectiveAnchor;
    } else {
      // Clearing the stand drops its pin too — back to the lake's own anchor.
      if (lakeCoord) setAnchor(lakeCoord);
      adjustAfterStand.current = false;
    }
  };
  const closeStands = () => {
    setStandOpen(false);
    const next = adjustAfterStand.current;
    adjustAfterStand.current = false;
    if (next === false) return;
    openAdjust(next);
  };
  const openAdjust = (center?: Coord | null) => {
    setAdjustCenter(center ?? effectiveAnchor);
    setAdjustOpen(true);
  };

  /* ── species ───────────────────────────────────────────────────────────── */
  const fishes = useQuery({ ...fishesQuery(t), retry: false });
  const quickSpecies = useMemo<TargetSpecies[]>(() => {
    const catalog = fishes.data?.length ? sortCatalog(fishes.data.map(toCatalogFish)) : [];
    return catalog.length ? catalog.slice(0, 6).map(f => ({ id: f.id, name: f.name })) : resolveDefaultTargets([]);
  }, [fishes.data]);
  const speciesChips = useMemo(() => mergeSpeciesChips(targetSpecies, quickSpecies), [targetSpecies, quickSpecies]);
  const toggleSpecies = (s: TargetSpecies) =>
    setTargetSpecies(prev => (prev.some(p => sameSpecies(p, s)) ? prev.filter(p => !sameSpecies(p, s)) : [...prev, s]));

  /* ── start ─────────────────────────────────────────────────────────────── */
  const canStart = !!sel && !!effectiveAnchor && !starting;
  const handleStart = async () => {
    if (!sel || !effectiveAnchor || starting) return;
    setStarting(true);
    try {
      // fish useStartPartida's local guard: a live pointer on this browser blocks a second start.
      const pointer = live.state.active;
      const pointed = pointer ? live.state.sessions[pointer.sessionId] : undefined;
      if (pointer && (!pointed || pointed.endedAt === null)) {
        toast(ALREADY_ACTIVE, 'danger');
        router.replace(routes.partida(pointer.documentId));
        return;
      }
      const input = startInput({ sel, anchor: effectiveAnchor, anchorName, stand, pinCounty, plannedDurationMs, targetSpecies, visibleOnProfile });
      const repo = await live.repo();
      const handle = await repo.createSession(sessionFromInput(crypto.randomUUID(), input, Date.now()));
      await live.setActive({ sessionId: handle.sessionId, documentId: handle.documentId });
      router.replace(routes.partida(handle.documentId));
    } catch (error) {
      const failure = startFailureOf(error);
      if (failure.kind === 'auth') {
        router.push(routes.signIn(routes.startPartida({ balta: balta ?? undefined, apa: apa ?? undefined })));
      } else if (failure.kind === 'already-active') {
        toast(ALREADY_ACTIVE, 'danger');
        // The refusal carries the running partidă's ids (a browser whose pointer is gone): claim it.
        const target = failure.pointer ?? live.state.active;
        if (failure.pointer) await live.setActive(failure.pointer).catch(() => {});
        if (target) router.replace(routes.partida(target.documentId));
      } else {
        console.warn('[partide/incepe] start failed', error);
        toast(START_ERROR, 'danger');
      }
    } finally {
      setStarting(false);
    }
  };

  /* ── frame ─────────────────────────────────────────────────────────────── */
  const steps: T4Step[] = [
    { id: 'venue', title: STEP_TITLES.venue, state: step === 'venue' ? 'current' : 'done', summary: sel?.name },
    { id: 'detail', title: STEP_TITLES.detail, state: step === 'detail' ? 'current' : 'upcoming' },
  ];
  const onStep = (id: string) => {
    if (id === 'venue' && step === 'detail') changeVenue();
  };
  const preselecting = step === 'detail' && !sel;
  const locality = sel ? venueLocalityLine(sel, pinCounty) : null;

  const preview = (heightClass: string) => (
    <AnchorPreview
      anchor={effectiveAnchor}
      loading={anchorLoading}
      label={sel?.name}
      dimmed={stands.length > 0 && !stand}
      onPress={() => (stands.length > 0 && !stand ? setStandOpen(true) : openAdjust())}
      heightClass={heightClass}
      testId="anchor-preview-large"
    />
  );

  const header = (
    <T4Header
      title={TITLE}
      titleId={TITLE_ID}
      eyebrow="Partide"
      step={step === 'venue' ? 1 : 2}
      total={2}
      back={step === 'detail' && sel ? { label: 'Înapoi la alegerea locului', onClick: changeVenue } : { label: 'Înapoi', onClick: leave }}
      busy={starting}
      progress={<T4Progress steps={steps} onSelect={onStep} label="Pașii partidei" />}
      focusKey={step}
    />
  );

  const actions =
    step === 'detail' && sel ? (
      <T4ActionBar
        primary={
          <Button
            variant="success"
            data-testid="start-submit"
            disabled={!canStart}
            aria-busy={starting || undefined}
            onClick={() => void handleStart()}
          >
            {starting ? 'Se pornește…' : 'Începe partida'}
          </Button>
        }
        back={
          <Button variant="ghost" onClick={changeVenue} disabled={starting}>
            Înapoi
          </Button>
        }
        meta={
          !effectiveAnchor && !anchorLoading ? <span className="t-caption text-status-danger-fg">Fixează poziția pe hartă</span> : null
        }
      />
    ) : null;

  const standCaption = stands.length > 0 && !stand ? 'Alege standul, apoi poți ajusta poziția pe hartă.' : effectiveAnchor ? `${effectiveAnchor.lat.toFixed(5)}, ${effectiveAnchor.lng.toFixed(5)}` : null;

  return (
    <>
      <SetBreadcrumb trail={TRAIL} />
      <T4Frame
        header={header}
        label={`Pasul ${step === 'venue' ? 1 : 2} din 2: ${STEP_TITLES[step]}`}
        busy={preselecting}
        aside={step === 'detail' && sel ? <PositionAside caption={standCaption}>{preview('h-[min(28rem,calc(100dvh-24rem))] min-h-72')}</PositionAside> : undefined}
        actions={actions}
      >
        <T4Progress steps={steps} onSelect={onStep} label="Pașii partidei" className="hidden xl:block" />
        {step === 'venue' ? (
          <>
            {preselectFailed ? (
              <p role="status" className="rounded-card bg-status-warning-bg px-4 py-3 t-body text-status-warning-fg">
                Nu am găsit locul din link. Alege-l din listă.
              </p>
            ) : null}
            <VenueStep t={t} location={location} onSelect={handleSelect} />
          </>
        ) : !sel ? (
          <DetailSkeleton />
        ) : (
          <div data-testid="start-detail" className="flex flex-col gap-4 md:gap-5">
            <VenueCard sel={sel} locality={locality} onChange={changeVenue} />
            <PositionSection
              sel={sel}
              stands={stands}
              stand={stand}
              anchor={effectiveAnchor}
              anchorLoading={anchorLoading}
              anchorName={anchorName}
              onAnchorName={setAnchorName}
              onOpenStands={() => setStandOpen(true)}
              onClearStand={() => selectStand(null)}
              onAdjust={() => openAdjust()}
            />
            <DurationSection
              value={plannedDurationMs}
              custom={customDuration}
              onPreset={ms => {
                setPlannedDurationMs(ms);
                setCustomDuration(false);
              }}
              onCustom={ms => {
                setPlannedDurationMs(ms);
                setCustomDuration(true);
              }}
            />
            <SpeciesSection chips={speciesChips} selected={targetSpecies} onToggle={toggleSpecies} onSeeAll={() => setSpeciesOpen(true)} />
            <PublicSection checked={visibleOnProfile} onChange={setVisibleOnProfile} />
          </div>
        )}
      </T4Frame>

      <StandPicker open={standOpen} stands={stands} selectedId={stand?.documentId ?? null} onSelect={selectStand} onClose={closeStands} />
      <SpeciesPicker open={speciesOpen} initial={targetSpecies} onSave={setTargetSpecies} onClose={() => setSpeciesOpen(false)} />
      <MapPointPicker
        open={adjustOpen}
        title="Ajustează poziția"
        center={adjustCenter ?? ROMANIA_CENTER}
        initialZoom={adjustCenter ? ANCHOR_ZOOM : COUNTRY_ZOOM}
        initialMapType={adjustCenter ? 'satellite' : 'standard'}
        onCancel={() => setAdjustOpen(false)}
        onConfirm={coord => {
          setAnchor(coord);
          setAdjustOpen(false);
        }}
      />
    </>
  );
}

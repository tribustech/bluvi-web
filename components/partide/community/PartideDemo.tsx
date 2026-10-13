'use client';

import { useEffect, useState, useSyncExternalStore, type ComponentType, type CSSProperties, type ReactNode, type SVGProps } from 'react';
import { ChartBarIcon, ClockIcon, CameraIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';

/*
 * The Partide showcase's demo (owner 2026-10-13: «ceva animat frumos… animații foarte mișto», option A):
 * the four things a partidă does, each as a feature row on the left and a scene on a drawn phone on
 * the right, playing on their own — a row's bar fills while its scene plays, then the next. A click
 * (or Enter) on a row jumps to its scene. The phone shows the REAL app screens (owner 2026-10-13:
 * «exact design din aplicația mobilă… nu punem la mișto niște chestii»), rebuilt in HTML from fish
 * (features/partide: PartidaRodCard, the catch form, JurnalScene, the Setări team block, the
 * Statistici scene) — live and touchable: the rod timers count down, «Captură» on a rod opens the
 * catch form, its − / + change the weight, the species chips select, members join the team.
 *
 * Reduced motion: no auto-play and no entrances — each scene shows its end state; the rows still
 * switch scenes. The demo is decorative for assistive tech (the rows are the content: buttons with
 * their title and text; the phone is aria-hidden).
 */

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const SCENE_MS = 5200;

export const DEMO_FEATURES: { key: string; Icon: Icon; title: string; body: string; hue: string }[] = [
  {
    key: 'timers',
    Icon: ClockIcon,
    title: 'Cronometru pe fiecare lansetă',
    body: 'Știi de cât stă fiecare montură în apă și când e timpul s-o schimbi.',
    hue: 'var(--color-shortcut-blue-solid)',
  },
  {
    key: 'catch',
    Icon: CameraIcon,
    title: 'Jurnalul capturilor',
    body: 'Poză, specie și greutate, cu ora și lanseta pe care a tras.',
    hue: 'var(--color-shortcut-teal-solid)',
  },
  {
    key: 'friends',
    Icon: UserGroupIcon,
    title: 'Partide cu prietenii',
    body: 'Până la 3 pescari în aceeași partidă: intră cu un cod și vedeți totul împreună.',
    hue: 'var(--color-shortcut-violet-solid)',
  },
  {
    key: 'stats',
    Icon: ChartBarIcon,
    title: 'Statistici pe partidă',
    body: 'Capturi pe lansetă, cea mai mare, clasamentul momelilor. Și merge fără semnal.',
    hue: 'var(--color-shortcut-plum-solid)',
  },
];

const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)');
function subscribeMotion(onChange: () => void) {
  const mq = REDUCED();
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
/** true on the server and during hydration: the still demo first, then the viewer's setting. */
function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, () => REDUCED().matches, () => true);
}

/** Milliseconds since `key` last changed, ticking every frame while `run` (0 when not running). */
function useElapsed(key: number, run: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!run) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      setElapsed(now - start);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [key, run]);
  return run ? elapsed : Number.POSITIVE_INFINITY;
}

export function PartideDemo({ intro }: { intro?: ReactNode }) {
  const reduced = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const run = !reduced && !paused;
  // The scene's clock: restarts on each scene (its key), drives the scene's own counters.
  const elapsed = useElapsed(scene, !reduced);
  useEffect(() => {
    if (!run) return;
    const id = window.setTimeout(() => setScene((s) => (s + 1) % DEMO_FEATURES.length), SCENE_MS);
    return () => window.clearTimeout(id);
  }, [run, scene]);

  const feature = DEMO_FEATURES[scene];
  return (
    <div
      className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto] xl:gap-16"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex min-w-0 flex-col gap-6">
      {intro}
      <ol className="flex flex-col gap-1.5">
        {DEMO_FEATURES.map((f, i) => {
          const active = i === scene;
          return (
            <li key={f.key}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setScene(i)}
                style={{ '--hue': f.hue } as CSSProperties}
                className={cn(
                  'group relative flex w-full cursor-pointer items-start gap-4 overflow-hidden rounded-card p-4 text-left transition-[background-color,box-shadow] duration-(--duration-medium) ease-slow',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  active ? 'bg-surface shadow-e1' : 'hover:bg-surface/60',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-control transition-colors duration-(--duration-medium)',
                    active ? 'bg-(--hue) text-on-accent' : 'bg-surface text-(--hue) shadow-e0',
                  )}
                >
                  <f.Icon className="size-6" />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className={cn('t-heading', active ? 'text-ink' : 'text-ink-2')}>{f.title}</span>
                  <span className={cn('t-body text-ink-2 transition-[opacity] duration-(--duration-medium)', active ? 'opacity-100' : 'opacity-70')}>{f.body}</span>
                </span>
                {/* The scene's time, filling under the active row. */}
                {active && run ? (
                  <span
                    key={scene}
                    aria-hidden
                    className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-(--hue) animate-fill"
                    style={{ animationDuration: `${SCENE_MS}ms` }}
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
      </div>
      <Phone hue={feature.hue}>
        <div key={scene} className="flex h-full flex-col">
          {scene === 0 ? <RodsScene elapsed={elapsed} still={reduced} onCatch={() => setScene(1)} /> : null}
          {scene === 1 ? <CatchScene elapsed={elapsed} still={reduced} /> : null}
          {scene === 2 ? <TeamScene elapsed={elapsed} still={reduced} /> : null}
          {scene === 3 ? <StatsScene elapsed={elapsed} still={reduced} /> : null}
        </div>
      </Phone>
    </div>
  );
}

/* ------------------------------------------------------------------ the phone */

function Phone({ hue, children }: { hue: string; children: ReactNode }) {
  return (
    <div aria-hidden className="relative mx-auto w-[300px] shrink-0 select-none">
      {/* The glow behind the phone takes the scene's hue. */}
      <div
        className="absolute -inset-12 z-behind rounded-full opacity-60 blur-3xl transition-[background-color] duration-700"
        style={{ backgroundColor: `color-mix(in oklab, ${hue} 26%, transparent)` }}
      />
      <div className="rounded-[50px] bg-navy p-2.5 shadow-[0_40px_80px_-30px_rgb(16_24_40/0.55)]">
        <div className="relative flex h-[610px] flex-col overflow-hidden rounded-[42px] bg-surface">
          {children}
          <div className="absolute bottom-1.5 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-ink" />
        </div>
      </div>
    </div>
  );
}

/** iOS status bar: the time, the island, signal / wifi / battery (`light` on a coloured header). */
function StatusBar({ light = false }: { light?: boolean }) {
  return (
    <div className={cn('relative flex h-11 shrink-0 items-center justify-between px-7 pt-1', light ? 'text-on-accent' : 'text-ink')}>
      <span className="t-label">15:43</span>
      <span className="absolute top-2 left-1/2 h-6.5 w-24 -translate-x-1/2 rounded-full bg-navy" />
      <span className="flex items-center gap-1">
        <svg viewBox="0 0 18 12" className="h-2.5 w-3.5" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="7" rx="1" />
          <rect x="10" y="2" width="3" height="10" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" opacity="0.35" />
        </svg>
        <span className="h-2.5 w-5 rounded-[3px] border border-current p-[1px]">
          <span className="block h-full w-3/4 rounded-[1px] bg-current" />
        </span>
      </span>
    </div>
  );
}

/** The partidă's own header (fish PartidaScreen): back, lake + stand, «Termină», share; its tabs. */
function PartidaHeader({ tab }: { tab: 'Lansete' | 'Jurnal' | 'Galerie' | 'Statistici' | 'Setări' }) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 px-3 pb-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-soft-fill t-body text-ink-2">‹</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate t-body-strong text-ink">Chita Lake</span>
          <span className="t-micro text-muted">Stand 7 · 2 lansete</span>
        </span>
        <span className="rounded-full bg-status-danger-bg px-2 py-0.5 t-micro-strong text-status-danger-fg">Termină</span>
        <span className="flex size-7 items-center justify-center rounded-full bg-soft-fill t-micro text-ink-2">⤴</span>
      </div>
      <div className="flex shrink-0 gap-3.5 border-b border-hairline px-3">
        {(['Lansete', 'Jurnal', 'Galerie', 'Statistici', 'Setări'] as const).map((t) => (
          <span key={t} className={cn('relative pb-2 t-micro-strong', t === tab ? 'text-fish-indigo5' : 'text-muted')}>
            {t}
            {t === 'Jurnal' ? <span className="ml-0.5 rounded-full bg-fish-indigo5 px-1 text-on-accent">2</span> : null}
            {t === tab ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-fish-indigo5" /> : null}
          </span>
        ))}
      </div>
    </>
  );
}

const enter = (still: boolean, delayMs: number) => (still ? undefined : { animationDelay: `${delayMs}ms` });

function clock(sec: number) {
  const v = Math.max(0, Math.floor(sec));
  const h = Math.floor(v / 3600);
  const m = Math.floor((v % 3600) / 60);
  const s = v % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/* ------------------------------------------------------------------ 1 · Lansete (fish PartidaRodCard) */

const RODS = [
  { key: 'L1', color: 'bg-fish-red', ring: 'ring-fish-red', bar: 'bg-fish-red', where: '59 m', left: 29 * 60 + 9, total: 30 * 60, bait: 'Boilies 20mm Krill' },
  { key: 'L2', color: 'bg-fish-blue', ring: 'ring-fish-blue', bar: 'bg-fish-blue', where: 'Centru · 50 m', left: 14 * 60 + 55, total: 15 * 60, bait: 'Momeală necunoscută' },
];

function RodsScene({ elapsed, still, onCatch }: { elapsed: number; still: boolean; onCatch: () => void }) {
  // Real seconds: the timers count down as the app does.
  const t = still ? 0 : Math.floor(Math.min(elapsed, 60_000) / 1000);
  return (
    <>
      <StatusBar />
      <PartidaHeader tab="Lansete" />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden bg-page px-3 pt-3">
        {RODS.map((r, i) => {
          const left = r.left - t;
          return (
            <div key={r.key} className={cn('flex flex-col gap-2 rounded-card bg-surface p-3 shadow-e0 ring-1', r.ring, !still && 'animate-rise')} style={enter(still, i * 150)}>
              <div className="flex items-center gap-2">
                <span className={cn('flex size-6 items-center justify-center rounded-full t-micro-strong text-on-accent ring-2 ring-surface outline-2 outline-fish-indigo5', r.color)}>{r.key}</span>
                <span className="flex-1 t-label text-ink">{r.where}</span>
                <span className="flex size-6 items-center justify-center rounded-control bg-soft-fill t-micro text-muted">⚙</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="flex flex-col">
                  <span className="t-micro uppercase text-muted">Timp rămas</span>
                  <span className="t-stat text-ink tabular-nums">{clock(left)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="t-micro text-muted tabular-nums">{clock(r.total)}</span>
                  <span className="flex size-6 items-center justify-center rounded-badge bg-status-danger-bg">
                    <span className="size-2 rounded-[2px] bg-fish-red" />
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-soft-fill">
                <div className={cn('h-full rounded-full transition-[width] duration-1000 ease-linear', r.bar)} style={{ width: `${(1 - left / r.total) * 100}%` }} />
              </div>
              <span className="t-caption text-ink-2">⚲ {r.bait}</span>
              <div className="grid grid-cols-3 gap-1.5">
                <span className="flex flex-col items-center gap-0.5 rounded-control bg-soft-fill py-1.5 t-micro text-ink-2">⊘<span>Fără trăsătură</span></span>
                <span className="flex flex-col items-center gap-0.5 rounded-control bg-status-warning-bg py-1.5 t-micro text-status-warning-fg">◇<span>Scăpat</span></span>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={onCatch}
                  className={cn('flex cursor-pointer flex-col items-center gap-0.5 rounded-control bg-fish-green py-1.5 t-micro-strong text-on-accent transition-transform hover:scale-[1.03] active:scale-95', i === 0 && !still && 'animate-pop')}
                  style={i === 0 ? enter(still, 2600) : undefined}
                >
                  ◆<span>Captură</span>
                </button>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-center gap-1 rounded-card border border-dashed border-hairline py-2.5 t-label text-fish-indigo5">+ Adaugă lansetă</div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 2 · Captură nouă (fish catch form) */

const SPECIES = ['Crap', 'Crap Oglindă', 'Caras'];

function CatchScene({ elapsed, still }: { elapsed: number; still: boolean }) {
  const [species, setSpecies] = useState(1);
  const [delta, setDelta] = useState(0);
  // The weight «typed in»: counts up to 13,4 kg, then the − / + step it by 100 g.
  const p = still ? 1 : Math.min(1, Math.max(0, (elapsed - 600) / 1400));
  const kg = Math.max(0, 13.4 * (1 - Math.pow(1 - p, 3)) + delta);
  return (
    <>
      <div className="shrink-0 rounded-b-[24px] bg-fish-indigo5 pb-4 text-on-accent">
        <StatusBar light />
        <div className="flex items-center gap-2 px-4">
          <span className="flex size-7 items-center justify-center rounded-full bg-on-accent/20 t-body">‹</span>
          <span className="t-heading">Captură nouă</span>
        </div>
        <p className="mt-1 px-4 pl-13 t-micro text-on-accent/80">Completează datele pentru o statistică personală cât mai completă.</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 pt-3">
        <span className="t-micro uppercase text-muted">Ce ai prins?</span>
        <div className="flex flex-wrap gap-1.5">
          {SPECIES.map((sp, i) => (
            <button
              key={sp}
              type="button"
              tabIndex={-1}
              onClick={() => setSpecies(i)}
              className={cn('cursor-pointer rounded-full px-3 py-1.5 t-label transition-colors', i === species ? 'bg-fish-indigo5 text-on-accent' : 'bg-soft-fill text-ink-2')}
            >
              {sp}
            </button>
          ))}
        </div>
        <span className="mt-1 t-micro uppercase text-muted">Greutate</span>
        <div className="flex flex-col items-center gap-2 rounded-card bg-surface p-3 shadow-e0">
          <div className="flex w-full items-center justify-between">
            <button type="button" tabIndex={-1} onClick={() => setDelta((d) => d - 0.1)} className="flex size-9 cursor-pointer items-center justify-center rounded-control bg-soft-fill t-heading text-ink-2 active:scale-95">
              −
            </button>
            <span className="flex items-baseline gap-1">
              <span className="t-display text-ink tabular-nums">{kg.toFixed(1).replace('.', ',')}</span>
              <span className="t-label text-muted">kg</span>
            </span>
            <button type="button" tabIndex={-1} onClick={() => setDelta((d) => d + 0.1)} className="flex size-9 cursor-pointer items-center justify-center rounded-control bg-fish-indigo5 t-heading text-on-accent active:scale-95">
              +
            </button>
          </div>
          <span className="rounded-full bg-accent-tint px-2 py-0.5 t-micro text-accent-ink">Atinge pentru a scrie</span>
          <div className="grid w-full grid-cols-2 rounded-control bg-soft-fill p-0.5 t-micro-strong">
            <span className="rounded-[6px] bg-surface py-1 text-center text-fish-indigo5 shadow-e0">Cântărită</span>
            <span className="py-1 text-center text-muted">Estimată</span>
          </div>
        </div>
        <span className="mt-1 t-micro uppercase text-muted">Detalii</span>
        <div className="flex flex-col divide-y divide-hairline rounded-card bg-surface shadow-e0">
          {[
            ['Lansetă', 'Lanseta 1'],
            ['Momeală', 'Boilies 20mm Krill'],
            ['Ora', 'acum · 15:44'],
          ].map(([k, v], i) => (
            <div key={k} className={cn('flex items-center justify-between px-3 py-2', !still && 'animate-rise')} style={enter(still, 1800 + i * 160)}>
              <span className="t-label text-ink">{k}</span>
              <span className="t-micro text-muted">{v} ›</span>
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 px-3 pt-2 pb-5">
        <div className="rounded-control bg-fish-indigo5 py-2.5 text-center t-label text-on-accent">Salvează captura</div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 3 · Setări · Partidă în echipă */

const MEMBERS = [
  { name: 'Andrew', role: 'Organizator', tone: 'bg-fish-avatar-1' },
  { name: 'Mihai Stan', role: 'Membru', tone: 'bg-fish-avatar-3' },
  { name: 'Vlad Mureșan', role: 'Membru', tone: 'bg-fish-avatar-5' },
];

function TeamScene({ elapsed, still }: { elapsed: number; still: boolean }) {
  // Members join one by one (the code shared, they enter it in their app).
  const joined = still ? MEMBERS.length : 1 + (elapsed > 1600 ? 1 : 0) + (elapsed > 3000 ? 1 : 0);
  return (
    <>
      <StatusBar />
      <PartidaHeader tab="Setări" />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden bg-page px-3 pt-3">
        <div className="flex flex-col gap-2 rounded-card bg-surface p-3 shadow-e0">
          <span className="t-micro uppercase text-muted">👥 Partidă în echipă</span>
          <div className="flex items-center justify-between">
            <span className="flex flex-col">
              <span className="t-micro text-muted">Cod de acces</span>
              <span className="t-stat tracking-[0.18em] text-fish-indigo5">X9QXQ7</span>
            </span>
            <span className="rounded-control bg-fish-indigo5 px-3 py-1.5 t-label text-on-accent">Invită</span>
          </div>
          <span className="self-start rounded-control border border-fish-indigo5 px-2 py-1 t-micro-strong text-fish-indigo5">⟳ Schimbă codul</span>
          <span className="mt-1 border-t border-hairline pt-2 t-micro text-muted">
            {joined} {joined === 1 ? 'membru' : 'membri'}
          </span>
          {MEMBERS.slice(0, joined).map((m, i) => (
            <div key={m.name} className={cn('flex items-center gap-2', !still && i > 0 && 'animate-rise')}>
              <span className={cn('flex size-8 items-center justify-center rounded-full t-micro-strong text-on-accent', m.tone, !still && i > 0 && 'animate-pop')}>
                {m.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')}
              </span>
              <span className="flex flex-col">
                <span className="t-label text-ink">{m.name}</span>
                <span className="t-micro text-fish-indigo5">{m.role}</span>
              </span>
              {i > 0 ? <span className="ml-auto t-micro text-status-success-fg">s-a alăturat</span> : null}
            </div>
          ))}
        </div>
        <span className="t-micro uppercase text-muted">Detalii</span>
        <div className="flex flex-col divide-y divide-hairline rounded-card bg-surface shadow-e0">
          {[
            ['Baltă', 'Chita Lake'],
            ['Început', '8 oct. · 15:40'],
            ['Sincronizare', 'Sincronizat'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-3 py-2">
              <span className="t-label text-ink">{k}</span>
              <span className={cn('t-micro', k === 'Sincronizare' ? 'text-status-success-fg' : 'text-ink-2')}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 4 · Statistici (fish Statistici scene) */

const PER_ROD = [
  { label: 'Lanseta 1', dot: 'bg-fish-red', n: 2 },
  { label: 'Lanseta 2', dot: 'bg-fish-blue', n: 1 },
  { label: 'Lanseta 3', dot: 'bg-fish-green', n: 7 },
];
const BAITS = [
  ['Boilies 20mm hook half rosu', '5', '7,2', '13,4'],
  ['Boilies 20mm wasabi banana', '3', '11,7', '18,3'],
  ['Boilies 20mm hook', '2', '5,15', '5,7'],
];

function StatsScene({ elapsed, still }: { elapsed: number; still: boolean }) {
  const p = still ? 1 : Math.min(1, Math.max(0, (elapsed - 400) / 1400));
  const ease = 1 - Math.pow(1 - p, 3);
  return (
    <>
      <StatusBar />
      <PartidaHeader tab="Statistici" />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden bg-page px-3 pt-3">
        <div className="grid grid-cols-2 rounded-control bg-soft-fill p-0.5 t-micro-strong">
          <span className="rounded-[6px] bg-surface py-1 text-center text-ink shadow-e0">Această partidă</span>
          <span className="py-1 text-center text-muted">Toate partidele</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Capturi', `${Math.round(11 * ease)}`, ''],
            ['Cea mai mare', (18.3 * ease).toFixed(1).replace('.', ','), 'kg'],
            ['Greutate totală', (84 * ease).toFixed(1).replace('.', ','), 'kg'],
          ].map(([k, v, u]) => (
            <div key={k} className="flex flex-col gap-0.5 rounded-card bg-surface p-2.5 shadow-e0">
              <span className="t-micro text-muted">{k}</span>
              <span className="flex items-baseline gap-0.5">
                <span className="t-stat text-fish-indigo5 tabular-nums">{v}</span>
                {u ? <span className="t-micro text-muted">{u}</span> : null}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 rounded-card bg-surface p-3 shadow-e0">
          <span className="t-micro uppercase text-muted">Capturi pe lansetă</span>
          {PER_ROD.map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <span className={cn('size-2 rounded-full', r.dot)} />
              <span className="w-15 t-micro text-ink">{r.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft-fill">
                <span className={cn('block h-full rounded-full', r.dot)} style={{ width: `${(r.n / 7) * 100 * ease}%` }} />
              </span>
              <span className="w-3 text-right t-micro text-muted">{r.n}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 rounded-card bg-surface p-3 shadow-e0">
          <span className="t-micro uppercase text-muted">🏆 Clasament momeli</span>
          {BAITS.map(([name, n, avg, max], i) => (
            <div key={name} className={cn('flex items-center gap-1.5 rounded-badge px-1 py-1', i === 0 && 'bg-accent-tint', !still && 'animate-rise')} style={enter(still, 600 + i * 200)}>
              <span className="flex size-4 items-center justify-center rounded-[4px] bg-fish-indigo5 t-micro text-on-accent">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate t-micro text-ink">{name}</span>
              <span className="w-3 text-right t-micro text-ink-2">{n}</span>
              <span className="w-6 text-right t-micro text-ink-2">{avg}</span>
              <span className="w-6 text-right t-micro-strong text-ink">{max}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

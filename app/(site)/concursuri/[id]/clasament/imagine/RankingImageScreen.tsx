'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDownTrayIcon,
  ArrowsPointingInIcon,
  ExclamationCircleIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ShareIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import { SadSearchIcon } from '@/components/icons/brand';
import { IconButton } from '@/components/nav/IconButton';
import { DetailBackButton, DetailBand, DetailBody, DetailHeader, DetailPage, DetailSection, DetailSectionState, headerChipClass } from '@/components/templates/T3';
import { Button, ButtonLink } from '@/components/ui/Button';
import { captureException } from '@/lib/observability/report';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../../_shell/Toast';
import { trackRankingImage } from './analytics';
import { EMPTY_REASONS, type EmptyReason } from './model';
import { SCALE } from './png/scale';
import type { SheetGeometry } from './png/sheet';

/*
 * The ranking image page (fish ranking-image.tsx / ranking-image-cn.tsx): the T3 band — title, the
 * competition and what the table is, «Descarcă clasamentul» (the band's one primary action) and
 * «Distribuie clasamentul» (secondary, as every T3 band's share): «Descarcă» / «Distribuie» from
 * 768, the full label from 1280, the fish header chips on the phone — and the image on the whole
 * width under it, as a sheet of paper on the page's ground, in a stage that zooms and pans (fish
 * ResumableZoom, c8).
 *
 * States (c6, c7): planning (the plan streams in under the band: the stage's skeleton, nothing
 * fetched yet), generating (the PNG is being drawn: a skeleton of the planned sheet's own blocks at
 * the size and place the image opens at, so nothing moves when it lands), ready, failed (fish's «Am
 * întâmpinat o eroare!» + «Încearcă din nou» / «Înapoi»; a request that takes longer than
 * TIMEOUT_MS fails too), «nothing to draw» (decided on the server, page.tsx: the PNG is never
 * requested; fish keeps «Vezi full» disabled then — not started, no weighing, no such table, a type
 * it cannot draw) and «the competition is gone» (a 404 after the page rendered). Download and share
 * are disabled while the image generates (c9) and absent when there is nothing to save. One polite
 * status says where the image is (generating → ready → failed) for screen readers; the ready image
 * is described in words (`summary`) and links to the table itself.
 */

const FAILED_COPY = 'Nu s-a putut genera imaginea, dacă problema persistă vă rugăm să lăsați un feedback în aplicație.';
/**
 * The longest a PNG may take before the page gives up. The server answers nothing until the sheet is
 * drawn (a completed ranking is drawn once and kept, png/route.tsx), so there is no progress to
 * follow: the bound is generous — past the route's own 8 s reads and a large sheet's first drawing
 * on a busy server — and the skeleton says it is slow from SLOW_MS.
 */
const TIMEOUT_MS = 60_000;
/** After this the skeleton says the image is taking longer than usual. */
const SLOW_MS = 8_000;

type Ready = { url: string; blob: Blob; fileName: string; cn: boolean; width: number; height: number };
type State =
  | { kind: 'loading' }
  | { kind: 'ready'; image: Ready }
  | { kind: 'failed' }
  | { kind: 'empty'; reason: EmptyReason }
  | { kind: 'missing' };

/** `filename*=UTF-8''Clasament_X.png` → «Clasament_X.png». */
function fileNameOf(disposition: string | null, fallback: string): string {
  const m = /filename\*=UTF-8''([^;]+)/i.exec(disposition ?? '');
  if (!m) return fallback;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return fallback;
  }
}

const asReason = (r: unknown): EmptyReason => (EMPTY_REASONS.includes(r as EmptyReason) ? (r as EmptyReason) : 'noWeighing');

function useRankingImage(fileUrl: string, name: string, initial: State | undefined, enabled: boolean) {
  // The settled result, keyed by the URL it is for: another URL (or a retry) is loading until it lands.
  const [settled, setSettled] = useState<{ key: string; state: State } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [slowKey, setSlowKey] = useState<string | null>(null);
  const key = `${fileUrl}#${attempt}`;
  useEffect(() => {
    if (initial || !enabled) return;
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, TIMEOUT_MS);
    const slow = setTimeout(() => setSlowKey(key), SLOW_MS);
    let objectUrl: string | null = null;
    const setState = (state: State) => setSettled({ key, state });
    (async () => {
      try {
        // A retry asks the server again rather than a cached failure.
        const res = await fetch(fileUrl, { signal: ctrl.signal, cache: attempt > 0 ? 'reload' : 'default' });
        // Deleted or unpublished since the page rendered (a stale tab).
        if (res.status === 404) return setState({ kind: 'missing' });
        const type = res.headers.get('content-type') ?? '';
        if (res.ok && type.startsWith('application/json')) {
          const body = (await res.json().catch(() => ({}))) as { reason?: string };
          return setState({ kind: 'empty', reason: asReason(body.reason) });
        }
        if (!res.ok || !type.startsWith('image/png')) throw new Error(`ranking image: HTTP ${res.status}`);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.src = objectUrl;
        await img.decode();
        setState({
          kind: 'ready',
          image: {
            url: objectUrl,
            blob,
            fileName: fileNameOf(res.headers.get('content-disposition'), `Clasament_${name}.png`),
            cn: res.headers.get('x-ranking-image') === 'cn',
            width: img.naturalWidth,
            height: img.naturalHeight,
          },
        });
      } catch (e) {
        if (ctrl.signal.aborted && !timedOut) return;
        // fish ranking-image.tsx:144 reports the capture failure to Sentry (a no-op while it is off).
        console.warn('[imagine-clasament]', timedOut ? 'timeout' : e);
        captureException(timedOut ? new Error('ranking image: timeout') : e, {
          tags: { feature: 'ranking_image', failure: timedOut ? 'timeout' : 'fetch' },
        });
        setState({ kind: 'failed' });
      } finally {
        clearTimeout(timer);
        clearTimeout(slow);
      }
    })();
    return () => {
      clearTimeout(timer);
      clearTimeout(slow);
      ctrl.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl, name, key, attempt, initial, enabled]);
  const state: State = initial ?? (settled?.key === key ? settled.state : { kind: 'loading' });
  return {
    state,
    attempt,
    // A retry from the failed state keeps that state on screen (its button busy, focus on it) until it lands.
    retrying: state.kind === 'loading' && settled?.state.kind === 'failed',
    slow: state.kind === 'loading' && slowKey === key,
    retry: useCallback(() => setAttempt(a => a + 1), []),
  };
}

const STATUS: Record<State['kind'], string> = {
  loading: 'Se generează imaginea clasamentului…',
  ready: 'Imaginea clasamentului este gata. O poți descărca sau distribui.',
  failed: 'Nu s-a putut genera imaginea clasamentului.',
  empty: 'Nu există date de afișat.',
  missing: 'Concursul nu mai există.',
};

/** «Nothing to draw», by reason: what is missing, said truthfully. */
const EMPTY_COPY: Record<EmptyReason, { heading: string; description: string }> = {
  notStarted: { heading: 'Concursul nu a început încă', description: 'Imaginea clasamentului apare după primul cântar.' },
  noWeighing: { heading: 'Nu există date de afișat', description: 'Imaginea apare după primul cântar al clasamentului ales.' },
  noSuchView: { heading: 'Clasamentul ales nu există', description: 'Concursul nu are acest clasament. Vezi imaginea clasamentului general.' },
  unsupported: { heading: 'Nu există date de afișat', description: 'Clasamentul acestui concurs nu poate fi exportat ca imagine.' },
};

export type RankingImageScreenProps = {
  id: string;
  name: string;
  /** What the table is («Clasament general», «Sector B», «Manșa 2»). */
  subtitle: string;
  /** The same, short enough for the phone's title column («După poziție»). */
  phoneSubtitle: string;
  fileUrl: string;
  backHref: string;
  /** The image of the competition's default table (the way on from «Clasamentul ales nu există»). */
  defaultHref: string;
  /** The PNG's planned geometry (page.tsx): the skeleton takes the image's own blocks. */
  sheet: SheetGeometry | null;
};

export function RankingImageScreen({
  id,
  name,
  subtitle,
  phoneSubtitle,
  fileUrl,
  backHref,
  defaultHref,
  sheet,
  initial,
  summary,
  planning = false,
}: RankingImageScreenProps & {
  /** Decided on the server (page.tsx): nothing to draw — the PNG is never requested. */
  initial?: { kind: 'empty'; reason: EmptyReason };
  /** The image in words (model.ts imageSummary), for screen readers. */
  summary?: string;
  /** The plan is still streaming in (page.tsx Suspense fallback): the skeleton, nothing fetched. */
  planning?: boolean;
}) {
  const { state, attempt, retrying, slow, retry } = useRankingImage(fileUrl, name, initial, !planning);
  const toast = useSiteToast();
  const image = state.kind === 'ready' ? state.image : null;
  const disabled = !image;
  // Nothing to save in the empty / failed / missing states: the state itself carries the way out.
  const actionable = (state.kind === 'loading' && !retrying) || state.kind === 'ready';

  const download = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image.url;
    a.download = image.fileName;
    document.body.append(a);
    a.click();
    a.remove();
    // fish downloadFile: «Descarcat cu succes!» once the file is saved.
    toast('Imaginea a fost descărcată.', 'success');
    trackRankingImage(image.cn ? 'download_cn_ranking_image' : 'download_ranking_image', { id, name });
  };

  // The FILE is shared (fish shareImage), which the kit DetailShareButton (the page's link) cannot do.
  const share = async () => {
    if (!image) return;
    const file = new File([image.blob], image.fileName, { type: 'image/png' });
    const event = image.cn ? 'share_cn_ranking_image' : 'share_ranking_image';
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Clasament ${name}` });
        toast('Distribuit cu succes', 'success');
      } else if (typeof navigator.share === 'function') {
        await navigator.share({ title: `Clasament ${name}`, url: window.location.href });
        toast('Distribuit cu succes', 'success');
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast('Linkul imaginii a fost copiat.', 'success');
      }
      trackRankingImage(event, { id, name });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      toast('Nu am putut distribui imaginea.', 'danger');
    }
  };

  // The kit's header chip (DetailShareButton look="chip"), disabled until the image is ready.
  const chip = headerChipClass({ className: 'disabled:cursor-not-allowed disabled:opacity-50' });
  const empty = state.kind === 'empty' ? EMPTY_COPY[state.reason] : null;

  return (
    <DetailPage phoneGround="surface">
      <p role="status" className="sr-only">
        {STATUS[retrying ? 'failed' : state.kind]}
      </p>
      <DetailBand>
        <DetailHeader
          title="Imagine clasament"
          eyebrow={name}
          meta={[
            // From 768 the competition is the eyebrow; the phone hides the eyebrow, so it leads the meta there.
            <span key="v" className="flex min-w-0 flex-col">
              <span className="truncate text-ink-2 md:hidden">{name}</span>
              <span className="md:hidden">{phoneSubtitle}</span>
              <span className="max-md:hidden">{subtitle}</span>
            </span>,
          ]}
          phoneStart={<DetailBackButton fallbackHref={backHref} label="Înapoi la clasament" />}
          phoneEnd={
            actionable ? (
              <span className="flex gap-2">
                <button type="button" aria-label="Descarcă clasamentul" title="Descarcă clasamentul" className={chip} disabled={disabled} onClick={download}>
                  <ArrowDownTrayIcon aria-hidden />
                </button>
                <button type="button" aria-label="Distribuie clasamentul" title="Distribuie clasamentul" className={chip} disabled={disabled} onClick={() => void share()}>
                  <ShareIcon aria-hidden />
                </button>
              </span>
            ) : undefined
          }
          actions={
            actionable ? (
              <>
                {/* «Distribuie» as every T3 band's (the kit secondary); «Descarcă» is the band's one primary action. */}
                <Button variant="secondary" icon={<ShareIcon />} disabled={disabled} onClick={() => void share()} aria-label="Distribuie clasamentul">
                  <span className="xl:hidden">Distribuie</span>
                  <span className="max-xl:hidden">Distribuie clasamentul</span>
                </Button>
                <Button variant="primary" icon={<ArrowDownTrayIcon />} disabled={disabled} onClick={download} aria-label="Descarcă clasamentul">
                  <span className="xl:hidden">Descarcă</span>
                  <span className="max-xl:hidden">Descarcă clasamentul</span>
                </Button>
              </>
            ) : undefined
          }
        />
      </DetailBand>
      <DetailBody>
        {state.kind === 'failed' || retrying ? (
          <Failed backHref={backHref} retry={retry} pending={retrying} attempt={attempt} />
        ) : empty && state.kind === 'empty' ? (
          <DetailSectionState
            icon={<SadSearchIcon size={48} />}
            heading={empty.heading}
            description={empty.description}
            action={
              state.reason === 'noSuchView' ? (
                <ButtonLink href={defaultHref} variant="secondary">
                  Vezi clasamentul general
                </ButtonLink>
              ) : (
                <ButtonLink href={backHref} variant="secondary">
                  Înapoi la clasament
                </ButtonLink>
              )
            }
          />
        ) : state.kind === 'missing' ? (
          <DetailSectionState
            icon={<SadSearchIcon size={48} />}
            heading="Concursul nu mai există"
            description="A fost șters sau nu mai este public."
            action={
              <ButtonLink href={routes.competitions()} variant="secondary">
                Vezi concursurile
              </ButtonLink>
            }
          />
        ) : (
          <DetailSection tone="plain">
            <ImageViewer image={image} sheet={sheet} name={name} slow={slow} focusOnReady={attempt > 0} summary={summary} tableHref={backHref} />
          </DetailSection>
        )}
      </DetailBody>
    </DetailPage>
  );
}

/* ------------------------------------------------------------------ */
/* The stage's frame: the same box for the skeleton and the image       */
/* ------------------------------------------------------------------ */

/** Phone (window narrower than 768, the frame's own breakpoint): the image opens at this scale of its pixels — table text ≈ 9 css px — not at the 19% fit. */
const PHONE_SCALE = 0.45;
/** On the phone the sheet opens with the table's left edge this far in from the stage's (Stand and Participant first). */
const PHONE_INSET = 8;
const PHONE_MAX = 768;
/** Room kept under the phone's toolbar so it never touches the window's edge. */
const BOTTOM_GUTTER = 16;

/** A sheet of the usual proportions, when the server could not plan it (png/sheet.tsx sheetGeometry's blocks). */
const DEFAULT_SHEET: SheetGeometry = {
  width: 1950,
  height: 1500,
  top: 84,
  header: { y: 84, h: 240 },
  title: null,
  table: { x: 488, y: 384, w: 975, h: 840, rows: 20 },
  stats: { y: 1272, h: 144 },
};

/*
 * The frame. Phone: the whole room left in the window under where it starts (`--avail`, measured:
 * the window's height − the frame's top − the toolbar row − a gutter), the image on the page's
 * ground, so the toolbar sits at the screen's bottom for every ranking. From 768: the image's own
 * proportions at the column's width (fitted to the width, the page scrolls it), drawn as a sheet of
 * paper (the card radius, a hairline edge and the e1 elevation) on the page's ground; the toolbar row
 * sticks to the window's bottom while the sheet is taller than the window.
 */
const FRAME_CLASS =
  'relative w-full min-h-40 overflow-hidden bg-page h-(--avail) [--avail:calc(100dvh-13rem)] md:h-auto md:min-h-0 md:aspect-(--ratio) md:rounded-card md:bg-surface md:shadow-e1 md:ring-1 md:ring-hairline';

function frameStyle(size: { width: number; height: number }, avail: number | null): CSSProperties {
  return {
    '--ratio': `${size.width} / ${size.height}`,
    ...(avail != null ? { '--avail': `${Math.max(avail, 160)}px` } : {}),
  } as CSSProperties;
}

/** The room left under `ref`'s top in the window, minus its last child (the toolbar row) and the gutter. */
function useAvailableHeight(ref: RefObject<HTMLDivElement | null>) {
  const [avail, setAvail] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const toolbar = (el.lastElementChild as HTMLElement | null)?.offsetHeight ?? 0;
      setAvail(Math.floor(window.innerHeight - top - toolbar - BOTTOM_GUTTER));
    };
    measure();
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [ref]);
  return avail;
}

function ImageViewer({
  image,
  sheet,
  name,
  slow,
  focusOnReady,
  summary,
  tableHref,
}: {
  image: Ready | null;
  sheet: SheetGeometry | null;
  name: string;
  slow: boolean;
  focusOnReady: boolean;
  summary?: string;
  tableHref: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const avail = useAvailableHeight(wrap);
  const plan = sheet ?? DEFAULT_SHEET;
  const style = frameStyle(image ?? plan, avail);
  const tableLink = (
    <Link href={tableHref} className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 t-label text-accent-ink hover:underline [&>svg]:size-4">
      <TableCellsIcon aria-hidden />
      <span className="md:hidden">Vezi tabelul</span>
      <span className="max-md:hidden">Vezi clasamentul ca tabel</span>
    </Link>
  );
  return (
    <div ref={wrap} data-sheet={sheet ? `${sheet.width}x${sheet.height}` : undefined}>
      {image ? (
        <ZoomStage image={image} sheet={plan} name={name} frameStyle={style} autoFocus={focusOnReady} summary={summary} tableLink={tableLink} />
      ) : (
        <>
          <div className={FRAME_CLASS} style={style}>
            <ImageSkeleton sheet={plan} slow={slow} />
          </div>
          <ToolbarRow tableLink={tableLink}>
            <ZoomToolbar percent={null} live={false} atMin atMax onOut={() => {}} onIn={() => {}} onFit={() => {}} disabled />
          </ToolbarRow>
        </>
      )}
    </div>
  );
}

/** loading.tsx: the stage's frame (usual proportions) with its skeleton and the disabled zoom toolbar. */
export function ImageViewerSkeleton({ tableHref }: { tableHref: string }) {
  return <ImageViewer image={null} sheet={null} name="" slow={false} focusOnReady={false} tableHref={tableHref} />;
}

/** Under the stage: the way to the table (left) and the zoom toolbar (right); from 768 it sticks to the window's bottom. */
function ToolbarRow({ tableLink, children }: { tableLink: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-hairline px-2 py-1 md:sticky md:bottom-0 md:z-sticky md:mt-3 md:border-t-0 md:bg-page md:px-0 md:py-2">
      {tableLink}
      {children}
    </div>
  );
}

/** A percentage of the sheet: the skeleton's bones sit where the image's blocks will. */
const pct = (n: number, of: number) => `${(n / of) * 100}%`;

/*
 * Generating: the planned sheet's blocks — the logo, the name / organizer / dates lines and the
 * badge, the title band, the table (its width, centred, one bone per row) and the totals — on a
 * sheet of paper at the size and place the image opens at (from 768 the frame itself; on the phone
 * PHONE_SCALE, the table's left edge at the stage's, just under the sheet's top margin, as ZoomStage's
 * opening view). The status
 * sits in a pill over the table.
 */
function ImageSkeleton({ sheet, slow = false }: { sheet: SheetGeometry; slow?: boolean }) {
  const { width: W, height: H } = sheet;
  const box = (x: number, y: number, w: number, h: number): CSSProperties => ({ left: pct(x, W), top: pct(y, H), width: pct(w, W), height: pct(h, H) });
  const bone = 'absolute animate-shimmer rounded-badge';
  const hx = sheet.header;
  const rows = Math.min(sheet.table.rows, 60);
  const rowH = sheet.table.h / (rows + 1);
  const paper = {
    '--paper-w': `${Math.round(W * PHONE_SCALE)}px`,
    '--paper-h': `${Math.round(H * PHONE_SCALE)}px`,
    '--paper-top': `${-Math.round(sheet.top * PHONE_SCALE) + 8}px`,
    '--paper-left': `${Math.min(0, -Math.round(sheet.table.x * PHONE_SCALE) + PHONE_INSET)}px`,
  } as CSSProperties;
  return (
    <div aria-hidden className="absolute inset-0">
      <div
        style={paper}
        className="absolute top-(--paper-top) left-(--paper-left) h-(--paper-h) w-(--paper-w) bg-surface md:inset-0 md:h-full md:w-full"
      >
        {/* Header: logo + tagline, the three centred lines, the badge and the export date. */}
        <span className={bone} style={box(24, hx.y + hx.h * 0.28, 390, hx.h * 0.3)} />
        <span className={bone} style={box(24 + 60, hx.y + hx.h * 0.66, 330, hx.h * 0.08)} />
        <span className={bone} style={box(W * 0.33, hx.y + hx.h * 0.08, W * 0.3, hx.h * 0.2)} />
        <span className={bone} style={box(W * 0.36, hx.y + hx.h * 0.46, W * 0.24, hx.h * 0.12)} />
        <span className={bone} style={box(W * 0.35, hx.y + hx.h * 0.74, W * 0.26, hx.h * 0.12)} />
        <span className={bone} style={box(W - 24 - 300, hx.y + hx.h * 0.1, 300, hx.h * 0.2)} />
        <span className={bone} style={box(W - 24 - 360, hx.y + hx.h * 0.78, 360, hx.h * 0.08)} />
        {sheet.title ? <span className={bone} style={box(W * 0.38, sheet.title.y + sheet.title.h * 0.15, W * 0.24, sheet.title.h * 0.7)} /> : null}
        {/* The table: the head, then one bone per row, at the table's own width. */}
        <span className={cn(bone, 'opacity-60')} style={box(sheet.table.x, sheet.table.y, sheet.table.w, rowH * 0.9)} />
        {Array.from({ length: rows }, (_, i) => (
          <span key={i} className={bone} style={box(sheet.table.x, sheet.table.y + rowH * (i + 1), sheet.table.w, rowH * 0.8)} />
        ))}
        {[0, 1, 2, 3].map(i => (
          <span key={i} className={bone} style={box(W * (0.1 + i * 0.21), sheet.stats.y + sheet.stats.h * 0.3, W * 0.16, sheet.stats.h * 0.45)} />
        ))}
      </div>
      <span className="absolute inset-x-0 top-1/3 flex justify-center px-4 md:top-(--pill-top)" style={{ '--pill-top': pct(sheet.table.y + 24, H) } as CSSProperties}>
        <span className="flex flex-col items-center gap-0.5 rounded-control bg-surface px-4 py-2 text-center shadow-e2">
          <span className="t-label text-ink-2">Se generează imaginea…</span>
          {slow ? <span className="t-caption text-muted">Durează mai mult decât de obicei…</span> : null}
        </span>
      </span>
    </div>
  );
}

/**
 * fish: «Am întâmpinat o eroare!», the reason, «Înapoi» — plus the retry the web can offer, in the
 * kit DetailRetry's form: the secondary button, busy (aria-busy, not pressable twice, focus kept)
 * while the image is drawn again, and a polite status when it fails again. (DetailRetry itself
 * re-renders the route; here the PNG is fetched again, so the button is local.)
 */
function Failed({ backHref, retry, pending, attempt }: { backHref: string; retry: () => void; pending: boolean; attempt: number }) {
  const router = useRouter();
  return (
    <div role="alert">
      <DetailSectionState
        icon={
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-status-danger-bg text-status-danger-fg [&>svg]:size-6">
            <ExclamationCircleIcon aria-hidden />
          </span>
        }
        heading="Am întâmpinat o eroare!"
        description={FAILED_COPY}
        action={
          <>
            <span className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" aria-busy={pending || undefined} aria-disabled={pending || undefined} onClick={() => (pending ? undefined : retry())}>
                {pending ? 'Se generează…' : 'Încearcă din nou'}
              </Button>
              <Button variant="secondary" onClick={() => (window.history.length > 1 ? router.back() : router.push(backHref))}>
                Înapoi
              </Button>
            </span>
            <span role="status" className="sr-only">
              {attempt > 0 && !pending ? 'Tot nu s-a putut genera imaginea.' : ''}
            </span>
          </>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Zoom and pan (fish ResumableZoom)                                   */
/* ------------------------------------------------------------------ */

type View = { scale: number; x: number; y: number };

/** In the PNG's pixels (SCALE× the sheet): 2 = 300% of the sheet's own size. */
const MAX_SCALE = 2;
const STEP = 1.25;
/** How far the edge fades reach (the «more this way» cue). */
const FADE = 48;
const HINT_KEY = 'bluvi:ranking-image-pan-hint';

function ZoomToolbar({
  percent,
  live,
  atMin,
  atMax,
  onOut,
  onIn,
  onFit,
  disabled = false,
}: {
  percent: number | null;
  live: boolean;
  atMin: boolean;
  atMax: boolean;
  onOut: () => void;
  onIn: () => void;
  onFit: () => void;
  disabled?: boolean;
}) {
  const btn = 'disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div role="toolbar" aria-label="Zoom" className="flex items-center gap-1">
      <IconButton aria-label="Micșorează" onClick={onOut} disabled={disabled || atMin} size="size-11 xl:size-10" className={btn}>
        <MagnifyingGlassMinusIcon aria-hidden />
      </IconButton>
      {/* Announced only once the reader zooms: the opening value means nothing out of context. */}
      <output aria-live={live ? 'polite' : 'off'} className="w-12 text-center t-label text-ink-2 tabular-nums">
        {percent != null ? (
          <>
            <span className="sr-only">Zoom </span>
            {percent}%
          </>
        ) : null}
      </output>
      <IconButton aria-label="Mărește" onClick={onIn} disabled={disabled || atMax} size="size-11 xl:size-10" className={btn}>
        <MagnifyingGlassPlusIcon aria-hidden />
      </IconButton>
      <IconButton aria-label="Potrivește pe lățime" onClick={onFit} disabled={disabled} size="size-11 xl:size-10" className={btn}>
        <ArrowsPointingInIcon aria-hidden />
      </IconButton>
    </div>
  );
}

/** «More this way» as a mask on the stage itself, so the sheet fades into whatever ground is behind it. */
function edgeMask(more: { top: boolean; bottom: boolean; left: boolean; right: boolean }): CSSProperties {
  const layers = [
    more.bottom && `linear-gradient(to bottom, black calc(100% - ${FADE}px), transparent)`,
    more.top && `linear-gradient(to top, black calc(100% - ${FADE / 2}px), transparent)`,
    more.right && `linear-gradient(to right, black calc(100% - ${FADE}px), transparent)`,
    more.left && `linear-gradient(to left, black calc(100% - ${FADE / 2}px), transparent)`,
  ].filter(Boolean) as string[];
  if (!layers.length) return {};
  const image = layers.join(', ');
  return { maskImage: image, WebkitMaskImage: image, maskComposite: 'intersect', WebkitMaskComposite: 'source-in' };
}

/**
 * The image in the frame. From 768 fitted to the width (the page scrolls it); on the phone at a
 * readable PHONE_SCALE, the table's left edge PHONE_INSET in from the stage's and just under the
 * sheet's top margin, so the title and the table's Stand and Participant columns are the first view
 * and the drag hint invites panning right to the numbers (fish fits the whole sheet instead; at 375
 * that is 19% — unreadable). Then zoomed with the buttons, Ctrl / ⌘ + wheel, a pinch or a double click,
 * and panned by dragging, the wheel or the arrow keys (+ / − / 0 zoom from the keyboard too). Never
 * smaller than the whole image in the stage, never more than MAX_SCALE. The wheel pans the image
 * only while it can move; at its edge it scrolls the page. Edge fades say where more of it is, and
 * the phone's first visit says it can be dragged.
 */
function ZoomStage({
  image,
  sheet,
  name,
  frameStyle: style,
  autoFocus,
  summary,
  tableLink,
}: {
  image: Ready;
  sheet: SheetGeometry;
  name: string;
  frameStyle: CSSProperties;
  autoFocus: boolean;
  summary?: string;
  tableLink: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const describedBy = useId();
  const [box, setBox] = useState<{ w: number; h: number; phone: boolean } | null>(null);
  // What the reader did (null: untouched); `view` is it clamped to the stage, first the opening view.
  const [wanted, setWanted] = useState<View | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight, phone: window.innerWidth < PHONE_MAX });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (autoFocus) stage.current?.focus();
  }, [autoFocus]);

  const phone = !!box?.phone;
  // The phone's one-time «drag to see it all» chip (per viewer: once dismissed, never again). The
  // stage only mounts in the browser (the image is a fetched blob), so storage is readable here.
  const [hintSeen, setHintSeen] = useState(() => {
    try {
      return window.localStorage.getItem(HINT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const hint = phone && !hintSeen;
  const dismissHint = () => {
    if (hintSeen) return;
    setHintSeen(true);
    try {
      window.localStorage.setItem(HINT_KEY, '1');
    } catch {
      // Storage blocked: it comes back next visit.
    }
  };

  const fitWidth = box ? box.w / image.width : 1;
  const contain = box ? Math.min(box.w / image.width, box.h / image.height) : 1;
  const minScale = Math.min(contain, fitWidth);

  const clamp = useCallback(
    (v: View): View => {
      if (!box) return v;
      const scale = Math.min(Math.max(v.scale, minScale), MAX_SCALE);
      const w = image.width * scale;
      const h = image.height * scale;
      const x = w <= box.w ? (box.w - w) / 2 : Math.min(0, Math.max(box.w - w, v.x));
      // Shorter than the stage: at its top (the sheet reads from its header down), centred across.
      const y = h <= box.h ? 0 : Math.min(0, Math.max(box.h - h, v.y));
      return { scale, x, y };
    },
    [box, minScale, image.width, image.height],
  );

  const openingScale = phone ? Math.max(fitWidth, PHONE_SCALE) : fitWidth;
  const opening: View = phone
    ? { scale: openingScale, x: -(sheet.table.x * openingScale) + PHONE_INSET, y: -(sheet.top * openingScale) + 8 }
    : { scale: openingScale, x: 0, y: 0 };
  const view: View | null = box ? clamp(wanted ?? opening) : null;
  const setView = (next: (v: View | null) => View | null) => setWanted(next(view));

  const fit = () => setWanted({ scale: fitWidth, x: 0, y: 0 });

  const zoomAt = (factor: number, cx?: number, cy?: number) =>
    setView(v => {
      if (!v || !box) return v;
      const px = cx ?? box.w / 2;
      const py = cy ?? box.h / 2;
      const scale = Math.min(Math.max(v.scale * factor, minScale), MAX_SCALE);
      const k = scale / v.scale;
      return clamp({ scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
    });

  const pan = (dx: number, dy: number) => setView(v => (v ? clamp({ ...v, x: v.x + dx, y: v.y + dy }) : v));

  const local = (e: { clientX: number; clientY: number }) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // React's onWheel is passive, so the stage listens itself — and takes the wheel only when it
  // uses it: Ctrl / ⌘ zooms; a plain wheel pans while the image can move that way, and otherwise
  // reaches the page (a fitted image, or one at its edge, never freezes the page's scroll).
  const onWheel = useRef<(e: globalThis.WheelEvent) => void>(() => {});
  const handleWheel = (e: globalThis.WheelEvent) => {
    if (!view) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const p = local(e);
      zoomAt(Math.exp(-e.deltaY / 300), p.x, p.y);
      return;
    }
    const next = clamp({ ...view, x: view.x - e.deltaX, y: view.y - e.deltaY });
    if (Math.abs(next.x - view.x) < 0.5 && Math.abs(next.y - view.y) < 0.5) return;
    e.preventDefault();
    setWanted(next);
  };
  useLayoutEffect(() => {
    onWheel.current = handleWheel;
  });
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const listener = (e: globalThis.WheelEvent) => onWheel.current(e);
    el.addEventListener('wheel', listener, { passive: false });
    return () => el.removeEventListener('wheel', listener);
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dismissHint();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 2 && view) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2 && pinch.current && view) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((pinch.current.scale * (dist / pinch.current.dist)) / view.scale, (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (pointers.current.size === 1) pan(p.x - prev.x, p.y - prev.y);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 80;
    const keys: Record<string, () => void> = {
      '+': () => zoomAt(STEP),
      '=': () => zoomAt(STEP),
      '-': () => zoomAt(1 / STEP),
      '0': fit,
      ArrowLeft: () => pan(step, 0),
      ArrowRight: () => pan(-step, 0),
      ArrowUp: () => pan(0, step),
      ArrowDown: () => pan(0, -step),
    };
    const run = keys[e.key];
    if (run) {
      e.preventDefault();
      dismissHint();
      run();
    }
  };

  // Relative to the sheet's own size (the PNG is drawn at SCALE×): the desktop fit reads ≈ 100%.
  const percent = view ? Math.round(view.scale * SCALE * 100) : null;
  const atMin = !view || view.scale <= minScale + 1e-3;
  const atMax = !view || view.scale >= MAX_SCALE - 1e-3;
  const w = view ? image.width * view.scale : 0;
  const h = view ? image.height * view.scale : 0;
  const more = {
    top: !!view && view.y < -1,
    bottom: !!view && !!box && view.y + h > box.h + 1,
    left: !!view && view.x < -1,
    right: !!view && !!box && view.x + w > box.w + 1,
  };

  return (
    <>
      <div
        ref={stage}
        role="img"
        tabIndex={0}
        aria-label={`Imaginea clasamentului concursului ${name}. Trage pentru a muta imaginea, Ctrl și rotița sau + și − pentru zoom.`}
        aria-describedby={summary ? describedBy : undefined}
        aria-roledescription="imagine cu zoom"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={e => {
          const p = local(e);
          if (view && view.scale > openingScale * 1.05) setWanted(phone ? null : { scale: fitWidth, x: 0, y: 0 });
          else zoomAt(Math.max(1, openingScale * 2) / (view?.scale ?? 1), p.x, p.y);
        }}
        onKeyDown={onKeyDown}
        data-testid="ranking-image-stage"
        data-scale={view?.scale}
        data-fit={box ? fitWidth : undefined}
        data-table-x={sheet.table.x}
        data-more={Object.entries(more)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(' ')}
        style={{ ...style, ...edgeMask(more) }}
        className={cn(
          FRAME_CLASS,
          'cursor-grab touch-none outline-none select-none active:cursor-grabbing',
          // The focus ring is drawn over the image (an inset outline would sit under it).
          "after:pointer-events-none after:absolute after:inset-0 after:z-above after:rounded-[inherit] after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-accent focus-visible:after:ring-inset",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL, drawn at the stage's own scale. */}
        <img
          src={image.url}
          alt=""
          width={image.width}
          height={image.height}
          draggable={false}
          className="absolute top-0 left-0 max-w-none origin-top-left bg-surface transition-opacity duration-(--duration-fast) ease-fast"
          style={{
            width: image.width,
            height: image.height,
            transform: view ? `translate(${view.x}px, ${view.y}px) scale(${view.scale})` : undefined,
            opacity: view ? 1 : 0,
          }}
        />
        {summary ? (
          <span id={describedBy} className="sr-only">
            {summary}
          </span>
        ) : null}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-4 flex justify-center transition-opacity duration-(--duration-medium) ease-medium md:hidden',
            hint && more.right ? 'opacity-100' : 'opacity-0',
          )}
        >
          <span className="rounded-full bg-surface px-3 py-1.5 t-label text-ink-2 shadow-e2">Trage pentru a vedea tot clasamentul</span>
        </span>
      </div>
      <ToolbarRow tableLink={tableLink}>
        <ZoomToolbar
          percent={percent}
          live={wanted != null}
          atMin={atMin}
          atMax={atMax}
          onOut={() => zoomAt(1 / STEP)}
          onIn={() => zoomAt(STEP)}
          onFit={fit}
        />
      </ToolbarRow>
    </>
  );
}

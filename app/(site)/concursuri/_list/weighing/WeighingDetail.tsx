'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ArrowRightIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { InlineNumber, SignatureNumber } from '@/components/ui/SignatureNumber';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatKg, type RecentWeighing } from '@/core/competitions';
import { weighingByIdQuery, type WeighingDetail as WeighingData } from '@/core/organizer';
import { isApiError, type Transport } from '@/core/transport';
import { routes } from '@/lib/routes';
import { clockTime, timeAgo } from '../../[id]/_components/dates';
import { speciesImage } from '../../[id]/_components/species';
import { catchesBySpecies, fishCount, weigherName } from './format';

/*
 * One recent weighing, opened from the Live tab's «Cântăriri recente» (prototype app/dev/hub
 * WeighingDetail.tsx; fish WeighingDetailSheet for the body): the competition it belongs to and
 * when it was weighed, who is on the stand, the total with its state, the catches grouped by
 * species and their photos, then the way on — «Vezi concursul», «Toate cântarele».
 *
 * The strip item already carries the summary (who, stand, N pești, kg): it is drawn at once; the
 * catches come from the existing GET /feed/weighings/:id (core/organizer weighingByIdQuery), read
 * when the detail opens. ≥768 a popover anchored to the pressed item (owner rule 17), Escape / a
 * press outside / «Închide» close it and focus returns to the item; <768 fish's bottom sheet.
 */

export type WeighingDetailTarget = {
  item: RecentWeighing;
  /** The id of the pressed element: the popover sits beside it and focus returns to it. */
  anchorId: string;
};

export function WeighingDetail({ t, target, onClose }: { t: Transport; target: WeighingDetailTarget | null; onClose: () => void }) {
  const bp = useBreakpoint();
  if (!target) return null;
  const { item } = target;
  if (bp !== 'mobile') {
    return (
      <Popover key={item.weighingDocumentId} anchorId={target.anchorId} onClose={onClose}>
        <Body t={t} item={item} />
        <Actions item={item} onNavigate={onClose} />
      </Popover>
    );
  }
  // The sheet unmounts with the target (no dialog close() to hand focus back): back to the item.
  const anchorId = target.anchorId;
  const close = () => {
    onClose();
    requestAnimationFrame(() => document.getElementById(anchorId)?.focus());
  };
  return (
    <Sheet
      open
      onClose={close}
      title="Detaliu cântar"
      subtitle={`${item.competition.name} · ${clockTime(item.endAt)}`}
      footer={<Actions item={item} onNavigate={onClose} />}
      initialSnap={0.9}
    >
      <Body t={t} item={item} />
    </Sheet>
  );
}

function Body({ t, item }: { t: Transport; item: RecentWeighing }) {
  const detail = useQuery(weighingByIdQuery(t, item.weighingDocumentId));
  // «acum 3 minute» is time-dependent: computed in the browser only (the detail never prerenders).
  const [now] = useState(() => new Date());
  const name = weigherName(item);
  const finished = detail.data ? detail.data.weighingStatus === 'finished' : true;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="relative size-12 shrink-0 overflow-hidden rounded-avatar bg-soft-fill">
          {item.competition.posterUrl ? <Image src={item.competition.posterUrl} alt="" fill sizes="48px" className="object-cover" /> : null}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate t-body-strong text-ink">{item.competition.name}</span>
          <span className="truncate t-caption text-muted">
            cântărit la {clockTime(item.endAt)} · {timeAgo(item.endAt, now)}
            {item.weighingType === 'extra' ? ' · cântar extra' : ''}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-card bg-page py-3.5 ps-4 pe-3.5">
        <Avatar name={name} src={item.angler?.avatarUrl} size={48} shape={item.angler?.isTeam ? 'square' : 'round'} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate t-heading text-ink">{name}</span>
          <span className="t-label text-ink-2">{item.standLabel}</span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <SignatureNumber value={formatKg(item.totalKg)} unit="kg" size="fact" caption={`Total cântărit · ${fishCount(item.catchCount)}`} />
        <StatusPill tone={finished ? 'success' : 'live'}>{finished ? 'Terminat' : 'În curs'}</StatusPill>
      </div>

      <Catches state={detail} />
    </div>
  );
}

type DetailState = UseQueryResult<WeighingData>;

function Catches({ state }: { state: DetailState }) {
  if (state.isPending) {
    return (
      <div role="status" className="flex flex-col gap-1.5">
        <span className="sr-only">Se încarcă capturile…</span>
        {[0, 1].map((i) => (
          <span key={i} aria-hidden className="h-11 animate-shimmer rounded-control" />
        ))}
      </div>
    );
  }
  if (state.isError) {
    const gone = isApiError(state.error) && state.error.status === 404;
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-soft-fill px-3 py-2.5 t-caption text-ink-2">
        {gone ? 'Cântarul nu mai există.' : 'Nu am putut încărca capturile.'}
        {gone ? null : (
          <button type="button" onClick={() => void state.refetch()} className="cursor-pointer t-label text-accent-ink hover:underline">
            Încearcă din nou
          </button>
        )}
      </p>
    );
  }
  const catches = state.data.catches;
  if (!catches.length) return <p className="t-body text-muted">Fără capturi la acest cântar.</p>;
  const groups = catchesBySpecies(catches);
  const photos = catches.flatMap((c, i) => c.media.map((m) => ({ url: m.url, label: `Captura ${i + 1}${c.fishType ? ` · ${c.fishType.Name}` : ''}` })));
  return (
    <>
      <section className="flex flex-col gap-2" aria-label="Capturi pe specii">
        <h3 className="flex items-center justify-between t-label text-muted">
          Capturi pe specii
          <span className="t-caption">{fishCount(catches.length)}</span>
        </h3>
        <ul className="flex flex-col gap-1.5">
          {groups.map((g) => (
            <li key={g.species} className="flex items-center gap-2.5 rounded-control bg-page px-3 py-2">
              <Image src={speciesImage(g.species)} alt="" width={40} height={28} className="h-7 w-10 shrink-0 object-contain" />
              <span className="min-w-0 flex-1 truncate t-body-strong text-ink">{g.species}</span>
              <span className="t-caption text-muted">{fishCount(g.count)}</span>
              <InlineNumber value={formatKg(g.kg)} unit="kg" valueClassName="t-body-strong text-ink" />
            </li>
          ))}
        </ul>
      </section>
      {photos.length ? (
        <section className="flex flex-col gap-2" aria-label="Fotografii">
          <h3 className="t-label text-muted">Fotografii</h3>
          <ul className="grid grid-cols-4 gap-1.5">
            {photos.slice(0, 8).map((p) => (
              <li key={p.url} className="relative aspect-square overflow-hidden rounded-control bg-soft-fill">
                <a href={p.url} target="_blank" rel="noreferrer" aria-label={`${p.label} (se deschide într-o filă nouă)`} className="absolute inset-0">
                  <Image src={p.url} alt="" fill sizes="96px" className="object-cover" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function Actions({ item, onNavigate }: { item: RecentWeighing; onNavigate: () => void }) {
  const id = item.competition.documentId;
  return (
    <div className="flex gap-2 pt-1">
      <Link href={routes.competition(id)} onClick={onNavigate} className={buttonClass({ variant: 'primary', size: 'compact', className: 'flex-1' })}>
        Vezi concursul <ArrowRightIcon aria-hidden className="size-4" />
      </Link>
      <Link href={routes.competitionWeighings(id)} onClick={onNavigate} className={buttonClass({ variant: 'secondary', size: 'compact', className: 'flex-1' })}>
        Toate cântarele
      </Link>
    </div>
  );
}

const GAP = 10;
const EDGE = 12;

/** Top-layer popover beside the pressed item; Escape, «Închide» or a press outside close it. */
function Popover({ anchorId, onClose, children }: { anchorId: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      el.showPopover();
    } catch {
      /* already shown */
    }
    const place = () => {
      const anchor = document.getElementById(anchorId);
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const a = anchor?.getBoundingClientRect();
      if (!a) return setPos({ top: Math.max(EDGE, (vh - h) / 2), left: (vw - w) / 2 });
      // Under the item when there is room (the strip is a horizontal row), else above it.
      const below = a.bottom + GAP;
      const top = below + h <= vh - EDGE ? below : Math.max(EDGE, a.top - GAP - h);
      const left = Math.min(Math.max(EDGE, a.left), vw - w - EDGE);
      setPos({ top, left });
    };
    place();
    el.focus();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorId]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || document.getElementById(anchorId)?.contains(t)) return;
      onClose();
    };
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', down);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', down);
      document.getElementById(anchorId)?.focus();
    };
  }, [anchorId, onClose]);

  return (
    <div
      ref={ref}
      popover="manual"
      role="dialog"
      aria-label="Detaliu cântar"
      tabIndex={-1}
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
      className={cn(
        'fixed m-0 flex max-h-[calc(100dvh-24px)] w-95 flex-col gap-4 overflow-y-auto rounded-card bg-surface p-4 text-ink shadow-[var(--shadow-e2),var(--shadow-e0)] outline-none',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="t-eyebrow text-muted uppercase">Detaliu cântar</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="grid size-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-accent"
        >
          <XMarkIcon aria-hidden className="size-5" />
        </button>
      </div>
      {children}
    </div>
  );
}

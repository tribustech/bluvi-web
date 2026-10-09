'use client';

import Link from 'next/link';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { StarIcon } from '@heroicons/react/20/solid';
import { FishIcon } from '@/components/icons/brand';
import { CatchRow, CatchThumb } from '@/components/partide/session/CatchRow';
import { catchCaption, clockRo, dayMonthRo, durationLabel, longDateRo, spacedDuration } from '@/components/partide/session/format';
import { Lightbox, type LightboxItem } from '@/components/surfaces/Lightbox';
import { AsideSection, ListEmpty, ListError, ListFooter, ListHeader, ListPage } from '@/components/templates/T1';
import { Badge } from '@/components/ui/Badge';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { InlineNumber } from '@/components/ui/SignatureNumber';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  communityKeys,
  communitySessionQuery,
  fmtKg,
  fullSource,
  gridSource,
  sessionCatchesInfiniteQuery,
  type CommunitySessionDetailCatchDTO,
  type CommunitySessionDetailDTO,
} from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../../_shell/SiteHeader';
import { SpectatorNotFound } from '../../_spectator/states';
import { CatchesBodySkeleton, CatchesListSkeleton, SubtitleBone } from './CatchesSkeleton';
import { BODY, CARD, COL, LIST_COLUMN, SIDE } from './layout';

/*
 * Capturi — every catch of a partidă (parity partide.spectator-capturi; fish
 * app/(app)/partide/comunitate/capturi/[id].tsx, community/hooks.ts useSessionCatchesInfinite),
 * behind the partidă page's «Vezi toate ({n})». Public, read-only, Revolut-clean.
 *  - c1 «Capturi ({total})» — the total from page 1, else just «Capturi» — with the way back to
 *    the partidă (T1 ListHeader's back square);
 *  - c2 every catch, newest first, 20 a page on a cursor, the next page as the end nears; the
 *    partidă's biggest catch highlighted: its kg in indigo, as fish (compared with the partidă's
 *    `maxKg`, never re-derived from the loaded pages — fish's own rule). Phone: fish's rows (the B1
 *    CatchRow). From 768 a real table, every column visible (owner rule 14), sized to its content
 *    (rule 16), the biggest one also labelled «Cea mai mare»; from 1280 the partidă's summary docks
 *    at its right;
 *  - c3 a row with a photo opens the kit Lightbox — photos only, in the list's order — captioned
 *    «{specie} · {kg} kg · HH:MM»;
 *  - a partidă whose catches span more than one calendar day (they can last 36 h) shows the day:
 *    a «Zi» column in the table, a day caption above each day's rows on the phone, «10 AUG, 14:50»
 *    in the lightbox. A same-day partidă keeps HH:MM alone (fish);
 *  - live: the partidă's 60 s poll (c14) moving its catchCount / maxKg reads the list again, so the
 *    title, the rows, the highlighted biggest and the summary never disagree (the summary's count
 *    IS the list's total once it is known).
 *  - c4 «Nicio captură încă.» when empty; the list skeleton on the first load.
 * Data: core sessionCatchesInfiniteQuery + communitySessionQuery (maxKg, the venue for the title
 * row and the summary), both seeded by the server's cached reads (page.tsx) when it had them. A
 * 404 / 400 from either (unknown, deleted or private — visibleOnProfile false, invariant 15) is
 * the partidă's not-found state: nothing of it stays on screen.
 */

const TITLE_ID = 'capturi-titlu';

const gone = (e: unknown) => isApiError(e) && (e.status === 404 || e.status === 400);

/** The Bucharest calendar day of an instant (longDateRo: «10 august 2026»). */
const dayOf = (iso: string) => longDateRo(iso);

/** «10 AUG, 14:50» on a multi-day partidă, «14:50» otherwise. */
const whenOf = (iso: string, multiDay: boolean) => (multiDay ? `${dayMonthRo(iso)}, ${clockRo(iso)}` : clockRo(iso));

export function CatchesView({ documentId }: { documentId: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const session = useQuery(communitySessionQuery(t, documentId));
  const q = useInfiniteQuery(sessionCatchesInfiniteQuery(t, documentId));
  const [lightbox, setLightbox] = useState<number | null>(null);
  const qc = useQueryClient();

  // The partidă polls every 60 s while live (c14); the list has no interval of its own. When the
  // poll brings a new count or a new biggest (or the end), read the list again, so the title, the
  // rows and the highlighted biggest catch up with the summary.
  const polled = session.data;
  const signature = polled ? `${polled.catchCount}|${polled.maxKg ?? ''}|${polled.endedAt ?? ''}` : null;
  const lastSignature = useRef(signature);
  useEffect(() => {
    const before = lastSignature.current;
    lastSignature.current = signature;
    if (before == null || signature == null || before === signature) return;
    void qc.invalidateQueries({ queryKey: communityKeys.sessionCatches(documentId), exact: true });
  }, [signature, qc, documentId]);

  const rows = useMemo(() => (q.data?.pages ?? []).flatMap(p => p.data), [q.data]);
  const total = q.data?.pages[0]?.meta.pagination.total;
  // More than one calendar day among the rows, or (more pages to come) the partidă began on an
  // earlier day than its newest catch: decided before the older rows land, so it never flips.
  const multiDay = useMemo(() => {
    if (new Set(rows.map(r => dayOf(r.occurredAt))).size > 1) return true;
    const start = polled?.startedAt;
    return !!(q.hasNextPage && start && rows[0] && dayOf(start) !== dayOf(rows[0].occurredAt));
  }, [rows, q.hasNextPage, polled?.startedAt]);
  const photoRows = useMemo(() => rows.filter(r => fullSource(r)), [rows]);
  const lightboxItems = useMemo<LightboxItem[]>(
    () =>
      photoRows.map(c => ({
        key: c.clientId,
        src: fullSource(c) ?? '',
        preview: gridSource(c) ?? undefined,
        alt: multiDay ? [c.species, c.weightKg != null ? `${fmtKg(c.weightKg)} kg` : null, whenOf(c.occurredAt, true)].filter(Boolean).join(' · ') : catchCaption(c),
      })),
    [photoRows, multiDay],
  );

  if (gone(session.error) || gone(q.error)) return <SpectatorNotFound />;

  const detail = session.data ?? null;
  const maxKg = detail?.maxKg ?? null;
  const isMax = (c: CommunitySessionDetailCatchDTO) => maxKg != null && c.weightKg === maxKg;
  const openOf = (c: CommunitySessionDetailCatchDTO) => {
    const i = photoRows.findIndex(p => p.clientId === c.clientId);
    return i >= 0 ? () => setLightbox(i) : undefined;
  };
  const loadMore = () => {
    if (!q.hasNextPage || q.isFetchingNextPage) return;
    void q.fetchNextPage();
  };
  const partida = routes.partida(documentId);

  const header = (
    <ListHeader
      title={<span data-testid="catches-title">{`Capturi${total != null ? ` (${total})` : ''}`}</span>}
      titleId={TITLE_ID}
      // The partidă, once it is known (rule 4: no placeholder name).
      description={
        detail ? <span data-testid="catches-subtitle">{`Partidă la ${detail.venueName}`}</span> : session.isPending ? <SubtitleBone /> : undefined
      }
      back={{ label: 'Înapoi la partidă', href: partida }}
    />
  );

  let body;
  if (q.isPending) {
    body = <CatchesListSkeleton />;
  } else if (q.isError && !q.data) {
    body = (
      <div data-testid="catches-error">
        <ListError
          title="Nu am putut încărca capturile."
          onRetry={() => void q.refetch()}
          retrying={q.isFetching}
          retryLabel="Reîncearcă"
          attempt={q.errorUpdateCount}
        />
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div data-testid="catches-empty">
        <ListEmpty
          icon={<FishIcon aria-hidden className="size-12 text-accent" />}
          title="Nicio captură încă."
          action={
            <Link href={partida} className={buttonClass({ variant: 'secondary' })}>
              Înapoi la partidă
            </Link>
          }
        />
      </div>
    );
  } else {
    body = (
      <>
        <section aria-labelledby={TITLE_ID} data-testid="catches-list" aria-busy={q.isFetchingNextPage || undefined} className={CARD}>
          {/* Phone: fish's rows (a day caption above each day's rows on a multi-day partidă). */}
          <div className="md:hidden">
            {multiDay ? (
              byDay(rows).map(group => (
                <Fragment key={group.day}>
                  <h2 data-testid="catches-day" className="border-b border-hairline bg-page px-4 py-2 t-label text-muted not-first:border-t">
                    {dayMonthRo(group.rows[0].occurredAt)}
                  </h2>
                  <ul className="divide-y divide-hairline">
                    {group.rows.map(c => (
                      <CatchRow key={c.clientId} item={c} isMax={isMax(c)} onOpen={openOf(c)} />
                    ))}
                  </ul>
                </Fragment>
              ))
            ) : (
              <ul className="divide-y divide-hairline">
                {rows.map(c => (
                  <CatchRow key={c.clientId} item={c} isMax={isMax(c)} onOpen={openOf(c)} />
                ))}
              </ul>
            )}
          </div>
          {/* From 768: the table. */}
          <CatchesTable rows={rows} isMax={isMax} openOf={openOf} multiDay={multiDay} />
        </section>
        <ListFooter
          hasMore={!!q.hasNextPage}
          loadingMore={q.isFetchingNextPage}
          error={q.isFetchNextPageError}
          onLoadMore={loadMore}
          shown={rows.length}
          total={total}
          formatTotal={n => formatCount(n, 'captură', 'capturi')}
          errorLabel="Nu am putut încărca mai multe capturi."
          spinner
          // The footer of a 20-row first page sits in the observer's range on a tall screen: load the
          // next page only once the reader scrolls (the button still loads it on demand).
          armOnScroll
        />
      </>
    );
  }

  return (
    <ListPage header={header}>
      <SetBreadcrumb
        trail={[
          { label: 'Partide', href: routes.partide() },
          ...(detail ? [{ label: detail.venueName, href: partida }] : []),
          { label: 'Capturi' },
        ]}
      />
      {q.isPending && session.isPending ? (
        <CatchesBodySkeleton />
      ) : (
        <div className={BODY}>
          <div className={LIST_COLUMN}>{body}</div>
          {detail ? (
            <aside aria-label="Partida" className={SIDE} data-testid="catches-summary">
              <Summary detail={detail} documentId={documentId} count={total ?? detail.catchCount} />
            </aside>
          ) : null}
        </div>
      )}
      <Lightbox
        items={lightboxItems}
        index={lightbox}
        onIndex={setLightbox}
        total={lightboxItems.length}
        label="Fotografii"
        footer={item => <p className="t-body-strong text-on-photo-scrim">{item.alt}</p>}
      />
    </ListPage>
  );
}

/** The rows (newest first) cut into their Bucharest calendar days, in order. */
function byDay(rows: CommunitySessionDetailCatchDTO[]) {
  const groups: { day: string; rows: CommunitySessionDetailCatchDTO[] }[] = [];
  for (const r of rows) {
    const day = dayOf(r.occurredAt);
    const last = groups.at(-1);
    if (last && last.day === day) last.rows.push(r);
    else groups.push({ day, rows: [r] });
  }
  return groups;
}

/* ------------------------------------------------------------------------------------------------ */

/**
 * From 768 (owner rule 14): one row per catch with every column visible. A row with a photo opens
 * the lightbox from its thumbnail (the button keyboard users reach) or from anywhere on the row.
 */
function CatchesTable({
  rows,
  isMax,
  openOf,
  multiDay,
}: {
  rows: CommunitySessionDetailCatchDTO[];
  isMax: (c: CommunitySessionDetailCatchDTO) => boolean;
  openOf: (c: CommunitySessionDetailCatchDTO) => (() => void) | undefined;
  /** The partidă's catches span more than one day: a «Zi» column before «Ora». */
  multiDay: boolean;
}) {
  return (
    <table className="hidden w-full table-fixed border-collapse md:table" data-testid="catches-table">
      <caption className="sr-only">Capturile partidei</caption>
      <colgroup>
        {multiDay ? <col className={COL.day} /> : null}
        <col className={multiDay ? COL.timeAfterDay : COL.time} />
        <col className={COL.photo} />
        <col />
        <col className={COL.kg} />
      </colgroup>
      <thead className="bg-page">
        <tr className="border-b border-hairline text-muted">
          {multiDay ? (
            <th scope="col" className="py-2.5 ps-5 text-left t-label">
              Zi
            </th>
          ) : null}
          <th scope="col" className={cn('py-2.5 text-left t-label', !multiDay && 'ps-5')}>
            Ora
          </th>
          <th scope="col" className="py-2.5 text-left t-label">
            Foto
          </th>
          <th scope="col" className="py-2.5 text-left t-label">
            Specie
          </th>
          <th scope="col" className="py-2.5 pe-5 text-right t-label">
            Greutate
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline">
        {rows.map(c => {
          const open = openOf(c);
          const max = isMax(c);
          const species = c.species ?? 'Captură';
          const time = clockRo(c.occurredAt);
          const when = whenOf(c.occurredAt, multiDay);
          return (
            <tr
              key={c.clientId}
              data-testid="catches-row"
              data-max={max || undefined}
              onClick={open}
              className={cn(open && 'cursor-pointer transition-colors duration-(--duration-fast) ease-fast hover:bg-page')}
            >
              {multiDay ? (
                <td className="py-2.75 ps-5 align-middle t-body text-ink-2 tabular-nums">{dayMonthRo(c.occurredAt)}</td>
              ) : null}
              <td className={cn('py-2.75 align-middle', !multiDay && 'ps-5')}>
                <time dateTime={c.occurredAt} title={longDateRo(c.occurredAt)} className="t-body text-ink-2 tabular-nums">
                  {time}
                </time>
              </td>
              <td className="py-2.75 align-middle">
                {open ? (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`${species}${c.weightKg != null ? `, ${fmtKg(c.weightKg)} kg` : ''}, ${when} — vezi fotografia`}
                    onClick={e => {
                      e.stopPropagation();
                      open();
                    }}
                    className="flex cursor-pointer rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <CatchThumb item={c} />
                  </button>
                ) : (
                  <CatchThumb item={c} />
                )}
              </td>
              <td className="py-2.75 pe-3 align-middle">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate t-body-strong text-ink">{species}</span>
                  {max ? (
                    <Badge color="indigo" icon={<StarIcon aria-hidden />} className="self-center">
                      Cea mai mare
                    </Badge>
                  ) : null}
                </span>
              </td>
              <td className="py-2.75 pe-5 text-right align-middle">
                {c.weightKg != null ? (
                  <InlineNumber
                    value={fmtKg(c.weightKg)}
                    unit="kg"
                    valueClassName={cn('t-body-strong tabular-nums', max ? 'text-accent-ink' : 'text-ink')}
                    unitClassName={max ? 'text-accent-ink' : 'text-muted'}
                  />
                ) : (
                  <span className="t-body text-muted">
                    <span aria-hidden>–</span>
                    <span className="sr-only">necântărită</span>
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------------------------------------ */

/**
 * From 1280: the partidă these catches belong to — status, where and when, the count (the list's
 * own total once known, so it always matches the title), the biggest.
 */
function Summary({ detail, documentId, count }: { detail: CommunitySessionDetailDTO; documentId: string; count: number }) {
  const live = detail.endedAt == null;
  const length = durationLabel(detail);
  const biggest = detail.maxCatch;
  return (
    <AsideSection title="Partida">
      <div className="flex flex-col gap-1">
        <span>{live ? <StatusPill tone="live">ÎN DESFĂȘURARE</StatusPill> : <StatusPill tone="neutral">ÎNCHEIATĂ</StatusPill>}</span>
        <p className="mt-1.5 t-body-strong text-ink">{detail.venueName}</p>
        <p className="t-caption text-muted">
          {[detail.locality, dayMonthRo(detail.startedAt), length ? spacedDuration(length) : null].filter(Boolean).join(' · ')}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5 rounded-control bg-page px-3 py-2.5">
          <dt className="t-caption text-muted">Capturi</dt>
          <dd className="t-title2 text-ink tabular-nums">{count}</dd>
        </div>
        {detail.maxKg != null ? (
          <div className="flex flex-col gap-0.5 rounded-control bg-accent-tint px-3 py-2.5">
            <dt className="t-caption text-accent-ink">Cea mai mare</dt>
            <dd className="flex flex-col">
              <InlineNumber value={fmtKg(detail.maxKg)} unit="kg" valueClassName="t-title2 text-accent-ink" unitClassName="text-accent-ink" />
              {biggest?.species ? <span className="truncate t-caption text-accent-ink">{biggest.species}</span> : null}
            </dd>
          </div>
        ) : null}
      </dl>
      <Link href={routes.partida(documentId)} className={buttonClass({ variant: 'secondary', block: true })}>
        Vezi partida
      </Link>
    </AsideSection>
  );
}

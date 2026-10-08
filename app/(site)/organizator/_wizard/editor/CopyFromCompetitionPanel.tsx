'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ChevronRightIcon, DocumentDuplicateIcon, DocumentTextIcon, SparklesIcon } from '@heroicons/react/24/outline';
import {
  availableSourcesCount,
  filterOutCurrentCompetitionSource,
  getOrganizerCompetitionSourceDetail,
  organizerCompetitionsInfiniteQuery,
  type DraftCompetition,
  type OrganizerCompetitionSourceSummary,
} from '@/core/organizer';
import { formatCount } from '@/core/realtime/chat/format';
import type { RichTextNode } from '@/core/shared';
import { createBrowserTransport } from '@/lib/client/transport';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { pickSurface } from '@/components/surfaces/rule';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { T4Spinner } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/components/ui/cn';
import { RichText } from '../../../stiri/_content/RichText';
import { draftImage } from '../../_panel/model';
import { panelCopy, sourceContentKey, sourceDate, sourceStatusBadge, type RichTextField } from './model';

/*
 * organizer.rich-text-editor c6–c9 — «Copiază din altă competiție» (fish
 * components/competition/RegulationSourcePickerSheet.tsx + rich-text-editor.tsx:183-292).
 *
 * The kit surface rule, intent `reading`: <768 a Sheet (90%, fish 80% snap), ≥768 the wide Dialog
 * with its body scrolling and the actions pinned. Two views in one surface, like fish:
 *  - list: the hint, «N competiție disponibilă / competiții disponibile» (formatCount; the current
 *    draft / competition excluded and not counted), the organizer's competitions 10 per page
 *    (organizerCompetitionsInfiniteQuery — the panel's own key, shared with the panel's «Toate»),
 *    more loaded when the end of the list scrolls into view; loading / error + «Reîncearcă» /
 *    first-competition empty copy; «Închide».
 *  - preview: «Previzualizare <câmp>», the source's name, date and status badge, its content
 *    (rendered as the competition page renders it), «Se încarcă …», an error + «Reîncearcă», or
 *    «Competiția selectată nu are …»; «Înapoi» / «Copiază» (disabled while loading or empty).
 * The count is shown once the list answered (rule 4: never a «0» that only means «not yet»).
 * Reads only (GET /competitions/organizer/my-competitions, /competitions/organizer/:id or
 * /competitions/organizer/draft/:id for a draft source).
 */

const PAGE_SIZE = 10;

type Props = {
  field: RichTextField;
  /** The draft / competition being edited: left out of the list (fish currentSourceId). */
  currentId: string | null;
  onClose: () => void;
  /** «Copiază» with the source's content (Strapi blocks); the editor asks before replacing text. */
  onCopy: (blocks: RichTextNode[]) => void;
};

export function CopyFromCompetitionPanel({ field, currentId, onClose, onCopy }: Props) {
  const [source, setSource] = useState<OrganizerCompetitionSourceSummary | null>(null);
  const surface = pickSurface('reading', useBreakpoint());
  const copy = panelCopy(field);
  const t = useMemo(() => createBrowserTransport(), []);
  const scrollTop = useRef<HTMLDivElement>(null);

  // A new view starts at its top (the list kept its place in fish only because it stayed mounted).
  useEffect(() => {
    scrollTop.current?.parentElement?.scrollTo({ top: 0 });
  }, [source]);

  return (
    <ResponsiveSurface
      open
      onClose={onClose}
      intent="reading"
      title={source ? copy.previewTitle : copy.listTitle}
      sheetSnap={0.9}
      pinnedActions
      actions={
        source ? (
          <PreviewActions key={source.documentId} t={t} source={source} field={field} onBack={() => setSource(null)} onCopy={onCopy} block={surface === 'sheet'} />
        ) : (
          <Button variant="secondary" onClick={onClose} block={surface === 'sheet'} data-testid="rte-copy-close">
            Închide
          </Button>
        )
      }
    >
      <div ref={scrollTop} data-testid="rte-copy-panel" data-view={source ? 'preview' : 'list'} data-surface={surface} className="flex flex-col gap-4 pt-1">
        {source ? (
          <Preview key={source.documentId} t={t} source={source} field={field} />
        ) : (
          <SourceList t={t} field={field} currentId={currentId} onSelect={setSource} />
        )}
      </div>
    </ResponsiveSurface>
  );
}

type T = ReturnType<typeof createBrowserTransport>;

/* ── list ───────────────────────────────────────────────────────────────────────────────────── */

function SourceList({ t, field, currentId, onSelect }: { t: T; field: RichTextField; currentId: string | null; onSelect: (s: OrganizerCompetitionSourceSummary) => void }) {
  const copy = panelCopy(field);
  // fish reloads page 1 on every opening (openSourceSheet → loadSources(1)): the cache is shared
  // with the panel's «Toate» and may predate this draft or a rename, so cached rows (and the count)
  // show only once the fresh answer is in.
  const list = useInfiniteQuery({
    ...organizerCompetitionsInfiniteQuery(t, { isOrganizer: true, pageSize: PAGE_SIZE }),
    retry: false,
    refetchOnMount: 'always',
  });
  const fresh = list.isFetchedAfterMount;
  const sources = useMemo(
    () => filterOutCurrentCompetitionSource(list.data?.pages.flatMap(p => p.data) ?? [], currentId),
    [list.data, currentId],
  );
  const total = list.data && fresh ? availableSourcesCount(list.data.pages[0]?.meta.pagination.total ?? 0, currentId) : null;

  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, sources.length]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="flex items-start gap-2 t-caption text-muted">
          <SparklesIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-ink" />
          <span>{copy.hint}</span>
        </p>
        {total != null && !list.isError ? (
          <p className="t-label text-ink-2" data-testid="rte-copy-count">
            {formatCount(total, 'competiție disponibilă', 'competiții disponibile')}
          </p>
        ) : null}
      </div>

      {list.isPending || !fresh || (list.isError && list.isRefetching) ? (
        <div role="status" className="flex flex-col gap-1" data-testid="rte-copy-loading">
          <p className="t-body-strong text-muted">Se încarcă competițiile...</p>
          <ul aria-hidden className="flex flex-col">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <span className="size-12 shrink-0 animate-pulse rounded-control bg-soft-fill" />
                <span className="flex flex-1 flex-col gap-2">
                  <span className="h-4 w-3/5 animate-pulse rounded-badge bg-soft-fill" />
                  <span className="h-3 w-1/4 animate-pulse rounded-badge bg-soft-fill" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : list.isError && sources.length === 0 ? (
        <div role="alert" className="flex flex-col items-start gap-3" data-testid="rte-copy-error">
          <p className="t-body-strong text-status-danger-fg">Nu am putut încărca competițiile. Încearcă din nou.</p>
          <Button variant="secondary" size="compact" onClick={() => void list.refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : sources.length === 0 && !hasNextPage ? (
        <div className="flex flex-col gap-2 rounded-card bg-soft-fill p-4" data-testid="rte-copy-empty">
          <p className="t-body-strong text-ink-2">Ești la prima competiție pe care o creezi în Bluvi și nu avem de unde copia datele.</p>
          <p className="t-body-strong text-muted">Data viitoare va fi mai ușor.</p>
        </div>
      ) : (
        <>
          <ul className="-mx-2 flex flex-col divide-y divide-hairline" data-testid="rte-copy-list" aria-label="Competițiile tale">
            {sources.map(s => (
              <li key={s.documentId}>
                <SourceRow source={s} onSelect={() => onSelect(s)} />
              </li>
            ))}
          </ul>
          <div ref={sentinel} aria-hidden className="h-px" />
          {isFetchingNextPage ? (
            <div role="status" className="flex items-center justify-center gap-2 py-2 t-caption text-muted" data-testid="rte-copy-more">
              <T4Spinner className="text-accent-ink" />
              Se încarcă mai multe competiții...
            </div>
          ) : list.isFetchNextPageError ? (
            <div role="alert" className="flex items-center justify-between gap-3 py-2">
              <p className="t-caption text-status-danger-fg">Nu am putut încărca restul competițiilor.</p>
              <Button variant="secondary" size="compact" onClick={() => void fetchNextPage()}>
                Reîncearcă
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

function Thumb({ source }: { source: Pick<DraftCompetition, 'banner'> }) {
  const img = draftImage(source);
  return img ? (
    <span className="relative size-12 shrink-0 overflow-hidden rounded-control bg-soft-fill">
      <Image src={img} alt="" fill sizes="48px" className="object-cover" />
    </span>
  ) : (
    <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-control bg-accent-tint text-accent-ink outline-1 -outline-offset-1 outline-accent-tint-3">
      <DocumentTextIcon className="size-5" />
    </span>
  );
}

function Badge({ status }: { status: string | null | undefined }) {
  const b = sourceStatusBadge(status);
  return b ? <StatusPill tone={b.tone}>{b.label}</StatusPill> : null;
}

function SourceRow({ source, onSelect }: { source: OrganizerCompetitionSourceSummary; onSelect: () => void }) {
  const date = sourceDate(source.startDate);
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid="rte-copy-source"
      data-id={source.documentId}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-control px-2 py-3 text-left',
        'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-80',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
      )}
    >
      <Thumb source={source} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate t-body-strong text-ink">{source.name}</span>
        {date ? <span className="t-caption text-muted">{date}</span> : null}
      </span>
      <Badge status={source.competitionStatus} />
      <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted" />
    </button>
  );
}

/* ── preview ────────────────────────────────────────────────────────────────────────────────── */

function useSourceDetail(t: T, source: OrganizerCompetitionSourceSummary) {
  return useQuery({
    queryKey: ['organizer', 'competition-source', source.documentId, source.competitionStatus === 'draft' ? 'draft' : 'competition'],
    queryFn: () => getOrganizerCompetitionSourceDetail(t, source),
    retry: false,
  });
}

function sourceBlocks(detail: { description?: RichTextNode[] | null; regulation?: RichTextNode[] | null } | undefined, field: RichTextField) {
  const blocks = detail?.[sourceContentKey(field)];
  return Array.isArray(blocks) && blocks.length > 0 ? blocks : null;
}

function Preview({ t, source, field }: { t: T; source: OrganizerCompetitionSourceSummary; field: RichTextField }) {
  const copy = panelCopy(field);
  const detail = useSourceDetail(t, source);
  const blocks = sourceBlocks(detail.data, field);
  const loading = detail.isPending || (detail.isError && detail.isFetching);
  const date = sourceDate(detail.data?.startDate ?? source.startDate);
  return (
    <>
      <div className="flex items-center gap-3" data-testid="rte-copy-source-meta">
        <Thumb source={source} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate t-body-strong text-ink">{detail.data?.name ?? source.name}</p>
          {date ? <p className="t-caption text-muted">{date}</p> : null}
        </div>
        <Badge status={detail.data?.competitionStatus ?? source.competitionStatus} />
      </div>
      <div className="rounded-card bg-page p-4 md:p-5" data-testid="rte-copy-preview" data-state={loading ? 'loading' : detail.isError ? 'error' : blocks ? 'content' : 'empty'}>
        {loading ? (
          <div role="status" className="flex flex-col gap-3">
            <p className="t-body-strong text-muted">{copy.loadingPreview}</p>
            <span aria-hidden className="h-3 w-full animate-pulse rounded-badge bg-soft-fill" />
            <span aria-hidden className="h-3 w-11/12 animate-pulse rounded-badge bg-soft-fill" />
            <span aria-hidden className="h-3 w-3/5 animate-pulse rounded-badge bg-soft-fill" />
          </div>
        ) : detail.isError ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="t-body-strong text-status-danger-fg">{copy.previewError}</p>
            <Button variant="secondary" size="compact" onClick={() => void detail.refetch()}>
              Reîncearcă
            </Button>
          </div>
        ) : blocks ? (
          <RichText blocks={blocks} />
        ) : (
          <p className="t-body-strong text-muted">{copy.noContent}</p>
        )}
      </div>
    </>
  );
}

function PreviewActions({
  t,
  source,
  field,
  onBack,
  onCopy,
  block,
}: {
  t: T;
  source: OrganizerCompetitionSourceSummary;
  field: RichTextField;
  onBack: () => void;
  onCopy: (blocks: RichTextNode[]) => void;
  block: boolean;
}) {
  // Same query as the body (one request): the footer only needs to know whether there is content.
  const detail = useSourceDetail(t, source);
  const blocks = sourceBlocks(detail.data, field);
  return (
    <>
      <Button variant="secondary" onClick={onBack} block={block} data-testid="rte-copy-back">
        Înapoi
      </Button>
      <Button onClick={() => blocks && onCopy(blocks)} disabled={detail.isPending || !blocks} block={block} icon={<DocumentDuplicateIcon aria-hidden />} data-testid="rte-copy-confirm">
        Copiază
      </Button>
    </>
  );
}

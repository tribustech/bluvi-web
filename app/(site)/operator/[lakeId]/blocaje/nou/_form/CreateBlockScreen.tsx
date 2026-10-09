'use client';

import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { T4TextArea } from '@/components/templates/T4';
import { FlowActions, FlowAsideCard, FlowHeader, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  buildBlockInterval,
  createBlockMutation,
  formatBookingPeriod,
  nextRange,
  ownedLakesQuery,
  type DayRange,
  type OfferedBlockReason,
} from '@/core/booking';
import { formatCount } from '@/core/realtime/chat/format';
import { ApiError } from '@/core/transport';
import { routes } from '@/lib/routes';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import { OperatorErrorState } from '../../../../_shared/OperatorErrorState';
import { operatorTrail } from '../../../../_shared/OperatorFrame';
import { useOperatorTransport } from '../../../../_shared/useOperatorTransport';
import { useOwnedLakeName } from '../../../../_shared/useOwnedLakeName';
import { BlockCalendar } from './BlockCalendar';
import { CreateBlockBody, CreateBlockAsideSkeleton, EyebrowBar } from './CreateBlockFallback';
import { HourChips } from './HourChips';
import { ReasonChips } from './ReasonChips';
import { toggleChipClass } from './chips';
import {
  buildInputs,
  calendarError,
  DEFAULT_END_TIME,
  DEFAULT_REASON,
  DEFAULT_START_TIME,
  failureMessage,
  FORM_ID,
  hasErrors,
  NOTE_MAX,
  rangeDays,
  reasonLabel,
  rejectedSave,
  remainingStands,
  saveHint,
  savedMessage,
  scopeText,
  selectionLine,
  TITLE,
  TITLE_ID,
  validateBlock,
  validateNote,
  validatePeriod,
  type BlockErrors,
} from './model';
import { useBlockAvailability, useTodayKey } from './useBlockAvailability';

/*
 * /operator/[lakeId]/blocaje/nou — operator.blocaj-nou «Adaugă blocaj» (T6). fish
 * app/(app)/operator/[lakeId]/blocks.tsx (add mode) + features/operator/CreateBlockForm.tsx.
 *
 *  c1 its own route; Back and «Anulează» → the blocks list (routes.operatorBlocks).
 *  c2 «Aplică pentru»: «Tot lacul» (on when no stand is picked; picking it clears them) + one toggle
 *     chip per stand, multi-select, kept in pick order. c3 stands + tour starts from the first page.
 *  c4–c7 the calendar (./BlockCalendar), paging month by month (./useBlockAvailability).
 *  c8 the line under it; c9 the hours; c10 «Blocat: …»; c11 reason (default Închidere); c12 note ≤ 500.
 *  c0 (web, operator.b.role-gating) only an owned lake gets the form: the shared owned-lakes list
 *     (the key useOwnedLakeName reads) decides — skeleton while it loads, «Nu ai acces» when the
 *     lake is not in it (fish reaches this screen only from an owned lake's list).
 *  c13 date errors under the calendar, live once the period was touched (fish setValue
 *      shouldValidate); the note's after a save attempt. c14 a rejected save: a toast naming the
 *      first invalid field, the calendar scrolled into view (and its day focused) for a date error.
 *  c15 «Salvează și închide» / «Salvează și adaugă altul» / «Anulează», all off while saving.
 *  c16 one POST per picked stand, in order, or one whole-lake block. c17 success toast, then the
 *      list — or the form again with only the period reset. c18 a failure stops the loop: the
 *      saved blocks stay, the toast says how many landed, and (web) the saved stands leave the
 *      selection so a retry sends only the rest (the CMS has no overlap check: no duplicates). c19 core createBlockMutation invalidates
 *      bookings (availability, grid, blocks) and operator stats.
 *
 * Layout: phone stacked in fish order (scope, period, reason + note); from 1024 two columns —
 * the calendar left, the options right; from 1280 the T6 aside holds the live summary with the
 * actions docked under it. Per owner: every read and write through /api/cms, never cached.
 */

/** The wall clock, read only in event handlers (validation of «Perioada trebuie să fie în viitor»). */
const clock = () => Date.now();

export function CreateBlockScreen({ lakeId }: { lakeId: string }) {
  const router = useRouter();
  const toast = useSiteToast();
  const t = useOperatorTransport();
  const qc = useQueryClient();
  const lakeName = useOwnedLakeName(lakeId);
  const owned = useQuery(ownedLakesQuery(t));
  const todayKey = useTodayKey();
  const [monthOffset, setMonthOffset] = useState(0);
  const av = useBlockAvailability(lakeId, monthOffset, todayKey);
  const create = useMutation(createBlockMutation(t, qc));

  const [standIds, setStandIds] = useState<string[]>([]);
  const [range, setRange] = useState<DayRange>({});
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [endTime, setEndTime] = useState(DEFAULT_END_TIME);
  const [reason, setReason] = useState<OfferedBlockReason>(DEFAULT_REASON);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<BlockErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const periodRef = useRef<HTMLElement>(null);
  const dayRef = useRef<HTMLButtonElement>(null);

  const interval = buildBlockInterval(range, startTime, endTime);
  const listHref = routes.operatorBlocks(lakeId);
  const trail = operatorTrail(
    { label: lakeName ?? 'Balta', href: routes.operator(lakeId) },
    { label: 'Blocaje', href: listHref },
    { label: TITLE },
  );
  const header = (
    <FlowHeader
      title={TITLE}
      id={TITLE_ID}
      eyebrow={lakeName ?? <EyebrowBar />}
      backHref={listHref}
      backLabel="Înapoi la blocaje"
    />
  );

  // fish applyPeriod: the period fields are re-validated after every calendar or hour tap.
  const applyPeriod = (r: DayRange, from: string, to: string) => {
    const iv = buildBlockInterval(r, from, to);
    const period = validatePeriod({ startDate: iv?.start ?? '', endDate: iv?.end ?? '' }, clock());
    setErrors((e) => ({ note: e.note, ...period }));
  };

  const resetPeriod = () => {
    setRange({});
    setStartTime(DEFAULT_START_TIME);
    setEndTime(DEFAULT_END_TIME);
    setErrors({});
    setSubmitted(false);
  };

  const submit = async (keepOpen: boolean) => {
    if (saving) return;
    setSubmitted(true);
    const values = { startDate: interval?.start ?? '', endDate: interval?.end ?? '', note };
    const errs = validateBlock(values, clock());
    setErrors(errs);
    if (hasErrors(errs)) {
      const r = rejectedSave(errs, range);
      toast(r.message, 'danger');
      if (r.dateField) {
        const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        periodRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        dayRef.current?.focus({ preventScroll: true });
      }
      return;
    }
    const inputs = buildInputs(lakeId, standIds, { ...values, reason });
    setSaving(true);
    let done = 0;
    try {
      // One request per picked stand, in order; on failure the blocks already created stay.
      for (const input of inputs) {
        await create.mutateAsync(input);
        done += 1;
      }
    } catch (e) {
      toast(failureMessage(done, inputs.length, e), 'danger');
      // The saved stands leave the selection: a retry sends only what failed.
      if (done > 0) setStandIds((ids) => remainingStands(ids, inputs.slice(0, done)));
      setSaving(false);
      return;
    }
    toast(savedMessage(inputs.length), 'success');
    if (keepOpen) {
      resetPeriod();
      setSaving(false);
    } else {
      // Stays «saving» until the list paints: nothing to press twice on the way out.
      router.push(listHref);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(false);
  };

  // --- c0 ownership: not this owner's lake → «Nu ai acces» (the blocks list's wording) -----------
  const ownedLakes = owned.data;
  const refusal =
    owned.isError && !ownedLakes
      ? owned.error
      : ownedLakes && !ownedLakes.some((l) => l.documentId === lakeId)
        ? new ApiError({ message: 'Forbidden', status: 403, code: 'HTTP' })
        : null;
  if (refusal) {
    return (
      <>
        <SetBreadcrumb trail={trail} />
        <FlowLayout header={header} variant="bare" narrow labelledBy={TITLE_ID}>
          <OperatorErrorState
            error={refusal}
            onRetry={() => void owned.refetch()}
            retrying={owned.isFetching}
            attempt={owned.errorUpdateCount}
            next={routes.operatorBlockNew(lakeId)}
          />
        </FlowLayout>
      </>
    );
  }

  // --- Loading / failed first page ------------------------------------------------------------
  const ready = ownedLakes && av.query.data && todayKey;
  if (!ready) {
    if (av.query.isError && !av.query.data) {
      return (
        <>
          <SetBreadcrumb trail={trail} />
          <FlowLayout header={header} variant="bare" narrow labelledBy={TITLE_ID}>
            <OperatorErrorState
              error={av.query.error}
              onRetry={() => void av.query.refetch()}
              retrying={av.query.isFetching}
              attempt={av.query.errorUpdateCount}
              next={routes.operatorBlockNew(lakeId)}
            />
          </FlowLayout>
        </>
      );
    }
    return (
      <>
        <SetBreadcrumb trail={trail} />
        <FlowLayout header={header} labelledBy={TITLE_ID} busy aside={<CreateBlockAsideSkeleton />} asideMobile="hidden" actions={<Actions disabled />}>
          <CreateBlockBody />
        </FlowLayout>
      </>
    );
  }

  const line = selectionLine(range);
  const dateError = calendarError(errors, range);
  const blocked = interval ? formatBookingPeriod(interval.start, interval.end) : null;
  const scope = scopeText(standIds, av.stands);

  return (
    <>
      <SetBreadcrumb trail={trail} />
      <FlowLayout
        header={header}
        labelledBy={TITLE_ID}
        aside={
          <Summary
            scope={scope}
            period={blocked}
            days={range.startDate && range.endDate ? formatCount(rangeDays({ startDate: range.startDate, endDate: range.endDate }), 'zi', 'zile') : undefined}
            reason={reasonLabel(reason)}
            note={note.trim()}
          />
        }
        asideMobile="hidden"
        actions={
          <Actions
            saving={saving}
            hint={saveHint(standIds.length)}
            onSaveAndAdd={() => void submit(true)}
            onCancel={() => router.push(listHref)}
          />
        }
      >
        <form
          id={FORM_ID}
          noValidate
          onSubmit={onSubmit}
          aria-labelledby={TITLE_ID}
          aria-busy={saving || undefined}
          className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-x-8 lg:gap-y-8 xl:gap-x-10"
        >
          {/* c2 c3 — scope */}
          <section aria-labelledby="blocaj-scop" className="flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-start-1">
            <h2 id="blocaj-scop" className="t-title2 text-ink">
              Aplică pentru
            </h2>
            <div role="group" aria-labelledby="blocaj-scop" className="flex flex-wrap gap-2" data-testid="block-scope">
              <button
                type="button"
                aria-pressed={standIds.length === 0}
                disabled={saving}
                onClick={() => setStandIds([])}
                className={toggleChipClass(standIds.length === 0, saving)}
              >
                Tot lacul
              </button>
              {av.stands.map((s) => {
                const on = standIds.includes(s.documentId);
                return (
                  <button
                    key={s.documentId}
                    type="button"
                    aria-pressed={on}
                    aria-label={`Standul ${s.name}`}
                    data-stand={s.documentId}
                    disabled={saving}
                    onClick={() => setStandIds((ids) => (on ? ids.filter((id) => id !== s.documentId) : [...ids, s.documentId]))}
                    className={toggleChipClass(on, saving)}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </section>

          {/* c4–c10 c13 — period */}
          <section
            ref={periodRef}
            aria-labelledby="blocaj-perioada"
            className="flex min-w-0 scroll-mt-24 flex-col gap-3 lg:col-start-1 lg:row-span-3 lg:row-start-1"
          >
            <h2 id="blocaj-perioada" className="t-title2 text-ink">
              Perioadă
            </h2>
            <BlockCalendar
              todayKey={todayKey}
              monthOffset={monthOffset}
              onMonthOffset={setMonthOffset}
              range={range}
              onPick={(key) => {
                const next = nextRange(range, key);
                setRange(next);
                applyPeriod(next, startTime, endTime);
              }}
              busy={av.busy}
              covered={av.covered}
              monthLoading={av.monthLoading}
              monthFailed={av.monthFailed}
              onRetryMonth={av.retryMonth}
              describedBy={dateError ? 'blocaj-eroare-perioada' : undefined}
              disabled={saving}
              focusRef={dayRef}
            />
            <p
              aria-live="polite"
              data-testid="block-selection"
              className={line.complete ? 't-body-strong text-ink-2' : 't-caption text-muted'}
            >
              {line.text}
            </p>
            <HourChips
              options={av.timeOptions}
              start={startTime}
              end={endTime}
              disabled={saving}
              onStart={(v) => {
                setStartTime(v);
                applyPeriod(range, v, endTime);
              }}
              onEnd={(v) => {
                setEndTime(v);
                applyPeriod(range, startTime, v);
              }}
            />
            {blocked ? (
              <p className="t-caption text-ink-2" data-testid="block-interval">
                Blocat: {blocked}
              </p>
            ) : null}
            {dateError ? (
              <p id="blocaj-eroare-perioada" role="alert" className="t-caption text-status-danger-fg" data-testid="block-date-error">
                {dateError}
              </p>
            ) : null}
          </section>

          {/* c11 c12 — reason and note */}
          <section aria-labelledby="blocaj-motiv" className="flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-start-2">
            <h2 id="blocaj-motiv" className="t-title2 text-ink">
              Motiv
            </h2>
            <ReasonChips value={reason} onChange={setReason} labelledBy="blocaj-motiv" disabled={saving} />
            <T4TextArea
              label="Notă (opțional)"
              name="note"
              placeholder="Detalii suplimentare"
              value={note}
              maxLength={NOTE_MAX}
              rows={3}
              disabled={saving}
              error={errors.note}
              onChange={(e) => {
                const v = e.target.value;
                setNote(v);
                if (submitted) setErrors((er) => ({ ...er, note: validateNote(v) }));
              }}
              data-testid="block-note"
            />
          </section>

          {/* Phone: «Anulează» at the end of the form, so the sticky bar holds only the two saves. */}
          <Button variant="ghost" block className="md:hidden lg:col-start-2" disabled={saving} onClick={() => router.push(listHref)}>
            Anulează
          </Button>
          {saving ? <FlowLoadingStatus label="Se salvează blocajul…" /> : null}
        </form>
      </FlowLayout>
    </>
  );
}

/** c15 — the three buttons; the solid one is the form's submit (Enter). */
function Actions({
  saving = false,
  disabled = false,
  hint,
  onSaveAndAdd,
  onCancel,
}: {
  saving?: boolean;
  disabled?: boolean;
  hint?: string;
  onSaveAndAdd?: () => void;
  onCancel?: () => void;
}) {
  const off = saving || disabled;
  return (
    <FlowActions
      hint={hint}
      primary={
        <Button
          type="submit"
          form={FORM_ID}
          block
          disabled={off}
          aria-busy={saving || undefined}
          icon={saving ? <ArrowPathIcon className="motion-safe:animate-spin" /> : undefined}
          data-testid="block-save-close"
        >
          Salvează și închide
        </Button>
      }
      secondary={
        <>
          <Button variant="outline" block disabled={off} onClick={onSaveAndAdd} data-testid="block-save-add">
            Salvează și adaugă altul
          </Button>
          <Button variant="ghost" block className="max-md:hidden" disabled={off} onClick={onCancel} data-testid="block-cancel">
            Anulează
          </Button>
        </>
      }
    />
  );
}

/** ≥1280: what the save will create, as it is filled in. */
function Summary({
  scope,
  period,
  days,
  reason,
  note,
}: {
  scope: string;
  period: string | null;
  days?: string;
  reason: string;
  note: string;
}) {
  return (
    <FlowAsideCard title="Rezumat" id="blocaj-rezumat">
      <dl data-testid="block-summary" className="flex flex-col divide-y divide-hairline">
        <Row label="Aplică pentru">{scope}</Row>
        <Row label="Perioadă" muted={!period}>
          {period ? (
            <>
              {period}
              {days ? <span className="t-caption block text-muted">{days}</span> : null}
            </>
          ) : (
            'Alege zilele în calendar'
          )}
        </Row>
        <Row label="Motiv">{reason}</Row>
        {note ? (
          <Row label="Notă">
            <span className="line-clamp-4 break-words">{note}</span>
          </Row>
        ) : null}
      </dl>
    </FlowAsideCard>
  );
}

function Row({ label, muted = false, children }: { label: string; muted?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
      <dt className="t-label text-ink-2">{label}</dt>
      <dd className={cn(muted ? 't-caption text-muted' : 't-body text-ink')}>{children}</dd>
    </div>
  );
}

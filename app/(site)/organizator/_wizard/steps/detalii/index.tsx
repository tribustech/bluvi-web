'use client';

import { useCallback, useState } from 'react';
import { CalendarDaysIcon, DocumentTextIcon, IdentificationIcon } from '@heroicons/react/24/outline';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { getDateConstraintUpdates } from '@/core/organizer';
import { TextInput } from '@/components/forms/TextInput';
import { T4Section } from '@/components/templates/T4';
import { cn } from '@/components/ui/cn';
import { useWizard } from '../../context';
import type { RichTextField } from '../../editor';
import { BannerPicker } from './BannerPicker';
import { DateTimeDialog } from './DateTimeDialog';
import { FeeField } from './FeeField';
import { formatDateLabel, initialPickerDate } from './format';
import { RichTextCard } from './RichTextCard';

/*
 * Step «Detalii de bază» (parity organizer.step-basics; fish app/(app)/create-competition/
 * step-basics.tsx) — three T4 cards, fish's order and copy:
 *  - «Identitate competiție»: the name (c1, c2: error once left, auto-save on blur) and the banner
 *    (c3: crop → thumbnail → debounced auto-save);
 *  - «Conținut competiție»: Descriere * / Premii / Regulament previews (c4–c6, ?editor=…);
 *  - «Calendar și taxă»: the start / end rows with the date → time picker (c7–c9) and the fee (c10).
 * The footer («Următorul pas», the save button) is the frame's action bar (c11). From 768 the fields
 * sit side by side inside each card (name | banner, start | end, fee); from 1280 the frame adds the
 * step list on the left and the running summary on the right.
 */

type DateField = 'startDate' | 'endDate';

const RICH_TEXT_CARDS: { field: RichTextField; key: 'description' | 'reward' | 'regulation'; label: string; required?: boolean; helper: string }[] = [
  { field: 'descriere', key: 'description', label: 'Descriere', required: true, helper: 'Prezintă competiția pe scurt — locație, format, condiții.' },
  { field: 'premii', key: 'reward', label: 'Premii', helper: 'Descrie premiile oferite câștigătorilor.' },
  { field: 'regulament', key: 'regulation', label: 'Regulament', helper: 'Regulile oficiale ale competiției.' },
];

export function StepDetalii() {
  const w = useWizard();
  const { values, setValue } = w;
  // The picker's field and the date it opens on, fixed at the moment it opens.
  const [picker, setPicker] = useState<{ field: DateField; initial: Date; minDay?: Date; maxDay?: Date } | null>(null);

  const nameError = w.touched.has('name') ? w.errors.name : undefined;

  // fish's Android guard (step-basics.tsx minimumDate / maximumDate): the end's calendar greys out
  // the days before the start, the start's the days after the end, and an empty field opens on the
  // other one's date (not on today, a month the organizer would have to leave). The time of day
  // is still kept in order by getDateConstraintUpdates on confirm (c9).
  const openPicker = (field: DateField) => {
    const other = field === 'endDate' ? values.startDate : values.endDate;
    const otherDate = other ? initialPickerDate(other) : undefined;
    setPicker({
      field,
      initial: initialPickerDate(values[field] || other),
      minDay: field === 'endDate' ? otherDate : undefined,
      maxDay: field === 'startDate' ? otherDate : undefined,
    });
  };

  // c8 / c9 — fish applyDateConstraintUpdates + scheduleAutoSave: start ≤ end, then one debounced save.
  const applyDate = useCallback(
    (field: DateField, date: Date) => {
      const updates = getDateConstraintUpdates({ startDate: values.startDate, endDate: values.endDate }, field, date.toISOString());
      const keys = (['startDate', 'endDate'] as const).filter((k) => updates[k]);
      keys.forEach((k, i) => setValue(k, updates[k], { autoSave: i === keys.length - 1 ? 'debounced' : false }));
      setPicker(null);
    },
    [setValue, values.endDate, values.startDate],
  );

  const onPickBanner = useCallback((blob: Blob, filename: string) => w.pickBanner(blob, filename), [w]);

  return (
    // One query container: the fields go side by side by the form column's own width (the column
    // is ~500 px at 1280 between the step list and the summary, ~1100 at 1920), not the viewport's.
    <div className="@container flex flex-col gap-4 md:gap-5" data-testid="step-detalii">
      <T4Section
        title="Identitate competiție"
        description="Configurează numele și imaginea principală afișată în listă."
        icon={<IdentificationIcon />}
      >
        <div className="grid items-start gap-4 @2xl:grid-cols-2">
          <TextInput
            id={w.fieldIds.name}
            label="Numele competiției *"
            helper="Alege un nume scurt și ușor de reținut."
            placeholder="ex. Cupa Primăverii 2026"
            autoComplete="off"
            value={values.name ?? ''}
            error={nameError}
            disabled={w.busy}
            onChange={(e) => setValue('name', e.currentTarget.value)}
            onBlur={() => w.touch('name')}
          />
          <BannerPicker banner={values.banner} disabled={w.busy} onPick={onPickBanner} />
        </div>
      </T4Section>

      <T4Section
        title="Conținut competiție"
        description="Pregătește informațiile afișate participanților înainte de înscriere."
        icon={<DocumentTextIcon />}
      >
        {/* Side by side only from a ~900 px column (1920): narrower, three ~210 px columns show a
            few words per line, so 1280 / 1440 stack. Each card a subgrid of the same three rows (label, helper, preview), so the
            previews start on one line whatever the helper's length. */}
        <div className="grid gap-5 @4xl:grid-cols-3 @4xl:grid-rows-[auto_auto_1fr] @4xl:gap-x-4 @4xl:gap-y-1.5">
          {RICH_TEXT_CARDS.map((c) => (
            <RichTextCard
              key={c.field}
              label={c.label}
              required={c.required}
              helper={c.helper}
              value={values[c.key]}
              disabled={w.busy}
              onOpen={() => w.setQuery({ editor: c.field })}
              testId={`rich-text-${c.field}`}
            />
          ))}
        </div>
      </T4Section>

      <T4Section
        title="Calendar și taxă"
        description="Stabilește perioada desfășurării și taxa de înscriere."
        icon={<CalendarDaysIcon />}
      >
        <div role="group" aria-labelledby="concurs-perioada" aria-describedby="concurs-perioada-help" className="flex flex-col gap-1.5">
          <p id="concurs-perioada" className="t-label text-ink-2">
            Datele competiției *
          </p>
          <p id="concurs-perioada-help" className="t-caption text-muted">
            Setează perioada competiției.
          </p>
          <div className="mt-1 grid gap-2.5 @lg:grid-cols-2 @lg:gap-4">
            <DateRow label="Data începerii" value={values.startDate} disabled={w.busy} onOpen={() => openPicker('startDate')} testId="date-start" />
            <DateRow label="Data încheierii" value={values.endDate} disabled={w.busy} onOpen={() => openPicker('endDate')} testId="date-end" />
          </div>
        </div>
        <div className="grid @xl:grid-cols-2">
          <FeeField
            id="concurs-taxa"
            value={values.registerFee}
            error={w.errors.registerFee}
            disabled={w.busy}
            onChange={(next) => setValue('registerFee', next === '' ? undefined : next)}
            onBlur={() => w.touch('registerFee')}
          />
        </div>
      </T4Section>

      <DateTimeDialog
        field={picker?.field ?? null}
        initial={picker?.initial ?? new Date(0)}
        minDay={picker?.minDay}
        maxDay={picker?.maxDay}
        onCancel={() => setPicker(null)}
        onConfirm={(date) => picker && applyDate(picker.field, date)}
      />
    </div>
  );
}

/** c7 — fish's date row: the label left, «Selectează data» (muted) or the date right. */
function DateRow({ label, value, disabled, onOpen, testId }: { label: string; value: string | undefined; disabled: boolean; onOpen: () => void; testId: string }) {
  const text = formatDateLabel(value);
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-label={`${label}: ${text}`}
      data-testid={testId}
      data-empty={value ? undefined : 'true'}
      className={cn(
        'flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-control bg-soft-fill px-3 py-2.5 text-left',
        'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-accent-tint-2 active:opacity-80',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent-ink [&>svg]:size-5">
        <CalendarDaysIcon />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="t-caption text-muted">{label}</span>
        <span className={cn('truncate tabular-nums', value ? 't-body-strong text-ink' : 't-body text-muted')} data-testid={`${testId}-value`}>
          {text}
        </span>
      </span>
      <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted" />
    </button>
  );
}

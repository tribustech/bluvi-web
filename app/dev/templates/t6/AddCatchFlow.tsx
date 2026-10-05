'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { splitWeightWithScaleConstraint } from '@/core/organizer';
import { formatDecimal, plural } from '@/components/cards/format';
import { T4Notice } from '@/components/templates/T4';
import {
  BigNumberInput,
  ChoiceChips,
  FlowActions,
  FlowAsideCard,
  FlowConfirmation,
  FlowHeader,
  FlowLayout,
  QuantityStepper,
} from '@/components/templates/T6';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { StatusPill } from '@/components/ui/StatusPill';
import type { AddCatchData } from './data';
import { StandSubject } from './StandSubject';
import { READ_ONLY_TITLE } from './states';

/** fish AddCatchSheet: MAX_QUANTITY and the «too big to be true» ceiling. */
const MAX_QUANTITY = 20;
const MAX_WEIGHT_KG = 60;
const LAST_SPECIES_KEY = 'bluvi:lastFishSpeciesId';
const FORM_ID = 'adauga-captura';
/**
 * One block for the whole step, at every width and in every state (open, read-only, loading):
 * the subject card, weight | quantity (2fr | 1fr from 768), the per-fish weights and the species
 * share one width — the task card's below 1280, capped at 680 from 1280 (weight ≈ 450, quantity
 * ≈ 220: a value of six characters in a field as wide as the column reads as sparse). The subject
 * spans the block, so its right edge is the stepper's.
 */
const FORM_CAP = 'xl:max-w-170';
const FORM_GRID = 'grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]';

type Errors = { weight?: string; quantity?: string; species?: string };
type Added = { weight: number; species: string; parts: number };

/** The weight as recorded: comma or dot, rounded to the scale's gram (3 decimals). */
const parseWeight = (raw: string) => Math.round(Number.parseFloat(raw.trim().replace(',', '.')) * 1000) / 1000;

/** Digits, then at most one separator and its decimals: «4», «4,250», «4.25». */
const WEIGHT_FORMAT = /^\d+([.,]\d+)?$/;

/**
 * While typing: digits and separators only, and only the first separator is kept («4,2,5» →
 * «4,25»), so a second comma never silently truncates the weight.
 */
const sanitizeWeight = (v: string) => v.replace(/[^\d.,]/g, '').replace(/([.,].*?)[.,]/g, '$1');

/**
 * fish AddCatchSheet rules, word for word where fish's copy was right. The value checked is the
 * value recorded (rounded to 3 decimals), so 0,0001 can never be saved as «0,000 kg».
 */
function validate(weight: string, quantity: number, species: string): Errors {
  const e: Errors = {};
  const raw = weight.trim();
  const w = parseWeight(raw);
  if (!raw) e.weight = 'Acest câmp este obligatoriu.';
  else if (!WEIGHT_FORMAT.test(raw)) e.weight = 'Format invalid: 4,250';
  else if ((raw.split(/[.,]/)[1]?.length ?? 0) > 3) e.weight = 'Maximum 3 zecimale.';
  else if (!(w > 0)) e.weight = 'Greutatea minimă este 0,001 kg.';
  else if (w > MAX_WEIGHT_KG) e.weight = 'Ai introdus o valoare prea mare ca să fie adevărată! Mai verifică o dată, te rog.';
  if (!Number.isFinite(quantity) || quantity < 1) e.quantity = 'Cantitatea minimă este 1.';
  else if (!Number.isInteger(quantity)) e.quantity = 'Introdu un număr întreg.';
  else if (quantity > MAX_QUANTITY) e.quantity = `Maximum ${MAX_QUANTITY}.`;
  if (!species) e.species = 'Alege specia.';
  return e;
}

/** localStorage has no change event for the same tab; the value is read once per render. */
const noSubscribe = () => () => {};

function readLastSpecies(): string {
  try {
    return window.localStorage.getItem(LAST_SPECIES_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeLastSpecies(id: string) {
  try {
    window.localStorage.setItem(LAST_SPECIES_KEY, id);
  } catch {
    /* private mode: the species is simply not remembered */
  }
}


const describeEntry = (a: Added) => (a.parts > 1 ? `${a.parts} × ${a.species}` : a.species);

/**
 * Step 2 — «Adaugă captură» (fish scale/[id]/add.tsx + AddCatchSheet): weight (kg, comma or dot,
 * ≤ 60), quantity (1–20, split on the scale's 25 g step when > 1), species (the last one is
 * remembered), then «Finalizează» or «Adaugă și continuă». DEMO: nothing is sent to the CMS —
 * the submit goes straight to the confirmation.
 *
 * Read-only (`blockedReason`: no role, not started, finished, role unknown): no form and no action
 * bar — the subject and the stand's weighings, the reason once, in the notice. No species
 * configured: the form stays (the notice inside it says why), every control off.
 */
export function AddCatchFlow({
  data,
  eyebrow,
  meta,
  trailing,
  notice,
  backHref,
  blockedReason,
  initial,
}: {
  data: AddCatchData;
  /** Header: the competition name, step 1's meta line (lake, badges) and the status pill. */
  eyebrow: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  notice?: ReactNode;
  backHref: string;
  /** Set when the viewer may not weigh here (the notice says why): step 2 is read-only. */
  blockedReason?: string;
  /** Demo states: `invalid` pre-fills a too-big weight and shows the errors; `confirmed` opens on the result. */
  initial?: 'invalid' | 'confirmed';
}) {
  const firstSpecies = data.species[0]?.value ?? '';
  const noSpecies = data.species.length === 0;
  const readOnly = Boolean(blockedReason);
  const blocked = readOnly || noSpecies;
  const hint = noSpecies ? 'Organizatorul trebuie să configureze speciile.' : undefined;

  const [weight, setWeight] = useState(initial === 'invalid' && !blocked ? '75' : '');
  const [quantity, setQuantity] = useState(1);
  // fish restores the last species when the sheet opens, if the competition still has it. Read
  // as an external store: '' on the server and during hydration, the stored id right after.
  const stored = useSyncExternalStore(noSubscribe, readLastSpecies, () => '');
  const [picked, setSpecies] = useState('');
  // A competition with one species has nothing to choose: it is picked already, so the chip shows
  // selected and «Alege specia.» can never fire.
  const only = data.species.length === 1 ? firstSpecies : '';
  const species = picked || only || (!initial && data.species.some((s) => s.value === stored) ? stored : '');
  const [submitted, setSubmitted] = useState(initial === 'invalid' && !blocked);
  // Demo `confirmed`: the result of one catch just added — the aside lists it too.
  const demoEntry: Added | null =
    initial === 'confirmed' && firstSpecies ? { weight: 4.25, species: data.species[0].label, parts: 1 } : null;
  const [added, setAdded] = useState<Added[]>(demoEntry ? [demoEntry] : []);
  const [confirmed, setConfirmed] = useState<Added | null>(demoEntry);
  /** Focus the result only when it follows a submit (not on a direct open). */
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [announce, setAnnounce] = useState('');
  /** «Adaugă încă o captură»: the weight field takes focus once the form is back. */
  const focusWeightOnReturn = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusWeightOnReturn.current || confirmed) return;
    focusWeightOnReturn.current = false;
    weightRef.current?.focus();
  }, [confirmed]);

  const errors = submitted ? validate(weight, quantity, species) : {};
  const split = useMemo(() => {
    const w = parseWeight(weight);
    return Number.isInteger(quantity) && quantity > 1 && quantity <= MAX_QUANTITY && w > 0 ? splitWeightWithScaleConstraint(w, quantity) : [];
  }, [weight, quantity]);
  const speciesLabel = data.species.find((s) => s.value === species)?.label ?? '';

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (blocked) return;
    setSubmitted(true);
    const invalid = validate(weight, quantity, species);
    if (Object.keys(invalid).length > 0) {
      // The first invalid control takes focus; its label and error are read from there.
      const first = invalid.weight ? 'weight' : invalid.quantity ? 'quantity' : 'species';
      const target = formRef.current?.querySelector<HTMLInputElement>(
        first === 'species' ? 'input[name="species"]:checked, input[name="species"]' : `input[name="${first}"]`,
      );
      // A focus the screen moved shows its ring even after a mouse click (no :focus-visible then).
      if (target && first === 'species') target.dataset.focusRing = '';
      target?.focus({ preventScroll: true });
      // Centred, never under the sticky action bar (a radio is sr-only: scroll its fieldset).
      (first === 'species' ? target?.closest('fieldset') : target)?.scrollIntoView({ block: 'center' });
      return;
    }
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const entry: Added = { weight: parseWeight(weight), species: speciesLabel, parts: quantity };
    writeLastSpecies(species);
    setAdded((a) => [entry, ...a]);
    // fish handleAddAndContinue: reset weight and quantity, keep the species.
    setWeight('');
    setQuantity(1);
    setSubmitted(false);
    if (submitter?.value === 'continue') {
      // The running number makes every announcement new text, so two identical catches in a row
      // are both read (a polite region stays silent when its text does not change).
      setAnnounce(`Captura ${added.length + 1} adăugată: ${formatDecimal(entry.weight, 3, 3)} kg ${describeEntry(entry)}.`);
      weightRef.current?.focus();
    } else {
      setJustConfirmed(true);
      setConfirmed(entry);
    }
  };

  const restart = () => {
    setConfirmed(null);
    setJustConfirmed(false);
    setWeight('');
    setQuantity(1);
    setSubmitted(false);
    focusWeightOnReturn.current = true;
  };

  const header = (
    <FlowHeader
      id="t6-title"
      title={confirmed ? 'Captură adăugată' : readOnly ? READ_ONLY_TITLE : 'Adaugă captură'}
      eyebrow={eyebrow}
      meta={meta}
      backHref={backHref}
      backLabel="Înapoi la standuri"
      trailing={trailing}
    />
  );
  const aside = <StandWeighings data={data} added={added} title={readOnly ? 'Cântăriri' : undefined} />;
  const live = (
    <p aria-live="polite" className="sr-only">
      {announce}
    </p>
  );

  if (confirmed) {
    const caption = `${describeEntry(confirmed)} · ${data.stand.fullLabel}`;
    const value = `${formatDecimal(confirmed.weight, 3, 3)} kg`;
    return (
      <FlowLayout
        header={header}
        aside={aside}
        asideMobile="hidden"
        labelledBy="t6-title"
        fill
        actions={
          <FlowActions
            primary={
              <Button block onClick={restart}>
                Adaugă încă o captură
              </Button>
            }
            secondary={
              <ButtonLink href={backHref} variant="outline" block>
                Înapoi la standuri
              </ButtonLink>
            }
          />
        }
      >
        <FlowConfirmation
          label={`Captură adăugată: ${value}, ${caption}.`}
          focusOnMount={justConfirmed}
          value={<SignatureNumber value={formatDecimal(confirmed.weight, 3, 3)} unit=" kg" size="count" className="items-center" />}
          caption={caption}
          details={<p>Demo: nimic nu a fost trimis la server.</p>}
        />
      </FlowLayout>
    );
  }

  const subject = <StandSubject stand={data.stand} />;

  if (readOnly) {
    // Nothing to do here: no dead form, no dead buttons, and no task card around a lone subject
    // (`bare`): the subject sits under the notice in the open step's width, and the weighings are
    // their card — after it below 1280, in the aside from 1280 (the same card as the open step).
    return (
      <FlowLayout header={header} notice={notice} aside={aside} asideMobile="after" labelledBy="t6-title" variant="bare">
        <div className={FORM_CAP}>{subject}</div>
      </FlowLayout>
    );
  }

  return (
    <FlowLayout
      header={header}
      notice={notice}
      aside={aside}
      labelledBy="t6-title"
      actions={
        <FlowActions
          disabled={blocked}
          hint={hint ?? (split.length > 1 ? `Se adaugă ${quantity} capturi de ${speciesLabel || 'pește'}.` : undefined)}
          primary={
            <Button type="submit" form={FORM_ID} name="intent" value="finish" disabled={blocked} block>
              Finalizează
            </Button>
          }
          secondary={
            <Button type="submit" form={FORM_ID} name="intent" value="continue" variant="outline" disabled={blocked} block>
              Adaugă și continuă
            </Button>
          }
        />
      }
    >
      {/* The step's block: the subject spans it, ending where the stepper ends, at every width. */}
      <div className={FORM_CAP}>{subject}</div>
      <form ref={formRef} id={FORM_ID} noValidate onSubmit={onSubmit} className={cn('flex flex-col gap-5', FORM_CAP)}>
        <div className={cn(FORM_GRID, 'md:items-start')}>
          <BigNumberInput
            ref={weightRef}
            label="Greutate"
            unit="kg"
            name="weight"
            value={weight}
            onChange={(v) => setWeight(sanitizeWeight(v))}
            error={errors.weight}
            helper="Cu virgulă sau punct: 4,250"
            autoFocus={!initial && !blocked}
            disabled={blocked}
          />
          <QuantityStepper
            label="Bucăți"
            unit="buc"
            name="quantity"
            value={quantity}
            onChange={setQuantity}
            min={1}
            max={MAX_QUANTITY}
            error={errors.quantity}
            disabled={blocked}
            // Beside the 96px weight field from 768: one height, one baseline for both helpers.
            shellClassName="md:min-h-24"
          />
        </div>

        {split.length > 1 ? (
          // Read-only: one body line of figures, nothing shaped like a chip, so it cannot be taken
          // for an option right above «Specia».
          <div className="flex flex-col gap-1">
            <p id="t6-split" className="t-label text-ink-2">
              Greutatea fiecărui pește
            </p>
            <p aria-labelledby="t6-split" className="t-body text-ink-2 tabular-nums">
              {split.map((w) => formatDecimal(w, 3, 3)).join(' · ')} kg
            </p>
          </div>
        ) : null}

        {noSpecies ? (
          <T4Notice tone="warning" role="status" title="Concursul nu are specii configurate">
            Capturile se pot adăuga după ce organizatorul alege speciile concursului.
          </T4Notice>
        ) : (
          <ChoiceChips
            label="Specia"
            name="species"
            options={data.species}
            value={species}
            onChange={setSpecies}
            error={errors.species}
            disabled={blocked}
          />
        )}
      </form>
      {live}
    </FlowLayout>
  );
}

/**
 * The stand's weighings: the total leads (SignatureNumber stat, as step 1's ScaleSummary), then
 * what this session added (newest first, «Adăugate acum») and the stand's weighings from the CMS;
 * the total counts both, so the result screen and its context agree. Only a weighing still open
 * carries a pill («În curs»); finished is the norm, not news.
 */
function StandWeighings({
  data,
  added,
  id = 't6-weighings',
  title = 'Cântăririle standului',
}: {
  data: AddCatchData;
  added: Added[];
  id?: string;
  /** «Cântăriri» on the read-only step, whose h1 already says «Cântăririle standului». */
  title?: string;
}) {
  const addedKg = added.reduce((acc, a) => acc + a.weight, 0);
  const total = data.weighings.reduce((acc, w) => acc + w.totalKg, 0) + addedKg;
  const empty = data.weighings.length === 0 && added.length === 0;
  const caption = [
    plural(data.weighings.length, 'cântărire', 'cântăriri'),
    added.length > 0 ? plural(added.length, 'captură adăugată acum', 'capturi adăugate acum') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <FlowAsideCard title={title} id={id}>
      {/* Always the stat and its caption (as step 1's summary: «0,000 kg · Nicio cântărire încă»):
          the box the skeleton reserved, so the docked action card never jumps when it lands. */}
      <SignatureNumber
        value={formatDecimal(total, 3, 3)}
        unit=" kg"
        size="stat"
        caption={empty ? 'Nu s-a efectuat nicio cântărire.' : caption}
      />
      {added.length > 0 ? (
        <section aria-labelledby={`${id}-added`} className="flex flex-col gap-2 border-t border-hairline pt-3">
          <h3 id={`${id}-added`} className="t-label text-ink-2">
            Adăugate acum
          </h3>
          <ol className="flex flex-col divide-y divide-hairline">
            {added.map((a, i) => (
              <li key={added.length - i} className="flex items-baseline gap-3 py-2 first:pt-0 last:pb-0">
                <span className="t-caption w-5 shrink-0 text-muted tabular-nums">{added.length - i}.</span>
                <span className="t-body min-w-0 flex-1 text-ink">{describeEntry(a)}</span>
                <span className="t-body-strong text-accent-ink tabular-nums">{formatDecimal(a.weight, 3, 3)} kg</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {data.weighings.length > 0 ? (
        <ol className="flex flex-col divide-y divide-hairline border-t border-hairline pt-3">
          {data.weighings.map((w, i) => (
            <li key={w.documentId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2">
                  <span className="t-body-strong text-ink">Cântar {i + 1}</span>
                  {/* An attribute of the weighing (a Badge); its state is the pill on the right. */}
                  {w.weighingType === 'extra' ? (
                    <span className="flex">
                      <Badge color="yellow">Extra</Badge>
                    </span>
                  ) : null}
                </span>
                <span className="t-caption text-muted">{plural(w.catches, 'captură', 'capturi')}</span>
              </div>
              <span className="t-body-strong text-accent-ink tabular-nums">{formatDecimal(w.totalKg, 3, 3)} kg</span>
              {w.weighingStatus !== 'finished' ? <StatusPill tone="info">În curs</StatusPill> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </FlowAsideCard>
  );
}

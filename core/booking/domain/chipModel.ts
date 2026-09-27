/** fish `features/bookings/ui/chipModel.ts` (verbatim). */
export type ChipVariant = 'stand' | 'duration' | 'payment' | 'gate';
export type ChipSpec = { variant: ChipVariant; label: string };

/** Fixed reading order — the stand is what both anglers and operators look for first. */
const ORDER: ChipVariant[] = ['stand', 'duration', 'payment', 'gate'];

const APPEARANCE: Record<ChipVariant, { fill: string; text: string }> = {
  stand: { fill: '#F0F3FD', text: '#4338CA' },
  duration: { fill: '#F2F4F7', text: '#475467' },
  payment: { fill: '#E5F6F3', text: '#15803D' },
  gate: { fill: '#FEF9C3', text: '#CA8A04' },
};

export function chipAppearance(variant: ChipVariant) {
  return APPEARANCE[variant];
}

export function sortChips(specs: ChipSpec[]): ChipSpec[] {
  return [...specs].sort((a, b) => ORDER.indexOf(a.variant) - ORDER.indexOf(b.variant));
}

/**
 * A 12h booking is either a day or a night shift and operators think in those
 * terms, so the duration says which. Anything 24h or longer covers both, so it
 * stays a plain hour count. Exported because the operator card prints it beside
 * the price instead of spending a chip on it.
 */
export function durationLabel(hours: number, startHour: number): string {
  if (hours >= 24) return `${hours}h`;
  return startHour >= 12 ? `${hours}h noapte` : `${hours}h zi`;
}

/**
 * Does the operator's own name for a rate row say anything the duration does not?
 *
 * The pill exists for real package names — "Pachet weekend redus" is exactly what
 * an angler should notice. But an operator who names the row after its length
 * ("Tur 12h", and Chita does) only repeats what the card already shows, in a word
 * the rest of the app never uses. Those get dropped; anything else is kept.
 */
export function rowLabelAddsMeaning(label: string | null | undefined, hours: number): boolean {
  if (!label) return false;
  const normalised = label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  // "12h", "tur 12h", "tura 12 h", "12 ore" — all just the duration again.
  return !new RegExp(`^(tur[ăa]?\\s*)?${hours}\\s*(h|ore|ora)?$`).test(normalised);
}

export function buildBookingChips(input: {
  standName?: string | null;
  hours: number;
  startHour: number;
  paymentMode?: string | null;
  isWalkIn?: boolean;
  /** Off for the operator card, which shows the duration next to the price. */
  includeDuration?: boolean;
}): ChipSpec[] {
  const chips: ChipSpec[] = [];
  if (input.standName) chips.push({ variant: 'stand', label: `Standul ${input.standName}` });
  if (input.includeDuration !== false) {
    chips.push({ variant: 'duration', label: durationLabel(input.hours, input.startHour) });
  }
  if (input.paymentMode === 'offline') chips.push({ variant: 'payment', label: 'Numerar' });
  if (input.isWalkIn) chips.push({ variant: 'gate', label: 'La poartă' });
  // The pushes above already follow ORDER, so this is a no-op today — it's here to
  // keep the ordering guarantee intact if a future push is reordered or inserted wrong.
  return sortChips(chips);
}

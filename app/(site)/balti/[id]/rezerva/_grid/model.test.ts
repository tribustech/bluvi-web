import { describe, expect, it } from 'vitest';
import { mergePages, type LakeAvailability } from '@/core/booking';
import { buildGridModel, dayRefusal, runAction, selectionFree, selectionLabelOf, selectionNote, standRuns, zoneHint } from './model';

process.env.TZ = 'Europe/Bucharest';

const NOW = new Date('2026-10-07T12:00:00+03:00').getTime();
const page: LakeAvailability = {
  lakeId: 'l',
  bookingEnabled: true,
  incrementHours: 12,
  checkoutBufferMinutes: 0,
  leadHours: 24,
  slotStartTimes: ['06:00', '18:00'],
  timezone: 'Europe/Bucharest',
  stands: [
    { documentId: 's1', name: '1', coordinates: null, extras: [] },
    { documentId: 's2', name: '2', coordinates: null, extras: [] },
  ],
  extras: [],
  bookings: [{ standDocumentId: 's1', start: '2026-10-10T06:00:00+03:00', end: '2026-10-10T18:00:00+03:00', initials: 'AP' }],
  blocks: [
    {
      standDocumentId: null,
      start: '2026-10-12T06:00:00+03:00',
      end: '2026-10-13T06:00:00+03:00',
      reason: 'competition',
      label: 'Cupa Bluvi',
      competitionId: 'c1',
    },
  ],
  window: { from: '2026-10-01T00:00:00+03:00', to: '2026-11-01T00:00:00+02:00' },
};
const model = buildGridModel(mergePages([page]), NOW);
const cellAt = (iso: string) => model.slots.findIndex(s => s.start === iso);

describe('grid model (booking.rezerva-grila)', () => {
  it('starts at yesterday (c8) and opens on today', () => {
    expect(model.slots[0].start).toBe('2026-10-06T06:00:00+03:00');
    expect(model.todayDayIndex).toBe(1);
    expect(model.dayLabels[0]).toBe('Marți 6 oct');
  });

  it('runs: booked shows initials, a competition block is one run, the lead time is yellow (c12–c15)', () => {
    const runs = standRuns(model, { documentId: 's1', name: '1' }, null, null);
    const booked = runs.find(r => r.firstCell === cellAt('2026-10-10T06:00:00+03:00'))!;
    expect(booked.status).toBe('booked');
    expect(booked.label).toBe('AP');
    expect(runAction(booked)).toBe('none');
    const comp = runs.find(r => r.status === 'blocked')!;
    expect(comp.lastCell - comp.firstCell).toBe(1);
    expect(runAction(comp)).toBe('block');
    expect(comp.ariaLabel).toContain('Cupa Bluvi');
    const past = runs.find(r => r.isPast)!;
    expect(runAction(past)).toBe('past');
    expect(past.ariaLabel).toMatch(/, trecut$/);
    const soon = runs.find(r => r.tooSoon && r.status === 'available' && !r.isPast)!;
    expect(runAction(soon)).toBe('too-soon');
    expect(soon.ariaLabel).toMatch(/doar telefonic$/);
    const free = runs.find(r => r.status === 'available' && !r.tooSoon && !r.isPast)!;
    expect(runAction(free)).toBe('toggle');
    expect(free.ariaLabel).toBe('1, Joi 8 oct 18–06, disponibil');
  });

  it('a plain block (no label, no competition) says nothing (c18)', () => {
    const m = buildGridModel(
      mergePages([{ ...page, blocks: [{ standDocumentId: 's2', start: '2026-10-10T06:00:00+03:00', end: '2026-10-10T18:00:00+03:00', reason: 'maintenance' }] }]),
      NOW
    );
    const run = standRuns(m, { documentId: 's2', name: '2' }, null, null).find(r => r.status === 'blocked')!;
    expect(runAction(run)).toBe('none');
  });

  it('the selected run is one pill with its interval (c21)', () => {
    const a = cellAt('2026-10-09T06:00:00+03:00');
    const one = { standDocumentId: 's2', startIndex: a, endIndex: a };
    expect(selectionLabelOf(model, one)).toBe('06–18');
    const two = { standDocumentId: 's2', startIndex: a, endIndex: a + 1 };
    expect(selectionLabelOf(model, two)).toBe('Vi 06:00 – Sâ 06:00');
    const runs = standRuns(model, { documentId: 's2', name: '2' }, two, selectionLabelOf(model, two));
    const sel = runs.filter(r => r.selected);
    expect(sel).toHaveLength(1);
    expect(sel[0].label).toBe('Vi 06:00 – Sâ 06:00');
    expect(sel[0].ariaLabel).toMatch(/selectat$/);
  });

  it('day pill refusals in the order a person notices them (c20)', () => {
    const [yesterday, today] = model.geometry.days;
    expect(dayRefusal(model, yesterday)).toBe('Ziua a trecut — alege o zi viitoare.');
    expect(dayRefusal(model, today)).toBe('Ziua a început deja — alege o zi viitoare.');
    expect(dayRefusal(model, model.geometry.days[4])).toBe('Ziua nu e liberă integral la standul ales.');
  });
});

describe('selectionFree (b.live-availability re-check)', () => {
  it('a free run passes; a run crossing a booking, the lead time or the past fails', () => {
    const a = cellAt('2026-10-09T06:00:00+03:00');
    expect(selectionFree(model, { standDocumentId: 's1', startIndex: a, endIndex: a + 1 })).toBe(true);
    const booked = cellAt('2026-10-10T06:00:00+03:00');
    expect(selectionFree(model, { standDocumentId: 's1', startIndex: booked - 1, endIndex: booked })).toBe(false);
    expect(selectionFree(model, null)).toBe(false);
    // The same run judged a day later sits inside the 24h lead.
    const later = buildGridModel(mergePages([page]), new Date('2026-10-08T12:00:00+03:00').getTime());
    const b = later.slots.findIndex(s => s.start === '2026-10-09T06:00:00+03:00');
    expect(selectionFree(later, { standDocumentId: 's1', startIndex: b, endIndex: b })).toBe(false);
  });
});

describe('zoneHint (b.timezone)', () => {
  it('says nothing when the browser keeps the lake\'s clock, or without a zone', () => {
    expect(zoneHint('Europe/Bucharest', NOW)).toBeNull();
    expect(zoneHint(null, NOW)).toBeNull();
    expect(zoneHint('Not/AZone', NOW)).toBeNull();
  });
  it('names the difference, singular / plural, ahead / behind (browser here in Europe/Bucharest)', () => {
    expect(zoneHint('Europe/London', NOW)).toBe('Orele sunt afișate după ceasul tău, cu 2 ore înaintea orei bălții.');
    expect(zoneHint('Europe/Berlin', NOW)).toBe('Orele sunt afișate după ceasul tău, cu 1 oră înaintea orei bălții.');
    expect(zoneHint('Asia/Kolkata', NOW)).toBe('Orele sunt afișate după ceasul tău, cu 2 h 30 min în urma orei bălții.');
  });
});

describe('selectionNote (c33)', () => {
  it('extras first, then the deposit, then pay on site; nothing for full payment', () => {
    expect(selectionNote({ offeredCount: 1, paymentMode: 'deposit', depositPercent: 30, total: 300 })).toBe('Poți adăuga extra la pasul următor.');
    expect(selectionNote({ offeredCount: 0, paymentMode: 'deposit', depositPercent: 30, total: 315 })).toBe('Avans 30%: 94,5 lei');
    expect(selectionNote({ offeredCount: 0, paymentMode: 'offline', depositPercent: null, total: 300 })).toBe('Plata se face la fața locului.');
    expect(selectionNote({ offeredCount: 0, paymentMode: null, depositPercent: null, total: 300 })).toBe('Plata se face la fața locului.');
    expect(selectionNote({ offeredCount: 0, paymentMode: 'full', depositPercent: null, total: 300 })).toBeNull();
  });

  it('a deposit lake without a server total (quoting, refused, failed) shows no amount (owner rule 4)', () => {
    expect(selectionNote({ offeredCount: 0, paymentMode: 'deposit', depositPercent: 30, total: null })).toBeNull();
    // The extras note does not depend on the price.
    expect(selectionNote({ offeredCount: 2, paymentMode: 'deposit', depositPercent: 30, total: null })).toBe('Poți adăuga extra la pasul următor.');
  });
});

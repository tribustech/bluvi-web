import { describe, expect, it } from 'vitest';
import { mergePages, type LakeAvailability } from '@/core/booking';
import {
  buildGridModel,
  dayRefusal,
  loadedDayCount,
  mondayOf,
  pageDayOf,
  pageFit,
  pageModel,
  periodLabel,
  runAction,
  selectionFree,
  selectionLabelOf,
  selectionNote,
  slotShiftHours,
  standRuns,
  weekStartOf,
  zoneHint,
} from './model';

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

describe('desktop pages (owner 2026-10-11)', () => {
  it('fits whole days at ≥160px (or the lake\'s own day width), at most 7, filling the width exactly', () => {
    expect(pageFit(1158, 120)).toEqual({ days: 7, dayPx: 1158 / 7 });
    expect(pageFit(918, 120).days).toBe(5);
    expect(pageFit(662, 120).days).toBe(4);
    expect(pageFit(3000, 120).days).toBe(7);
    expect(pageFit(100, 120)).toEqual({ days: 1, dayPx: 100 });
    // 6h slots: the lake's 192px day is the floor (no band under 44px).
    expect(pageFit(1158, 192).days).toBe(6);
  });

  it('cuts the model to the page on slot boundaries: each column 06:00 → 06:00, every slot whole, global cells', () => {
    const today = model.todayDayIndex;
    expect(slotShiftHours(model)).toBe(6);
    // 12:00 is past the first start hour: the first page starts on today's column.
    expect(pageDayOf(model, 6)).toBe(today);
    const p = pageModel(model, today, 7, 160);
    expect(p.geometry.days.map(d => d.dayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(p.geometry.days[0].date.getDate()).toBe(7);
    expect(p.dayLabels[0]).toBe(model.dayLabels[today]);
    expect(p.geometry.bodyWidthPx).toBe(7 * 160);
    expect(p.todayDayIndex).toBe(0);
    // 14 slots, two per column, each half a column, edge to edge from 0 to the page's right edge.
    expect(p.geometry.bands).toHaveLength(14);
    p.geometry.bands.forEach((b, i) => {
      expect(b.leftPx).toBeCloseTo(i * 80);
      expect(b.widthPx).toBeCloseTo(80);
    });
    expect(p.geometry.bands[0].cellIndex).toBe(cellAt('2026-10-07T06:00:00+03:00'));
    expect(p.geometry.bands[13].cellIndex).toBe(cellAt('2026-10-13T18:00:00+03:00'));
    expect(p.geometry.headerSlots.map(h => h.kind).slice(0, 2)).toEqual(['day', 'night']);
    // Runs keep the global cell indices (a selection lives outside the page).
    const runs = standRuns(p, { documentId: 's1', name: '1' }, null, null);
    expect(runs[0].firstCell).toBe(cellAt('2026-10-07T06:00:00+03:00'));
  });

  it('the first page holds the first open slot: the next start (angler), or a running night (walk-in)', () => {
    const at3 = new Date('2026-10-07T03:00:00+03:00').getTime();
    const angler = buildGridModel(mergePages([page]), at3);
    expect(pageDayOf(angler, 6)).toBe(angler.todayDayIndex);
    const walkIn = buildGridModel(mergePages([page]), at3, 1, { enforceLeadTime: false, allowInProgress: true });
    expect(pageDayOf(walkIn, 6)).toBe(walkIn.todayDayIndex - 1);
    // Late in the day, the day's last slot already started: the next column.
    const late = buildGridModel(mergePages([page]), new Date('2026-10-07T21:00:00+03:00').getTime());
    expect(pageDayOf(late, 6)).toBe(late.todayDayIndex + 1);
  });

  it('a lake starting a slot at midnight keeps calendar days', () => {
    const m = buildGridModel(mergePages([{ ...page, incrementHours: 6, slotStartTimes: ['00:00', '06:00', '12:00', '18:00'] }]), NOW);
    expect(slotShiftHours(m)).toBe(0);
    const p = pageModel(m, m.todayDayIndex, 3, 200);
    expect(p.geometry.bands).toHaveLength(12);
    expect(p.geometry.bands[0].leftPx).toBe(0);
  });

  it('a page past the loaded end holds only the loaded days', () => {
    const n = loadedDayCount(model);
    const p = pageModel(model, n - 3, 7, 100);
    expect(p.geometry.days).toHaveLength(3);
    expect(p.geometry.bodyWidthPx).toBe(300);
  });

  it('labels the period', () => {
    const d = (s: string) => new Date(`${s}T00:00:00`);
    expect(periodLabel(d('2026-10-11'), d('2026-10-17'))).toBe('11 – 17 oct 2026');
    expect(periodLabel(d('2026-10-28'), d('2026-11-03'))).toBe('28 oct – 3 noi 2026');
    expect(periodLabel(d('2026-12-29'), d('2027-01-04'))).toBe('29 dec 2026 – 4 ian 2027');
    expect(periodLabel(d('2026-10-11'), d('2026-10-11'))).toBe('11 oct 2026');
  });

  it('weeks run Monday → Sunday: the grid reaches back to this week\'s Monday, drawn as past', () => {
    // 2026-10-07 is a Wednesday; its week starts Monday 5 oct.
    expect(mondayOf(new Date(NOW)).getDate()).toBe(5);
    const m = buildGridModel(mergePages([page]), NOW, 1, undefined, mondayOf(new Date(NOW)));
    expect(m.gridFrom.startsWith('2026-10-05')).toBe(true);
    const monday = weekStartOf(m, pageDayOf(m, slotShiftHours(m)));
    expect(monday).toBe(0);
    const p = pageModel(m, monday, 7, 160);
    expect(p.geometry.days[0].date.getDay()).toBe(1);
    expect(p.geometry.days[6].date.getDay()).toBe(0);
    expect(standRuns(p, { documentId: 's2', name: '2' }, null, null)[0].isPast).toBe(true);
  });
});

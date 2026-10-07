import { describe, expect, it } from 'vitest';
import { formatBookingPeriod, formatBookingPoint, wallHour } from './bookingPeriod';

// fish helpers/__tests__/formatBookingPeriod.test.ts, 1:1. Device-local like fish (date-fns), pinned
// to the Romanian zone so the expectations read the lake's wall clock.
process.env.TZ = 'Europe/Bucharest';

describe('formatBookingPeriod', () => {
  it('renders a same-day period with the capitalized full weekday', () => {
    expect(formatBookingPeriod('2026-08-15T06:00:00+03:00', '2026-08-15T18:00:00+03:00')).toBe(
      'Sâmbătă, 15 aug · 06:00–18:00'
    );
  });

  it('renders an overnight period with both days', () => {
    expect(formatBookingPeriod('2026-08-15T18:00:00+03:00', '2026-08-16T06:00:00+03:00')).toBe(
      'Sâmbătă, 15 aug 18:00 – Duminică, 16 aug 06:00'
    );
  });
});

describe('checkout buffer', () => {
  it('subtracts the buffer from the end of a same-day period', () => {
    expect(formatBookingPeriod('2026-08-22T06:00:00+03:00', '2026-08-22T18:00:00+03:00', 30)).toBe(
      'Sâmbătă, 22 aug · 06:00–17:30'
    );
  });

  it('subtracts it from the end of a multi-day period', () => {
    expect(formatBookingPeriod('2026-08-22T18:00:00+03:00', '2026-08-23T18:00:00+03:00', 60)).toBe(
      'Sâmbătă, 22 aug 18:00 – Duminică, 23 aug 17:00'
    );
  });

  it('can pull the end back across midnight into the previous day', () => {
    expect(formatBookingPeriod('2026-08-22T18:00:00+03:00', '2026-08-23T00:00:00+03:00', 30)).toBe(
      'Sâmbătă, 22 aug · 18:00–23:30'
    );
  });

  it('is unchanged when the lake has no buffer', () => {
    expect(formatBookingPeriod('2026-08-22T06:00:00+03:00', '2026-08-22T18:00:00+03:00', 0)).toBe(
      formatBookingPeriod('2026-08-22T06:00:00+03:00', '2026-08-22T18:00:00+03:00')
    );
  });

  it('formatBookingPoint subtracts the buffer from an end point', () => {
    expect(formatBookingPoint('2026-08-23T06:00:00+03:00', 30)).toBe('Duminică, 23 aug · 05:30');
    expect(formatBookingPoint('2026-08-23T06:00:00+03:00')).toBe('Duminică, 23 aug · 06:00');
  });

  it('formatBookingPoint pulls a midnight end point back into the previous day', () => {
    expect(formatBookingPoint('2026-08-23T00:00:00+03:00', 30)).toBe('Sâmbătă, 22 aug · 23:30');
  });
});

describe('lake time zone', () => {
  // The device here is Bucharest; the lake reads the same instants on ITS clock.
  it('reads the period on the lake clock when the zone is given', () => {
    // 18:00 Bucharest = 16:00 London: a London lake shows 16:00, a Bucharest lake 18:00.
    expect(formatBookingPeriod('2026-08-15T18:00:00+03:00', '2026-08-16T06:00:00+03:00', 0, 'Europe/London')).toBe(
      'Sâmbătă, 15 aug 16:00 – Duminică, 16 aug 04:00'
    );
    expect(formatBookingPeriod('2026-08-15T15:00:00Z', '2026-08-16T03:00:00Z', 0, 'Europe/Bucharest')).toBe(
      'Sâmbătă, 15 aug 18:00 – Duminică, 16 aug 06:00'
    );
  });

  it('moves the day across midnight in the lake zone', () => {
    // 01:00 Bucharest on the 16th is still the 15th, 23:00, in London.
    expect(formatBookingPoint('2026-08-16T01:00:00+03:00', 0, 'Europe/London')).toBe('Sâmbătă, 15 aug · 23:00');
  });

  it('wallHour reads the lake hour', () => {
    expect(wallHour('2026-08-15T09:00:00Z', 'Europe/Bucharest')).toBe(12);
    expect(wallHour('2026-08-15T09:00:00Z', 'Europe/London')).toBe(10);
    expect(wallHour('2026-08-15T09:00:00Z')).toBe(12);
  });
});

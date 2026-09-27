import { describe, expect, it } from 'vitest';
import { buildTimeline } from './timelineModel';

describe('buildTimeline', () => {
  it('marks the wait as current for a pending angler booking', () => {
    const steps = buildTimeline({ status: 'pending', audience: 'angler', createdAtLabel: '16 aug, 11:02' });
    expect(steps.map((s) => s.state)).toEqual(['done', 'current', 'future', 'future']);
    expect(steps[0].title).toBe('Cerere trimisă');
    expect(steps[0].detail).toBe('16 aug, 11:02');
    expect(steps[1].title).toBe('Așteaptă răspunsul lacului');
  });

  it('addresses the operator in the second person', () => {
    const steps = buildTimeline({ status: 'pending', audience: 'operator' });
    expect(steps[1].title).toBe('Așteaptă răspunsul tău');
  });

  it('shows elapsed age on the current step when given', () => {
    const steps = buildTimeline({ status: 'pending', audience: 'operator', ageLabel: 'de 2 ore' });
    expect(steps[1].detail).toBe('de 2 ore');
  });

  it('advances past the wait once confirmed', () => {
    const steps = buildTimeline({ status: 'confirmed', audience: 'angler', confirmedAtLabel: '16 aug, 13:40' });
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'future']);
    expect(steps[2].detail).toBe('16 aug, 13:40');
  });

  it('closes every step once completed', () => {
    const steps = buildTimeline({ status: 'completed', audience: 'angler' });
    expect(steps.every((s) => s.state === 'done')).toBe(true);
  });

  it('ends the timeline at a terminal rejection', () => {
    const steps = buildTimeline({ status: 'rejected', audience: 'angler' });
    expect(steps).toHaveLength(2);
    expect(steps[1]).toMatchObject({ title: 'Respinsă', state: 'current' });
  });

  it('ends the timeline at a cancellation', () => {
    const steps = buildTimeline({ status: 'cancelled', audience: 'angler' });
    expect(steps).toHaveLength(2);
    expect(steps[1]).toMatchObject({ title: 'Anulată', state: 'current' });
  });

  // Coverage beyond the brief: pin the branches the prose specifies but the
  // brief's own tests leave unasserted, so a future edit can't silently break them.
  it('leaves the confirmed step detail undefined while still pending', () => {
    const steps = buildTimeline({ status: 'pending', audience: 'angler', confirmedAtLabel: '16 aug, 13:40' });
    expect(steps[2].detail).toBeUndefined();
  });

  it('marks the ended step done once completed, future otherwise', () => {
    const confirmedSteps = buildTimeline({ status: 'confirmed', audience: 'angler' });
    expect(confirmedSteps[3].state).toBe('future');

    const completedSteps = buildTimeline({ status: 'completed', audience: 'angler', endedLabel: '20 aug, 09:00' });
    expect(completedSteps[3].state).toBe('done');
    expect(completedSteps[3].detail).toBe('20 aug, 09:00');
  });
});

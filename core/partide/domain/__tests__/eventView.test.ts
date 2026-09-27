import { describe, it, expect } from 'vitest';
import { EMPTY_JURNAL_FILTER, eventMeta, eventPhotoUri, filterEvents, jurnalRowModel } from '../eventView';
import type { LocalEvent } from '../types';

const ev = (over: Partial<LocalEvent>): LocalEvent => ({
  clientId: Math.random().toString(36).slice(2),
  serverId: null,
  serverNumericId: null,
  syncStatus: 'synced',
  clientUpdatedAt: 1,
  sessionClientId: 's1',
  outcome: 'capture',
  rodIndex: 1,
  rodLabel: 'L1',
  rodColor: '#f00',
  bait: '',
  baitType: null,
  baitSize: null,
  baitFlavor: null,
  lane: null,
  distance: 60,
  lat: null,
  lng: null,
  weightKg: 5,
  weightEstimated: false,
  species: 'Crap',
  speciesId: null,
  photoLocalUri: null,
  photoUploadStatus: 'none',
  photoUrl: null,
  notes: null,
  occurredAt: 100,
  ...over,
});

describe('eventPhotoUri', () => {
  it('prefers the remote url, falls back to local, else null', () => {
    expect(eventPhotoUri(ev({ photoUrl: 'https://x/p.jpg', photoLocalUri: 'file:///l.jpg' }))).toBe(
      'https://x/p.jpg'
    );
    expect(eventPhotoUri(ev({ photoUrl: null, photoLocalUri: 'file:///l.jpg' }))).toBe('file:///l.jpg');
    expect(eventPhotoUri(ev({}))).toBeNull();
  });
});

describe('eventMeta', () => {
  it('joins lane, distance and bait, dropping the missing legs', () => {
    expect(eventMeta(ev({ lane: 'left', distance: 50, bait: 'Boilies 20mm' }))).toBe('Stânga · 50 m · Boilies 20mm');
    expect(eventMeta(ev({ lane: 'left', distance: 35, bait: '' }))).toBe('Stânga · 35 m');
    expect(eventMeta(ev({ lane: null, distance: 0, bait: 'Porumb' }))).toBe('Porumb');
  });

  it('never names the rod — the row shows it as a pill', () => {
    expect(eventMeta(ev({ lane: null, distance: 0, bait: '' }))).toBe('');
  });

  it('treats a zero distance as absent', () => {
    expect(eventMeta(ev({ lane: 'center', distance: 0, bait: '' }))).toBe('Centru');
  });

  it('falls back to the note only when there is nothing else', () => {
    expect(eventMeta(ev({ lane: null, distance: 0, bait: '', notes: 'la mal' }))).toBe('la mal');
    // a note never appends to a position it would have replaced
    expect(eventMeta(ev({ lane: 'right', distance: 20, bait: '', notes: 'la mal' }))).toBe('Dreapta · 20 m');
  });

  it('returns empty when the event carries nothing to say', () => {
    expect(eventMeta(ev({ lane: null, distance: 0, bait: '', notes: null }))).toBe('');
  });
});

describe('jurnalRowModel', () => {
  it('leads with the weight when there is one', () => {
    const m = jurnalRowModel(ev({ weightKg: 8.4 }));
    expect(m.lead).toBe('weight');
    expect(m.weight).toBe('8,4');
    expect(m.estimated).toBe(false);
  });

  it('flags an estimated weight', () => {
    expect(jurnalRowModel(ev({ weightKg: 12.9, weightEstimated: true })).estimated).toBe(true);
  });

  it('does not flag "estimated" on a capture that has no weight to estimate', () => {
    const m = jurnalRowModel(ev({ weightKg: null, weightEstimated: true }));
    expect(m.lead).toBe('glyph');
    expect(m.estimated).toBe(false);
  });

  it('leads with the fish glyph on a weightless capture', () => {
    const m = jurnalRowModel(ev({ weightKg: null }));
    expect(m.lead).toBe('glyph');
    expect(m.weight).toBeNull();
  });

  it('lets the outcome win over a weight, so lost/blank never render one', () => {
    expect(jurnalRowModel(ev({ outcome: 'lost', weightKg: 5 })).lead).toBe('lost');
    expect(jurnalRowModel(ev({ outcome: 'blank', weightKg: 5 })).lead).toBe('blank');
    expect(jurnalRowModel(ev({ outcome: 'lost', weightKg: 5 })).weight).toBeNull();
  });

  it('paints the accent from the rod, and greys a rod-less capture', () => {
    expect(jurnalRowModel(ev({ rodColor: '#4CB944' })).accent).toBe('#4CB944');
    expect(jurnalRowModel(ev({ rodIndex: null, rodColor: null })).accent).toBe('#E1E5EC');
  });

  it('falls back to indigo for a rod whose colour never synced', () => {
    expect(jurnalRowModel(ev({ rodIndex: 2, rodColor: null })).rodColor).toBe('#6366F1');
    expect(jurnalRowModel(ev({ rodIndex: 2, rodColor: null })).accent).toBe('#6366F1');
  });

  it('gives lost and blank their own accent and tint, whatever the rod says', () => {
    const lost = jurnalRowModel(ev({ outcome: 'lost', rodColor: '#4CB944' }));
    expect(lost.accent).toBe('#EAB308');
    expect(lost.background).toBe('#FEFCE9');

    const blank = jurnalRowModel(ev({ outcome: 'blank', rodColor: '#4CB944' }));
    expect(blank.accent).toBe('#A3A3A3');
    expect(blank.background).toBe('#F6F7F9');
  });

  it('leaves a capture on white', () => {
    expect(jurnalRowModel(ev({})).background).toBe('#FFFFFF');
  });

  it('carries the photo flag, species, meta and clock through', () => {
    const m = jurnalRowModel(
      ev({ photoUrl: 'https://x/p.jpg', species: 'Amur', lane: 'left', distance: 35, occurredAt: Date.UTC(2026, 0, 1, 9, 5) })
    );
    expect(m.hasPhoto).toBe(true);
    expect(m.species).toBe('Amur');
    expect(m.meta).toBe('Stânga · 35 m');
    expect(m.time).toMatch(/^\d{2}:\d{2}$/);
    expect(jurnalRowModel(ev({})).hasPhoto).toBe(false);
  });
});

describe('filterEvents', () => {
  const events = [
    ev({ outcome: 'capture', rodIndex: 1 }),
    ev({ outcome: 'lost', rodIndex: 2 }),
    ev({ outcome: 'blank', rodIndex: 1 }),
    ev({ outcome: 'capture', rodIndex: null }), // rod-less quick capture
  ];

  it('empty filter returns everything', () => {
    expect(filterEvents(events, EMPTY_JURNAL_FILTER)).toHaveLength(4);
  });

  it('outcome filter', () => {
    expect(filterEvents(events, { outcomes: ['capture'], rodIndexes: [] })).toHaveLength(2);
  });

  it('rod filter excludes rod-less events', () => {
    const r = filterEvents(events, { outcomes: [], rodIndexes: [1] });
    expect(r).toHaveLength(2);
    expect(r.every(e => e.rodIndex === 1)).toBe(true);
  });

  it('outcome ∧ rod combine', () => {
    expect(filterEvents(events, { outcomes: ['capture'], rodIndexes: [1] })).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { pickMoment } from './pickMoment';
import type { CompetitionCard, CardPodiumRow } from '../schemas';

const NOW = new Date(2026, 8, 24, 16, 0, 0); // 24 September 2026

const winner = (over: Partial<CardPodiumRow> = {}): CardPodiumRow => ({
  position: 1,
  tied: false,
  displayName: 'Andrei Popescu',
  standName: null,
  clubName: null,
  avatarUrls: [],
  ...over,
});

const card = (over: Partial<CompetitionCard> = {}): CompetitionCard =>
  ({
    documentId: 'c1',
    name: 'Cupa Toamnei',
    dateLabel: '10 sept.',
    endDate: '2026-09-20T12:00:00.000Z',
    status: 'completed',
    format: { kind: 'single', teamSize: null, unit: 'pescari' },
    organizer: null,
    results: null,
    ...over,
  }) as CompetitionCard;

const lists = (over: Partial<Parameters<typeof pickMoment>[0]> = {}) => ({
  live: [],
  upcoming: [],
  completed: [],
  ...over,
});

const withWinner = (over: Partial<CompetitionCard> = {}) =>
  card({ results: { podium: [winner()] } as CompetitionCard['results'], ...over });

describe('pickMoment', () => {
  it('names the winner of the most recent finished competition', () => {
    const moment = pickMoment(lists({ completed: [withWinner()] }), NOW)!;
    expect(moment.kicker).toBe('CÂȘTIGĂTOR');
    expect(moment.displayName).toBe('Andrei Popescu');
    expect(moment.line).toBe('Individual · locul 1');
  });

  it('still shows a win that is months old, dated so it cannot read as news', () => {
    // The 14-day window used to blank the whole tile the moment the last winner
    // aged out, with nothing having changed for the user.
    const moment = pickMoment(
      lists({ completed: [withWinner({ endDate: '2026-04-02T12:00:00.000Z', dateLabel: '2 apr.' })] }),
      NOW
    )!;
    expect(moment.kicker).toBe('CÂȘTIGĂTOR');
    expect(moment.meta).toBe('Cupa Toamnei · 2 apr.');
  });

  it('leaves a fresh win undated', () => {
    expect(pickMoment(lists({ completed: [withWinner()] }), NOW)!.meta).toBe('Cupa Toamnei');
  });

  it('falls back to an organizer when nothing has been won yet', () => {
    const moment = pickMoment(
      lists({
        live: [
          card({
            documentId: 'live-1',
            status: 'started',
            name: 'Cupa de vară',
            organizer: { documentId: 'o1', username: 'Razvan', avatarUrl: 'a.jpg' },
          }),
        ],
        completed: [card()], // finished, but nobody caught anything
      }),
      NOW
    )!;
    expect(moment.kicker).toBe('ORGANIZATOR');
    expect(moment.displayName).toBe('Razvan');
    expect(moment.line).toBe('Are un concurs în desfășurare');
    expect(moment.avatarUrls).toEqual(['a.jpg']);
    expect(moment.competitionId).toBe('live-1');
  });

  it('prefers a winner over an organizer', () => {
    const moment = pickMoment(
      lists({
        live: [card({ organizer: { documentId: 'o1', username: 'Razvan', avatarUrl: null } })],
        completed: [withWinner()],
      }),
      NOW
    )!;
    expect(moment.kicker).toBe('CÂȘTIGĂTOR');
  });

  it('says how many shared first place instead of naming one of them', () => {
    const moment = pickMoment(
      lists({
        completed: [
          card({
            results: {
              podium: [winner({ tied: true }), winner({ tied: true, displayName: 'Ion' })],
            } as CompetitionCard['results'],
          }),
        ],
      }),
      NOW
    )!;
    expect(moment.kicker).toBe('PODIUM');
    expect(moment.displayName).toBe('2 pescari la egalitate');
    expect(moment.line).toBe('Locul 1 la egalitate');
  });

  it('skips a person the screen has just shown', () => {
    const moment = pickMoment(
      lists({
        completed: [withWinner()],
        upcoming: [
          card({
            documentId: 'u1',
            status: 'notStarted',
            organizer: { documentId: 'o1', username: 'Razvan', avatarUrl: null },
          }),
        ],
      }),
      NOW,
      ['CAMPION:c1']
    )!;
    expect(moment.kicker).toBe('ORGANIZATOR');
  });

  it('returns null only when there is nothing at all', () => {
    expect(pickMoment(lists(), NOW)).toBeNull();
  });
});

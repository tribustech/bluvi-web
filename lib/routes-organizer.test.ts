import { describe, expect, it } from 'vitest';
import { routes, safeReturnPath, WIZARD_STEPS } from './routes';

describe('M6 organizer routes (docs/parity/areas/organizer.yml web_route)', () => {
  it('builds the wizard steps with draft, return target, editor and explanation', () => {
    expect(WIZARD_STEPS).toEqual(['detalii', 'configurare', 'clasament', 'lac-si-sectoare', 'standuri', 'revizuire']);
    expect(routes.organizerCompetitionNew('detalii')).toBe('/organizator/concursuri/nou/detalii');
    expect(routes.organizerCompetitionNew('detalii', { inapoi: '/organizator' })).toBe('/organizator/concursuri/nou/detalii?inapoi=%2Forganizator');
    expect(routes.organizerCompetitionNew('detalii', { ciorna: 'd1', inapoi: '/organizator' })).toBe(
      '/organizator/concursuri/nou/detalii?ciorna=d1&inapoi=%2Forganizator',
    );
    expect(routes.organizerCompetitionNew('detalii', { editor: 'regulament' })).toBe('/organizator/concursuri/nou/detalii?editor=regulament');
    expect(routes.organizerCompetitionNew('clasament', { explicatie: 'quantity' })).toBe('/organizator/concursuri/nou/clasament?explicatie=quantity');
  });

  it('builds the edit wizard of a published competition', () => {
    expect(routes.competitionEdit('c 1', 'detalii')).toBe('/concursuri/c%201/editeaza/detalii');
    expect(routes.competitionEdit('c1', 'revizuire', { inapoi: '/concursuri/c1?tab=x' })).toBe(
      '/concursuri/c1/editeaza/revizuire?inapoi=%2Fconcursuri%2Fc1%3Ftab%3Dx',
    );
  });

  it('drops an unsafe return target from the URL', () => {
    for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', 'organizator', '/a\nb']) {
      expect(routes.organizerCompetitionNew('detalii', { inapoi: bad })).toBe('/organizator/concursuri/nou/detalii');
    }
  });

  it('builds the management pages', () => {
    expect(routes.competitionSectors('c1')).toBe('/concursuri/c1/sectoare');
    expect(routes.competitionAllocation('c1')).toBe('/concursuri/c1/alocare');
    expect(routes.competitionAllocation('c1', 1)).toBe('/concursuri/c1/alocare');
    expect(routes.competitionAllocation('c1', 2)).toBe('/concursuri/c1/alocare?mansa=2');
    expect(routes.competitionScale('c1')).toBe('/concursuri/c1/cantar');
    expect(routes.competitionScaleStand('c1', 's1')).toBe('/concursuri/c1/cantar/s1');
    expect(routes.competitionScaleWeighing('c1', 's1', 'w1')).toBe('/concursuri/c1/cantar/s1/w1');
    expect(routes.competitionScaleRevisions('c1', 's1', 'w1')).toBe('/concursuri/c1/cantar/s1/w1/modificari');
    expect(routes.competitionPenalties('c1')).toBe('/concursuri/c1/penalizari');
    expect(routes.competitionPenaltiesStand('c1')).toBe('/concursuri/c1/penalizari/stand');
    expect(routes.competitionPenaltiesApply('c1', 'r 1')).toBe('/concursuri/c1/penalizari/aplica?inscriere=r%201');
  });

  it('filters the participants list', () => {
    expect(routes.competitionParticipants('c1')).toBe('/concursuri/c1/participanti');
    expect(routes.competitionParticipants('c1', 'in-asteptare')).toBe('/concursuri/c1/participanti?filtru=in-asteptare');
    expect(routes.competitionParticipants('c1', 'aprobati')).toBe('/concursuri/c1/participanti?filtru=aprobati');
    expect(routes.competitionParticipants('c1', 'respinsi')).toBe('/concursuri/c1/participanti?filtru=respinsi');
  });
});

describe('safeReturnPath', () => {
  it('keeps same-origin relative paths with their query and hash', () => {
    expect(safeReturnPath('/organizator')).toBe('/organizator');
    expect(safeReturnPath('/concursuri/c1?tab=x#y')).toBe('/concursuri/c1?tab=x#y');
  });
  it('refuses anything that could leave the site', () => {
    for (const bad of [undefined, null, '', 'organizator', 'https://evil.test/x', '//evil.test', '/\\evil.test', '/x\u0000', ' /x']) {
      expect(safeReturnPath(bad)).toBeNull();
    }
  });
});

import type { ReactNode } from 'react';
import { AnglerCard, CatchCard, CompetitionCard, FollowButton, LakeCard, PartidaCard } from '@/components/cards';
import { RankingRow, RankingTable, SECTOR_LETTERS, sectorColorMap, tiedIndices } from '@/components/ranking';
import type { QuantityStandRanking } from '@/core/competitions/schemas';
import { createQuantityRow } from '@/core/competitions/domain/table/createTableRows';
import { getQuantityColumns } from '@/core/competitions/domain/table/getTableColumns';

/*
 * /dev/kit section: cards + ranking (Fundații §07 "Carduri", "Rând clasament · mobil",
 * "Tabel clasament · desktop"). Sample data is the design's own; ranking rows go through the
 * real builders (createQuantityRow + getQuantityColumns), like the competition page will.
 */

const sectorColors = sectorColorMap();

function stand(
  p: Partial<QuantityStandRanking> &
    Pick<QuantityStandRanking, 'sectorName' | 'standName' | 'generalPosition' | 'sectorPosition'>,
): QuantityStandRanking {
  return {
    sectorId: `s-${p.sectorName}`,
    standId: `${p.sectorName}${p.standName}`,
    teamName: null,
    guestName: null,
    participant: null,
    biggestFish: 0,
    catchCount: 0,
    quantity: 0,
    quantityPoints: p.sectorPosition,
    penalties: [],
    ...p,
  };
}

const penalty2kg = {
  documentId: 'pen-1',
  action: 'DEDUCT_TOTAL_WEIGHT' as const,
  value: 2,
  reason: 'Plasă de păstrare neconformă',
  createdAt: '2026-09-27T10:00:00.000Z',
};

/*
 * As the page's buildRankingTable: the winners are the general places 1..S (here: each sector's
 * first), and Radu Ionescu (A7) holds the competition's biggest catch.
 */
const row = (r: QuantityStandRanking) =>
  createQuantityRow(r, sectorColors, {
    isWinner: r.sectorPosition === 1 && r.quantity > 0,
    biggestStandId: 'A7',
    biggestWeight: 14.2,
  });

/* Mobile rows — exactly the three Fundații rows. */
const mobileRows = [
  row(
    stand({
      sectorName: 'A',
      standName: '7',
      participant: { username: 'Radu Ionescu' },
      quantity: 86.4,
      catchCount: 9,
      biggestFish: 14.2,
      generalPosition: 1,
      sectorPosition: 1,
    }),
  ),
  row(
    stand({
      sectorName: 'B',
      standName: '22',
      teamName: 'Echipa Delta',
      quantity: 52,
      catchCount: 6,
      biggestFish: 11.1,
      generalPosition: 4,
      sectorPosition: 2,
      penalties: [penalty2kg],
    }),
  ),
  row(
    stand({
      sectorName: 'C',
      standName: '31',
      participant: { username: 'Vlad Stan' },
      generalPosition: 12,
      sectorPosition: 8,
    }),
  ),
];

/* Desktop table — the three Fundații rows (Tu · Mihai Popa is the signed-in user). */
const tableRows = [
  mobileRows[0],
  row(
    stand({
      sectorName: 'B',
      standName: '22',
      participant: { username: 'Mihai Popa' },
      quantity: 71.9,
      catchCount: 11,
      biggestFish: 9.8,
      generalPosition: 2,
      sectorPosition: 1,
    }),
  ),
  row(
    stand({
      sectorName: 'C',
      standName: '31',
      participant: { username: 'Vlad Stan' },
      generalPosition: 24,
      sectorPosition: 8,
    }),
  ),
];

/* 24 sectors, one stand each: stripes A–X, a tie, a penalty, a row without catches, and enough rows to scroll. */
const NAMES = [
  'Radu Ionescu', 'Mihai Popa', 'Echipa Delta', 'Andrei Marin', 'Ioan Toma', 'Cristi Dobre',
  'Echipa Siliștea', 'Sorin Vlad', 'Paul Neagu', 'Dan Lazăr', 'Florin Ene', 'George Matei',
  'Echipa Crap Club', 'Marius Stoica', 'Lucian Rusu', 'Bogdan Ilie', 'Costel Nistor', 'Alex Pop',
  'Ștefan Barbu', 'Victor Moldovan', 'Nicu Avram', 'Tudor Sima', 'Emil Preda', 'Vlad Stan',
];
const bigRows = SECTOR_LETTERS.map((letter, i) => {
  const noCatch = i === 23;
  const generalPosition = i === 4 ? 4 : i + 1; // stands 4 and 5 tie at =4
  const isTeam = NAMES[i].startsWith('Echipa');
  return row(
    stand({
      sectorName: letter,
      standName: String(3 + ((i * 7) % 40)),
      ...(isTeam ? { teamName: NAMES[i] } : { participant: { username: NAMES[i] } }),
      quantity: noCatch ? 0 : Math.round((92 - i * 3.7) * 1000) / 1000,
      catchCount: noCatch ? 0 : 14 - Math.floor(i / 2),
      biggestFish: noCatch ? 0 : Math.round((15.3 - i * 0.4) * 100) / 100,
      generalPosition,
      sectorPosition: 1,
      penalties: i === 2 ? [penalty2kg] : [],
    }),
  );
});

function Block({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <div className="flex flex-col gap-3.5">
      <h3 className="t-body-strong text-ink-2">{title}</h3>
      {children}
      {note && <p className="t-caption text-muted">{note}</p>}
    </div>
  );
}

export function CardsSection() {
  const mobileTies = new Set([1]); // "=4" in the design
  const bigTies = tiedIndices(bigRows);

  return (
    <>
      <h2 className="t-title1">Carduri și clasament</h2>

      {/* Fundații §07 sets the components on a white panel (radius 20, padding 40). */}
      <div className="space-y-8 rounded-bento bg-surface p-5 xl:p-10">
        <Block title="Carduri · concurs · baltă · pescar · partidă · captură">
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CompetitionCard
              href="#cards"
              title="Cupa Toamnei la Crap"
              dateLabel="Sâm, 27 - Dum, 28 sept"
              lakeName="Balta Siliștea"
              imageSrc="/images/competition-placeholder.jpg"
              live
              followersCount={412}
              registeredCount={48}
              capacity={48}
              badges={[
                { label: 'Individual', tone: 'green' },
                { label: 'Cantitate', tone: 'yellow' },
              ]}
            />
            <LakeCard
              href="#cards"
              name="Lacul Cornu"
              rating={4.7}
              locationLabel="Cornu, Prahova"
              species={['Crap', 'Amur']}
              priceMin={120}
              priceMax={220}
              onlineBooking
              imageSrc="/images/lake.jpeg"
            />
            <AnglerCard
              href="#cards"
              username="andrei.marin"
              city="Ploiești"
              followersCount={1240}
              competitionsCount={31}
              podiumsCount={7}
              recordKg={21.3}
              action={<FollowButton name="andrei.marin" />}
            />
            <PartidaCard
              href="#cards"
              title="Tura de noapte · Stand 7"
              lakeName="Lacul Cornu"
              durationLabel="de 14h 20min"
              active
              catchCount={6}
              totalKg={42.8}
              friends={[{ name: 'Ioan Toma' }, { name: 'Radu Dinu' }]}
            />
            <CatchCard
              href="#cards"
              weightKg={14.2}
              species="Crap Oglindă"
              anglerName="mihai.p"
              standLabel="Stand 12"
              timeLabel="04:37"
              imageSrc="/images/placeholder-lake.jpg"
            />
          </div>
        </Block>

        <Block title="Carduri · alte stări">
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CompetitionCard
              title="Memorialul Siliștea"
              dateLabel="Sâm, 11 oct · 07:00"
              lakeName="Balta Siliștea"
              imageSrc="/images/competition-placeholder.jpg"
              status={{ label: 'Înscrieri deschise', tone: 'success' }}
              registeredCount={36}
              capacity={48}
              badges={[{ label: 'Echipe', tone: 'indigo' }]}
            />
            <CompetitionCard
              title="Cupa de Iarnă"
              dateLabel="Sâm, 6 dec"
              lakeName="Lacul Cornu"
              imageSrc="/images/lake.jpeg"
              status={{ label: 'Ultimele 3 locuri', tone: 'warning' }}
              followersCount={58}
              registeredCount={45}
              capacity={48}
            />
            <LakeCard
              name="Balta Siliștea"
              rating={null}
              locationLabel="Siliștea, Ilfov"
              species={['Crap']}
              priceMin={80}
              imageSrc="/images/placeholder-lake.jpg"
            />
            <AnglerCard
              username="radu.ionescu"
              city="Brașov"
              followersCount={1}
              competitionsCount={1}
              podiumsCount={0}
              recordKg={null}
              action={<FollowButton name="radu.ionescu" defaultFollowing />}
            />
            <PartidaCard
              title="Dimineață la amur"
              lakeName="Balta Siliștea"
              durationLabel="5h 40min"
              active={false}
              catchCount={1}
              totalKg={7.35}
              friends={[{ name: 'Ioan Toma' }]}
            />
          </div>
        </Block>

        {/* Stacked: the kit column (976px at 1440) cannot hold 380px + the table without scrolling. */}
        <div className="grid grid-cols-1 gap-8 *:first:max-w-[380px]">
          <Block
            title="Rând clasament · mobil"
            note="Egalitate „=4” cu penalizare; „Fără capturi” pe fundal neutru. Sectorul apare doar ca bară de 4px."
          >
            <ol aria-label="Clasament" className="overflow-hidden rounded-card bg-surface shadow-e0">
              {mobileRows.map((r, i) => (
                <RankingRow key={r.standId} row={r} tied={mobileTies.has(i)} />
              ))}
            </ol>
            <ol aria-label="Clasament, rândul tău" className="overflow-hidden rounded-card bg-surface shadow-e0">
              <RankingRow row={tableRows[1]} isCurrentUser />
            </ol>
          </Block>
          <Block
            title="Tabel clasament · desktop · antet lipit, cifre tabulare, sortabil"
            note="Tabelul paginii de concurs, nu o copie: Stand primul cu bara sectorului, cântăriri cu trei zecimale, celula aurie pentru cea mai mare captură, marcajul de penalizare. Loc: numărul, cu trofeu pentru podium; câștigătorul de sector are trofeul discret la „Poziție sector”."
          >
            <RankingTable
              caption="Clasament general"
              columns={getQuantityColumns()}
              rows={tableRows}
              currentUserStandId="B22"
            />
          </Block>
        </div>

        <Block
          title="Tabel clasament · 24 de sectoare A–X · antet lipit la derulare"
          note={`Egalitate pe locul 4 (${bigTies.size} rânduri), penalizare −2 kg, fără capturi pe ultimul loc („–”). Antet colorat, avatar lângă nume. Click pe antet sortează.`}
        >
          <RankingTable
            caption="Clasament general, 24 de sectoare"
            columns={getQuantityColumns()}
            rows={bigRows}
            currentUserStandId={bigRows[1].standId}
            maxHeight="420px"
            faceOf={r => ({ src: null, team: r.participant.startsWith('Echipa') })}
          />
        </Block>
      </div>
    </>
  );
}

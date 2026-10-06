import type { ReactNode } from 'react';
import type { FeederGeneralRow, FeederLegRow, FeederLegSection, NcGeneralClub } from '@/core/competitions';
import { readCell } from '@/components/ranking/model';
import { competitionDateTime } from '../../../_components/dates';
import { statLines, statusText, type ImageColumn, type ImageRow, type RankingImageModel } from '../model';

export { statLines };
import { SCALE } from './scale';
import { contrastOn, inkOn, withAlpha, type ImageTokens, type TypeToken } from './tokens';
import { LOGO_PATHS, LOGO_VIEWBOX, TROPHY_PATH } from './marks';

/*
 * The ranking image, drawn for Satori (next/og): fish RankingTableForScreenshot.tsx (header, sector
 * title, the generic table), NationalChampionshipTable.tsx (the club table), FeederRankingTable.tsx
 * `variant="image"` and the totals + sponsors of ranking-image.tsx. Satori lays out flexbox only and
 * needs every size up front, so every block has a fixed height and `sheetSize` adds them up.
 *
 * Sizes are fish's (points at 1×); the PNG is drawn at SCALE× so it stays sharp when zoomed. Text
 * takes the site's t-* steps (tokens.ts reads them from globals.css), never a literal size. fish
 * prints «🎖️» next to a winner's place; the web's ranking marks a winner with the trophy
 * (_components/rankingShell PlaceCell), and the image uses the same mark.
 */

export { SCALE };
const u = (n: number) => Math.round(n * SCALE * 100) / 100;

const MIN_WIDTH = 1300;
const PAD = 16;
const HEADER_BLOCK = 160;
const HEADER_MARGIN = 40;
const TITLE_H = 80;
/** The totals: a hairline over them, STATS_GAP under the table (the header's rhythm), then the row. */
const STATS_GAP = 32;
const STATS_H = 96;
const SPONSOR = 150;
const SPONSORS_H = 16 + SPONSOR + 16;

// Generic table (RankingTableForScreenshot).
const CELL_W = 80;
const PARTICIPANT_W = 250;
const HEAD_H = 60;
const ROW_H = 40;
const FIRST_W = 60;
const DYN_PAD = 40;
const DYN_CHAR = 7;
const STAND_CHAR = 9;
const STAND_PAD = 28;
const STAND_MIN = 80;
const STAND_MAX = 180;

// NC club table (NationalChampionshipTable).
const NC_CLUB_W = 120;
const NC_MIN_NAMES = 200;
const NC_NAMES_PAD = 40;
const NC_STAND_MIN = 80;
const NC_STAND_MAX = 160;
const NC_STAND_PAD = 24;
const NC_STAND_CHAR = 7;

// Feeder, image variant (×1.45 of the screen sizes).
const F = 1.45;
const FW = {
  place: Math.round(40 * F),
  nameMin: Math.round(132 * F),
  points: Math.round(48 * F),
  seat: Math.round(44 * F),
  kg: Math.round(60 * F),
  legSeat: Math.round(46 * F),
  legKg: Math.round(60 * F),
  legCount: Math.round(38 * F),
  legBiggest: Math.round(56 * F),
  legPoints: Math.round(50 * F),
};
const F_ROW = 48;
const F_GROUP = 24;
const F_SUB = 26;
const F_BAND = 28;

const textLen = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === 'object' && 'weight' in (v as Record<string, unknown>)) return String((v as { weight: unknown }).weight ?? '').length;
  return String(v).length;
};

/** fish computeColumnWidth / computeStandColumnWidth. */
export function columnWidths(columns: readonly ImageColumn[], rows: readonly ImageRow[]): number[] {
  return columns.map((c, i) => {
    const longest = rows.reduce((m, r) => Math.max(m, textLen(r[c.key])), c.title.length);
    if (i === 0 && c.key === 'position' && !c.dynamic) return Math.min(Math.max(longest * STAND_CHAR + STAND_PAD, STAND_MIN), STAND_MAX);
    if (c.dynamic) return Math.min(Math.max(longest * DYN_CHAR + DYN_PAD, c.dynamic.min), c.dynamic.max);
    if (i === 0) return FIRST_W;
    if (c.key === 'participant') return PARTICIPANT_W;
    return CELL_W;
  });
}

const NC_MERGED = new Set(['club', 'totalKg', 'biggestCatch', 'catchCount', 'averageWeight', 'points', 'position']);
type NcCol = { key: string; title: string; width: number };

function ncColumns(clubs: readonly NcGeneralClub[]): NcCol[] {
  const teams = clubs.flatMap(c => c.teams);
  const names = Math.max(teams.reduce((m, t) => Math.max(m, t.participants.length * 6), 0) + NC_NAMES_PAD, NC_MIN_NAMES);
  const standLen = teams.reduce((m, t) => Math.max(m, t.stand.length), 'Stand'.length);
  const stand = Math.min(Math.max(standLen * NC_STAND_CHAR + NC_STAND_PAD, NC_STAND_MIN), NC_STAND_MAX);
  return [
    { key: 'club', title: 'Club', width: NC_CLUB_W },
    { key: 'participants', title: 'Pescari', width: names },
    { key: 'stand', title: 'Stand', width: stand },
    { key: 'quantity', title: 'Cantitate Sector', width: CELL_W },
    { key: 'totalKg', title: 'Total Kg Lot', width: CELL_W },
    { key: 'biggestCatch', title: 'CMMC Lot', width: CELL_W },
    { key: 'catchCount', title: 'Nr Pesti Lot', width: CELL_W },
    { key: 'averageWeight', title: 'Medie Lot', width: CELL_W },
    { key: 'sectorPoints', title: 'Puncte Sector', width: CELL_W },
    { key: 'points', title: 'Puncte Lot', width: CELL_W },
    { key: 'position', title: 'Loc General', width: CELL_W },
    { key: 'generalPosition', title: 'Loc Individual', width: CELL_W },
  ];
}

const imageNameWidth = (names: readonly string[]) =>
  Math.min(Math.max(Math.ceil(names.reduce((m, n) => Math.max(m, n.length), 0) * 8.5 + 16), FW.nameMin), 340);

/** The table's own size (points at 1×). */
function tableSize(model: RankingImageModel): { width: number; height: number } {
  const t = model.table;
  switch (t.kind) {
    case 'table': {
      const widths = columnWidths(t.columns, t.rows);
      return { width: widths.reduce((a, b) => a + b, 0), height: HEAD_H + t.rows.length * ROW_H };
    }
    case 'ncGeneral': {
      const rows = t.clubs.reduce((n, c) => n + Math.max(c.teams.length, 1), 0);
      return { width: ncColumns(t.clubs).reduce((a, c) => a + c.width, 0), height: HEAD_H + rows * ROW_H };
    }
    case 'feederGeneral': {
      const name = imageNameWidth(t.rows.map(r => r.name));
      const width = FW.place + name + FW.points + FW.kg + t.legs.length * (FW.seat + FW.kg + FW.points);
      return { width, height: F_GROUP + F_SUB + t.rows.length * F_ROW };
    }
    case 'feederLeg': {
      const name = imageNameWidth(t.sections.flatMap(s => s.rows.map(r => r.name)));
      const width = FW.legSeat + name + FW.legKg + FW.legCount + FW.legBiggest + FW.legPoints;
      const rows = t.sections.reduce((n, s) => n + s.rows.length, 0);
      return { width, height: F_SUB + 8 + t.sections.length * F_BAND + rows * F_ROW };
    }
  }
}

/** The PNG's size in pixels (SCALE× the 1× layout). */
export function sheetSize(model: RankingImageModel, sponsorCount: number): { width: number; height: number } {
  const table = tableSize(model);
  const width = Math.max(MIN_WIDTH, table.width + 2 * PAD);
  const height =
    PAD +
    HEADER_MARGIN * 2 +
    HEADER_BLOCK +
    (model.title ? TITLE_H : 0) +
    table.height +
    STATS_GAP +
    STATS_H +
    (sponsorCount > 0 ? SPONSORS_H : 0) +
    PAD;
  return { width: Math.ceil(u(width)), height: Math.ceil(u(height)) };
}

/** Where the sheet's blocks sit, in the PNG's pixels: the viewer's skeleton and opening view. */
export type SheetGeometry = {
  width: number;
  height: number;
  /** The white margin above the header (the phone opens just under it). */
  top: number;
  header: { y: number; h: number };
  title: { y: number; h: number } | null;
  /** The table block, centred across the sheet: its rows (head excluded) for the skeleton. */
  table: { x: number; y: number; w: number; h: number; rows: number };
  stats: { y: number; h: number };
};

export function sheetGeometry(model: RankingImageModel, sponsorCount: number): SheetGeometry {
  const { width, height } = sheetSize(model, sponsorCount);
  const table = tableSize(model);
  const t = model.table;
  const rows =
    t.kind === 'table'
      ? t.rows.length
      : t.kind === 'ncGeneral'
        ? t.clubs.reduce((n, c) => n + Math.max(c.teams.length, 1), 0)
        : t.kind === 'feederGeneral'
          ? t.rows.length
          : t.sections.reduce((n, s) => n + s.rows.length + 1, 0);
  const headerY = PAD + HEADER_MARGIN;
  const titleY = headerY + HEADER_BLOCK + HEADER_MARGIN;
  const tableY = titleY + (model.title ? TITLE_H : 0);
  const statsY = tableY + table.height + STATS_GAP;
  return {
    width,
    height,
    top: u(headerY),
    header: { y: u(headerY), h: u(HEADER_BLOCK) },
    title: model.title ? { y: u(titleY - 16), h: u(TITLE_H) } : null,
    table: { x: Math.round((width - u(table.width)) / 2), y: u(tableY), w: u(table.width), h: u(table.height), rows },
    stats: { y: u(statsY), h: u(STATS_H) },
  };
}

/** «dd MMMM yyyy HH:mm» in Bucharest (fish format(date, 'dd MMMM yyyy HH:mm', { locale: ro })). */
export function imageDateTime(iso: string): string {
  const [, date = '', time = ''] = competitionDateTime(iso).split(', ');
  return `${date} ${time}`.trim();
}

/* ------------------------------------------------------------------ */

type Ctx = { tokens: ImageTokens; sectorColor: (letter: string) => string };

/** A t-* step as Satori style, at SCALE× (weight / line height overridable by another step's). */
function font(step: TypeToken, o: { weight?: number; lineHeight?: number } = {}) {
  return {
    fontSize: u(step.size),
    lineHeight: `${u(o.lineHeight ?? step.lineHeight)}px`,
    fontWeight: o.weight ?? step.weight,
    ...(step.letterSpacing ? { letterSpacing: u(step.letterSpacing) } : {}),
  };
}

/** The lightest ground a row can have (zebra page, podium accent tint) — text on rows must clear AA on all. */
const rowGrounds = (tokens: ImageTokens) => [tokens.surface, tokens.page, tokens.accentTint];

/**
 * A leg / sector colour used as TEXT (a column head on its 0.1 tint, a leg's points on the rows):
 * the colour itself where it reaches AA (4.5:1) on every ground it sits on, else the ink — the
 * image is printed and shared, and several sector hues (orange, amber, lime, cyan) are too light.
 */
export function colourInk(color: string, tokens: ImageTokens): string {
  const grounds: [string, number][] = [[color, 0.1], ...rowGrounds(tokens).map((g): [string, number] => [g, 1])];
  return grounds.every(([fill, alpha]) => contrastOn(color, fill, alpha, tokens.surface) >= 4.5) ? color : tokens.ink;
}

/** The generic / NC table head (as RankingTable's text-accent-ink head) and the Best-N tier head. */
export const tableHead = (tokens: ImageTokens) => ({ ink: tokens.accentInk, fill: tokens.accentTint2 });
export const tierHead = (tokens: ImageTokens) => ({ ink: tokens.ink, fill: tokens.indigo4 });
/** The feeder tables' plain head (Loc, the name, a leg's columns). */
export const plainHead = (tokens: ImageTokens) => ({ ink: tokens.muted, fill: tokens.softFill });
/** fish LEG_COLORS (blue, teal, purple): the sector tokens of the same hues. */
export const LEG_SECTORS = ['A', 'M', 'D'] as const;

/**
 * Every text-on-fill pair the sheet's heads draw (and a leg colour on the rows), for the contrast
 * unit test: [what, ink, fill, alpha over the white sheet].
 */
export function headPairs(tokens: ImageTokens): [string, string, string, number][] {
  const sector = (l: string) => tokens.sectors[l] ?? tokens.muted;
  const total = tokens.accentInk;
  const pairs: [string, string, string, number][] = [
    ['table head', tableHead(tokens).ink, tableHead(tokens).fill, 1],
    ['tier head', tierHead(tokens).ink, tierHead(tokens).fill, 1],
    ['feeder head', plainHead(tokens).ink, plainHead(tokens).fill, 1],
    ['feeder Total', tokens.onAccent, total, 1],
    ['feeder Total sub-head', total, total, 0.1],
    ['tier won cell', tokens.onAccent, tokens.success, 1],
  ];
  for (const ground of rowGrounds(tokens)) pairs.push([`Total points on ${ground}`, total, ground, 1]);
  for (const l of LEG_SECTORS) {
    const c = sector(l);
    pairs.push([`leg ${l} band`, inkOn(c, 1, tokens.surface, tokens.onAccent, tokens.ink), c, 1]);
    pairs.push([`leg ${l} sub-head`, colourInk(c, tokens), c, 0.1]);
    for (const ground of rowGrounds(tokens)) pairs.push([`leg ${l} points on ${ground}`, colourInk(c, tokens), ground, 1]);
  }
  return pairs;
}

function Trophy({ color, size }: { color: string; size: number }) {
  return (
    <svg width={u(size)} height={u(size)} viewBox="0 0 20 20" fill={color}>
      <path fillRule="evenodd" clipRule="evenodd" d={TROPHY_PATH} />
    </svg>
  );
}

function Txt({
  children,
  step,
  weight,
  color,
  align = 'center',
  lines = 1,
  lineHeight,
}: {
  children: ReactNode;
  step: TypeToken;
  /** Another step's weight (the emphasis), when it differs from `step`'s. */
  weight?: number;
  color: string;
  align?: 'center' | 'left';
  lines?: number;
  /** Another step's line height, for a name set tight on two lines in a fixed row. */
  lineHeight?: number;
}) {
  const lh = lineHeight ?? step.lineHeight;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        alignItems: 'center',
        gap: u(4),
        ...font(step, { weight, lineHeight: lh }),
        color,
        textAlign: align,
        maxHeight: u(lh * lines),
        overflow: 'hidden',
        ...(lines === 1 ? { whiteSpace: 'nowrap', textOverflow: 'ellipsis' } : {}),
      }}
    >
      {children}
    </div>
  );
}

/**
 * Where Nunito's baseline sits below the middle of its line box, in em: (ascent − descent) / 2 of
 * its metrics (1.011, 0.353). A font metric, not a visual value: it lines two sizes up on one baseline.
 */
const BASELINE_EM = 0.329;

/** The header's right column: as wide as the logo's, so the name and the date row centre on the same axis. */
const HEADER_SIDE = 280;

/*
 * Logo | three rows (name + ranking-type badge, organizer + lake, dates + status + «Exportat la data»).
 * The badge sits on the name's row and the export date on the date row (same line box, on its
 * baseline); the right cell of every row is HEADER_SIDE wide, so the centre column never shifts.
 */
function Header({ model, ctx, now }: { model: RankingImageModel; ctx: Ctx; now: string }) {
  const { tokens } = ctx;
  const { type } = tokens;
  const c = model.competition;
  const row = { display: 'flex', alignItems: 'center', width: '100%' } as const;
  const centre = { display: 'flex', flex: 1, justifyContent: 'center', textAlign: 'center' } as const;
  const side = { display: 'flex', justifyContent: 'flex-end', width: u(HEADER_SIDE), flexShrink: 0 } as const;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: u(HEADER_BLOCK),
        marginTop: u(HEADER_MARGIN),
        marginBottom: u(HEADER_MARGIN),
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: u(260), flexShrink: 0 }}>
        <svg width={u(260)} height={u((260 * 624) / 1832.937)} viewBox={LOGO_VIEWBOX} fill={tokens.accentInk}>
          {LOGO_PATHS.map((p, i) => (
            <path key={i} d={p.d} fillRule={p.evenodd ? 'evenodd' : undefined} clipRule={p.evenodd ? 'evenodd' : undefined} />
          ))}
        </svg>
        <div style={{ display: 'flex', marginTop: u(8), ...font(type.caption), color: tokens.ink2 }}>Descarcă aplicația și vezi clasamentul live!</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginLeft: u(16), gap: u(12) }}>
        <div style={row}>
          <div style={{ ...centre, ...font(type['page-title']), maxHeight: u(type['page-title'].lineHeight * 2), overflow: 'hidden', color: tokens.ink }}>{c.name}</div>
          <div style={side}>
            <div
              style={{
                display: 'flex',
                backgroundColor: tokens.accentTint2,
                color: tokens.accentInk,
                borderRadius: u(tokens.radiusBadge),
                paddingLeft: u(12),
                paddingRight: u(12),
                paddingTop: u(6),
                paddingBottom: u(6),
                ...font(type.stat),
              }}
            >
              {model.rankingLabel}
            </div>
          </div>
        </div>
        <div style={row}>
          <div style={{ ...centre, flexWrap: 'wrap', ...font(type.title1, { weight: type.caption.weight }), color: tokens.ink2 }}>
            {c.author ? (
              <>
                <span>Organizat de&nbsp;</span>
                <span style={{ color: tokens.accentInk, fontWeight: type.title1.weight }}>{c.author.username}</span>
              </>
            ) : null}
            {c.lake ? (
              <>
                <span>{c.author ? '\u00a0pe balta\u00a0' : 'Pe balta\u00a0'}</span>
                <span style={{ color: tokens.accentInk, fontWeight: type.title1.weight }}>{c.lake.name}</span>
              </>
            ) : null}
          </div>
          <div style={side} />
        </div>
        <div style={row}>
          <div style={{ ...centre, gap: u(16), ...font(type.title1, { weight: type.caption.weight }) }}>
            <span style={{ color: tokens.ink2 }}>
              {imageDateTime(c.startDate)} - {imageDateTime(c.endDate)}
            </span>
            <span style={{ color: tokens.accentInk, fontWeight: type.title1.weight }}>{statusText(c.competitionStatus)}</span>
          </div>
          {/* Same line box as the date row; Satori has no baseline alignment, so the smaller face is
              lowered by the difference of the two baselines (Nunito's: BASELINE_EM × the size gap). */}
          <div
            style={{
              ...side,
              ...font(type.caption, { lineHeight: type.title1.lineHeight }),
              position: 'relative',
              top: u(BASELINE_EM * (type.title1.size - type.caption.size)),
              color: tokens.muted,
              whiteSpace: 'nowrap',
            }}
          >
            Exportat la data {now}
          </div>
        </div>
      </div>
    </div>
  );
}

function Title({ model, ctx }: { model: RankingImageModel; ctx: Ctx }) {
  if (!model.title) return null;
  const color = model.title.sectorLetter ? ctx.sectorColor(model.title.sectorLetter) : ctx.tokens.accentInk;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: u(TITLE_H), marginTop: u(-16), marginBottom: u(16) }}>
      <div style={{ display: 'flex', ...font(ctx.tokens.type.count), color }}>{model.title.text}</div>
    </div>
  );
}

/* ---------- the generic table (standard rankings, an NC sector) ---------- */

const CATCH = /^catch\d+$/;
/** Name columns: read from the left, on two lines when long (never clipped at the start). */
const TEXT_COLUMNS = new Set(['participant']);

function GenericTable({ columns, rows, ctx }: { columns: ImageColumn[]; rows: ImageRow[]; ctx: Ctx }) {
  const { tokens } = ctx;
  const { type } = tokens;
  const head = tableHead(tokens);
  const tier = tierHead(tokens);
  const widths = columnWidths(columns, rows);
  const cellBase = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: u(ROW_H),
    paddingLeft: u(8),
    paddingRight: u(8),
    // The on-screen ranking's grid (RankingTable / RankingRow border-hairline).
    border: `${u(1)}px solid ${tokens.hairline}`,
  } as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex' }}>
        {columns.map((col, i) => (
          <div
            key={col.key}
            style={{ ...cellBase, width: u(widths[i]), height: u(HEAD_H), backgroundColor: col.isTier ? tier.fill : head.fill }}
          >
            <Txt step={type.caption} color={col.isTier ? tier.ink : head.ink} lines={2}>
              {col.title}
            </Txt>
          </div>
        ))}
      </div>
      {rows.map((row, ri) => {
        const winner = !!row.isWinner;
        const sector = ctx.sectorColor(row.sectorLetter);
        return (
          <div key={ri} style={{ display: 'flex' }}>
            {columns.map((col, ci) => {
              const cell = readCell(row[col.key]);
              const isCatch = CATCH.test(col.key);
              const minFish = typeof row.sectorMinNumberOfFish === 'number' ? row.sectorMinNumberOfFish : undefined;
              // fish: catch cells past the sector's minimum number of fish are greyed out and empty.
              const greyed = isCatch && minFish !== undefined && ci > minFish + 1;
              const bg = greyed
                ? tokens.softFill
                : cell.isTierWin
                  ? tokens.success
                  : cell.isTier
                    ? winner
                      ? tokens.accentTint3
                      : tokens.accentTint2
                    : cell.isBiggest
                      ? withAlpha(tokens.rating, 0.85)
                      : withAlpha(sector, winner ? 0.9 : 0.4);
              // A winner's 0.9 sector fill: white where it reaches AA, else the ink (orange, green sectors).
              const winnerInk = inkOn(sector, 0.9, tokens.surface, tokens.onAccent, tokens.ink);
              const color = cell.isTierWin ? tokens.onAccent : cell.isTier || cell.isBiggest ? tokens.ink : winner ? winnerInk : tokens.ink;
              const isText = TEXT_COLUMNS.has(col.key);
              const raw = col.key === 'position' ? String(cell.raw ?? '').replace('/', '') : cell.raw;
              const text = raw === null || raw === '' ? '-' : String(raw);
              return (
                <div
                  key={col.key}
                  style={{
                    ...cellBase,
                    position: 'relative',
                    width: u(widths[ci]),
                    backgroundColor: bg,
                    ...(isText ? { justifyContent: 'flex-start' } : {}),
                    ...(ci === 0 ? { borderLeft: `${u(4)}px solid ${sector}` } : {}),
                  }}
                >
                  {greyed ? null : (
                    <Txt
                      step={type.table}
                      weight={ci === 0 || winner ? type['body-strong'].weight : undefined}
                      color={color}
                      align={isText ? 'left' : 'center'}
                      lines={isText ? 2 : 1}
                      // Two lines of a long name inside the 40-high row: set at the label step's leading.
                      lineHeight={isText ? type.label.lineHeight : undefined}
                    >
                      {winner && col.key === 'generalPosition' ? <Trophy color={color} size={type.table.size} /> : null}
                      {text}
                    </Txt>
                  )}
                  {cell.isSplit ? (
                    <div style={{ position: 'absolute', right: u(2), bottom: u(1), display: 'flex', ...font(type.nano), color }}>SPLIT</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- National Championship General (the club table) ---------- */

function NcClubTable({ clubs, ctx }: { clubs: NcGeneralClub[]; ctx: Ctx }) {
  const { tokens } = ctx;
  const cols = ncColumns(clubs);
  const { type } = tokens;
  const head = tableHead(tokens);
  const clubColor = (i: number) => ctx.sectorColor('ABCDEF'[i] ?? 'A');
  const border = `${u(1)}px solid ${tokens.hairline}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex' }}>
        {cols.map(c => (
          <div
            key={c.key}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: u(c.width), height: u(HEAD_H), padding: u(4), border, backgroundColor: head.fill }}
          >
            <Txt step={type.caption} color={head.ink} lines={2}>
              {c.title}
            </Txt>
          </div>
        ))}
      </div>
      {clubs.map(club => {
        const color = clubColor(club.colorIndex);
        const n = Math.max(club.teams.length, 1);
        const fill = withAlpha(color, club.winner ? 0.9 : 0.4);
        // White on the 0.9 fill only where it reaches AA (the orange / green clubs take the ink).
        const strongInk = inkOn(color, 0.9, tokens.surface, tokens.onAccent, tokens.ink);
        const ink = club.winner ? strongInk : tokens.ink;
        const merged = (key: string): string => {
          const v = { club: club.clubName, totalKg: club.totalKg, biggestCatch: club.biggestCatch, catchCount: club.catchCount, averageWeight: club.averageWeight, points: club.points, position: club.position }[key];
          return v ?? '-';
        };
        return (
          <div key={club.clubId} style={{ display: 'flex' }}>
            {cols.map(c => {
              if (NC_MERGED.has(c.key)) {
                const value = merged(c.key);
                return (
                  <div
                    key={c.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: u(c.width),
                      height: u(n * ROW_H),
                      padding: u(4),
                      border,
                      backgroundColor: fill,
                      ...(c.key === 'club' ? { borderLeft: `${u(4)}px solid ${color}` } : {}),
                    }}
                  >
                    <Txt step={c.key === 'club' ? type.label : type.caption} color={ink} lines={c.key === 'club' ? 3 : 1}>
                      {club.winner && c.key === 'position' && value !== '-' ? <Trophy color={ink} size={type.caption.size} /> : null}
                      {value}
                    </Txt>
                  </div>
                );
              }
              return (
                <div key={c.key} style={{ display: 'flex', flexDirection: 'column' }}>
                  {club.teams.map(team => {
                    const individual = c.key === 'generalPosition' && team.individualWinner;
                    const bg = individual || club.winner ? withAlpha(color, 0.9) : withAlpha(color, 0.4);
                    const tc = individual || club.winner ? strongInk : tokens.ink;
                    const value =
                      c.key === 'participants'
                        ? team.participants
                        : c.key === 'stand'
                          ? team.stand
                          : c.key === 'quantity'
                            ? team.quantity
                            : c.key === 'sectorPoints'
                              ? team.sectorPoints
                              : team.generalPosition
                                ? String(team.generalPosition)
                                : '-';
                    return (
                      <div
                        key={team.standId + c.key}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: u(c.width), height: u(ROW_H), padding: u(4), border, backgroundColor: bg }}
                      >
                        <Txt step={type.caption} color={tc} lines={c.key === 'participants' ? 2 : 1}>
                          {individual && value !== '-' ? <Trophy color={tc} size={type.caption.size} /> : null}
                          {value}
                        </Txt>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Feeder (image variant) ---------- */

function legColor(ctx: Ctx, leg: number) {
  return ctx.sectorColor(LEG_SECTORS[(leg - 1) % LEG_SECTORS.length]);
}

function FCell({
  w,
  h = F_ROW,
  children,
  bg,
  color,
  weight,
  align = 'center',
  lines = 1,
  left,
  head,
  ctx,
}: {
  w: number;
  h?: number;
  children?: ReactNode;
  bg: string;
  color: string;
  weight?: number;
  align?: 'center' | 'left';
  lines?: number;
  left?: string;
  head?: boolean;
  ctx: Ctx;
}) {
  const border = `${u(1)}px solid ${ctx.tokens.hairline}`;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        width: u(w),
        height: u(h),
        paddingLeft: u(head ? 2 : 6),
        paddingRight: u(head ? 2 : 6),
        backgroundColor: bg,
        borderRight: border,
        borderBottom: border,
        ...(left ? { borderLeft: `${u(2)}px solid ${left}` } : {}),
      }}
    >
      {children != null ? (
        <Txt step={head ? ctx.tokens.type.control : ctx.tokens.type.table} weight={weight} color={color} align={align} lines={lines}>
          {children}
        </Txt>
      ) : null}
    </div>
  );
}

function FeederGeneral({ legs, rows, nameTitle, ctx }: { legs: number[]; rows: FeederGeneralRow[]; nameTitle: string; ctx: Ctx }) {
  const { tokens } = ctx;
  const { type } = tokens;
  // fish's 600 / 700 text: the table step and its strong twin.
  const regular = type.table.weight;
  const strong = type['body-strong'].weight;
  const name = imageNameWidth(rows.map(r => r.name));
  const total = tokens.accentInk;
  const totalSub = withAlpha(total, 0.1);
  const plain = { bg: tokens.softFill, color: tokens.muted };
  const zebra = (i: number) => (i % 2 ? tokens.page : tokens.surface);
  const rowBg = (r: FeederGeneralRow, i: number) => (r.podium ? tokens.accentTint : zebra(i));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `${u(1)}px solid ${tokens.hairline}` }}>
      <div style={{ display: 'flex' }}>
        <FCell w={FW.place} h={F_GROUP + F_SUB} head weight={regular} ctx={ctx} {...plain}>
          Loc
        </FCell>
        <FCell w={name} h={F_GROUP + F_SUB} head weight={regular} ctx={ctx} {...plain}>
          {nameTitle}
        </FCell>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <FCell w={FW.points + FW.kg} h={F_GROUP} head weight={strong} bg={total} color={tokens.onAccent} left={total} ctx={ctx}>
            Total
          </FCell>
          <div style={{ display: 'flex' }}>
            <FCell w={FW.points} h={F_SUB} head weight={regular} bg={totalSub} color={total} left={total} ctx={ctx}>
              Puncte
            </FCell>
            <FCell w={FW.kg} h={F_SUB} head weight={regular} bg={totalSub} color={total} ctx={ctx}>
              Kg
            </FCell>
          </div>
        </div>
        {legs.map(leg => {
          const c = legColor(ctx, leg);
          const sub = withAlpha(c, 0.1);
          return (
            <div key={leg} style={{ display: 'flex', flexDirection: 'column' }}>
              <FCell w={FW.seat + FW.kg + FW.points} h={F_GROUP} head weight={strong} bg={c} color={inkOn(c, 1, tokens.surface, tokens.onAccent, tokens.ink)} left={c} ctx={ctx}>
                {`Manșa ${leg}`}
              </FCell>
              <div style={{ display: 'flex' }}>
                <FCell w={FW.seat} h={F_SUB} head weight={regular} bg={sub} color={colourInk(c, tokens)} left={c} ctx={ctx}>
                  Stand
                </FCell>
                <FCell w={FW.kg} h={F_SUB} head weight={regular} bg={sub} color={colourInk(c, tokens)} ctx={ctx}>
                  Kg
                </FCell>
                <FCell w={FW.points} h={F_SUB} head weight={regular} bg={sub} color={colourInk(c, tokens)} ctx={ctx}>
                  Puncte
                </FCell>
              </div>
            </div>
          );
        })}
      </div>
      {rows.map((r, i) => {
        const bg = rowBg(r, i);
        return (
          <div key={r.registrationId} style={{ display: 'flex' }}>
            <FCell w={FW.place} bg={bg} color={tokens.ink} weight={strong} ctx={ctx}>
              {r.podium ? <Trophy color={tokens.accentInk} size={type.table.size} /> : null}
              {String(r.position)}
            </FCell>
            <FCell w={name} bg={bg} color={tokens.ink} weight={r.podium ? strong : regular} align="left" lines={2} ctx={ctx}>
              {r.name}
            </FCell>
            <FCell w={FW.points} bg={bg} color={total} weight={strong} left={total} ctx={ctx}>
              {r.totalPoints}
            </FCell>
            <FCell w={FW.kg} bg={bg} color={tokens.ink} ctx={ctx}>
              {r.totalKg}
            </FCell>
            {r.legs.map((cell, li) => {
              const c = legColor(ctx, legs[li]);
              return [
                <FCell key={`s${li}`} w={FW.seat} bg={bg} color={tokens.muted} left={c} ctx={ctx}>
                  {cell.seat}
                </FCell>,
                <FCell key={`k${li}`} w={FW.kg} bg={bg} color={tokens.ink} ctx={ctx}>
                  {cell.kg}
                </FCell>,
                <FCell key={`p${li}`} w={FW.points} bg={bg} color={colourInk(c, tokens)} weight={regular} ctx={ctx}>
                  {cell.points}
                </FCell>,
              ];
            })}
          </div>
        );
      })}
    </div>
  );
}

function FeederLeg({ sections, nameTitle, ctx }: { sections: FeederLegSection[]; nameTitle: string; ctx: Ctx }) {
  const { tokens } = ctx;
  const { type } = tokens;
  // fish's 600 / 700 text: the table step and its strong twin.
  const regular = type.table.weight;
  const strong = type['body-strong'].weight;
  const name = imageNameWidth(sections.flatMap(s => s.rows.map(r => r.name)));
  const plain = { bg: tokens.softFill, color: tokens.muted };
  const head = F_SUB + 8;
  const width = FW.legSeat + name + FW.legKg + FW.legCount + FW.legBiggest + FW.legPoints;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `${u(1)}px solid ${tokens.hairline}` }}>
      <div style={{ display: 'flex' }}>
        {(
          [
            [FW.legSeat, 'Stand'],
            [name, nameTitle],
            [FW.legKg, 'Kg'],
            [FW.legCount, 'Buc'],
            [FW.legBiggest, 'C.M.M.C'],
            [FW.legPoints, 'Puncte'],
          ] as const
        ).map(([w, t]) => (
          <FCell key={t} w={w} h={head} head weight={regular} ctx={ctx} {...plain}>
            {t}
          </FCell>
        ))}
      </div>
      {sections.map(section => {
        const color = section.sector ? ctx.sectorColor(section.sector) : tokens.faint;
        return (
          <div key={section.sector ?? 'none'} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: u(width), height: u(F_BAND), paddingLeft: u(10), backgroundColor: color }}>
              <Txt step={type.table} weight={strong} color={inkOn(color, 1, tokens.surface, tokens.onAccent, tokens.ink)}>
                {section.sector ? `Sector ${section.sector}` : 'Nu au pescuit în această manșă'}
              </Txt>
            </div>
            {section.rows.map((r, i) => (
              <LegRow key={r.registrationId} r={r} i={i} color={color} name={name} ctx={ctx} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function LegRow({ r, i, color, name, ctx }: { r: FeederLegRow; i: number; color: string; name: number; ctx: Ctx }) {
  const { tokens } = ctx;
  const { type } = tokens;
  // fish's 600 / 700 text: the table step and its strong twin.
  const regular = type.table.weight;
  const strong = type['body-strong'].weight;
  const bg = r.sectorWinner ? withAlpha(color, 0.16) : i % 2 ? tokens.page : tokens.surface;
  return (
    <div style={{ display: 'flex', borderLeft: `${u(4)}px solid ${color}` }}>
      <FCell w={FW.legSeat - 4} bg={bg} color={tokens.muted} ctx={ctx}>
        {r.seat}
      </FCell>
      <FCell w={name} bg={bg} color={tokens.ink} weight={r.sectorWinner ? strong : regular} align="left" lines={2} ctx={ctx}>
        {r.name}
      </FCell>
      <FCell w={FW.legKg} bg={bg} color={tokens.ink} ctx={ctx}>
        {r.kg}
      </FCell>
      <FCell w={FW.legCount} bg={bg} color={tokens.ink} ctx={ctx}>
        {r.catchCount}
      </FCell>
      <FCell w={FW.legBiggest} bg={bg} color={tokens.ink} ctx={ctx}>
        {r.biggestFish}
      </FCell>
      <FCell w={FW.legPoints} bg={bg} color={tokens.ink} weight={strong} ctx={ctx}>
        {r.points}
      </FCell>
    </div>
  );
}

/* ---------- totals + sponsors ---------- */

/*
 * fish's totals and order, at the sheet's hierarchy: an overline label (heading size, muted 600,
 * upper case with the eyebrow's tracking) over the value (the display step, accent), STATS_GAP under
 * the table and a hairline above, so the row reads as the sheet's summary, not a table row.
 */
function Stats({ model, ctx }: { model: RankingImageModel; ctx: Ctx }) {
  const { tokens } = ctx;
  const { type } = tokens;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        height: u(STATS_H),
        marginTop: u(STATS_GAP),
        paddingTop: u(24),
        paddingBottom: u(16),
        paddingLeft: u(32),
        paddingRight: u(32),
        borderTop: `${u(1)}px solid ${tokens.hairline}`,
      }}
    >
      {statLines(model.stats).map(([label, value]) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(4) }}>
          <div
            style={{
              display: 'flex',
              ...font(type.heading, { weight: type.caption.weight }),
              letterSpacing: u(type.eyebrow.letterSpacing),
              textTransform: 'uppercase',
              color: tokens.ink2,
            }}
          >
            {label}
          </div>
          <div style={{ display: 'flex', ...font(type.display), color: tokens.accent }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

export function RankingSheet({
  model,
  tokens,
  now,
  sponsors,
  width,
  height,
}: {
  model: RankingImageModel;
  tokens: ImageTokens;
  now: string;
  /** Sponsor logos already read (data URLs); a logo that could not be read is left out. */
  sponsors: string[];
  width: number;
  height: number;
}) {
  const ctx: Ctx = { tokens, sectorColor: letter => tokens.sectors[letter.toUpperCase()] ?? tokens.muted };
  const t = model.table;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width,
        height,
        padding: u(PAD),
        backgroundColor: tokens.surface,
        fontFamily: 'Nunito',
        color: tokens.ink,
      }}
    >
      <Header model={model} ctx={ctx} now={now} />
      <Title model={model} ctx={ctx} />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {t.kind === 'table' ? (
          <GenericTable columns={t.columns} rows={t.rows} ctx={ctx} />
        ) : t.kind === 'ncGeneral' ? (
          <NcClubTable clubs={t.clubs} ctx={ctx} />
        ) : t.kind === 'feederGeneral' ? (
          <FeederGeneral legs={t.legs} rows={t.rows} nameTitle={t.nameTitle} ctx={ctx} />
        ) : (
          <FeederLeg sections={t.sections} nameTitle={t.nameTitle} ctx={ctx} />
        )}
      </div>
      <Stats model={model} ctx={ctx} />
      {sponsors.length > 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: u(16), marginTop: u(16), height: u(SPONSOR), paddingLeft: u(24), paddingRight: u(24) }}>
          {sponsors.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image.
            <img key={i} src={src} width={u(SPONSOR)} height={u(SPONSOR)} alt="" style={{ objectFit: 'contain' }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

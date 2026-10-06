import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatInt } from '@/components/cards/format';
import { UNDER_BAR_TOP_MD } from '@/components/nav/shell';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import { RANKING_HEAD } from '@/components/ranking/tableHead';
import { type CompetitionCard } from '@/core/competitions';
import { routes } from '@/lib/routes';
import type { MineRow, VariantData } from './data';
import { Cta, FormatChips, kg, lakeLine, MedalChip, MyStatusPills, nextStep, Places, SampleTag, Thumb, upcomingCta, type TabKey } from './shared';

/*
 * C — «Table for all»: every tab is a dense event table. One row = 72px: date, thumb, name + lake,
 * format, the tab's own number (places / live kg / winner / my status), status + CTA. The header
 * row is the ranking tables' coloured band (ROADMAP §4b.12) and sticks under the top bar; rows
 * highlight on hover and the whole row is the link.
 */

type Col = { label: string; className?: string; align?: 'end' };

export function VariantC({ tab, data }: { tab: TabKey; data: VariantData }) {
  if (tab === 'viitoare') {
    return (
      <Table cols={[{ label: 'Data', className: 'w-36' }, { label: 'Concurs' }, { label: 'Format', className: 'w-52' }, { label: 'Locuri', className: 'w-56' }, { label: '', className: 'w-32', align: 'end' }]}>
        {data.upcoming.map((c) => {
          const cta = upcomingCta(c);
          return (
            <Tr key={c.documentId}>
              <DateCell card={c} />
              <NameCell card={c} />
              <Td><FormatChips card={c} size="sm" /></Td>
              <Td><Places card={c} /></Td>
              <Td align="end"><Cta href={routes.competition(c.documentId)} {...cta} /></Td>
            </Tr>
          );
        })}
      </Table>
    );
  }
  if (tab === 'live') {
    return (
      <Table cols={[{ label: 'Data', className: 'w-36' }, { label: 'Concurs' }, { label: 'Format', className: 'w-52' }, { label: 'Cea mai mare', className: 'w-36', align: 'end' }, { label: 'Capturi', className: 'w-28', align: 'end' }, { label: 'Urmăresc', className: 'w-28', align: 'end' }, { label: '', className: 'w-60', align: 'end' }]}>
        {data.live.map((c) => (
          <Tr key={c.documentId}>
            <DateCell card={c} />
            <NameCell card={c} />
            <Td><FormatChips card={c} size="sm" /></Td>
            <Td align="end"><Num value={kg(c.results?.biggestFishKg)} unit={c.results?.biggestFishKg != null ? 'kg' : undefined} /></Td>
            <Td align="end"><Num value={formatInt(c.results?.catchCount ?? 0)} /></Td>
            <Td align="end"><Num value={formatInt(c.viewers)} /></Td>
            <Td align="end">
              <span className="flex items-center justify-end gap-2">
                <StatusPill tone="live">LIVE</StatusPill>
                <Cta href={routes.competition(c.documentId)} label="Clasament" variant="primary" />
              </span>
            </Td>
          </Tr>
        ))}
      </Table>
    );
  }
  if (tab === 'rezultate') {
    return (
      <Table cols={[{ label: 'Data', className: 'w-36' }, { label: 'Concurs' }, { label: 'Format', className: 'w-52' }, { label: 'Câștigător', className: 'w-64' }, { label: 'Cea mai mare', className: 'w-36', align: 'end' }, { label: 'Capturi', className: 'w-28', align: 'end' }, { label: '', className: 'w-32', align: 'end' }]}>
        {data.completed.map((c) => {
          const w = c.results?.podium[0];
          return (
            <Tr key={c.documentId}>
              <DateCell card={c} />
              <NameCell card={c} />
              <Td><FormatChips card={c} size="sm" /></Td>
              <Td>
                {w ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <MedalChip position={1} />
                    <Avatar name={w.displayName} src={w.avatarUrls[0] ?? null} size={24} />
                    <span className="truncate t-label text-ink">{w.displayName}</span>
                  </span>
                ) : (
                  <span className="t-caption text-muted">{c.results?.hasCatches ? 'Clasament în lucru' : 'Fără capturi'}</span>
                )}
              </Td>
              <Td align="end"><Num value={kg(c.results?.biggestFishKg)} unit={c.results?.biggestFishKg != null ? 'kg' : undefined} /></Td>
              <Td align="end"><Num value={formatInt(c.results?.catchCount ?? 0)} /></Td>
              <Td align="end"><Cta href={routes.competition(c.documentId)} label="Clasament" variant="secondary" /></Td>
            </Tr>
          );
        })}
      </Table>
    );
  }
  return (
    <Table cols={[{ label: 'Data', className: 'w-36' }, { label: 'Concurs' }, { label: 'Stare', className: 'w-64' }, { label: 'Pasul următor', className: 'w-[28%]' }, { label: '', className: 'w-36', align: 'end' }]}>
      {data.mine.map((r: MineRow) => {
        const step = nextStep(r, data.viewerName);
        return (
          <Tr key={r.card.documentId}>
            <DateCell card={r.card} />
            <NameCell card={r.card} extra={r.sample ? <SampleTag /> : null} />
            <Td><MyStatusPills row={r} /></Td>
            <Td><span className="line-clamp-2 t-table text-ink-2">{step.text}</span></Td>
            <Td align="end"><Cta href={routes.competition(r.card.documentId)} label={step.cta} variant={r.card.status === 'started' ? 'primary' : 'secondary'} /></Td>
          </Tr>
        );
      })}
    </Table>
  );
}

function Table({ cols, children }: { cols: Col[]; children: ReactNode }) {
  return (
    // overflow-clip (not hidden): clips the rounded corners without making a scroll container, so
    // the header row still sticks to the viewport under the top bar.
    <div className="overflow-clip rounded-card bg-surface shadow-e0">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th
                key={i}
                scope="col"
                className={cn(
                  'sticky z-above h-11 px-4 t-label whitespace-nowrap first:pl-5 last:pr-5',
                  UNDER_BAR_TOP_MD,
                  RANKING_HEAD,
                  c.align === 'end' ? 'text-right' : 'text-left',
                  c.className,
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Tr({ children }: { children: ReactNode }) {
  return <tr className="relative border-t border-hairline transition-colors duration-(--duration-fast) first:border-t-0 hover:bg-accent-tint">{children}</tr>;
}

function Td({ children, align, className }: { children: ReactNode; align?: 'end'; className?: string }) {
  return <td className={cn('h-18 px-4 align-middle first:pl-5 last:pr-5', align === 'end' && 'text-right', className)}>{children}</td>;
}

function DateCell({ card }: { card: CompetitionCard }) {
  return (
    <Td>
      <span className="flex flex-col">
        <span className="t-body-strong text-ink">{card.dateLabel}</span>
        <span className="t-caption text-muted">{card.hoursLabel ?? 'mai multe zile'}</span>
      </span>
    </Td>
  );
}

function NameCell({ card, extra }: { card: CompetitionCard; extra?: ReactNode }) {
  return (
    <Td>
      <span className="flex min-w-0 items-center gap-3">
        <Thumb card={card} className="h-12 w-16 rounded-control" sizes="64px" />
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <Link
              href={routes.competition(card.documentId)}
              className="truncate t-body-strong text-ink outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
            >
              {card.name}
            </Link>
            {extra}
          </span>
          <span className="truncate t-caption text-muted">{lakeLine(card)}</span>
        </span>
      </span>
    </Td>
  );
}

function Num({ value, unit }: { value: string; unit?: string }) {
  return (
    <span className="t-num-18 text-ink">
      {value}
      {unit ? <span className="ms-0.5 t-caption text-muted">{unit}</span> : null}
    </span>
  );
}

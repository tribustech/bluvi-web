import { CardShell, CardTitle } from './CardShell';
import { formatDecimal, formatInt, plural } from './format';
import { FaceStack } from '@/components/ui/Avatar';
import { Eyebrow } from './parts';

export type PartidaCardProps = {
  title: string;
  lakeName: string;
  /** "de 14h 20min" while active, "4h 10min" when finished — preformatted by the caller. */
  durationLabel: string;
  active: boolean;
  catchCount: number;
  totalKg: number;
  friends?: ReadonlyArray<{ name: string; avatarUrl?: string | null }>;
  href?: string;
};

function friendsLabel(n: number): string {
  if (n === 1) return 'cu un prieten';
  return `cu ${plural(n, 'prieten', 'prieteni')}`;
}

/** Fundații §07 card · partidă. */
export function PartidaCard({
  title,
  lakeName,
  durationLabel,
  active,
  catchCount,
  totalKg,
  friends = [],
  href,
}: PartidaCardProps) {
  return (
    <CardShell interactive={!!href} className="gap-2.5 p-4">
      <div className="flex items-center justify-between">
        <Eyebrow>Partidă · {active ? 'în desfășurare' : 'încheiată'}</Eyebrow>
        {active && <span aria-hidden className="size-2 rounded-full bg-live animate-live" />}
      </div>
      <CardTitle href={href} className="t-heading text-ink">
        {title}
      </CardTitle>
      <p className="t-caption text-muted">
        {lakeName} · {durationLabel}
      </p>
      <p className="flex items-baseline gap-1.5">
        <span className="t-num-40 text-ink">
          {formatInt(catchCount)}
        </span>
        <span className="t-label text-muted">
          {catchCount === 1 ? 'captură' : 'capturi'} · {formatDecimal(totalKg, 1, 1)} kg
        </span>
      </p>
      {friends.length > 0 && (
        <div className="flex items-center gap-1.5">
          <FaceStack
            people={friends.slice(0, 3).map((f, i) => ({ name: f.name, src: f.avatarUrl, tone: i % 2 ? 'tint' : 'indigo' }))}
            size={24}
          />
          <p className="t-caption text-ink-2">{friendsLabel(friends.length)}</p>
        </div>
      )}
    </CardShell>
  );
}

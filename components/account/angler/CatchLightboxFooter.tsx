import { fmtCatchDate, fmtProfileKg, type AnglerCatch } from '@/core/social';

/**
 * fish components/profile/CatchDetailFooter.tsx — under the photo in the catches lightbox (parity
 * account.angler-profile c19): «{kg} · {species}» (whichever exist; the weight as the signature
 * number, «kg» its own smaller word — owner rule 10), the venue, the competition's name for a
 * competition catch, the date «d MMM yyyy» (Romanian abbreviations).
 */
export function CatchLightboxFooter({ item }: { item: AnglerCatch }) {
  const hasTitle = item.weightKg != null || !!item.species;
  return (
    <div className="flex flex-col gap-0.5" data-testid="catch-footer">
      {hasTitle ? (
        <p className="flex flex-wrap items-baseline gap-x-1.5 t-title2" data-testid="catch-footer-title">
          {item.weightKg != null ? (
            <span className="whitespace-nowrap">
              {fmtProfileKg(item.weightKg)}
              <span className="ms-0.5 t-heading text-lavender-3">{' '}kg</span>
            </span>
          ) : null}
          {item.weightKg != null && item.species ? <span aria-hidden className="text-lavender-3">·</span> : null}
          {item.species ? <span>{item.species}</span> : null}
        </p>
      ) : null}
      {item.venueName ? <p className="t-body-strong text-lavender-3">{item.venueName}</p> : null}
      {item.source === 'competition' && item.competitionName ? (
        <p className="t-body-strong text-lavender-3" data-testid="catch-footer-competition">
          {item.competitionName}
        </p>
      ) : null}
      <p className="mt-0.5 t-caption text-lavender-3">
        <time dateTime={item.date}>{fmtCatchDate(item.date)}</time>
      </p>
    </div>
  );
}

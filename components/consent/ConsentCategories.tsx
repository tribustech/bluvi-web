'use client';

import { useId } from 'react';
import { ArrowTopRightOnSquareIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { SettingsSwitch } from '@/components/account/settings';
import { cn } from '@/components/ui/cn';
import { COPY, DETAIL_LABELS, type CategoryInfo, type ServiceDetails } from '@/lib/consent/catalog';
import { categoriesFor } from '@/lib/consent/catalog';
import { useActiveCategories } from '@/lib/consent/active';
import type { ConsentCategory, ConsentChoice } from '@/lib/consent/model';

/**
 * The consent categories whose service is configured (lib/consent/active.ts) as cards (fish CMP/ui/ExpandableToggleCard): title, «Mereu active» or
 * the switch, a one-line summary, and «Detalii» (a native <details>: works with JS off) with the
 * services' sections (fish text.ts serviceDetailsCategories) and the cookies.
 *
 * `values` undefined = the decision is not known yet (server HTML, hydration): the switch slots stay
 * empty boxes of the switch's size (owner rule 4), so nothing moves when they appear.
 */
export function ConsentCategories({
  values,
  onChange,
  headingLevel = 'h3',
  className,
}: {
  values: ConsentChoice | undefined;
  onChange: (category: ConsentCategory, on: boolean) => void;
  headingLevel?: 'h2' | 'h3';
  className?: string;
}) {
  const active = useActiveCategories();
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {categoriesFor(active).map((c) => (
        <li key={c.key}>
          <CategoryCard category={c} values={values} onChange={onChange} Heading={headingLevel} />
        </li>
      ))}
    </ul>
  );
}

function CategoryCard({
  category,
  values,
  onChange,
  Heading,
}: {
  category: CategoryInfo;
  values: ConsentChoice | undefined;
  onChange: (category: ConsentCategory, on: boolean) => void;
  Heading: 'h2' | 'h3';
}) {
  const titleId = useId();
  const summaryId = useId();
  const key = category.key;
  return (
    <section aria-labelledby={titleId} className="rounded-card bg-surface shadow-e0" data-consent-category={key}>
      <div className="flex items-start gap-3 px-4 pt-4 md:px-5">
        <div className="min-w-0 flex-1">
          <Heading id={titleId} className="t-heading text-ink">
            {category.title}
          </Heading>
          <p id={summaryId} className="t-body mt-1 text-ink-2">
            {category.summary}
          </p>
        </div>
        <div className="flex min-h-7 shrink-0 items-center">
          {key === 'necessary' ? (
            <span className="t-caption rounded-full bg-accent-tint-2 px-2.5 py-1 text-accent-ink">{COPY.alwaysOn}</span>
          ) : values === undefined ? (
            <span aria-hidden className="block h-7 w-12" />
          ) : (
            <SettingsSwitch checked={values[key]} onChange={(on) => onChange(key, on)} labelledBy={titleId} describedBy={summaryId} />
          )}
        </div>
      </div>
      <details className="group mt-2 border-t border-hairline">
        <summary
          className={cn(
            't-body-strong flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-accent-ink md:px-5 [&::-webkit-details-marker]:hidden',
            'rounded-b-card hover:bg-soft-fill group-open:rounded-none',
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
          )}
        >
          {COPY.details}
          <span className="sr-only"> — {category.title}</span>
          <ChevronDownIcon aria-hidden className="size-4 transition-transform duration-(--duration-fast) ease-fast group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-4 px-4 pt-1 pb-4 md:px-5">
          {category.services.map((s) => (
            <ServiceBlock key={s.name} service={s} />
          ))}
          <CookieList category={category} />
        </div>
      </details>
    </section>
  );
}

function ServiceBlock({ service }: { service: ServiceDetails }) {
  const rows: [string, string][] = [
    [DETAIL_LABELS.description, service.description],
    [DETAIL_LABELS.company, service.company],
    [DETAIL_LABELS.purposes, service.purposes.join(', ')],
    [DETAIL_LABELS.technologies, service.technologies.join(', ')],
    [DETAIL_LABELS.dataCollected, service.dataCollected.join(', ')],
    [DETAIL_LABELS.legalBasis, service.legalBasis],
    [DETAIL_LABELS.processingLocation, service.processingLocation],
    [DETAIL_LABELS.retention, service.retention],
    [DETAIL_LABELS.dataTransfer, service.dataTransfer.length ? service.dataTransfer.join(', ') : 'Nu'],
    [DETAIL_LABELS.recipients, service.recipients.join(', ')],
  ];
  return (
    <div className="flex flex-col gap-2">
      <p className="t-body-strong text-ink">{service.name}</p>
      <dl className="flex flex-col gap-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="t-caption text-muted">{label}</dt>
            <dd className="t-body text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <a
        href={service.privacyPolicy}
        target="_blank"
        rel="noopener noreferrer"
        className="t-body-strong inline-flex items-center gap-1.5 self-start rounded-control text-accent-ink underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
      >
        {DETAIL_LABELS.privacyPolicy}
        <span className="sr-only"> {service.name} (se deschide într-o filă nouă)</span>
        <ArrowTopRightOnSquareIcon aria-hidden className="size-4 shrink-0" />
      </a>
    </div>
  );
}

function CookieList({ category }: { category: CategoryInfo }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="t-caption text-muted">{DETAIL_LABELS.cookies}</p>
      {category.cookies.length ? (
        <ul className="divide-y divide-hairline overflow-hidden rounded-control bg-soft-fill">
          {category.cookies.map((k) => (
            <li key={k.name} className="flex flex-col gap-0.5 px-3 py-2.5">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="t-body-strong break-all text-ink">{k.name}</span>
                <span className="t-caption text-ink-2">{k.duration}</span>
              </span>
              <span className="t-caption text-ink-2">
                {k.provider} · {k.purpose}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {category.cookiesNote ? <p className="t-body text-ink-2">{category.cookiesNote}</p> : null}
    </div>
  );
}

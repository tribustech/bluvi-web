import Link from 'next/link';
import { cn } from '@/components/ui/cn';
import { absoluteUrl } from '@/lib/routes';
import { ShellColumn } from './shell';

export type Crumb = { label: string; href?: string };

type Props = {
  trail: Crumb[];
  /**
   * The current page's title is not known yet (a deep URL before its page names it): every crumb in
   * `trail` is a parent and a neutral placeholder stands in for the current one, so nothing claims
   * to be the current page and the row keeps its height when the title arrives.
   */
  pendingCurrent?: boolean;
  /** Also emit schema.org BreadcrumbList JSON-LD (render it on the server, where crawlers read it). */
  jsonLd?: boolean;
  className?: string;
};

/**
 * Breadcrumb trail (orientation + SEO), at the top of the page header (Fundații header spec):
 * parents in caption, muted; a text «/» separator in faint (decorative, aria-hidden), quieter than
 * the words it separates; the current page in body-strong ink and never a link, so the page's own
 * name carries the row. The row is 24px tall whatever it holds (link, placeholder), so the
 * pending → named swap never shifts.
 */
export function Breadcrumbs({ trail, pendingCurrent = false, jsonLd = false, className }: Props) {
  const current = pendingCurrent ? undefined : trail.at(-1);
  const parents = pendingCurrent ? trail : trail.slice(0, -1);
  return (
    <nav aria-label="Cale de navigare" className={cn('min-w-0', className)}>
      <ol className="flex min-h-6 min-w-0 items-center">
        {parents.map((c) => (
          <li key={c.label} className="t-caption flex shrink-0 items-center text-muted">
            {c.href ? (
              // 24px target (WCAG 2.5.8) without changing the row: the padding is taken back by -mx-1.
              <Link
                href={c.href}
                className="-mx-1 inline-flex min-h-6 items-center rounded-control px-1 transition-colors duration-(--duration-fast) hover:text-ink"
              >
                {c.label}
              </Link>
            ) : (
              c.label
            )}
            <span aria-hidden className="px-1.5 text-faint">
              /
            </span>
          </li>
        ))}
        {current ? (
          <li aria-current="page" className="t-body-strong min-w-0 truncate text-ink">
            {current.label}
          </li>
        ) : null}
        {pendingCurrent ? (
          <li aria-hidden className="t-caption flex min-w-0 items-center">
            <span className="inline-block h-3 w-40 max-w-full rounded-badge bg-soft-fill" />
          </li>
        ) : null}
      </ol>
      {jsonLd && !pendingCurrent ? <BreadcrumbJsonLd trail={trail} /> : null}
    </nav>
  );
}

/**
 * The breadcrumb row as the start of the page header (≥768; phones use the screen's back button):
 * a full-bleed bg-surface band with the trail in the shell column, so bar → crumbs → T3 hero read
 * as one white header. Server-safe: a page can render it with real titles and `jsonLd`.
 */
export function BreadcrumbBand(props: Props) {
  return (
    <ShellColumn className="hidden bg-surface md:block" innerClassName="pt-4">
      <Breadcrumbs {...props} />
    </ShellColumn>
  );
}

function BreadcrumbJsonLd({ trail }: { trail: Crumb[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: absoluteUrl(c.href) } : {}),
    })),
  };
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be raw JSON; `<` is escaped so a title can never close the script element.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

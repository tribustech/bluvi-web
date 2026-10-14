import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ListHeader, ListPage } from '@/components/templates/T1';
import { jsonLdHtml } from '@/lib/json-ld';
import type { LegalBlock, LegalDocument as Doc } from '@/lib/legal/document';
import { absoluteUrl } from '@/lib/routes';

/*
 * /termeni and /confidentialitate (lib/legal/*): one reading column of ~720 at every width, like
 * /cookie-uri — the date under the title, a contents list, then the numbered sections. Public,
 * indexable and static.
 */

const COLUMN = 'mx-auto w-full max-w-180';

export function legalMetadata(doc: Doc, path: string): Metadata {
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: path },
    openGraph: { type: 'website', title: `${doc.title} · Bluvi`, description: doc.description, url: absoluteUrl(path), siteName: 'Bluvi', locale: 'ro_RO' },
    twitter: { card: 'summary', title: `${doc.title} · Bluvi`, description: doc.description },
  };
}

/** `**lead**` → <strong>lead</strong>; nothing else is markup. */
function inline(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-bold text-ink">{p}</strong> : p));
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === 'string') return <p className="t-body text-ink-2">{inline(block)}</p>;
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 t-body text-ink-2 marker:text-muted">
      {block.list.map((item, i) => (
        <li key={i}>{inline(item)}</li>
      ))}
    </ul>
  );
}

export function LegalDocument({ doc, path }: { doc: Doc; path: string }) {
  const titleId = 'document-titlu';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: doc.title,
    description: doc.description,
    url: absoluteUrl(path),
    inLanguage: 'ro-RO',
    dateModified: doc.updatedIso,
  };
  return (
    <ListPage
      header={
        <div className={COLUMN}>
          <ListHeader
            title={doc.title}
            titleId={titleId}
            description={
              <>
                Ultima actualizare: <time dateTime={doc.updatedIso}>{doc.updated}</time>
              </>
            }
          />
        </div>
      }
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(jsonLd)} />
      <article aria-labelledby={titleId} className={`${COLUMN} flex flex-col gap-8 pb-10`} data-testid="legal-document">
        <div className="flex flex-col gap-3">
          {doc.intro.map((b, i) => (
            <Block key={i} block={b} />
          ))}
        </div>
        <nav aria-label="Cuprins" className="rounded-card bg-surface p-4 shadow-e0">
          <p className="mb-2 t-eyebrow text-muted uppercase">Cuprins</p>
          <ol className="flex flex-col gap-1.5">
            {doc.sections.map(s => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="t-body text-accent-ink underline-offset-2 hover:underline">
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {doc.sections.map(s => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titlu`} className="flex scroll-mt-24 flex-col gap-3">
            <h2 id={`${s.id}-titlu`} className="t-title2 text-ink">
              {s.heading}
            </h2>
            {s.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </section>
        ))}
      </article>
    </ListPage>
  );
}

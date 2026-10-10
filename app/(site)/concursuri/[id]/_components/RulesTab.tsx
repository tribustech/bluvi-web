'use client';

import { useMemo } from 'react';
import { DocumentTextIcon, PhoneIcon } from '@heroicons/react/24/outline';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import type { RichTextNode } from '@/core/shared';
import {
  DetailBody,
  DetailProse,
  DetailSection,
  DetailSectionState,
  DetailSectionsProvider,
  DetailSectionToc,
  richTextToPlain,
  SECTION_SCROLL_MARGIN,
  type DetailSectionItem,
} from '@/components/templates/T3';
import { ButtonLink } from '@/components/ui/Button';
import { ContactSection, FactsAside, normalizeRichLinks } from './infoParts';

/*
 * Concurs · Regulament — fish components/competition/CompetitionRules.tsx (parity
 * competition-page.regulament): the regulation's Strapi blocks as rich text (DetailProse: headings,
 * paragraphs, lists, links, bold / italic), held to the ~720px reading measure; without one, fish's
 * line as the T3 in-body state.
 *
 * From 1280 the T3 three columns (ROADMAP §4), as Informații: on the left the regulation's index
 * (its headings as jump links, the DetailSectionToc pattern) — or, with fewer than two headings, the
 * competition's «Detalii»; in the centre the text (a column about the reading measure wide, so the
 * card never stretches around capped text); on the right the Contact card («Întrebări despre
 * regulament?» — the organizer and referees). Below 1280 the Contact card follows the text.
 *
 * Without a regulation: fish's line as the T3 in-body state, as wide as the column (its edges line
 * up with the Contact card under it below 1280); its action calls the organizer when the author
 * has a phone («Sună organizatorul», tel:) — otherwise none (the Contact card is right there).
 *
 * Web differences: a CMS link saved as «tel0712…» is a tel: link (fish CustomBlocksRenderer).
 */

type Part = { id: string; label: string | null; blocks: RichTextNode[] };

/** The regulation cut at its headings: each heading and what follows it (the first part may have none). */
function splitAtHeadings(blocks: RichTextNode[]): Part[] {
  const parts: Part[] = [];
  for (const b of blocks) {
    if (b.type === 'heading' || !parts.length) {
      const label = b.type === 'heading' ? richTextToPlain([b]) || null : null;
      parts.push({ id: `regulament-${parts.length + 1}`, label, blocks: [b] });
    } else {
      parts[parts.length - 1].blocks.push(b);
    }
  }
  return parts;
}

export function RulesTab({ competition }: { competition: CompetitionWithMyStatus }) {
  const regulation = competition.regulation;
  const parts = useMemo(() => (regulation?.length ? splitAtHeadings(normalizeRichLinks(regulation)) : []), [regulation]);
  const index: DetailSectionItem[] = parts.filter(p => p.label).map(p => ({ id: p.id, label: p.label! }));
  const hasIndex = index.length >= 2;
  const authorPhone = competition.author?.phone?.trim() || null;

  const body = (
    <DetailBody
      left={hasIndex ? <DetailSectionToc title="Cuprins" /> : <FactsAside competition={competition} />}
      leftLabel={hasIndex ? 'Cuprinsul regulamentului' : 'Detalii'}
      aside={<ContactSection competition={competition} title="Întrebări despre regulament?" />}
      asideLabel="Contact"
    >
      {parts.length ? (
        <DetailSection id="regulament" title="Regulament">
          <div className="flex flex-col gap-3">
            {parts.map((p, i) => (
              <div key={p.id} id={p.label ? p.id : undefined} className={SECTION_SCROLL_MARGIN}>
                <DetailProse blocks={p.blocks} stripLeadingLabel={i === 0 ? 'Regulament' : undefined} />
              </div>
            ))}
          </div>
        </DetailSection>
      ) : (
        <DetailSectionState
          // Shares the column with the Contact card (below 1280) / sits between the side columns:
          // the column's width, not the 720 frame of a state alone in the body.
          // Phone (§4b.25): fish's one plain line at the top, no icon (the call button stays: a web extra).
          className="max-w-none! max-md:[&>div]:items-start max-md:[&>div]:px-4 max-md:[&>div]:py-4 max-md:[&>div]:text-left max-md:[&>div>span:first-child]:hidden max-md:[&_h2]:t-body max-md:[&_h2]:text-ink max-md:[&_p]:hidden"
          icon={
            <span className="flex size-12 items-center justify-center rounded-full bg-accent-tint text-accent-ink [&>svg]:size-6">
              <DocumentTextIcon aria-hidden />
            </span>
          }
          heading="Nu există regulament actualizat pentru această competiție"
          description="Organizatorul nu a publicat încă regulamentul. Pentru întrebări, îl găsești la contacte."
          action={
            authorPhone ? (
              <ButtonLink href={`tel:${authorPhone.replace(/\s+/g, '')}`} variant="secondary" icon={<PhoneIcon />}>
                Sună organizatorul
              </ButtonLink>
            ) : undefined
          }
        />
      )}
    </DetailBody>
  );
  return hasIndex ? <DetailSectionsProvider sections={index}>{body}</DetailSectionsProvider> : body;
}

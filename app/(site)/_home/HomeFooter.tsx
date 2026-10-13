import type { ReactNode } from 'react';
import Link from 'next/link';
import { ContactLink } from '@/components/account/ContactSurface';
import { OpenConsentSettings } from '@/components/consent/OpenConsentSettings';
import { PrivacyPolicyLink } from '@/components/consent/PrivacyPolicyLink';
import { LogoHorizontal } from '@/components/nav/brand';
import { FULL_BLEED_BG, SHELL_CONTENT, SHELL_GUTTERS } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { APP_STORE, PLAY_STORE } from '@/lib/app-links';
import { routes } from '@/lib/routes';
import { FeedbackLink } from './Feedback';

/**
 * Acasă's footer from 768 (owner 2026-10-13, «Acasă într-o coloană» — every site on the owner's
 * list ends on one): the white band edge to edge, its content in the centred box. Four columns of
 * plain links, then the brand line. «Sugestii», «Contactează-ne» and «Setări de confidențialitate»
 * used to be cards at the column's end; on the phone they still are (fish), the footer is not drawn.
 */
export function HomeFooter() {
  return (
    <footer
      data-home-footer
      className={cn(
        FULL_BLEED_BG,
        'mt-6 before:border-t before:border-hairline max-md:hidden',
      )}
    >
      <div className={cn('mx-auto flex flex-col gap-10 pt-12 pb-10', SHELL_CONTENT, SHELL_GUTTERS)}>
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          <Column title="Descoperă">
            <FooterLink href={routes.lakes()}>Bălți</FooterLink>
            <FooterLink href={routes.publicWaters()}>Ape publice</FooterLink>
            <FooterLink href={routes.lakesCounties()}>Bălți pe județe</FooterLink>
            <FooterLink href={routes.competitions()}>Concursuri</FooterLink>
            <FooterLink href={routes.news()}>Noutăți</FooterLink>
          </Column>
          <Column title="Comunitate">
            <FooterLink href={routes.partide()}>Partide</FooterLink>
            <FooterLink href={routes.suggestedAnglers()}>Pescari de urmărit</FooterLink>
            <FooterLink href={routes.polls()}>Sondaje</FooterLink>
          </Column>
          <Column title="Ajutor">
            <li>
              <FeedbackLink className={LINK}>Trimite o sugestie</FeedbackLink>
            </li>
            <li>
              <ContactLink className={LINK}>Contactează-ne</ContactLink>
            </li>
            <li>
              <OpenConsentSettings className={LINK}>Setări de confidențialitate</OpenConsentSettings>
            </li>
          </Column>
          <Column title="Aplicația Bluvi">
            <ExternalLink href={APP_STORE}>App Store</ExternalLink>
            <ExternalLink href={PLAY_STORE}>Google Play</ExternalLink>
          </Column>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-6">
          <span className="flex items-center gap-4">
            <LogoHorizontal aria-hidden className="h-6 w-auto text-accent-ink" />
            <span className="t-caption text-muted">© Bluvi · aplicația pescarilor din România</span>
          </span>
          <PrivacyPolicyLink className="t-caption font-normal text-ink-2 no-underline hover:underline" />
        </div>
      </div>
    </footer>
  );
}

/** A footer link: muted ink, ink + underline on hover, the page's focus ring, a 32px row. */
const LINK =
  'inline-flex min-h-8 cursor-pointer items-center rounded-badge t-body text-ink-2 transition-colors duration-(--duration-fast) hover:text-ink hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="t-body-strong text-ink">{title}</h2>
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className={LINK}>
        {children}
      </Link>
    </li>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
        {children}
        <span className="sr-only"> (se deschide într-o filă nouă)</span>
      </a>
    </li>
  );
}

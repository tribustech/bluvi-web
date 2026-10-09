import { cn } from '@/components/ui/cn';
import { COPY } from '@/lib/consent/catalog';
import { PRIVACY_URL } from '@/app/(site)/intra/logic';

/** «Politica de confidențialitate» (Termly, the policy /intra and /setari link to), in a new tab. */
export function PrivacyPolicyLink({ className }: { className?: string }) {
  return (
    <a
      href={PRIVACY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'rounded-badge font-bold text-accent-ink underline underline-offset-2 hover:no-underline',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
        className,
      )}
    >
      {COPY.privacyPolicy}
      <span className="sr-only"> (se deschide într-o filă nouă)</span>
    </a>
  );
}

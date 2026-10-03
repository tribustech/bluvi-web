import Link from 'next/link';
import { FishLogo } from './brand';
import { primaryNav, type NavKey } from './items';

type Props = {
  active?: NavKey | (string & {});
  signedIn: boolean;
  className?: string;
};

/**
 * Tablet rail (768–1279): 72px, icons only, the label lives in a tooltip that shows on hover and
 * on keyboard focus (and stays the accessible name via aria-label). Placement is the shell's job.
 */
export function Rail({ active, signedIn, className = '' }: Props) {
  return (
    <nav
      aria-label="Navigare principală"
      className={`flex w-[72px] flex-col items-center gap-2 bg-surface py-5 shadow-e0 ${className}`}
    >
      <Link href="/" aria-label="Bluvi, acasă" className="mb-3 rounded-control text-accent-ink">
        <FishLogo className="size-7" />
      </Link>
      <ul className="flex flex-col items-center gap-2">
        {primaryNav(signedIn).map(({ key, label, href, Icon }) => {
          const isActive = key === active;
          return (
            <li key={key} className="group relative">
              <Link
                href={href}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={`flex size-11 items-center justify-center rounded-control transition-colors duration-(--duration-fast) ease-fast ${
                  isActive ? 'bg-accent-tint text-accent-ink' : 'text-ink-2 hover:bg-soft-fill hover:text-ink'
                }`}
              >
                <Icon className="size-[22px]" aria-hidden />
              </Link>
              <span
                aria-hidden
                className="t-label pointer-events-none absolute top-1/2 left-full z-20 ml-3 -translate-y-1/2 rounded-control bg-navy px-2.5 py-1.5 hidden whitespace-nowrap text-lavender shadow-e2 group-hover:block group-has-focus-visible:block"
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

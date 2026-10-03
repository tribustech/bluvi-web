import Link from 'next/link';
import { primaryNav, type NavKey } from './items';

type Props = {
  /** Key of the current section; undefined = nothing highlighted. */
  active?: NavKey | (string & {});
  signedIn: boolean;
  className?: string;
};

/**
 * Mobile tab bar (<768). Surface with 16px top radii and a soft upward shadow; the bottom padding
 * keeps the labels clear of the home indicator (safe-area inset, at least 14px as in Fundații).
 * Placement (fixed to the bottom, hidden from md) is the app shell's job, not this component's.
 */
export function TabBar({ active, signedIn, className = '' }: Props) {
  return (
    <nav
      aria-label="Navigare principală"
      className={`rounded-t-card bg-surface pb-[max(14px,env(safe-area-inset-bottom))] shadow-tabbar ${className}`}
    >
      <ul className="grid grid-cols-5">
        {primaryNav(signedIn).map(({ key, label, href, Icon }) => {
          const isActive = key === active;
          return (
            <li key={key} className="flex">
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-[50px] flex-1 flex-col items-center justify-center gap-[3px] rounded-control transition-colors duration-(--duration-fast) ease-fast ${
                  isActive ? 'text-accent-ink' : 'text-ink-2 hover:text-ink'
                }`}
              >
                <Icon className="size-6 shrink-0" aria-hidden />
                <span className="t-micro-strong">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

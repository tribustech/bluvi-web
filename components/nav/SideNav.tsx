import Link from 'next/link';
import { LogoHorizontal } from './brand';
import { primaryNav, type AdminLink, type NavKey } from './items';

type Props = {
  /** Primary key, or the key of an admin link, of the current page. */
  active?: NavKey | (string & {});
  signedIn: boolean;
  /**
   * «ADMINISTRARE» group — organiser («Concursurile mele») and lake-operator («<lac> · panou»)
   * shortcuts. Omitted or empty = the group is not rendered.
   */
  admin?: AdminLink[];
  className?: string;
};

/** Desktop side menu (≥1280): 248px, logo, primary sections, then the admin group. */
export function SideNav({ active, signedIn, admin = [], className = '' }: Props) {
  return (
    <nav
      aria-label="Navigare principală"
      className={`flex w-[248px] flex-col gap-1 bg-surface px-3 py-5 shadow-e0 ${className}`}
    >
      <Link href="/" aria-label="Bluvi, acasă" className="mx-2 mb-4 self-start rounded-control text-accent-ink">
        <LogoHorizontal className="h-6 w-auto" />
      </Link>
      <ul className="flex flex-col gap-1">
        {primaryNav(signedIn).map(({ key, label, href, Icon }) => {
          const isActive = key === active;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`t-body-strong flex h-11 items-center gap-3 rounded-control px-3 transition-colors duration-(--duration-fast) ease-fast ${
                  isActive ? 'bg-accent-tint text-accent-ink' : 'text-ink-2 hover:bg-soft-fill hover:text-ink'
                }`}
              >
                <Icon className="size-[22px] shrink-0" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      {admin.length > 0 ? (
        <>
          <div role="separator" className="mx-1 my-2.5 h-px bg-hairline" />
          <p id="sidenav-admin" className="t-micro-strong px-3 py-1 tracking-[0.4px] text-muted">
            ADMINISTRARE
          </p>
          <ul aria-labelledby="sidenav-admin" className="flex flex-col gap-1">
            {admin.map((a) => {
              const isActive = a.key === active;
              return (
                <li key={a.key}>
                  <Link
                    href={a.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`t-body-strong flex h-10 items-center rounded-control px-3 transition-colors duration-(--duration-fast) ease-fast ${
                      isActive ? 'bg-accent-tint text-accent-ink' : 'text-ink-2 hover:bg-soft-fill hover:text-ink'
                    }`}
                  >
                    <span className="truncate">{a.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </nav>
  );
}

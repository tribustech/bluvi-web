import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

/*
 * Card surface + photo header shared by the five cards (Fundații §07 "Carduri").
 * A card with `href` gets a stretched link on its title: the whole card is clickable, while
 * buttons inside it (Urmărește) stay their own targets above the link (relative z-above).
 */

export function CardShell({
  children,
  elevated = false,
  interactive = false,
  className = '',
  label,
}: {
  children: ReactNode;
  /** e1 + hairline (cards with a photo that lead a list); default is hairline only (e0). */
  elevated?: boolean;
  interactive?: boolean;
  className?: string;
  /** aria-label for the article when the title alone is not enough. */
  label?: string;
}) {
  return (
    <article
      aria-label={label}
      className={`relative flex flex-col overflow-hidden rounded-card bg-surface ${
        elevated ? 'shadow-[var(--shadow-e1),var(--shadow-e0)]' : 'shadow-e0'
      } ${
        interactive
          ? 'transition-shadow duration-(--duration-fast) ease-fast hover:shadow-[var(--shadow-e2),var(--shadow-e0)] focus-within:shadow-[var(--shadow-e2),var(--shadow-e0)]'
          : ''
      } ${className}`}
    >
      {children}
    </article>
  );
}

/** 132px photo band. Photos load over their blurhash (DTO) when one is given, never a colored skeleton. */
export function CardPhoto({
  src,
  alt,
  blurDataURL,
  children,
  sizes = '(min-width: 1280px) 240px, (min-width: 768px) 50vw, 100vw',
}: {
  src: string;
  alt: string;
  blurDataURL?: string;
  children?: ReactNode;
  sizes?: string;
}) {
  return (
    <div className="relative h-[132px] shrink-0 bg-soft-fill">
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover"
        {...(blurDataURL ? { placeholder: 'blur' as const, blurDataURL } : {})}
      />
      {children}
    </div>
  );
}

/** Card title; with `href` it becomes the stretched link that makes the whole card clickable. */
export function CardTitle({
  href,
  children,
  className = '',
  as: Tag = 'h3',
}: {
  href?: string;
  children: ReactNode;
  className?: string;
  as?: 'h2' | 'h3' | 'h4' | 'p';
}) {
  return (
    <Tag className={className}>
      {href ? (
        <Link
          href={href}
          className="outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
        >
          {children}
        </Link>
      ) : (
        children
      )}
    </Tag>
  );
}

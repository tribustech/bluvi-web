import { linkify } from '@/core/realtime/chat/linkify';
import { cn } from '@/components/ui/cn';

/*
 * fish LinkedText (participant.chat c17): the text with URLs (http / https / www.) and Romanian phone
 * numbers as links — a web address opens in a new tab, a phone number is a tel: link. Same tokens as
 * fish (core linkify).
 */
export function LinkedText({ text, mine }: { text: string; mine: boolean }) {
  const tokens = linkify(text);
  return (
    <span className="break-words whitespace-pre-wrap">
      {tokens.map((t, i) =>
        t.kind === 'text' ? (
          <span key={i}>{t.value}</span>
        ) : (
          <a
            key={i}
            href={t.href}
            {...(t.kind === 'url' ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
            onClick={e => e.stopPropagation()}
            className={cn('rounded-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid', mine ? 'focus-visible:outline-on-accent' : 'text-accent-ink focus-visible:outline-accent')}
          >
            {t.value}
          </a>
        ),
      )}
    </span>
  );
}

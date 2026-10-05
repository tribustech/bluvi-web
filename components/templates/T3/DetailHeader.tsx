import { Fragment, type ReactNode } from 'react';
import { ICON_BUTTON_SIZE } from '@/components/nav/IconButton';
import { cn } from '@/components/ui/cn';

/*
 * T3 header — extracted from the competition page (fish CompetitionHeader: centred title,
 * organiser, lake, pills, back + share chips) and the lake page (fish [lakeId].tsx title block:
 * name with the rating on its right, location line under it).
 *
 * One DOM for every width (a single <h1>):
 *  - phone `center`: [phoneStart] [centred title · meta lines · badges] [phoneEnd]   (competition)
 *  - phone `start`:  title + titleAside in one run (the aside follows the title's last line),
 *                    meta wraps with dots, badges                                        (lake)
 *  - from 768:       [media 96] [eyebrow · title · meta on one dotted line · badges] [actions]
 *                    (the title wraps beside its aside; the actions only wrap under the title when
 *                    the title column would get less than 320px — keep them compact below 1280)
 */

export type DetailHeaderProps = {
  title: ReactNode;
  /** Small caps line over the title (from 768): «BALTĂ · GIURGIU», a date range. */
  eyebrow?: ReactNode;
  /** Meta items (organiser, lake link, dates…). Phone `center`: one per line; else dot-separated. */
  meta?: ReactNode[];
  /** The pill row (Live, urmăritori, Urmărește…). */
  badges?: ReactNode;
  /** The badge row only from 768 (the phone says the same thing elsewhere — the action bar). */
  badgesFromMd?: boolean;
  /** From 768: 96px thumbnail / avatar at the left. */
  media?: ReactNode;
  /** Also show `media` on the phone (an angler's avatar), above the title. */
  mediaOnPhone?: boolean;
  /** After the title's last line at every width, never split (the lake rating). */
  titleAside?: ReactNode;
  /** From 768: the action cluster at the right (buttons, share). On the phone, use the action bar. */
  actions?: ReactNode;
  /** Phone only: the header chip at the left (back). */
  phoneStart?: ReactNode;
  /** Phone only: the header chip at the right (share). */
  phoneEnd?: ReactNode;
  phoneAlign?: 'center' | 'start';
  /** Heading id, for `aria-labelledby` on the page region. */
  titleId?: string;
  className?: string;
};

export function DetailHeader({
  title,
  eyebrow,
  meta = [],
  badges,
  badgesFromMd = false,
  media,
  mediaOnPhone = false,
  titleAside,
  actions,
  phoneStart,
  phoneEnd,
  phoneAlign = 'start',
  titleId,
  className,
}: DetailHeaderProps) {
  const centred = phoneAlign === 'center';
  const items = meta.filter(Boolean);
  // Phone, centred: the title shares its row with two 48px chips (a ~245px measure). A long name
  // steps down to title2 and stops at three lines — the full name is still the <h1>'s text, in the
  // breadcrumb from 768 and in the pinned row.
  const long = centred && typeof title === 'string' && title.length > 40;
  return (
    <header
      data-t3="header"
      className={cn(
        // From 768 the actions anchor to the title's FIRST line (items-start + the eyebrow's offset),
        // so they stay put however many lines the title wraps to.
        'flex items-start gap-2 md:flex-wrap md:gap-x-5 md:gap-y-4 md:px-6 md:pt-6 md:pb-5 xl:px-8',
        // Phone: the shell gutter (16), so the chips and the title line up with the top bar's logo.
        centred ? 'px-4 py-2' : 'px-4 pt-4.5 pb-4',
        className,
      )}
    >
      {phoneStart ? <div className="shrink-0 md:hidden">{phoneStart}</div> : null}
      {media ? <div className="shrink-0 self-start max-md:hidden">{media}</div> : null}

      <div className={cn('flex min-w-0 flex-1 flex-col gap-0.5 md:basis-80 md:gap-1', centred && 'max-md:items-center max-md:text-center')}>
        {media && mediaOnPhone ? <div className="mb-2 md:hidden">{media}</div> : null}
        {eyebrow ? <p className="t-eyebrow text-muted uppercase max-md:hidden">{eyebrow}</p> : null}
        {/*
          The title and its aside (the rating) share one run of text: the <h1> is inline and the aside
          an inline box after it, baseline-aligned. So the rating always follows the title's LAST line
          — beside a short name, after the last word of a long one, or first on the next line when it
          does not fit — at every width, and the balanced title never leaves a gap before it.
        */}
        <div
          className={cn(
            'min-w-0 text-balance md:t-page-title',
            long ? 't-title2' : 't-title1',
            centred && 'max-md:max-w-[95%] max-md:line-clamp-3',
          )}
        >
          <h1 id={titleId} className="inline">
            {title}
          </h1>
          {titleAside ? (
            <>
              {' '}
              <span className="ml-1 inline-flex align-baseline whitespace-nowrap">{titleAside}</span>
            </>
          ) : null}
        </div>
        {items.length ? (
          <ul
            className={cn(
              'flex t-caption text-muted',
              centred
                ? 'flex-col items-center gap-0.5 md:flex-row md:flex-wrap md:items-center md:gap-x-2.5 md:gap-y-1'
                : 'flex-wrap items-center gap-x-2.5 gap-y-1',
            )}
          >
            {items.map((item, i) => (
              <Fragment key={i}>
                {i > 0 ? (
                  <li aria-hidden className={cn('size-0.75 shrink-0 rounded-full bg-faint', centred && 'max-md:hidden')} />
                ) : null}
                <li className="inline-flex min-w-0 items-center gap-1">{item}</li>
              </Fragment>
            ))}
          </ul>
        ) : null}
        {badges ? (
          <div className={cn('mt-2 flex flex-wrap items-center gap-1 md:mt-1.5', centred && 'max-md:justify-center', badgesFromMd && 'max-md:hidden')}>
            {badges}
          </div>
        ) : null}
      </div>

      {/* When the title needs the room (a long name on a tablet), the actions wrap under it, right-aligned. */}
      {/* With an eyebrow, its line + the column gap (14 + 4) down, so the buttons start on the title's line. */}
      {actions ? <div className={cn('ml-auto flex shrink-0 items-center gap-2 max-md:hidden', !!eyebrow && 'md:mt-4.5')}>{actions}</div> : null}
      {phoneEnd ? <div className="shrink-0 md:hidden">{phoneEnd}</div> : null}
    </header>
  );
}

/*
 * The header chips (fish headerIconSurface 'white' / BackButton `translucent`) on the shell's one
 * icon-button spec (components/nav/IconButton): the same 48 / 40 size (ICON_BUTTON_SIZE), radius 10,
 * 24px outline icon and pressed .8 as the top bar's buttons right above them. Only the fill is a
 * modifier, chosen by the ground the chip sits on:
 *  - `surface` (the white header band): soft fill;
 *  - `page` (a whole-page state on the grey ground, where soft fill would vanish): the white surface
 *    with the e0 hairline, like every card on that ground;
 *  - `photo`: the photo scrim, white icon.
 * (iconButtonClass itself is not composed in: `cn` does not merge, and its transparent ink-2 look
 * with a soft-fill hover would erase the white icon on a photo.) `size` overrides the 48 (the pinned
 * mini row, 46px tall, takes 44).
 */
export type HeaderChipGround = 'surface' | 'page' | 'photo';

const CHIP_GROUND: Record<HeaderChipGround, string> = {
  surface: 'bg-soft-fill text-ink hover:brightness-95',
  page: 'bg-surface text-ink shadow-e0 hover:bg-soft-fill',
  photo: 'bg-photo-scrim text-on-photo-scrim hover:brightness-125',
};

export function headerChipClass({
  ground,
  onPhoto = false,
  size = ICON_BUTTON_SIZE,
  className,
}: { ground?: HeaderChipGround; onPhoto?: boolean; size?: string; className?: string } = {}) {
  return cn(
    'relative flex shrink-0 cursor-pointer items-center justify-center rounded-control [&>svg]:size-6',
    'transition-[background-color,filter,opacity] duration-(--duration-fast) ease-fast active:opacity-80',
    CHIP_GROUND[ground ?? (onPhoto ? 'photo' : 'surface')],
    size,
    className,
  );
}

export const HEADER_CHIP = headerChipClass();
export const PHOTO_CHIP = headerChipClass({ ground: 'photo' });

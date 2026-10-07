'use client';

import { useRef, type ChangeEvent } from 'react';
import { CameraIcon } from '@heroicons/react/24/solid';
import { cn } from '@/components/ui/cn';
import type { AvatarValue } from './useSaveProfile';

/**
 * fish EditProfileScreen's avatar block: the current avatar as a 150px circle with a camera badge
 * (activating it opens the image picker), and under it «Regenerează avatar» · «sau» · «Încarcă
 * fotografie». Both change the avatar (the form marks it changed, so it is uploaded on submit).
 * The two actions never wrap their own text: side by side when the block is wide enough
 * (ACTIONS, a container query on the block itself), otherwise stacked with «sau» on its own
 * line — a 320px phone, and the form's left column from 672 (ProfileForm).
 *
 * The picker is an <input type=file accept=image/*>: on a phone the browser's own chooser already
 * offers the camera next to the gallery; `capture` is left off on purpose — it would skip the
 * gallery, and fish's picker is the gallery (useCamera pickImage). The input is visually hidden
 * and out of the tab order: both visible buttons open it.
 *
 * Previews are a plain <img>: the DiceBear host is not in next/image remotePatterns (on purpose),
 * a picked photo is an object URL, and the saved avatar is one 150px image.
 */
export function AvatarPicker({
  avatar,
  onRegenerate,
  onPick,
  busy = false,
  disabled = false,
  className,
}: {
  avatar: AvatarValue;
  onRegenerate: () => void;
  onPick: (file: File) => void;
  /** A picked photo is being prepared: the circle shows it is working. */
  busy?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const src = avatar.kind === 'file' ? avatar.previewUrl : avatar.url;
  const open = () => input.current?.click();
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset, so picking the same file again still fires a change.
    e.target.value = '';
    if (file) onPick(file);
  };

  return (
    <div className={cn('@container flex min-w-0 flex-col items-center gap-3 md:gap-4', className)}>
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        aria-label="Schimbă fotografia de profil"
        aria-busy={busy || undefined}
        className={cn(
          'group relative size-37.5 shrink-0 cursor-pointer rounded-full transition-opacity duration-(--duration-fast) ease-fast',
          'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent active:opacity-80 disabled:cursor-not-allowed',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- see the component comment */}
        <img
          src={src}
          alt=""
          data-avatar-kind={avatar.kind}
          className={cn('size-full rounded-full bg-soft-fill object-cover', busy && 'animate-pulse motion-reduce:animate-none')}
        />
        {/* fish: a 25px grey disc with a 16px white camera, bottom right. */}
        <span
          aria-hidden
          className="absolute right-2.5 bottom-2 flex size-8 items-center justify-center rounded-full bg-navy text-lavender shadow-e1 ring-2 ring-surface transition-transform duration-(--duration-fast) ease-fast group-hover:scale-105"
        >
          <CameraIcon className="size-4.5" />
        </span>
      </button>

      <div className={ACTIONS}>
        <button type="button" onClick={onRegenerate} disabled={disabled} className={LINK_BUTTON}>
          Regenerează avatar
        </button>
        <span className="t-body-strong text-ink-2">sau</span>
        <button type="button" onClick={open} disabled={disabled} className={LINK_BUTTON}>
          Încarcă fotografie
        </button>
      </div>

      <input ref={input} type="file" accept="image/*" tabIndex={-1} aria-hidden className="sr-only" onChange={onChange} />
    </div>
  );
}

/**
 * The actions: one row from a 328px block up (measured: 322 with the phone's 14px bold — so a
 * 360/375 phone keeps fish's row — and it only gets the 15px step in a wider form), stacked with
 * «sau» on its own line below that (a 320 phone, the form's 240px left column).
 */
const ACTIONS = 'flex flex-col items-center @[20.5rem]:flex-row @[20.5rem]:flex-wrap @[20.5rem]:justify-center @[20.5rem]:gap-x-1';

/** fish Button preset="chromeless": a text button in the accent ink, 48 / 40 tall, soft-fill on hover. */
const LINK_BUTTON = cn(
  't-body-strong inline-flex h-12 cursor-pointer items-center rounded-control px-3 whitespace-nowrap text-accent-ink xl:h-10',
  'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-80',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

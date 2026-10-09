'use client';

import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { COPY } from '@/lib/consent/catalog';

/**
 * The decision buttons. Refusing is exactly as prominent as accepting (GDPR: same variant, same
 * size, side by side) — only «Salvează preferințele», which saves what the visitor chose, is filled.
 *  - banner: «Refuz toate» · «Accept toate» side by side and equal (outline), «Personalizează» under
 *    them as a smaller ghost button (a way in, not a third decision);
 *  - dialog / page: «Refuz toate» · «Accept toate» on one row, «Salvează preferințele» under them
 *    on the phone, beside them from 768.
 */
export function ConsentActions({
  layout,
  onReject,
  onAccept,
  onSave,
  onCustomize,
  className,
}: {
  layout: 'banner' | 'dialog' | 'page';
  onReject: () => void;
  onAccept: () => void;
  onSave?: () => void;
  onCustomize?: () => void;
  className?: string;
}) {
  if (layout === 'banner') {
    return (
      <div className={cn('grid grid-cols-2 gap-2', className)}>
        <Button variant="outline" onClick={onReject}>
          {COPY.rejectAll}
        </Button>
        <Button variant="outline" onClick={onAccept}>
          {COPY.acceptAll}
        </Button>
        <Button variant="ghost" size="compact" onClick={onCustomize} className="col-span-2 justify-self-center text-accent-ink">
          {COPY.customize}
        </Button>
      </div>
    );
  }
  return (
    <div className={cn('grid grid-cols-2 gap-2', layout === 'page' ? 'md:flex md:flex-wrap md:justify-end' : 'md:grid-cols-[1fr_1fr_auto]', className)}>
      <Button variant="outline" onClick={onReject}>
        {COPY.rejectAll}
      </Button>
      <Button variant="outline" onClick={onAccept}>
        {COPY.acceptAll}
      </Button>
      <Button variant="primary" onClick={onSave} className="col-span-2 md:col-span-1">
        {COPY.save}
      </Button>
    </div>
  );
}

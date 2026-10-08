'use client';

import { SearchSelectDialog } from '@/components/forms/SearchSelectDialog';
import type { RegistrationOption } from './model';

/*
 * The registration picker of a stand (organizer.participants c6–c7; fish SelectWithSearchSheet with
 * filterBy ['label', 'id'], placeholder «Introdu numele»): the registered entrants, searchable by
 * the label, the members / previous-leg line and — invisible — the username+id or «Fără cont #id».
 * Seated entrants are disabled with their stand as the reason and listed last. A phone sheet, a
 * dialog from 768 (the kit's SearchSelectDialog). Choosing one seats it and closes.
 */

type Props = {
  open: boolean;
  /** «Sector A · Stand 3». */
  title: string;
  options: RegistrationOption[];
  onPick: (registrationId: string) => void;
  onClose: () => void;
};

export function RegistrationPicker({ open, title, options, onPick, onClose }: Props) {
  return (
    <SearchSelectDialog
      open={open}
      onClose={onClose}
      title={title}
      searchLabel="Caută participantul"
      placeholder="Introdu numele"
      options={options}
      onSelect={(o) => {
        if (!o.disabled) onPick(o.registrationId);
      }}
      listLabel="Înscrieri"
      emptyLabel={options.length === 0 ? 'Concursul nu are înscrieri confirmate' : 'Nu s-au găsit rezultate'}
      testId="alloc-picker"
      keepOrder
    />
  );
}

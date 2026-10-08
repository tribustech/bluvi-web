'use client';

import { ChatBubbleBottomCenterTextIcon, MegaphoneIcon, NoSymbolIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useChat } from './ChatController';

/*
 * fish ChatRulesSheet (participant.chat.c11): the first chat an account ever opens (no consent doc).
 * Blocking: no backdrop click, no Escape, no X — «Am înțeles» records acceptedAt and closes (busy
 * while saving; a failure toasts and keeps it open), «Nu accept» leaves the chat and records nothing
 * (it comes back next time). The keyboard way out (WCAG 2.1.2) is «Nu accept» itself.
 */

const RULES = [
  { Icon: NoSymbolIcon, text: 'Fără injurii, jigniri sau limbaj vulgar.' },
  { Icon: MegaphoneIcon, text: 'Fără spam, reclame sau mesaje repetate.' },
  { Icon: ChatBubbleBottomCenterTextIcon, text: 'Fără hărțuire; respect față de participanți și organizatori.' },
  { Icon: ShieldCheckIcon, text: 'Discuții despre concurs și pescuit — nimic ilegal sau ofensator.' },
];

const noop = () => {};

export function RulesDialog() {
  const c = useChat();
  const { open, saving, accept, decline } = c.rules;
  return (
    <Dialog
      open={open}
      onClose={noop}
      alert
      backdropDismiss={false}
      title="Reguli de bun-simț"
      description="Chat-ul e al tuturor celor din concurs. Câteva reguli simple:"
      actions={
        <>
          <Button variant="outline" onClick={() => !saving && decline()} aria-disabled={saving || undefined}>
            Nu accept
          </Button>
          <Button onClick={() => !saving && accept()} aria-busy={saving || undefined} aria-disabled={saving || undefined} className={cn(saving && 'cursor-progress opacity-70')}>
            {saving ? 'Se salvează…' : 'Am înțeles'}
          </Button>
        </>
      }
    >
      <ul className="mt-1 flex flex-col gap-3">
        {RULES.map(({ Icon, text }) => (
          <li key={text} className="flex items-start gap-3">
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-ink" />
            <span className="t-body text-ink">{text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 rounded-control bg-status-danger-bg p-3 t-label text-status-danger-fg">
        Încălcarea regulilor duce la blocarea accesului la chat și, la nevoie, la aplicație.
      </p>
    </Dialog>
  );
}

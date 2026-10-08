'use client';

import { useId, useState, type ReactNode } from 'react';
import { ExclamationCircleIcon, PhotoIcon } from '@heroicons/react/24/outline';
import {
  EDIT_BLOCKING_FALLBACK_MESSAGE,
  getCompetitionEditRiskFallbackMessage,
  getCompetitionEditRiskMessage,
  PUBLISH_FAILED_FALLBACK_MESSAGE,
  type OrganizerEditRiskDetails,
} from '@/core/organizer';
import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { T4Spinner } from '@/components/templates/T4';

/*
 * The wizard's decision dialogs — fish create-competition/_layout.tsx bottom sheets and the
 * CreateCompetitionContext alerts, on the kit Dialog (a phone keeps a centred dialog, as every web
 * confirmation). Copy is fish's, word for word.
 */

/** The 56px tinted disc fish puts over a sheet's title (danger / warning / accent). */
function Disc({ tone = 'danger', children }: { tone?: 'danger' | 'warning' | 'accent'; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-14 shrink-0 items-center justify-center rounded-full [&>svg]:size-6',
        tone === 'danger' && 'bg-status-danger-bg text-status-danger-fg',
        tone === 'warning' && 'bg-status-warning-bg text-status-warning-fg',
        tone === 'accent' && 'bg-accent-tint text-accent-ink',
      )}
    >
      {children}
    </span>
  );
}

/** A centred notice body: disc, title, text (the dialog's own h2 stays for assistive tech). */
function Notice({ icon, tone, title, children, testId }: { icon: ReactNode; tone?: 'danger' | 'warning' | 'accent'; title: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 pt-2 text-center" data-testid={testId}>
      <Disc tone={tone}>{icon}</Disc>
      <p aria-hidden className="t-title2 text-ink">
        {title}
      </p>
      <div className="t-body text-muted">{children}</div>
    </div>
  );
}

const busyIcon = (busy: boolean) => (busy ? <T4Spinner /> : undefined);

/** c4 — «Salvezi progresul înainte de a ieși?» (step 1 back with a dirty form, or a held leave). */
export function ExitDialog({
  open,
  saveLabel,
  saving,
  onSave,
  onDiscard,
  onClose,
}: {
  open: boolean;
  saveLabel: string;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      closeButton
      title="Salvezi progresul înainte de a ieși?"
      actions={
        <>
          <Button variant="secondary" onClick={onDiscard}>
            Ies fără să salvez
          </Button>
          <Button onClick={onSave} disabled={saving} icon={busyIcon(saving)}>
            {saveLabel}
          </Button>
        </>
      }
    />
  );
}

/** c7 — the header's trash on a saved draft. */
export function DeleteDraftDialog({ open, busy, onConfirm, onClose }: { open: boolean; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      alert
      title="Ștergi această ciornă?"
      description="Ciorna va fi ștearsă definitiv și nu o vei mai putea recupera."
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Renunță
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy} icon={busyIcon(busy)}>
            Șterge ciorna
          </Button>
        </>
      }
    />
  );
}

/** c9 — saving without a name of ≥ 3 characters. */
export function NameRequiredDialog({ open, onFill, onClose }: { open: boolean; onFill: () => void; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      titleHidden
      title="Adaugă un nume"
      actions={<Button onClick={onFill} block>Completează numele</Button>}
    >
      <Notice icon={<ExclamationCircleIcon />} title="Adaugă un nume" testId="wizard-name-required">
        Pentru a putea salva ciorna, competiția are nevoie de un nume (minim 3 caractere).
      </Notice>
    </Dialog>
  );
}

/** c12, c13 — «Atenție: modificări cu impact» (the CMS asked for confirmRiskChanges). */
export function RiskDialog({
  warning,
  saving,
  onConfirm,
  onClose,
}: {
  warning: OrganizerEditRiskDetails | null;
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const checkboxId = useId();
  const messages = (warning?.risks ?? []).map(r => getCompetitionEditRiskMessage(r.riskCode));
  const list = messages.length > 0 ? messages : [getCompetitionEditRiskFallbackMessage()];
  const close = () => {
    setChecked(false);
    onClose();
  };
  const impact = warning?.impact;
  return (
    <Dialog
      open={warning !== null}
      onClose={close}
      alert
      title="Atenție: modificări cu impact"
      description="Aceste schimbări pot afecta înscrierile și alocările existente."
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            Renunță
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!checked) return;
              setChecked(false);
              onConfirm();
            }}
            disabled={!checked || saving}
            icon={busyIcon(saving)}
          >
            Salvează oricum
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-2 pt-1" data-testid="wizard-risk-list">
        {list.map((message, i) => (
          <li key={`${i}-${message}`} className="t-body-strong flex gap-2 text-status-danger-fg">
            <span aria-hidden>•</span>
            <span className="min-w-0 flex-1">{message}</span>
          </li>
        ))}
      </ul>
      <dl className="t-caption mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-control bg-soft-fill p-3 text-ink-2">
        <dt>Participanți înscriși</dt>
        <dd className="t-body-strong text-right tabular-nums text-ink">{impact?.registeredCount ?? 0}</dd>
        <dt>Înscrieri în așteptare</dt>
        <dd className="t-body-strong text-right tabular-nums text-ink">{impact?.pendingCount ?? 0}</dd>
        <dt>Alocări pe standuri afectate</dt>
        <dd className="t-body-strong text-right tabular-nums text-ink">{impact?.allocatedRegistrationsCount ?? 0}</dd>
      </dl>
      <label
        htmlFor={checkboxId}
        className={cn(
          't-body-strong mt-2 flex cursor-pointer items-start gap-3 rounded-control border p-3 text-ink-2 transition-colors duration-(--duration-fast)',
          checked ? 'border-status-danger-fg' : 'border-hairline hover:bg-soft-fill',
        )}
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={checked}
          onChange={e => setChecked(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-status-danger-fg"
        />
        <span>Confirm că înțeleg impactul și vreau să continui.</span>
      </label>
    </Dialog>
  );
}

/** c14 — an edit refused by a blocking validation code. */
export function BlockingValidationDialog({ error, onClose }: { error: { message: string } | null; onClose: () => void }) {
  return (
    <Dialog
      open={error !== null}
      onClose={onClose}
      titleHidden
      title="Modificări necesare"
      actions={<Button onClick={onClose} block>Modifică și încearcă din nou</Button>}
    >
      <Notice icon={<ExclamationCircleIcon />} title="Modificări necesare" testId="wizard-blocking">
        {error?.message || EDIT_BLOCKING_FALLBACK_MESSAGE}
      </Notice>
    </Dialog>
  );
}

/** c19 — «Publicarea a eșuat» with a retry. */
export function PublishFailedDialog({ message, onRetry, onClose }: { message: string | null; onRetry: () => void; onClose: () => void }) {
  return (
    <Dialog
      open={message !== null}
      onClose={onClose}
      titleHidden
      title="Publicarea a eșuat"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Închide
          </Button>
          <Button onClick={onRetry}>Reîncearcă</Button>
        </>
      }
    >
      <Notice icon={<ExclamationCircleIcon />} title="Publicarea a eșuat" testId="wizard-publish-failed">
        {message || PUBLISH_FAILED_FALLBACK_MESSAGE}
      </Notice>
    </Dialog>
  );
}

/** c17 — publishing without a banner. */
export function NoBannerDialog({ open, onAnswer }: { open: boolean; onAnswer: (proceed: boolean) => void }) {
  return (
    <Dialog
      open={open}
      onClose={() => onAnswer(false)}
      title="Publicare fără fotografie"
      actions={
        <>
          <Button variant="secondary" onClick={() => onAnswer(false)}>
            Înapoi
          </Button>
          <Button onClick={() => onAnswer(true)}>Continuă</Button>
        </>
      }
    >
      <div className="flex items-start gap-3 pt-1">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
          <PhotoIcon className="size-6" />
        </span>
        <p className="t-body text-ink-2">
          Nu ai adăugat o fotografie pentru competiție. În lista de competiții se va folosi imaginea lacului.
        </p>
      </div>
    </Dialog>
  );
}

/** c25 — the draft / competition could not be loaded. */
export function HydrationErrorDialog({ open, onOk }: { open: boolean; onOk: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onOk}
      alert
      titleHidden
      title="Eroare"
      actions={<Button onClick={onOk} block>OK</Button>}
    >
      <Notice icon={<ExclamationCircleIcon />} title="Eroare" testId="wizard-hydration-error">
        Nu am putut încărca datele competiției. Te rugăm să încerci din nou.
      </Notice>
    </Dialog>
  );
}

import { Card } from './Card';

/**
 * c13 — «Mesajul tău»: only what the angler wrote, in „…” quotes (the operator's «[Anulare operator]» /
 * «[Refuz operator]» part is stripped by the model: it has its own line on the booking card). The
 * caller renders it only for a non-empty note.
 */
export function MessageCard({ note }: { note: string }) {
  return (
    <Card title="Mesajul tău" titleId="rezervare-mesaj" data-testid="booking-note">
      <p className="t-body break-words whitespace-pre-line text-ink-2">{`„${note}”`}</p>
    </Card>
  );
}

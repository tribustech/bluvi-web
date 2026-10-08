/** c3 — fish: a centred spinner under the header; the quick actions wait for data. */
export function PanelSpinner() {
  return (
    <div role="status" data-testid="operator-panel-loading" className="flex justify-center py-20">
      <span className="sr-only">Se încarcă panoul…</span>
      <span aria-hidden className="size-10 animate-spin rounded-full border-4 border-accent-tint-2 border-t-accent motion-reduce:animate-none" />
    </div>
  );
}

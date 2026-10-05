/*
 * One polite live region for Acasă's recoveries («Datele au fost reîncărcate», «Sugestie ascunsă»).
 * It lives on <body>, outside the blocks that unmount when they recover, and it is created BEFORE
 * the message is needed (prepareAnnouncer on the error/action's mount): a region that appears
 * together with its text is not read by every screen reader.
 */
let region: HTMLElement | null = null;

export function prepareAnnouncer(): void {
  if (region?.isConnected) return;
  region = document.createElement('div');
  region.setAttribute('role', 'status');
  region.className = 'sr-only';
  document.body.append(region);
}

export function announce(message: string): void {
  prepareAnnouncer();
  const el = region!;
  // Cleared first so the same sentence twice is still a change.
  el.textContent = '';
  setTimeout(() => {
    el.textContent = message;
  }, 50);
}

/**
 * After a block that held focus unmounted, put focus somewhere meaningful instead of <body>: the
 * given heading (made programmatically focusable). Only when focus was actually lost.
 */
export function restoreFocusTo(target: HTMLElement | null | undefined): void {
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active && active !== document.body) return;
    if (!target?.isConnected) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: false });
  });
}

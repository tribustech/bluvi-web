import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => '/rezervari/bk_1',
  useSearchParams: () => new URLSearchParams(),
}));

const { default: BookingError } = await import('./error');

/*
 * booking.rezervare c1 — the session-gate error (requireViewer → SessionUnknownError: the server's
 * /users/me read failed). A Playwright run cannot reach it (the read is the server's own, not the
 * browser's), so the server render is checked: ONE frame — one h1 («Rezervare», BookingFrame's),
 * the error card's title an h2, one back chip (the header's, phone only).
 */
describe('/rezervari/[id] error.tsx (session gate)', () => {
  const html = renderToStaticMarkup(createElement(BookingError, { error: new Error('x'), retry: () => {} }));

  it('one h1 — the page’s «Rezervare»; «Serverul nu răspunde» is an h2', () => {
    const h1s = html.match(/<h1[\s>][\s\S]*?<\/h1>/g) ?? [];
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toContain('Rezervare');
    expect(html).toMatch(/<h2[^>]*>Serverul nu răspunde<\/h2>/);
  });

  it('one back chip, the alert with the copy and «Încearcă din nou»', () => {
    expect(html.match(/Înapoi la rezervări/g) ?? []).toHaveLength(1);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Lucrăm la asta. Încearcă din nou în câteva minute.');
    expect(html).toContain('Încearcă din nou</button>');
  });
});

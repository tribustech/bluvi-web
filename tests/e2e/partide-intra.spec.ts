import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { expect, test } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.intra — /partide/intra, «Alătură-te unei partide» (T6; fish app/(app)/partide/join/index.tsx,
 * helpers/partidaJoinError.ts, domain/hooks.ts useJoinPartida).
 *
 * NOTHING is written anywhere: POST /feed/sessions/join is route-mocked (success, every PARTIDA:*
 * bluCode, an unknown failure, 401), as is the live layer's pointer probe (GET /feed/sessions/active →
 * none). The partidă the join lands on is served by the shared Firestore fake (helpers/fake-live.ts);
 * any Firebase request fails the test. The viewer is the real QA account (the session cookie).
 */

const SHOTS = '.shots/partide-intra';
mkdirSync(SHOTS, { recursive: true });

const JOINED = { documentId: 'e2e-join-doc', firestoreId: 'e2e-join-fs' };
const POINTER_KEY = '@bluvi/partide/activeSessionId';

let jwt = '';
let selfId = '';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(me.ok(), 'QA profile read').toBe(true);
  selfId = (await me.json()).documentId as string;
});

const NOW = '2026-10-08T09:00:00.000Z';

/** The CMS's join answer (sessionCreateJoinDTOSchema: a session DTO + firestoreId). */
function joinedDto() {
  return {
    documentId: JOINED.documentId,
    clientId: JOINED.firestoreId,
    firestoreId: JOINED.firestoreId,
    clientUpdatedAt: null,
    venueType: 'lake',
    lakeId: 'e2e-lake-1',
    lakeName: 'Balta Mock',
    lakeImageUrl: null,
    publicWaterCode: null,
    publicWaterName: null,
    manualVenueName: null,
    standId: null,
    standName: null,
    locality: 'Giurgiu',
    anchorLat: 44.43,
    anchorLong: 26.12,
    anchorName: null,
    startedAt: NOW,
    endedAt: null,
    plannedDurationMs: 6 * 3_600_000,
    notes: null,
    visibleOnProfile: true,
    status: 'active',
    targetSpecies: [],
    hostUid: 'e2e-host',
    joinCode: 'K7M2QX',
    rods: [],
    members: [
      { uid: 'e2e-host', name: 'Ana Crap', avatar: null, joinedAt: NOW },
      { uid: selfId, name: 'Eu', avatar: null, joinedAt: NOW },
    ],
  };
}

type JoinAnswer = { status: 200 } | { status: number; bluCode?: string };

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * Mocks the join (a queue of answers, the last one repeats; `delayMs` holds every answer) and the
 * pointer probe. Returns the request bodies the page sent.
 */
async function mockJoin(page: Page, answers: JoinAnswer[] = [{ status: 200 }], delayMs = 0) {
  const bodies: unknown[] = [];
  await page.route('**/api/cms/feed/sessions/active', route => json(route, { data: null }));
  await page.route('**/api/cms/feed/session-follows/mine', route => json(route, { data: { sessionDocumentIds: [] } }));
  await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
  await page.route('**/api/cms/feed/sessions/join', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    bodies.push(route.request().postDataJSON());
    const a = answers.length > 1 ? answers.shift()! : answers[0];
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    if (a.status === 200) return json(route, { data: joinedDto() });
    const bluCode = 'bluCode' in a ? a.bluCode : undefined;
    return json(route, { data: null, error: { status: a.status, name: 'Error', message: 'mock', details: bluCode ? { bluCode } : {} } }, a.status);
  });
  return bodies;
}

async function open(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await signIn(page.context(), jwt);
  await page.goto('/partide/intra');
  const field = page.getByRole('textbox', { name: 'Codul de acces' });
  await expect(field).toBeVisible();
  return { field, button: page.getByRole('button', { name: 'Alătură-te' }) };
}

test.describe('partide.intra', () => {
  test('partide.intra.c1 — signed out, the route redirects to sign-in with the way back', async ({ page }) => {
    await page.goto('/partide/intra');
    await expect(page).toHaveURL(/\/intra\?next=%2Fpartide%2Fintra$/);
  });

  test('partide.intra.c2 — title, helper, autofocused centred «COD» field, green «Alătură-te»; noindex', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockJoin(page);
    const { field, button } = await open(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Alătură-te unei partide' })).toBeVisible();
    // No breadcrumb band: the header's back control owns the way back (T6).
    await expect(page.getByRole('navigation', { name: 'Cale de navigare' })).toHaveCount(0);
    await expect(page.getByText('Introdu codul de acces primit de la organizatorul partidei.')).toBeVisible();
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute('placeholder', 'COD');
    await expect(field).toHaveCSS('text-align', 'center');
    await expect(field).toHaveAttribute('autocapitalize', 'characters');
    await expect(field).toHaveAttribute('inputmode', 'text');
    await expect(field).toHaveAttribute('maxlength', '6');
    await expect(field).toHaveAttribute('autocomplete', 'off');
    await expect(field).toHaveAccessibleDescription('Introdu codul de acces primit de la organizatorul partidei.');
    await expect(button).toBeDisabled();
    // The green of the kit's success variant (fish preset="green").
    await expect(button).toHaveClass(/bg-success/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page).toHaveTitle(/Alătură-te unei partide/);
    // The back chip is a real link to the hub (no JS, middle click); a click goes back in history.
    await expect(page.getByRole('link', { name: 'Înapoi', exact: true })).toHaveAttribute('href', '/partide');
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('partide.intra.c3 — uppercase, A–Z0–9, max 6; button only at exactly 6; Enter submits; paste', async ({ page }) => {
    const bodies = await mockJoin(page, [{ status: 400, bluCode: 'PARTIDA:CODE_INVALID' }]);
    const { field, button } = await open(page);
    await field.pressSequentially('k7-m2');
    await expect(field).toHaveValue('K7M2');
    await expect(button).toBeDisabled();
    await field.pressSequentially('q');
    await expect(field).toHaveValue('K7M2Q');
    await expect(button).toBeDisabled();
    // Enter with five characters sends nothing.
    await field.press('Enter');
    await page.waitForTimeout(300);
    expect(bodies).toHaveLength(0);
    await field.pressSequentially('x9z');
    await expect(field).toHaveValue('K7M2QX');
    await expect(button).toBeEnabled();
    await field.press('Backspace');
    await expect(button).toBeDisabled();

    // Paste: a bare code is cleaned; a pasted invite message gives its code.
    await field.fill('');
    await page.evaluate(() => {
      const input = document.activeElement as HTMLInputElement;
      const dt = new DataTransfer();
      dt.setData('text/plain', 'Hai în partida mea pe Bluvi! Folosește codul ab12cd sau deschide linkul: https://bluvi-app.wearetribus.com/partide/join/ab12cd');
      input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(field).toHaveValue('AB12CD');
    await expect(button).toBeEnabled();

    // Enter submits the code, uppercased.
    await field.press('Enter');
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]).toEqual({ data: { code: 'AB12CD' } });
    await page.screenshot({ path: `${SHOTS}/c3-paste.png` });
  });

  test('partide.intra.c4 — joining sets the pointer and REPLACES the page with the partidă (single flight)', async ({ page, fakeLive }) => {
    await fakeLive.seed({
      docs: {
        [JOINED.firestoreId]: {
          startedAt: NOW,
          status: 'active',
          venueType: 'lake',
          lakeId: 'e2e-lake-1',
          lakeName: 'Balta Mock',
          hostUid: 'e2e-host',
          joinCode: 'K7M2QX',
          visibleOnProfile: true,
          members: [
            { uid: 'e2e-host', name: 'Ana Crap', avatar: null, joinedAt: NOW },
            { uid: selfId, name: 'Eu', avatar: null, joinedAt: NOW },
          ],
          rods: [],
          catches: [],
        },
      },
    });
    const bodies = await mockJoin(page, [{ status: 200 }], 700);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    // A page before the form, to prove the join REPLACES the form in history.
    await page.goto('/partide');
    await page.goto('/partide/intra');
    const field = page.getByRole('textbox', { name: 'Codul de acces' });
    const button = page.getByRole('button', { name: 'Alătură-te' });
    await field.pressSequentially('k7m2qx');
    // Enter, Enter again and a click while the first request is in flight: one request.
    await field.press('Enter');
    await field.press('Enter');
    await button.click({ force: true }).catch(() => {});
    await expect(button).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}/c4-joining.png` });
    await expect(page).toHaveURL(new RegExp(`/partide/${JOINED.documentId}$`));
    expect(bodies).toEqual([{ data: { code: 'K7M2QX' } }]);
    // The pointer: persisted (both ids) and followed by the live layer.
    const pointer = await page.evaluate(k => window.localStorage.getItem(k), POINTER_KEY);
    expect(JSON.parse(pointer ?? 'null')).toEqual({ sessionId: JOINED.firestoreId, documentId: JOINED.documentId });
    await expect.poll(() => fakeLive.subscribed()).toContain(JOINED.firestoreId);
    // Back from the partidă skips the spent form.
    await page.goBack();
    await expect(page).toHaveURL(/\/partide$/);
  });

  const FAILURES: { name: string; answer: JoinAnswer; message: string }[] = [
    { name: 'PARTIDA:CODE_INVALID', answer: { status: 400, bluCode: 'PARTIDA:CODE_INVALID' }, message: 'Cod invalid' },
    { name: 'PARTIDA:ENDED', answer: { status: 400, bluCode: 'PARTIDA:ENDED' }, message: 'Partida s-a încheiat' },
    { name: 'PARTIDA:FULL', answer: { status: 409, bluCode: 'PARTIDA:FULL' }, message: 'Partida este plină' },
    {
      name: 'PARTIDA:ALREADY_ACTIVE',
      answer: { status: 409, bluCode: 'PARTIDA:ALREADY_ACTIVE' },
      message: 'Ai deja o partidă în desfășurare. Încheie-o înainte să intri în alta.',
    },
    { name: 'unknown bluCode', answer: { status: 400, bluCode: 'PARTIDA:SOMETHING_NEW' }, message: 'Ceva n-a mers. Încearcă din nou.' },
    { name: 'server error', answer: { status: 500 }, message: 'Ceva n-a mers. Încearcă din nou.' },
  ];

  for (const f of FAILURES) {
    test(`partide.intra.c5 — ${f.name} → «${f.message}» inline from 768`, async ({ page }) => {
      await mockJoin(page, [f.answer]);
      const { field, button } = await open(page);
      const status = page.getByTestId('join-error');
      // The live region is rendered (not display:none) BEFORE the message lands, so it is announced.
      await expect(status).toBeAttached();
      await expect(status).toBeEmpty();
      expect(await status.evaluate(el => getComputedStyle(el).display)).not.toBe('none');
      await field.pressSequentially('k7m2qx');
      await button.click();
      await expect(status).toHaveText(f.message);
      await expect(status).toHaveAttribute('role', 'status');
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      // The code stays, the form is usable again, focus is back on the field.
      await expect(field).toHaveValue('K7M2QX');
      await expect(field).toBeFocused();
      await expect(button).toBeEnabled();
      await expect(page).toHaveURL(/\/partide\/intra$/);
      if (f.name === 'PARTIDA:ALREADY_ACTIVE') {
        await page.screenshot({ path: `${SHOTS}/c5-inline-1280.png` });
        await expectNoA11yViolations(page);
      }
      // Editing the code clears the message.
      await field.press('Backspace');
      await expect(status).toBeEmpty();
      await expect(field).not.toHaveAttribute('aria-invalid', 'true');
    });
  }

  test('partide.intra.c5 — on a phone the failure is a toast (fish showErrorToast); a retry can succeed', async ({ page }) => {
    const bodies = await mockJoin(page, [{ status: 400, bluCode: 'PARTIDA:ENDED' }, { status: 200 }]);
    const { field, button } = await open(page, 375);
    await field.pressSequentially('k7m2qx');
    await field.press('Enter');
    await expect(page.getByRole('alert').filter({ hasText: 'Partida s-a încheiat' })).toBeVisible();
    await expect(page.getByTestId('join-error')).toBeEmpty();
    await page.screenshot({ path: `${SHOTS}/c5-toast-375.png` });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page).toHaveURL(new RegExp(`/partide/${JOINED.documentId}$`));
    expect(bodies).toHaveLength(2);
  });

  test('partide.intra — keyboard path: type, Tab to the button, Enter joins', async ({ page }) => {
    const bodies = await mockJoin(page);
    const { field, button } = await open(page);
    await page.keyboard.type('q2w3e4');
    await expect(field).toHaveValue('Q2W3E4');
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/partide/${JOINED.documentId}$`));
    expect(bodies).toEqual([{ data: { code: 'Q2W3E4' } }]);
  });

  test('partide.intra — a dead session (401) goes to sign-in and back here', async ({ page }) => {
    await mockJoin(page, [{ status: 401 }]);
    const { field, button } = await open(page);
    await field.pressSequentially('k7m2qx');
    await button.click();
    await expect(page).toHaveURL(/\/intra\?next=%2Fpartide%2Fintra$/);
  });

  test('partide.intra — the hub hero «Intră cu cod» opens this page (sign-in first for a guest)', async ({ page }) => {
    await mockJoin(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/partide');
    const guestLink = page.getByRole('link', { name: 'Intră cu cod' }).locator('visible=true').first();
    await expect(guestLink).toHaveAttribute('href', '/intra?next=%2Fpartide%2Fintra');
    await signIn(page.context(), jwt);
    await page.goto('/partide');
    const link = page.getByRole('link', { name: 'Intră cu cod' }).locator('visible=true').first();
    await expect(link).toHaveAttribute('href', '/partide/intra');
    await page.screenshot({ path: `${SHOTS}/hub-hero-1280.png` });
    await link.click();
    await expect(page).toHaveURL(/\/partide\/intra$/);
    await expect(page.getByRole('textbox', { name: 'Codul de acces' })).toBeFocused();
  });

  test('partide.intra — Acasă → «Intră cu cod» → back returns to Acasă (fish goBackOrHome)', async ({ page }) => {
    await mockJoin(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await page.goto('/');
    const link = page.getByRole('link', { name: 'Intră cu cod' }).locator('visible=true').first();
    await expect(link).toHaveAttribute('href', '/partide/intra');
    await link.click();
    await expect(page).toHaveURL(/\/partide\/intra$/);
    await expect(page.getByRole('textbox', { name: 'Codul de acces' })).toBeFocused();
    await page.getByRole('link', { name: 'Înapoi', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    // Back was a history step, not a push: Forward returns to the form.
    await page.goForward();
    await expect(page).toHaveURL(/\/partide\/intra$/);
  });

  test('partide.intra — a direct open: back REPLACES the form with the Partide hub', async ({ page }) => {
    await mockJoin(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await page.goto('/partide/intra');
    await expect(page.getByRole('textbox', { name: 'Codul de acces' })).toBeVisible();
    await page.getByRole('link', { name: 'Înapoi', exact: true }).click();
    await expect(page).toHaveURL(/\/partide$/);
  });

  test('partide.intra — IME composition (Gboard word mode) is not rewritten mid-word', async ({ page }) => {
    await mockJoin(page);
    const { field, button } = await open(page);
    const cdp = await page.context().newCDPSession(page);
    // Lowercase «k», then «k7» composing, then the word committed: one K, one 7.
    await cdp.send('Input.imeSetComposition', { text: 'k', selectionStart: 1, selectionEnd: 1 });
    await cdp.send('Input.imeSetComposition', { text: 'k7', selectionStart: 2, selectionEnd: 2 });
    await expect(field).toHaveValue('k7');
    await cdp.send('Input.insertText', { text: 'k7' });
    await expect(field).toHaveValue('K7');
    await cdp.send('Input.imeSetComposition', { text: 'm2-q', selectionStart: 4, selectionEnd: 4 });
    await cdp.send('Input.insertText', { text: 'm2-q' });
    await expect(field).toHaveValue('K7M2Q');
    await expect(button).toBeDisabled();
    await field.pressSequentially('x');
    await expect(field).toHaveValue('K7M2QX');
    await expect(button).toBeEnabled();
  });

  test('partide.intra — phone layout: no horizontal scroll, the button under the field', async ({ page }) => {
    await mockJoin(page);
    const { field, button } = await open(page, 375);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const f = (await field.boundingBox())!;
    const b = (await button.boundingBox())!;
    expect(b.y).toBeGreaterThan(f.y + f.height);
    expect(b.height).toBeGreaterThanOrEqual(48);
    await page.screenshot({ path: `${SHOTS}/phone-375.png` });
  });
});

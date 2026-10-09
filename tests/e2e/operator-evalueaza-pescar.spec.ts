import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { anglerJwt } from './helpers/fake-organizer';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * operator.evalueaza-pescar (c1–c12) + operator.b.double-submit (rating part), operator.b.write-invalidation
 * (angler review). fish: app/(app)/operator/rate-angler/[bookingId].tsx, features/operator/reviewTags.ts.
 *
 * Real: the sign-in gate (proxy + requireViewer), the page rendering its params, the no-param direct
 * link, the history back, the inbox → rate → back round trip on the LOCAL CMS, and the refusals the
 * LOCAL CMS really answers (c11 «real»): INVALID_STATUS (a not-ended booking of the owned lake),
 * ALREADY_REVIEWED (a booking a read shows as rated), 403 (a viewer who does not own the lake: the
 * plain e2e angler of helpers/fake-organizer) and 404 (an id no booking has) — the CMS refuses each
 * before writing, the booking is checked by a read first, and a guard aborts any POST for another id.
 * Angler reviews have no delete endpoint, so a SUCCESSFUL POST /feed/angler-reviews is ROUTE-MOCKED
 * at the browser's /api/cms proxy (body asserted), as are the refusals the UI cannot provoke on the
 * local seed (ANGLER_DID_NOT_SHOW needs an ended no-show, COMMENT_REQUIRED is blocked by the form,
 * another code, a 500). Nothing is written.
 */

test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const BOOKING = 'e2ebookingrate01';
/** Chita (local CMS): a completed walk-in, not rated → «Evaluează pescarul» in its detail. */
const REAL_WALK_IN = 'e2cgl6wld8e7h4rygu7ly9li';
const S3_AVATAR = 'https://fir-intins-strapi.s3.eu-central-1.amazonaws.com/e2e_avatar_ana.png';
const FULL = {
  anglerName: 'Ana Popescu',
  anglerId: 'u-ana',
  anglerAvatar: S3_AVATAR,
  standName: '3',
  startDate: '2026-08-15T03:00:00.000Z',
  endDate: '2026-08-15T15:00:00.000Z',
};
const url = (p: Record<string, string> = FULL, id = BOOKING) => `/operator/evalueaza/${id}${Object.keys(p).length ? `?${new URLSearchParams(p)}` : ''}`;
/** The stay line, the period's en dash wrapped in word joiners (one line). */
const STAY = /^Standul 3 · Sâmbătă, 15 aug · 06:00⁠?–⁠?18:00$/;

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

type Reply = { status?: number; body?: unknown; hold?: Promise<void> };
const OK_BODY = {
  data: { stars: 5, comment: null, authorName: 'qa', lakeName: 'Chita', createdAt: new Date().toISOString(), rulesScore: null, cleanlinessScore: null, behaviorScore: null, tags: [] },
};
const refusal = (message: string, bluCode?: string) => ({
  data: null,
  error: { status: 400, name: 'BadRequestError', message, details: bluCode ? { bluCode } : {} },
});

/** POST /api/cms/feed/angler-reviews mocked; returns the bodies the page sent. */
async function mockReview(page: Page, reply: Reply = {}) {
  const bodies: unknown[] = [];
  await page.route('**/api/cms/feed/angler-reviews', async (r: Route) => {
    if (r.request().method() !== 'POST') return r.fallback();
    bodies.push(r.request().postDataJSON());
    if (reply.hold) await reply.hold;
    await r.fulfill({ status: reply.status ?? 200, contentType: 'application/json', body: JSON.stringify(reply.body ?? OK_BODY) });
  });
  return bodies;
}

type LakeBooking = { documentId: string; bookingStatus: string; endDate: string; noShow?: boolean; reviewedByOperator?: boolean };

/** The first lake the QA user owns on the local CMS — the e2e seed; its absence fails the test. */
async function ownedLake(request: APIRequestContext, jwt: string): Promise<string> {
  const res = await request.get(`${CMS}/feed/owned-lakes`, { headers: { Authorization: `Bearer ${jwt}` } });
  expect(res.ok(), `GET /feed/owned-lakes: HTTP ${res.status()}`).toBe(true);
  const lakeId = (await res.json()).data?.[0]?.documentId as string | undefined;
  expect(lakeId, 'local seed: the QA user must own a lake (Chita Lake)').toBeTruthy();
  return lakeId!;
}

/** Every booking of the lake (the operator inbox, all pages) — a read. */
async function lakeBookings(request: APIRequestContext, jwt: string, lakeId: string): Promise<LakeBooking[]> {
  const all: LakeBooking[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await request.get(`${CMS}/feed/bookings/lake/${lakeId}?bucket=all&page=${page}&pageSize=50`, { headers: { Authorization: `Bearer ${jwt}` } });
    expect(res.ok(), `GET /feed/bookings/lake: HTTP ${res.status()}`).toBe(true);
    const rows = ((await res.json()).data ?? []) as LakeBooking[];
    all.push(...rows);
    if (rows.length < 50) break;
  }
  return all;
}

/** The CMS's rateable test (feed/controllers/reviews.ts): a confirmed/completed stay that has ended. */
const rateable = (b: LakeBooking) => ['confirmed', 'completed'].includes(b.bookingStatus) && Date.parse(b.endDate) < Date.now();

/**
 * The real POST may only go out for `bookingId` (a booking the CMS refuses): anything else is aborted
 * before it reaches the CMS, so a bug can never write a review. Returns the CMS's answers.
 */
async function realRefusalOnly(page: Page, bookingId: string) {
  const answers: { status: number; body: unknown }[] = [];
  await page.route('**/api/cms/feed/angler-reviews', async (r: Route) => {
    if (r.request().method() !== 'POST') return r.fallback();
    const booking = (r.request().postDataJSON() as { data?: { booking?: string } })?.data?.booking;
    if (booking !== bookingId) return r.abort();
    const res = await r.fetch();
    answers.push({ status: res.status(), body: await res.json().catch(() => null) });
    await r.fulfill({ response: res });
  });
  return answers;
}

async function mockAvatar(page: Page) {
  await page.route('https://fir-intins-strapi.s3.eu-central-1.amazonaws.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX }));
}

const stars = (page: Page) => page.getByRole('radiogroup');
const star = (page: Page, n: number) => page.getByRole('radio', { name: n === 1 ? '1 stea' : `${n} stele` });
const submitBtn = (page: Page) => page.getByTestId('rate-submit');
const chip = (page: Page, label: string) => page.getByRole('button', { name: label, exact: true });
/** Hydrated: the CTA turns on only then (while the gate streams, a second, disabled copy may still be in the DOM). */
const hydrated = (page: Page) => expect(page.locator('[data-testid="rate-submit"]:enabled')).not.toHaveCount(0);
/** The CTA's colour transition (disabled until hydrated → accent) has finished: axe reads final colours. */
const settled = (page: Page) => expect.poll(() => submitBtn(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(98, 101, 241)');

/** Expected console noise: mocked 4xx responses are logged by the browser as failed resources. */
const EXPECTED_CONSOLE = [/Failed to load resource/];

test.describe('signed out', () => {
  test('c1 gate: a signed-out visit goes to /intra with the whole link as next', async ({ page }) => {
    await page.goto(url());
    await expect(page).toHaveURL(/\/intra\?/);
    const next = new URL(page.url()).searchParams.get('next');
    expect(next).toBe(url());
  });
});

test.describe('signed in', () => {
  let jwt: string;
  test.beforeAll(async ({ request }) => {
    jwt = await qaJwt(request);
  });
  test.beforeEach(async ({ context }) => {
    await signIn(context, jwt);
  });

  test('c1 c2 c3: opened with every param — header, avatar, name, «Standul 3 · period»; nothing fetched', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockAvatar(page);
    const cms: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/cms/') || r.url().startsWith(CMS)) cms.push(`${r.method()} ${r.url()}`);
    });
    await page.goto(url());
    await expect(page.getByRole('heading', { level: 1, name: 'Evaluează pescarul' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    const card = page.getByTestId('rate-stay').filter({ visible: true });
    await expect(card).toContainText('Ana Popescu');
    await expect(card.getByTestId('rate-stay-line')).toHaveText(STAY);
    await expect(card.locator(`img[src="${S3_AVATAR}"]`)).toHaveCount(1);
    await expect(page.getByTestId('rate-question')).toHaveText('Cum a fost cu Ana Popescu?');
    // c1: the page reads nothing about the stay (no booking, no reputation, no list read) — the shell's
    // own reads (session, notifications, owned lakes for the menu) are not this page's.
    await page.waitForTimeout(800);
    expect(cms.filter((c) => /bookings|reputation|angler-reviews|u-ana|e2ebookingrate01/.test(c))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('c3: a direct link without params — «pescarul», initials, no stay line', async ({ page }) => {
    await page.goto(url({}));
    const card = page.getByTestId('rate-stay').filter({ visible: true });
    await expect(card).toContainText('pescarul');
    await expect(card.getByTestId('rate-stay-line')).toHaveCount(0);
    await expect(card.locator('img')).toHaveCount(0);
    await expect(card).toContainText('P');
    await expect(page.getByTestId('rate-question')).toHaveText('Cum a fost cu pescarul?');
  });

  test('c3: missing parts are omitted — stand only, period only', async ({ page }) => {
    await page.goto(url({ anglerName: 'Ion', standName: 'A1' }));
    await expect(page.getByTestId('rate-stay').filter({ visible: true }).getByTestId('rate-stay-line')).toHaveText('Standul A1');
    await page.goto(url({ anglerName: 'Ion', startDate: FULL.startDate, endDate: FULL.endDate }));
    await expect(page.getByTestId('rate-stay').filter({ visible: true }).getByTestId('rate-stay-line')).toHaveText(/^Sâmbătă, 15 aug · 06:00⁠?–⁠?18:00$/);
  });

  test('c1 params are sanitised: foreign avatar host, markup, over-long text, bad booking id', async ({ page }) => {
    let foreign = 0;
    await page.route('https://evil.example/**', (r) => {
      foreign += 1;
      return r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX });
    });
    const name = `<img src=x onerror=alert(1)>${'x'.repeat(200)}`;
    await page.goto(url({ anglerName: name, anglerAvatar: 'https://evil.example/a.png', standName: '<b>3</b>' }));
    const card = page.getByTestId('rate-stay').filter({ visible: true });
    await expect(card.locator('img')).toHaveCount(0);
    await expect(card.locator('b')).toHaveCount(0);
    await expect(card.getByTestId('rate-stay-line')).toHaveText('Standul <b>3</b>');
    const shown = (await page.getByTestId('rate-question').textContent()) ?? '';
    expect(shown.length).toBeLessThanOrEqual('Cum a fost cu ?'.length + 80);
    expect(foreign).toBe(0);
    // Not an id: the not-found page (streamed after the gate, so the status stays 200 — ROADMAP §8).
    await page.goto('/operator/evalueaza/bad%20id%3Cx%3E');
    await expect(page.getByRole('heading', { name: 'Pagina nu există' })).toBeVisible();
  });

  test('c2: back returns to the page before; without history it goes to the operator area', async ({ page }) => {
    await page.goto('/');
    await page.goto(url({}));
    // Hydrated (the CTA turns on only then): before it «Înapoi» has no handler yet.
    await hydrated(page);
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(/\/$/);

    const fresh = await page.context().newPage();
    await fresh.goto(url({}));
    await hydrated(fresh);
    await fresh.getByRole('button', { name: 'Înapoi' }).click();
    await expect(fresh).toHaveURL(/\/operator(\/[A-Za-z0-9]+)?$/);
    await fresh.close();
  });

  test('c4 c5: five stars preset; keyboard radio group; the current star keeps the score; verdict colours', async ({ page }) => {
    await page.goto(url());
    await expect(stars(page)).toHaveAccessibleName('Cum a fost cu Ana Popescu?');
    await expect(star(page, 5)).toBeChecked();
    const verdictEl = page.getByTestId('rate-verdict');
    await expect(verdictEl).toHaveText('Excelent');
    await expect(verdictEl).toHaveAttribute('data-tone', 'success');

    // Keyboard: Tab lands on the chosen star, the arrows move and choose.
    await page.getByRole('button', { name: 'Înapoi' }).focus();
    await page.keyboard.press('Tab');
    await expect(star(page, 5)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(star(page, 4)).toBeChecked();
    await expect(verdictEl).toHaveText('Bine');
    await expect(verdictEl).toHaveAttribute('data-tone', 'success');
    await page.keyboard.press('ArrowLeft');
    await expect(verdictEl).toHaveText('Acceptabil');
    await expect(verdictEl).toHaveAttribute('data-tone', 'neutral');
    await page.keyboard.press('ArrowLeft');
    await expect(verdictEl).toHaveText('Slab');
    await expect(verdictEl).toHaveAttribute('data-tone', 'danger');
    await page.keyboard.press('ArrowLeft');
    await expect(star(page, 1)).toBeChecked();
    await expect(verdictEl).toHaveText('Foarte slab');
    await expect(verdictEl).toHaveAttribute('data-tone', 'danger');

    // Activating the current value does not clear it (a score is always set).
    await star(page, 1).click({ force: true });
    await expect(star(page, 1)).toBeChecked();
    await star(page, 3).click({ force: true });
    await star(page, 3).click({ force: true });
    await expect(star(page, 3)).toBeChecked();
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);

    // Colours: green 4–5, ink-2 at 3, red 1–2.
    const color = () => verdictEl.evaluate((el) => getComputedStyle(el).color);
    expect(await color()).not.toBe('rgb(21, 128, 61)');
    await star(page, 2).click({ force: true });
    expect(await color()).toBe('rgb(190, 18, 60)');
    await star(page, 4).click({ force: true });
    expect(await color()).toBe('rgb(21, 128, 61)');
  });

  test('c6 c7: tag groups by score, chips toggle green / red, raising to five drops faults', async ({ page }) => {
    await page.goto(url());
    await expect(page.getByTestId('tags-positive')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A mers bine' })).toBeVisible();
    await expect(page.getByTestId('tags-negative')).toHaveCount(0);
    for (const l of ['A respectat regulile', 'A lăsat locul curat', 'Prietenos', 'Liniștit']) await expect(chip(page, l)).toBeVisible();

    await star(page, 4).click({ force: true });
    await expect(page.getByRole('heading', { name: 'Nu a mers' })).toBeVisible();
    for (const l of ['Nu a respectat regulile', 'A lăsat mizerie', 'Comportament nepotrivit', 'Gălăgios']) await expect(chip(page, l)).toBeVisible();

    const curat = chip(page, 'A lăsat locul curat');
    const noisy = chip(page, 'Gălăgios');
    await curat.click();
    await noisy.click();
    await expect(curat).toHaveAttribute('aria-pressed', 'true');
    await expect(noisy).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => curat.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(21, 128, 61)');
    await expect.poll(() => noisy.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(225, 29, 72)');
    // Toggle off and on again (keyboard).
    await noisy.focus();
    await page.keyboard.press('Enter');
    await expect(noisy).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Space');
    await expect(noisy).toHaveAttribute('aria-pressed', 'true');

    // Down keeps everything; up to five withdraws the faults, praise survives.
    await star(page, 2).click({ force: true });
    await expect(noisy).toHaveAttribute('aria-pressed', 'true');
    await star(page, 5).click({ force: true });
    await expect(page.getByTestId('tags-negative')).toHaveCount(0);
    await expect(curat).toHaveAttribute('aria-pressed', 'true');
    await star(page, 4).click({ force: true });
    await expect(chip(page, 'Gălăgios')).toHaveAttribute('aria-pressed', 'false');
  });

  test('c8 c9: comment opțional / obligatoriu, placeholders, the hint, the CTA off while invalid', async ({ page }) => {
    await page.goto(url());
    const input = page.getByRole('textbox', { name: 'Comentariu' });
    await expect(page.getByTestId('rate-comment-marker')).toHaveText('opțional');
    await expect(input).toHaveAttribute('placeholder', 'Ceva de menționat despre această rezervare?');
    await expect(page.getByTestId('rate-comment-hint')).toHaveCount(0);
    await expect(submitBtn(page)).toBeEnabled();

    await star(page, 2).click({ force: true });
    const marker = page.getByTestId('rate-comment-marker');
    await expect(marker).toHaveText('obligatoriu');
    expect(await marker.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(190, 18, 60)');
    await expect(input).toHaveAttribute('placeholder', 'Spune pe scurt ce nu a mers.');
    await expect(page.getByTestId('rate-comment-hint')).toHaveText('Adaugă un comentariu pentru o notă sub 3 stele');
    await expect(submitBtn(page)).toBeDisabled();

    await input.fill('   ');
    await expect(submitBtn(page)).toBeDisabled();
    await input.fill('A lăsat gunoi la stand.');
    await expect(page.getByTestId('rate-comment-hint')).toHaveCount(0);
    await expect(submitBtn(page)).toBeEnabled();
    await input.fill('');
    await star(page, 3).click({ force: true });
    await expect(marker).toHaveText('opțional');
    await expect(submitBtn(page)).toBeEnabled();
    await settled(page);
    await expectNoA11yViolations(page);
  });

  test('c9 c10 + b.double-submit: the body, busy while sending, «Evaluare trimisă», back', async ({ page }) => {
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    const bodies = await mockReview(page, { hold });
    // Opened with no history: «back» is the operator area, a client-side navigation the toast survives
    // (the history case is c2, and the inbox round trip c12).
    await page.goto(url());
    await star(page, 4).click({ force: true });
    await chip(page, 'Prietenos').click();
    await chip(page, 'Gălăgios').click();
    await page.getByRole('textbox', { name: 'Comentariu' }).fill('  A vorbit tare noaptea.  ');
    await submitBtn(page).click();
    await expect(submitBtn(page)).toBeDisabled();
    await expect(submitBtn(page)).toHaveAttribute('aria-busy', 'true');
    // A second press while sending sends nothing more.
    await submitBtn(page).click({ force: true }).catch(() => {});
    release();
    await expect(page.getByText('Evaluare trimisă')).toBeVisible();
    await expect(page).toHaveURL(/\/operator(\/[A-Za-z0-9]+)?$/);
    expect(bodies).toEqual([{ data: { booking: BOOKING, stars: 4, comment: 'A vorbit tare noaptea.', tags: ['friendly', 'noisy'] } }]);
  });

  test('c10: an empty comment is omitted; tags empty at five stars by default', async ({ page }) => {
    const bodies = await mockReview(page);
    await page.goto(url({}));
    await page.getByRole('textbox', { name: 'Comentariu' }).fill('   ');
    await submitBtn(page).click();
    await expect(page.getByText('Evaluare trimisă')).toBeVisible();
    expect(bodies).toEqual([{ data: { booking: BOOKING, stars: 5, tags: [] } }]);
  });

  // c11 (mock): the refusals the local seed / the form cannot provoke — the body is the CMS's shape
  // (fail() → ctx.badRequest(errorCopy(code), { bluCode })). `final`: the CTA stays off after it.
  const REFUSALS: { name: string; status: number; body: unknown; toast: string; final: boolean }[] = [
    {
      name: 'ANGLER_DID_NOT_SHOW',
      status: 400,
      body: refusal('Pescarul nu s-a prezentat, deci recenzia nu se poate lăsa.', 'ANGLER_DID_NOT_SHOW'),
      toast: 'Pescarul e marcat ca neprezentat — neprezentarea ține deja loc de evaluare.',
      final: true,
    },
    { name: 'COMMENT_REQUIRED', status: 400, body: refusal('Scrie câteva cuvinte despre ce nu a mers.', 'COMMENT_REQUIRED'), toast: 'La un punctaj mic, comentariul este obligatoriu.', final: false },
    { name: 'another code: the server sentence', status: 400, body: refusal('Nota trebuie să fie între 1 și 5.', 'INVALID_STARS'), toast: 'Nota trebuie să fie între 1 și 5.', final: false },
    { name: 'no code (500): the screen line', status: 500, body: { data: null, error: { status: 500, name: 'InternalServerError', message: 'Internal Server Error' } }, toast: 'Evaluarea nu a putut fi trimisă.', final: false },
  ];
  for (const r of REFUSALS) {
    test(`c11 (mock): ${r.name} → «${r.toast}», the form stays${r.final ? ', the CTA stays off' : ''}`, async ({ page }) => {
      const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
      await mockReview(page, { status: r.status, body: r.body });
      await page.goto(url());
      await submitBtn(page).click();
      await expect(page.getByRole('alert').filter({ hasText: r.toast })).toBeVisible();
      await expect(page).toHaveURL(/\/operator\/evalueaza\//);
      if (r.final) {
        await expect(submitBtn(page)).toBeDisabled();
        await expect(page.getByTestId('rate-refused')).toHaveText(r.toast);
      } else {
        await expect(submitBtn(page)).toBeEnabled();
        await expect(page.getByTestId('rate-refused')).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });
  }

  /** Submits five stars for `bookingId` against the REAL local CMS and checks the refusal end to end. */
  async function realRefusal(
    page: Page,
    bookingId: string,
    expected: { status: number; bluCode?: string; toast: string; final: boolean },
  ) {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const answers = await realRefusalOnly(page, bookingId);
    await page.goto(url({ anglerName: 'Pescar e2e' }, bookingId));
    await submitBtn(page).click();
    await expect(page.getByRole('alert').filter({ hasText: expected.toast })).toBeVisible();
    expect(answers).toHaveLength(1);
    expect(answers[0].status).toBe(expected.status);
    const details = (answers[0].body as { error?: { details?: { bluCode?: string } } } | null)?.error?.details;
    expect(details?.bluCode).toBe(expected.bluCode);
    await expect(page).toHaveURL(/\/operator\/evalueaza\//);
    if (expected.final) {
      await expect(submitBtn(page)).toBeDisabled();
      await expect(page.getByTestId('rate-refused')).toHaveText(expected.toast);
    } else {
      await expect(submitBtn(page)).toBeEnabled();
    }
    expect(errors).toEqual([]);
  }

  test('c11 (real): INVALID_STATUS — a not-ended booking of the owned lake → «Poți evalua doar după ce se încheie rezervarea.», retry stays on', async ({ page, request }) => {
    const lakeId = await ownedLake(request, jwt);
    const bookings = await lakeBookings(request, jwt, lakeId);
    // A future one first (the plain case); any other the CMS cannot rate otherwise.
    const target = bookings.find((b) => Date.parse(b.endDate) > Date.now()) ?? bookings.find((b) => !rateable(b));
    expect(target, 'local seed: the owned lake needs a booking that has not ended (or is not confirmed/completed)').toBeTruthy();
    expect(rateable(target!)).toBe(false);
    await realRefusal(page, target!.documentId, { status: 400, bluCode: 'INVALID_STATUS', toast: 'Poți evalua doar după ce se încheie rezervarea.', final: false });
  });

  test('c11 (real): ALREADY_REVIEWED — a booking the inbox shows as rated → «Ai evaluat deja această rezervare.», the CTA stays off', async ({ page, request }) => {
    const lakeId = await ownedLake(request, jwt);
    const target = (await lakeBookings(request, jwt, lakeId)).find((b) => b.reviewedByOperator === true && rateable(b) && b.noShow !== true);
    if (!target) {
      // Not skipped silently: the report carries why the real criterion did not run (no delete endpoint
      // for angler reviews, so the spec does not create one). The mapping is still covered by the unit test.
      test.info().annotations.push({ type: 'not exercised', description: 'local seed: no rated, ended, non-no-show booking on the owned lake' });
      test.skip(true, 'local seed: no rated booking on the owned lake (reviewedByOperator)');
      return;
    }
    await realRefusal(page, target.documentId, { status: 400, bluCode: 'ALREADY_REVIEWED', toast: 'Ai evaluat deja această rezervare.', final: true });
  });

  test('c11 (real): 403 — a viewer who does not own the lake → «Nu ai acces la această rezervare.», the CTA stays off', async ({ page, request, context }) => {
    const lakeId = await ownedLake(request, jwt);
    const bookings = await lakeBookings(request, jwt, lakeId);
    expect(bookings.length, 'local seed: the owned lake needs a booking').toBeGreaterThan(0);
    const other = await anglerJwt(request);
    expect(other, 'E2E_CMS_ADMIN_TOKEN (.env.local) is needed for the plain e2e angler').toBeTruthy();
    // The e2e angler owns no lake: the CMS answers ctx.forbidden() before reading anything else.
    const owned = await request.get(`${CMS}/feed/owned-lakes`, { headers: { Authorization: `Bearer ${other}` } });
    const ownedIds = ((await owned.json()).data ?? []).map((l: { documentId: string }) => l.documentId);
    expect(ownedIds).not.toContain(lakeId);
    await signIn(context, other!);
    await realRefusal(page, bookings[0].documentId, { status: 403, toast: 'Nu ai acces la această rezervare.', final: true });
  });

  test('c11 (real): 404 — a booking id no booking has → «Rezervarea nu mai există.», the CTA stays off', async ({ page }) => {
    await realRefusal(page, 'e2enosuchbooking0000000', { status: 404, toast: 'Rezervarea nu mai există.', final: true });
  });

  test('c9 layout: phone — the CTA bar sits on the bottom edge; 1280 — docked under the stay card; axe', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(url());
    // Measured once the gate has streamed the form in (before it, the skeleton's CTA has no test id).
    await expect(submitBtn(page)).toBeVisible();
    const bar = await submitBtn(page).boundingBox();
    expect(bar!.y + bar!.height).toBeGreaterThan(812 - 40);
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(812);
    await settled(page);
    await expectNoA11yViolations(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    const stay = page.getByTestId('rate-stay').filter({ visible: true });
    await expect(stay).toBeVisible();
    const s = await stay.boundingBox();
    const b = await submitBtn(page).boundingBox();
    expect(s!.x).toBeGreaterThan(800);
    expect(b!.y).toBeGreaterThan(s!.y + s!.height);
    expect(Math.abs(b!.x - s!.x)).toBeLessThan(40);
    await settled(page);
    await expectNoA11yViolations(page);
  });

  test('c12 + b.write-invalidation: inbox → «Evaluează pescarul» → sent → back, the bookings list is read again', async ({ page, request }) => {
    // The local seed is required, not optional: a missing lake or booking FAILS (a green run means
    // the round trip really ran).
    const lakeId = await ownedLake(request, jwt);
    const seed = (await lakeBookings(request, jwt, lakeId)).find((b) => b.documentId === REAL_WALK_IN);
    expect(seed, `local seed: ${REAL_WALK_IN} (a completed, unrated walk-in of the owned lake)`).toBeTruthy();
    expect(rateable(seed!) && seed!.reviewedByOperator !== true && seed!.noShow !== true, 'local seed: the walk-in must be ended, unrated, not a no-show').toBe(true);
    const bodies = await mockReview(page);
    // Chita's completed, unrated walk-in (the operator-detaliu-rezervare fixture), its detail open.
    await page.goto(`/operator/${lakeId}/rezervari?status=all&rezervare=${REAL_WALK_IN}`);
    const rate = page.getByRole('button', { name: 'Evaluează pescarul' }).filter({ visible: true }).first();
    await rate.waitFor({ timeout: 15_000 });
    await rate.click();
    await expect(page).toHaveURL(/\/operator\/evalueaza\//);
    await expect(page).toHaveURL(new RegExp(`/operator/evalueaza/${REAL_WALK_IN}\\?anglerName=`));
    await expect(page.getByTestId('rate-stay').filter({ visible: true }).getByTestId('rate-stay-line')).toContainText('Standul');
    const reads: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'GET' && /\/api\/cms\/feed\/bookings\/lake\//.test(r.url())) reads.push(r.url());
    });
    await submitBtn(page).click();
    await expect(page.getByText('Evaluare trimisă')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/operator/${lakeId}/rezervari`));
    expect(bodies[0]).toMatchObject({ data: { booking: REAL_WALK_IN, stars: 5 } });
    await expect.poll(() => reads.length).toBeGreaterThan(0);
  });
});

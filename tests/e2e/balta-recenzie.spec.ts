import { collectConsoleErrors as watchConsole } from './helpers/console';
import { BASE_URL as BASE } from './helpers/base-url';
import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';
import { createTestTransport } from '../transport';
import { deleteReview, getReviewForLakeByAuthorId } from '../../core/lakes/api';
import { expect, test, type Page, type Route } from '@playwright/test';

/*
 * The review form — /balti/[id]/recenzie (parity docs/parity/areas/lakes.yml lakes.review-form,
 * T4 single step), plus the reviews page's entry points into it (lakes.reviews c6 «Editează», c9
 * «Adaugă o recenzie») and lakes.b.review-invalidation.
 *
 * ONE real write, on the LOCAL CMS only: the QA user adds a review on a lake where
 * /feed/reviews/mine shows none, sees it on /recenzii and on the lake page, edits it, deletes it
 * from /recenzii, and the `finally` deletes whatever is left (core deleteReview with the QA JWT).
 * The lake-page steps check what the visitor sees after each write; they cannot prove the
 * read-your-own-writes refresh (refreshLakeAfterReview → updateTag) by themselves: the local CMS
 * sends no CDN-Cache-Control, so its public reads are not cached here (lib/server/public-get.ts) and
 * the step passes with or without the refresh (checked 2026-10-07). Staging / production cache them. Everything else is answered by
 * page.route: the verified path (?rezervare=) asserts the POST body carries `booking` without any
 * real booking, an edit failure shows the rollback, the read failures and the mode switches.
 *
 * Lake (override with E2E_LAKE_REVIEW): Balta Berzei — no review, referenced by no other spec, so
 * the review that lives for a few seconds never shows up in another spec's counts.
 */

test.describe.configure({ timeout: 180_000 });

const LAKE = process.env.E2E_LAKE_REVIEW ?? 'orrlgum9fec73ghsxl9mj11i';
const PHONE = { width: 375, height: 812 };
const LAPTOP = { width: 1280, height: 900 };

let jwt = '';
let lakeName = '';

test.beforeAll(async ({ request }) => {
  const res = await request.get(`${CMS}/feed/lakes/${LAKE}`);
  expect(res.ok(), `lake ${LAKE} exists in the local CMS`).toBeTruthy();
  lakeName = (await res.json()).data.name;
  jwt = await qaJwt(request);
});

function collectConsoleErrors(page: Page) {
  // Photos of the local test data that fail are the data's; the mocked failures below are expected
  // (a 500 / an aborted read is logged by the browser).
  return watchConsole(page, { ignore: /Failed to load resource|ERR_|net::/ });
}

const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

async function go(page: Page, path: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeAttached({ timeout: 60_000 });
}

async function faults(page: Page, list: string[]) {
  const res = await page.request.post(`${BASE}/balti/${LAKE}/e2e-fault`, { data: { faults: list } });
  expect(res.ok(), 'the dev-only fault switch answers (development server)').toBeTruthy();
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

/** The browser's read of a CMS path (direct or through the same-origin proxy). */
const cms = (path: string) => (url: URL) => url.pathname.endsWith(`/api${path}`) || url.pathname.endsWith(`/api/cms${path}`);

const form = `/balti/${LAKE}/recenzie`;
const group = (page: Page, name: string) => page.getByRole('radiogroup', { name });
const star = (page: Page, name: string, n: number) => group(page, name).getByRole('radio', { name: `${n} ${n === 1 ? 'stea' : 'stele'}` });

const ownReview = (over: Partial<Record<string, unknown>> = {}) => ({
  documentId: 'rev-e2e-own',
  quality: 4,
  facilities: 2,
  atmosphere: 3,
  recommendToOthers: false,
  comment: 'Recenzia mea de test, scrisă de mână.',
  createdAt: '2026-10-01T10:00:00.000Z',
  verified: false,
  author: { documentId: 'qa-author', username: 'QA', avatar: null },
  ...over,
});

/* ============================================================================================== */

test('lakes.review-form.c10 — signed out: /intra?next= keeps the form and its mode', async ({ page }) => {
  for (const path of [form, `${form}?editare=1`, `${form}?rezervare=bk-e2e`]) {
    await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page).toHaveURL(`${BASE}/intra?next=${encodeURIComponent(path)}`, { timeout: 60_000 });
  }
});

test('lakes.review-form.c1 lakes.review-form.c2 lakes.review-form.c3 lakes.review-form.c4 lakes.review-form.c5 lakes.review-form.c6 lakes.review-form.c7 lakes.review-form.c8 lakes.review-form.c9 lakes.reviews.c6 lakes.reviews.c9 lakes.b.review-invalidation — REAL write: add from /recenzii, see it, edit it, delete it', async ({ page, context }) => {
  const t = createTestTransport(jwt);
  const before = await getReviewForLakeByAuthorId(t, { lakeId: LAKE });
  expect(before, `the QA user has no review on ${LAKE} (delete it by hand if a previous run died)`).toBeNull();
  const errors = collectConsoleErrors(page);
  await signIn(context, jwt, BASE);
  const comment = `Recenzie e2e ${Date.now()}: apă curată, pești mulți.`;
  const edited = `${comment} Revenit: și mai bine.`;
  try {
    // lakes.reviews.c9 — signed in, no review: «Adaugă o recenzie» opens the form (client navigation).
    await go(page, `/balti/${LAKE}/recenzii`);
    const add = page.getByTestId('review-add').locator('visible=true');
    await expect(add).toHaveText('Adaugă o recenzie', { timeout: 30_000 });
    await expect(add).toHaveAttribute('href', form);
    await add.click();
    await expect(page).toHaveURL(`${BASE}${form}`);

    // c1 — title, the lake as the eyebrow, the back control.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Adaugă o recenzie');
    await expect(page.getByText(lakeName, { exact: true }).locator('visible=true').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    // c2 — the heading and three whole-star groups at 5.
    await expect(page.getByRole('heading', { name: 'Cum evaluezi această baltă?' })).toBeVisible();
    for (const name of ['Pescuit', 'Facilități', 'Atmosferă']) {
      await expect(group(page, name).getByRole('radio')).toHaveCount(5);
      await expect(star(page, name, 5)).toBeChecked();
    }
    // c3 placeholder, c4 recommended by default, c5 the CTA's words.
    const text = page.getByPlaceholder('Împărtășiți cu noi experiența dvs.');
    await expect(text).toHaveValue('');
    const recommend = page.getByRole('checkbox', { name: 'Recomand această baltă' });
    await expect(recommend).toBeChecked();
    const submit = page.getByTestId('review-submit');
    await expect(submit).toHaveText('Adaugă o recenzie');
    await settle(page);
    await expectNoA11yViolations(page);

    // c3 — fish's three messages; the field takes focus on a refused submit, then re-validates live.
    await submit.click();
    await expect(page.getByText('Pentru o experiență mai bună, te rugăm să lași un comentariu.')).toBeVisible();
    await expect(text).toBeFocused();
    await expect(text).toHaveAttribute('aria-invalid', 'true');
    await text.fill('   scurt   ');
    await expect(page.getByText('Acest câmp trebuie să aibă cel puțin 10 caractere')).toBeVisible();
    await text.fill('x'.repeat(2001));
    await expect(page.getByText('Acest câmp trebuie să aibă cel mult 2000 de caractere')).toBeVisible();
    await expectNoA11yViolations(page);
    await text.fill(comment);
    await expect(page.getByText(/Acest câmp trebuie|Pentru o experiență/)).toHaveCount(0);

    // c2 — keyboard: Tab-reachable radio group, arrows move and choose; the ring is keyboard-only.
    await star(page, 'Pescuit', 5).focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(star(page, 'Pescuit', 3)).toBeChecked();
    await expect(star(page, 'Pescuit', 3)).toBeFocused();
    expect(await star(page, 'Pescuit', 3).evaluate(el => getComputedStyle(el.nextElementSibling as Element).outlineStyle)).toBe('solid');
    // A pointer pick: the second star of Facilități; the minimum stays 1 (there is no «0»).
    await star(page, 'Facilități', 2).click();
    await expect(star(page, 'Facilități', 2)).toBeChecked();
    expect(await star(page, 'Facilități', 2).evaluate(el => getComputedStyle(el.nextElementSibling as Element).outlineStyle)).toBe('none');
    await star(page, 'Atmosferă', 1).click();
    await expect(star(page, 'Atmosferă', 1)).toBeChecked();
    await star(page, 'Atmosferă', 4).click();
    // c4 — the checkbox toggles.
    // (the card is the target: the native checkbox inside it is visually hidden, as in every T4 choice)
    await page.getByText('Recomand această baltă', { exact: true }).click();
    await expect(recommend).not.toBeChecked();

    // c5 + c6 — the real POST (held 1.2s so the sending state is seen): body, spinner, disabled.
    await page.route(url => url.pathname.endsWith(`/lakes/${LAKE}/review`), async route => {
      if (route.request().method() === 'POST') await new Promise(r => setTimeout(r, 1200));
      return route.continue();
    });
    const post = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname.endsWith(`/lakes/${LAKE}/review`));
    await submit.click();
    const body = (await post).postDataJSON() as { data: Record<string, unknown> };
    expect(body.data).toEqual({ quality: 3, facilities: 2, atmosphere: 4, recommendToOthers: false, comment });
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByText('Recenzia a fost adăugată cu succes!')).toBeVisible({ timeout: 30_000 });
    // Back to /recenzii (the page it came from) — c9: the list, my review and the lake re-read.
    await expect(page).toHaveURL(`${BASE}/balti/${LAKE}/recenzii`);
    const mine = page.getByTestId('reviews-list').getByTestId('lake-review').filter({ hasText: comment });
    await expect(mine).toHaveCount(1, { timeout: 30_000 });
    await expect(page.getByTestId('review-add')).toHaveCount(0);
    await expect(page.getByTestId('reviews-count')).toHaveText('1 recenzie');

    // lakes.b.review-invalidation / c9 — the lake page is static (cached reads tagged lake-<id>):
    // the write expired them (updateTag), so it shows the review at once, not the old «no reviews».
    await go(page, `/balti/${LAKE}`);
    const section = page.locator('#recenzii');
    await expect(section.getByText('1 recenzie', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(section.getByText(comment)).toBeVisible({ timeout: 30_000 });
    await expect(section.getByText('Această baltă nu are încă recenzii.')).toHaveCount(0);
    await go(page, `/balti/${LAKE}/recenzii`);
    await expect(mine).toHaveCount(1, { timeout: 30_000 });

    // lakes.reviews.c6 — «Editează» on the own card is the form in edit mode.
    const editLink = mine.getByTestId('review-edit');
    await expect(editLink).toHaveAttribute('href', `${form}?editare=1`);
    await editLink.click();
    await expect(page).toHaveURL(`${BASE}${form}?editare=1`);
    // c1 + c7 — the edit title and every field prefilled.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editează recenzia');
    await expect(star(page, 'Pescuit', 3)).toBeChecked();
    await expect(star(page, 'Facilități', 2)).toBeChecked();
    await expect(star(page, 'Atmosferă', 4)).toBeChecked();
    await expect(page.getByPlaceholder('Împărtășiți cu noi experiența dvs.')).toHaveValue(comment);
    await expect(page.getByRole('checkbox', { name: 'Recomand această baltă' })).not.toBeChecked();
    await expect(page.getByTestId('review-submit')).toHaveText('Editează recenzia');

    // c8 — the real PUT; success toast, back to the list with the new text.
    await page.getByPlaceholder('Împărtășiți cu noi experiența dvs.').fill(edited);
    await page.getByText('Recomand această baltă', { exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Recomand această baltă' })).toBeChecked();
    const put = page.waitForRequest(r => r.method() === 'PUT' && new URL(r.url()).pathname.endsWith(`/lakes/${LAKE}/review`));
    await page.getByTestId('review-submit').click();
    expect(((await put).postDataJSON() as { data: Record<string, unknown> }).data).toEqual({
      quality: 3,
      facilities: 2,
      atmosphere: 4,
      recommendToOthers: true,
      comment: edited,
    });
    await expect(page.getByText('Recenzia a fost editată cu succes!')).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(`${BASE}/balti/${LAKE}/recenzii`);
    await expect(page.getByTestId('reviews-list').getByTestId('lake-review').filter({ hasText: edited })).toHaveCount(1, { timeout: 30_000 });

    // The CMS has it as edited.
    const stored = await getReviewForLakeByAuthorId(t, { lakeId: LAKE });
    expect(stored?.comment).toBe(edited);
    expect(stored?.recommendToOthers).toBe(true);

    // The lake page follows the edit too.
    await go(page, `/balti/${LAKE}`);
    await expect(page.locator('#recenzii').getByText(edited)).toBeVisible({ timeout: 30_000 });

    // The delete (lakes.reviews c7) through the page: the lake page goes back to «no reviews».
    await go(page, `/balti/${LAKE}/recenzii`);
    const own = page.getByTestId('reviews-list').getByTestId('lake-review').filter({ hasText: edited });
    await own.getByTestId('review-delete').click();
    await page.getByTestId('review-delete-confirm').click();
    await expect(page.getByText('Recenzia ta a fost ștearsă cu succes.')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => getReviewForLakeByAuthorId(t, { lakeId: LAKE }), { timeout: 15_000 }).toBeNull();
    await go(page, `/balti/${LAKE}`);
    await expect(page.locator('#recenzii').getByText('Această baltă nu are încă recenzii.')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#recenzii').getByText(edited)).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    const left = await getReviewForLakeByAuthorId(t, { lakeId: LAKE }).catch(() => null);
    if (left?.documentId) await deleteReview(t, left.documentId, LAKE);
    const after = await getReviewForLakeByAuthorId(t, { lakeId: LAKE });
    expect(after, 'the e2e review is deleted').toBeNull();
  }
});

test('lakes.review-form.c6 — from a completed booking (?rezervare=): the POST carries the booking (verified); a refused POST shows its message', async ({ page, context }) => {
  await signIn(context, jwt, BASE);
  await page.route(cms('/feed/reviews/mine'), route => json(route, { data: null }));
  const bodies: Record<string, unknown>[] = [];
  let refuse = true;
  await page.route(url => url.pathname.endsWith(`/lakes/${LAKE}/review`), route => {
    if (route.request().method() !== 'POST') return route.continue();
    bodies.push((route.request().postDataJSON() as { data: Record<string, unknown> }).data);
    return refuse
      ? // A CMS refusal with its own copy (bluCode): the toast shows that message.
        json(route, { data: null, error: { status: 400, name: 'ValidationError', message: 'Ai lăsat deja o recenzie pentru această baltă.', details: { bluCode: 'REVIEW_EXISTS' } } }, 400)
      : json(route, { data: { documentId: 'rev-mocked' } });
  });
  await go(page, `${form}?rezervare=bk-e2e`);
  await page.getByPlaceholder('Împărtășiți cu noi experiența dvs.').fill('O tură foarte reușită la stand.');
  // Failure → the error toast with the message; the form stays.
  await page.getByTestId('review-submit').click();
  await expect(page.getByRole('alert').filter({ hasText: 'Ai lăsat deja o recenzie pentru această baltă.' })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(`${BASE}${form}?rezervare=bk-e2e`);
  await expect(page.getByTestId('review-submit')).toBeEnabled();
  // Success → the booking id rides in the body; the toast; the form closes (no history here: the reviews).
  refuse = false;
  await page.getByTestId('review-submit').click();
  await expect(page.getByText('Recenzia a fost adăugată cu succes!')).toBeVisible({ timeout: 30_000 });
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual({ quality: 5, facilities: 5, atmosphere: 5, recommendToOthers: true, comment: 'O tură foarte reușită la stand.', booking: 'bk-e2e' });
  await expect(page).toHaveURL(`${BASE}/balti/${LAKE}/recenzii`, { timeout: 30_000 });
});

test('lakes.review-form.c8 — a failed edit rolls the optimistic change back (my review, the list) and shows the error', async ({ page, context }) => {
  await signIn(context, jwt, BASE);
  const own = ownReview();
  // After the failed PUT the re-reads hang: what the list shows then is the cache — rolled back or not.
  let hold = false;
  const hang = () => new Promise<void>(() => {});
  await page.route(cms('/feed/reviews/mine'), async route => {
    if (hold) await hang();
    return json(route, { data: own });
  });
  await page.route(cms(`/feed/lakes/${LAKE}/reviews`), async route => {
    if (hold) await hang();
    return json(route, { data: [own], meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: 1 } } });
  });
  await page.route(url => url.pathname.endsWith(`/lakes/${LAKE}/review`), async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    await new Promise(r => setTimeout(r, 600));
    hold = true;
    return json(route, { data: null, error: { status: 500, name: 'InternalServerError', message: 'Serverul a refuzat modificarea.', details: { bluCode: 'E2E_REFUSED' } } }, 500);
  });
  // The list's server copy has no review (the lake has none): the dev-only fault switch fails the
  // server read, so the browser reads the list — the mock.
  await faults(page, ['reviews-page']);
  try {
    await go(page, `/balti/${LAKE}/recenzii`);
  } finally {
    await faults(page, []);
  }
  const card = page.getByTestId('reviews-list').getByTestId('lake-review').filter({ hasText: own.comment });
  await expect(card).toHaveCount(1, { timeout: 30_000 });
  await card.getByTestId('review-edit').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editează recenzia');
  await expect(page.getByPlaceholder('Împărtășiți cu noi experiența dvs.')).toHaveValue(own.comment);
  await page.getByPlaceholder('Împărtășiți cu noi experiența dvs.').fill('Text care nu ajunge niciodată în CMS.');
  await page.getByTestId('review-submit').click();
  await expect(page.getByRole('alert').filter({ hasText: 'Serverul a refuzat modificarea.' })).toBeVisible({ timeout: 30_000 });
  // The form stays (fish keeps it open), enabled again.
  await expect(page).toHaveURL(`${BASE}${form}?editare=1`);
  await expect(page.getByTestId('review-submit')).toBeEnabled();
  // Back on the list: the cached card is the original again (rolled back), not the optimistic text.
  await page.getByRole('button', { name: 'Înapoi' }).click();
  await expect(page).toHaveURL(`${BASE}/balti/${LAKE}/recenzii`);
  await expect(page.getByTestId('reviews-list').getByTestId('lake-review').filter({ hasText: own.comment })).toHaveCount(1);
  await expect(page.getByTestId('reviews-list').getByText('Text care nu ajunge niciodată în CMS.')).toHaveCount(0);
});

test('lakes.review-form.c7 — edit: the spinner while my review loads, the error copy with a retry, then the prefilled form', async ({ page, context }) => {
  await signIn(context, jwt, BASE);
  const errors = collectConsoleErrors(page);
  let mode: 'slow' | 'fail' | 'ok' = 'slow';
  await page.route(cms('/feed/reviews/mine'), async route => {
    if (mode === 'slow') {
      await new Promise(r => setTimeout(r, 2500));
      mode = 'fail';
      return route.abort();
    }
    if (mode === 'fail') return route.abort();
    return json(route, { data: ownReview() });
  });
  await go(page, `${form}?editare=1`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editează recenzia');
  await expect(page.getByTestId('review-form-loading')).toHaveText('Se încarcă recenzia ta…');
  // TanStack retries 3 times by default (fish too) — then the error.
  const gate = page.getByRole('alert').filter({ hasText: 'A apărut o eroare, te rugăm să încerci mai târziu' });
  await expect(gate).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('review-submit')).toHaveCount(0);
  await expectNoA11yViolations(page);
  mode = 'ok';
  await gate.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByPlaceholder('Împărtășiți cu noi experiența dvs.')).toHaveValue(ownReview().comment, { timeout: 30_000 });
  await expect(star(page, 'Pescuit', 4)).toBeChecked();
  await expect(star(page, 'Facilități', 2)).toBeChecked();
  await expect(star(page, 'Atmosferă', 3)).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Recomand această baltă' })).not.toBeChecked();
  expect(errors).toEqual([]);
});

test('lakes.review-form — web divergences: add with an own review → the edit mode; edit with none → the add mode (keeping ?rezervare=)', async ({ page, context }) => {
  await signIn(context, jwt, BASE);
  let own: unknown = ownReview();
  await page.route(cms('/feed/reviews/mine'), route => json(route, { data: own }));
  await go(page, `${form}?rezervare=bk-e2e`);
  await expect(page).toHaveURL(`${BASE}${form}?editare=1&rezervare=bk-e2e`, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editează recenzia');
  await expect(page.getByPlaceholder('Împărtășiți cu noi experiența dvs.')).toHaveValue(ownReview().comment);
  own = null;
  await go(page, `${form}?editare=1`);
  await expect(page).toHaveURL(`${BASE}${form}`, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Adaugă o recenzie');
  await expect(page.getByPlaceholder('Împărtășiți cu noi experiența dvs.')).toHaveValue('');

  // An edit link from a booking with no review to edit: the add mode keeps the booking, and the POST
  // carries it (verified) — the edit mode never sends it.
  const bodies: Record<string, unknown>[] = [];
  await page.route(url => url.pathname.endsWith(`/lakes/${LAKE}/review`), route => {
    if (route.request().method() !== 'POST') return route.continue();
    bodies.push((route.request().postDataJSON() as { data: Record<string, unknown> }).data);
    return json(route, { data: { documentId: 'rev-mocked' } });
  });
  await go(page, `${form}?editare=1&rezervare=bk-e2e`);
  await expect(page).toHaveURL(`${BASE}${form}?rezervare=bk-e2e`, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Adaugă o recenzie');
  await page.getByPlaceholder('Împărtășiți cu noi experiența dvs.').fill('Am venit de la rezervare, totul a fost bine.');
  await page.getByTestId('review-submit').click();
  await expect(page.getByText('Recenzia a fost adăugată cu succes!')).toBeVisible({ timeout: 30_000 });
  expect(bodies).toHaveLength(1);
  expect(bodies[0]?.booking).toBe('bk-e2e');
});

test('lakes.review-form — layout: one column on a phone with the CTA pinned; from 1280 the lake card on the right, the CTA under it', async ({ page, context }) => {
  await signIn(context, jwt, BASE);
  await page.route(cms('/feed/reviews/mine'), route => json(route, { data: null }));
  await go(page, form);
  await expect(page.getByTestId('review-submit')).toBeVisible();
  await expect(page.getByTestId('review-lake-summary')).toBeHidden();
  const bar = await page.getByTestId('review-submit').boundingBox();
  expect(bar!.y + bar!.height).toBeGreaterThan(PHONE.height - 100);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
  await page.setViewportSize(LAPTOP);
  const summary = page.getByTestId('review-lake-summary');
  await expect(summary).toBeVisible();
  await expect(summary.getByRole('heading', { name: lakeName })).toBeVisible();
  await expect(summary.getByRole('link', { name: lakeName })).toHaveAttribute('href', `/balti/${LAKE}`);
  const s = (await summary.boundingBox())!;
  const cta = (await page.getByTestId('review-submit').boundingBox())!;
  const rating = (await group(page, 'Pescuit').boundingBox())!;
  expect(s.x).toBeGreaterThan(rating.x + rating.width);
  expect(cta.y).toBeGreaterThan(s.y + s.height - 1);
  await settle(page);
  await expectNoA11yViolations(page);
});

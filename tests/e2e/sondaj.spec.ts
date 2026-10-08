import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';
import { POLLS_PAST_ON_WEB } from '../../app/(site)/sondaje/_components/model';

/*
 * participant.poll-current — /sondaje, «Sondaj» (T6; fish app/(app)/polls/current.tsx,
 * components/PollOption.tsx, PollSuggestInput.tsx, PollSuggestionSentSheet.tsx, helpers/sharePoll.ts)
 * + participant.b.poll-notification-route, b.poll-deeplink, b.poll-signin-redirect, home.acasa.c34.
 *
 * NOTHING is written: the local CMS's poll is closed, so every open / voted / none / guest state is
 * a route mock of GET /api/cms/polls/current, and PUT /polls/{id}/vote and POST /polls/{id}/suggest
 * are mocked too (their bodies asserted). One test reads the real local poll signed in (c13).
 */

const SHOTS = '.shots/sondaj';
mkdirSync(SHOTS, { recursive: true });
const WIDTHS = [375, 768, 1280, 1440, 1920] as const;
/** Mocked failures the specs provoke on purpose are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (400|500)/];

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

type Option = { id: number; documentId: string; title: string; description: string | null; order: number; votesCount: number; suggestedBy: { id: number; name: string } | null };
type Poll = {
  id: number;
  documentId: string;
  title: string;
  description: string | null;
  closesAt: string | null;
  votingClosed: boolean;
  totalVotes: number;
  myVoteOptionId: number | null;
  options: Option[];
};

const IN_5_DAYS = new Date(Date.now() + 5 * 86_400_000 + 3_600_000).toISOString();

/** Admin order ≠ vote order on purpose (c5): Somn first by order, Crap first by votes. */
function openPoll(over: Partial<Poll> = {}): Poll {
  return {
    id: 7,
    documentId: 'e2e-poll',
    title: 'Ce specie vrei la următorul concurs?',
    description: 'Votul închide pe 20 octombrie. Câștigătoarea devine tema concursului de toamnă.',
    closesAt: IN_5_DAYS,
    votingClosed: false,
    totalVotes: 21,
    myVoteOptionId: null,
    options: [
      { id: 11, documentId: 'o11', title: 'Somn', description: null, order: 1, votesCount: 4, suggestedBy: null },
      { id: 12, documentId: 'o12', title: 'Crap', description: 'Concurs de 48 de ore, pe standuri trase la sorți.', order: 2, votesCount: 12, suggestedBy: null },
      { id: 13, documentId: 'o13', title: 'Știucă', description: null, order: 3, votesCount: 4, suggestedBy: { id: 5, name: 'Ion Popescu' } },
      { id: 14, documentId: 'o14', title: 'Caras', description: null, order: 4, votesCount: 1, suggestedBy: null },
    ],
    ...over,
  };
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type MockOpts = {
  /** null = no active poll. */
  poll: Poll | null;
  delayMs?: number;
  voteStatus?: number;
  suggestStatus?: number;
};

/**
 * GET /polls/current answers the mock's live state; a successful vote updates it (the server's
 * truth the settle refetch reads back). Returns the write bodies.
 */
async function mockPoll(page: Page, opts: MockOpts) {
  let state = opts.poll ? structuredClone(opts.poll) : null;
  const votes: { url: string; body: unknown }[] = [];
  const suggestions: { url: string; body: unknown }[] = [];
  let gets = 0;
  await page.route('**/api/cms/polls/current', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    gets += 1;
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    return json(route, { data: state });
  });
  await page.route(/\/api\/cms\/polls\/[^/]+\/vote$/, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    const body = route.request().postDataJSON() as { optionId: number };
    votes.push({ url: route.request().url(), body });
    // Slow enough to see the optimistic update before the refetch.
    await new Promise((r) => setTimeout(r, 400));
    if (opts.voteStatus && opts.voteStatus >= 400) return json(route, { data: null, error: { status: opts.voteStatus, message: 'x' } }, opts.voteStatus);
    if (state) {
      const prev = state.myVoteOptionId;
      state = {
        ...state,
        myVoteOptionId: body.optionId,
        totalVotes: prev === null ? state.totalVotes + 1 : state.totalVotes,
        options: state.options.map((o) => (o.id === body.optionId ? { ...o, votesCount: o.votesCount + 1 } : o.id === prev ? { ...o, votesCount: o.votesCount - 1 } : o)),
      };
    }
    return json(route, { ok: true });
  });
  await page.route(/\/api\/cms\/polls\/[^/]+\/suggest$/, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    suggestions.push({ url: route.request().url(), body: route.request().postDataJSON() });
    await new Promise((r) => setTimeout(r, 300));
    if (opts.suggestStatus && opts.suggestStatus >= 400) return json(route, { data: null, error: { status: opts.suggestStatus, message: 'x' } }, opts.suggestStatus);
    return json(route, { ok: true });
  });
  return { votes, suggestions, gets: () => gets };
}

async function collectAnalytics(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __events: unknown[] }).__events = [];
    window.addEventListener('bluvi:analytics', (e) => (window as unknown as { __events: unknown[] }).__events.push((e as CustomEvent).detail));
  });
  return () => page.evaluate(() => (window as unknown as { __events: { name: string; params: Record<string, unknown> }[] }).__events);
}

async function open(page: Page, { width = 375, signedIn = true, path = '/sondaje' }: { width?: number; signedIn?: boolean; path?: string } = {}) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  if (signedIn) await signIn(page.context(), jwt);
  await page.goto(path);
}

const h1 = (page: Page) => page.getByRole('heading', { level: 1, name: 'Sondaj' });
const pollTitle = (page: Page, name = 'Ce specie vrei la următorul concurs?') => page.getByRole('heading', { level: 2, name });
const options = (page: Page) => page.getByRole('list', { name: 'Opțiuni' }).locator(':scope > li');
const option = (page: Page, title: string) => page.locator('[data-poll-option]').filter({ has: page.getByText(title, { exact: true }) });
const control = (page: Page, title: string) => option(page, title).locator('[data-poll-control]');
const suggestField = (page: Page) => page.getByRole('textbox', { name: 'Sugerează o opțiune' });

/** ≥768: the poll card starts on the header's left edge (the back chip), at every width. */
async function expectBodyOnHeaderEdge(page: Page) {
  const back = await page.getByRole('link', { name: 'Înapoi' }).boundingBox();
  const card = await page.locator('section[aria-labelledby="sondaj-poll-title"], [data-poll-skeleton]').first().boundingBox();
  expect(back && card).toBeTruthy();
  expect(Math.abs(card!.x - back!.x)).toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(700); // the fill bar's grow
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()!.width}.png`, fullPage: true });
}

test.describe('participant.poll-current', () => {
  test('c1 c4 c5 c6 — header, heading, options sorted by votes, chip, %, counts, my vote with its bar', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockPoll(page, { poll: openPoll({ myVoteOptionId: 12 }) });
    await open(page);
    await expect(h1(page)).toBeVisible();
    await expect(pollTitle(page)).toBeVisible();
    await expect(page.getByText('Votul închide pe 20 octombrie.', { exact: false })).toBeVisible();
    // c1: back, «Sondaje anterioare» (only once that page exists, rule 4), share (a poll exists).
    // No breadcrumb band: the header's back owns it.
    await expect(page.getByRole('link', { name: 'Înapoi' })).toHaveAttribute('href', '/');
    if (POLLS_PAST_ON_WEB) await expect(page.getByRole('link', { name: 'Sondaje anterioare' })).toHaveAttribute('href', '/sondaje/anterioare');
    else await expect(page.locator('a[href="/sondaje/anterioare"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Distribuie sondajul' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Cale de navigare' })).toHaveCount(0);
    // c5: most votes first, ties by admin order (Somn order 1 before Știucă order 3, both 4 votes).
    const titles = await options(page).locator('.t-heading:not(.tabular-nums)').allTextContents();
    expect(titles).toEqual(['Crap', 'Somn', 'Știucă', 'Caras']);
    // c6: «{p}%», «{n} vot/voturi», «Sugerat de», description.
    await expect(option(page, 'Crap')).toContainText('57%');
    await expect(option(page, 'Crap')).toContainText('12 voturi');
    await expect(option(page, 'Caras')).toContainText('5%');
    await expect(option(page, 'Caras')).toContainText('1 vot');
    await expect(option(page, 'Știucă').getByText('Sugerat de Ion Popescu')).toBeVisible();
    await expect(option(page, 'Crap').getByText('Concurs de 48 de ore, pe standuri trase la sorți.')).toBeVisible();
    // The facts line: plural with «de» and the closing time.
    await expect(page.getByText(/^21 de voturi · se închide în 5 zile$/)).toBeVisible();
    // My vote: pressed, 2px border, its bar grown to its share.
    await expect(control(page, 'Crap')).toHaveAttribute('aria-pressed', 'true');
    await expect(control(page, 'Somn')).toHaveAttribute('aria-pressed', 'false');
    // …and said in words (the same row is read-only on the past polls, where nothing is «pressed»).
    await expect(control(page, 'Crap')).toHaveAccessibleName(/^Crap ?, votul tău/);
    await expect(control(page, 'Somn')).not.toHaveAccessibleName(/votul tău/);
    await expect
      .poll(() => option(page, 'Crap').locator('[data-poll-bar]').evaluate((el) => (el as HTMLElement).style.width))
      .toBe('57%');
    await expect(option(page, 'Somn').locator('[data-poll-bar]')).toHaveCount(0);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('c2 — loading keeps the header, the body says «Se încarcă...»', async ({ page }) => {
    await mockPoll(page, { poll: openPoll(), delayMs: 2500 });
    await open(page);
    await expect(h1(page)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Se încarcă...' })).toHaveCount(1);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(1);
    for (const w of [375, 1280]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.screenshot({ path: `${SHOTS}/loading-${w}.png`, fullPage: true });
    }
    // 1280: the skeleton has the loaded geometry — the poll track on the header's edge, the grey
    // aside beside it, no header chips (decided by the viewport, so none appears and then goes).
    const skeleton = await page.locator('[data-poll-skeleton]').boundingBox();
    const asideSkeleton = await page.locator('[data-poll-skeleton-aside]').boundingBox();
    expect(asideSkeleton?.width).toBe(360);
    await expectBodyOnHeaderEdge(page);
    await expect(page.getByRole('button', { name: 'Distribuie sondajul' })).toBeHidden();
    await expect(pollTitle(page)).toBeVisible({ timeout: 10_000 });
    const loaded = await page.locator('section[aria-labelledby="sondaj-poll-title"]').boundingBox();
    const aside = await page.getByRole('complementary', { name: 'Despre sondaj' }).boundingBox();
    expect(loaded?.x).toBe(skeleton?.x);
    expect(loaded?.width).toBe(skeleton?.width);
    expect(aside?.x).toBe(asideSkeleton?.x);
    // Share is in the aside; the header still has no chip.
    await expect(page.getByRole('button', { name: 'Distribuie sondajul' })).toHaveCount(1);
  });

  test('c3 — no active poll: copy, link to the past polls, no share', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockPoll(page, { poll: null });
    await open(page);
    await expect(page.getByRole('heading', { name: 'Niciun sondaj activ' })).toBeVisible();
    await expect(page.getByText('Revino mai târziu pentru următorul sondaj al comunității.')).toBeVisible();
    if (POLLS_PAST_ON_WEB) await expect(page.getByRole('link', { name: 'Vezi sondajele anterioare' })).toHaveAttribute('href', '/sondaje/anterioare');
    else await expect(page.locator('a[href="/sondaje/anterioare"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Distribuie sondajul' })).toHaveCount(0);
    await expectNoA11yViolations(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'none');
    }
    expect(errors).toEqual([]);
  });

  test('c7 c8 c9 c15 — select, deselect, vote (optimistic), switch (dashed), analytics', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const events = await collectAnalytics(page);
    const mock = await mockPoll(page, { poll: openPoll() });
    await open(page);
    await expect(pollTitle(page)).toBeVisible();
    // c15 poll_view once.
    await expect.poll(async () => (await events()).filter((e) => e.name === 'poll_view')).toEqual([
      { name: 'poll_view', params: { poll_document_id: 'e2e-poll', voting_closed: false, has_voted: false } },
    ]);
    // Select → pending (tinted, dashed on a non-voted row), «Votează» replaces the share.
    await control(page, 'Somn').click();
    const vote = option(page, 'Somn').getByRole('button', { name: 'Votează' });
    await expect(vote).toBeVisible();
    await expect(option(page, 'Somn')).not.toContainText('19%');
    await expect(option(page, 'Somn')).toHaveCSS('border-style', 'dashed');
    await shot(page, 'pending');
    // The pending option again → deselects.
    await control(page, 'Somn').click();
    await expect(page.getByRole('button', { name: 'Votează' })).toHaveCount(0);
    // Vote: PUT /polls/{documentId}/vote {optionId}, optimistic +1 and +1 total before the answer.
    await control(page, 'Somn').click();
    await option(page, 'Somn').getByRole('button', { name: 'Votează' }).click();
    await expect(option(page, 'Somn')).toContainText('5 voturi');
    await expect(page.getByText(/^22 de voturi/)).toBeVisible();
    await expect.poll(() => mock.votes.length).toBe(1);
    expect(mock.votes[0].url).toMatch(/\/api\/cms\/polls\/e2e-poll\/vote$/);
    expect(mock.votes[0].body).toEqual({ optionId: 11 });
    await expect(control(page, 'Somn')).toHaveAttribute('aria-pressed', 'true');
    // Settled: refetched (the mock's truth), still my vote; focus back on the option.
    await expect.poll(() => mock.gets()).toBeGreaterThan(1);
    await expect(control(page, 'Somn')).toHaveAttribute('aria-pressed', 'true');
    // My current vote with nothing pending → nothing.
    await control(page, 'Somn').click();
    await expect(page.getByRole('button', { name: /^(Votează|Schimbă votul)$/ })).toHaveCount(0);
    // Switch: «Schimbă votul», dashed; moves one vote, total unchanged.
    await control(page, 'Caras').click();
    await expect(option(page, 'Caras')).toHaveCSS('border-style', 'dashed');
    await option(page, 'Caras').getByRole('button', { name: 'Schimbă votul' }).click();
    await expect(option(page, 'Caras')).toContainText('2 voturi');
    await expect(option(page, 'Somn')).toContainText('4 voturi');
    await expect(page.getByText(/^22 de voturi/)).toBeVisible();
    await expect.poll(() => mock.votes.length).toBe(2);
    expect(mock.votes[1].body).toEqual({ optionId: 14 });
    const votesLogged = (await events()).filter((e) => e.name.startsWith('poll_vote'));
    expect(votesLogged).toEqual([
      { name: 'poll_vote', params: { poll_document_id: 'e2e-poll', option_id: 11 } },
      { name: 'poll_vote_change', params: { poll_document_id: 'e2e-poll', option_id: 14 } },
    ]);
    expect((await events()).filter((e) => e.name === 'poll_view')).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('c9 — a failed vote rolls back and says so', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockPoll(page, { poll: openPoll(), voteStatus: 500 });
    await open(page);
    await control(page, 'Somn').click();
    await option(page, 'Somn').getByRole('button', { name: 'Votează' }).click();
    await expect(option(page, 'Somn')).toContainText('5 voturi');
    await expect(page.getByText('Votul nu a fost înregistrat. Încearcă din nou.')).toBeVisible();
    await expect(option(page, 'Somn')).toContainText('4 voturi');
    await expect(control(page, 'Somn')).toHaveAttribute('aria-pressed', 'false');
    expect(errors).toEqual([]);
  });

  test('c7 — voting closed: dimmed, clicks do nothing, no suggestion row', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const mock = await mockPoll(page, { poll: openPoll({ votingClosed: true, myVoteOptionId: 13 }) });
    await open(page);
    await expect(pollTitle(page)).toBeVisible();
    await expect(page.getByText(/^21 de voturi · Vot închis$/)).toBeVisible();
    // aria-disabled (still focusable, still clickable): the click must do nothing.
    await control(page, 'Somn').click({ force: true });
    await expect(page.getByRole('button', { name: /^(Votează|Schimbă votul)$/ })).toHaveCount(0);
    await expect(control(page, 'Somn')).toHaveAttribute('aria-disabled', 'true');
    // A closed row is a result, not a toggle: no aria-pressed; my vote is said in words.
    await expect(page.locator('[data-poll-control][aria-pressed]')).toHaveCount(0);
    await expect(control(page, 'Știucă')).toHaveAccessibleName(/Știucă ?, votul tău/);
    await expect(suggestField(page)).toHaveCount(0);
    expect(mock.votes).toEqual([]);
    await expectNoA11yViolations(page);
    // 375: fish's white screen to the bottom — the poll section reaches the viewport's bottom edge.
    const box = await page.locator('section[aria-labelledby="sondaj-poll-title"]').boundingBox();
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(812 - 1);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'closed');
    }
    expect(errors).toEqual([]);
  });

  test('c7 c10 b.poll-signin-redirect — a guest: options and «Trimite» go to sign-in and back to /sondaje', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockPoll(page, { poll: openPoll() });
    await open(page, { signedIn: false });
    await expect(pollTitle(page)).toBeVisible();
    const optionLinks = page.getByRole('link', { name: /intră în cont ca să votezi/ });
    await expect(optionLinks).toHaveCount(4);
    for (const href of await optionLinks.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) expect(href).toBe('/intra?next=%2Fsondaje');
    await expect(suggestField(page)).toBeDisabled();
    await expect(page.getByRole('link', { name: /^Trimite/ })).toHaveAttribute('href', '/intra?next=%2Fsondaje');
    await expectNoA11yViolations(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'guest');
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await optionLinks.first().click();
    await expect(page).toHaveURL(/\/intra\?next=%2Fsondaje$/);
    expect(errors).toEqual([]);
  });

  test('c10 c11 c15 — suggestion: length gate, POST body, sent dialog, cleared field, analytics', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const events = await collectAnalytics(page);
    const mock = await mockPoll(page, { poll: openPoll() });
    await open(page);
    const field = suggestField(page);
    const send = page.getByRole('button', { name: /^(Trimite|Se trimite…)$/ });
    await expect(field).toHaveAttribute('placeholder', 'Scrie ideea ta...');
    await expect(field).toHaveAttribute('maxlength', '200');
    await expect(send).toBeDisabled();
    await field.fill('  ab  ');
    await expect(send).toBeDisabled();
    await field.fill('  Caras pe feeder  ');
    await expect(send).toBeEnabled();
    await send.click();
    // Sending: field and button off.
    await expect(field).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Se trimite…' })).toBeDisabled();
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog.getByText('Sugestie trimisă!')).toBeVisible();
    await expect(
      dialog.getByText('Sugestia ta a fost trimisă spre verificare. Dacă este aprobată, va fi adăugată ca opțiune în sondaj și vei primi o notificare.'),
    ).toBeVisible();
    expect(mock.suggestions).toHaveLength(1);
    expect(mock.suggestions[0].url).toMatch(/\/api\/cms\/polls\/e2e-poll\/suggest$/);
    expect(mock.suggestions[0].body).toEqual({ text: 'Caras pe feeder' });
    await shot(page, 'suggest-sent');
    await expectNoA11yViolations(page);
    await dialog.getByRole('button', { name: 'Am înțeles' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(field).toHaveValue('');
    expect((await events()).filter((e) => e.name === 'poll_suggest')).toEqual([
      { name: 'poll_suggest', params: { poll_document_id: 'e2e-poll', text_length: 15 } },
    ]);
    expect(errors).toEqual([]);
  });

  test('c11 — a failed suggestion toasts «Nu am putut trimite sugestia.» and keeps the text', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockPoll(page, { poll: openPoll(), suggestStatus: 400 });
    await open(page, { width: 1280 });
    await suggestField(page).fill('Somn la mărgea');
    await page.getByRole('button', { name: 'Trimite' }).click();
    await expect(page.getByText('Nu am putut trimite sugestia.')).toBeVisible();
    await expect(suggestField(page)).toHaveValue('Somn la mărgea');
    expect(errors).toEqual([]);
  });

  test('c12 — ?focus=sugestie focuses the suggestion field once loaded', async ({ page }) => {
    await mockPoll(page, { poll: openPoll(), delayMs: 600 });
    await open(page, { path: '/sondaje?focus=sugestie' });
    await expect(suggestField(page)).toBeFocused();
    await open(page, { width: 1280, path: '/sondaje?focus=sugestie' });
    await expect(suggestField(page)).toBeFocused();
  });

  test('c13 — the real local poll, read signed in through /api/cms (closed locally)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const reads: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/cms/polls/current')) reads.push(r.method());
    });
    await open(page, { width: 1280 });
    await expect(page.getByRole('list', { name: 'Opțiuni' }).or(page.getByRole('heading', { name: 'Niciun sondaj activ' }))).toBeVisible();
    expect(reads).toContain('GET');
    // No polling: nothing more within the 10 s staleness window without a focus.
    const n = reads.length;
    await page.waitForTimeout(3000);
    expect(reads.length).toBe(n);
    // Refetched on focus once stale (TanStack refetchOnWindowFocus, staleTime 10 s).
    await page.waitForTimeout(8000);
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => reads.length).toBeGreaterThan(n);
    if (await page.getByText(/Vot închis$/).count()) {
      await expect(page.locator('[data-poll-control][aria-disabled="true"]').first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('c14 — share: Web Share API text + absolute /sondaje; without it the link is copied', async ({ page }) => {
    await mockPoll(page, { poll: openPoll() });
    await open(page);
    await expect(pollTitle(page)).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: async (d: unknown) => ((window as unknown as { __shared: unknown }).__shared = d) });
    });
    await page.getByRole('button', { name: 'Distribuie sondajul' }).click();
    const shared = (await page.evaluate(() => (window as unknown as { __shared: unknown }).__shared)) as { text: string; url: string };
    expect(shared.text).toBe('Votează în sondajul comunității Bluvi:\n\nCe specie vrei la următorul concurs?');
    expect(shared.url).toMatch(/^https?:\/\/[^/]+\/sondaje$/);
    // Desktop without a share sheet: the aside's button copies the link.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    });
    await page.getByRole('button', { name: 'Distribuie sondajul' }).click();
    await expect(page.getByText('Linkul a fost copiat.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/sondaje$/);
    // Cancelled sheet: silent.
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('x', 'AbortError'); } });
    });
    await page.getByRole('button', { name: 'Distribuie sondajul' }).click();
  });

  test('keyboard — options are buttons: Tab reaches them, arrows move, Enter selects, Enter votes', async ({ page }) => {
    const mock = await mockPoll(page, { poll: openPoll() });
    await open(page, { width: 1280 });
    await expect(pollTitle(page)).toBeVisible();
    await control(page, 'Crap').focus();
    await page.keyboard.press('ArrowDown');
    await expect(control(page, 'Somn')).toBeFocused();
    await page.keyboard.press('End');
    await expect(control(page, 'Caras')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(control(page, 'Crap')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(control(page, 'Caras')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(control(page, 'Crap')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(control(page, 'Somn')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(control(page, 'Somn')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Tab');
    await expect(option(page, 'Somn').getByRole('button', { name: 'Votează' })).toBeFocused();
    await page.keyboard.press('Enter');
    // Focus goes back to the option the vote was cast on.
    await expect(control(page, 'Somn')).toBeFocused();
    await expect.poll(() => mock.votes.length).toBe(1);
  });

  test('states at every width — open, voted, pending (shots + axe)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockPoll(page, { poll: openPoll() });
    await open(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await expect(pollTitle(page)).toBeVisible();
      await shot(page, 'open');
      // ≥1024: the aside with the suggestion card, «Sondaje anterioare» and share; no header chips.
      if (w >= 1024) {
        await expect(page.getByRole('complementary', { name: 'Despre sondaj' })).toBeVisible();
        await expect(page.getByRole('link', { name: /Sondaje anterioare/ })).toHaveCount(POLLS_PAST_ON_WEB ? 1 : 0);
        await expect(page.getByRole('button', { name: 'Distribuie sondajul' })).toHaveCount(1);
        await expectBodyOnHeaderEdge(page);
      }
      await expectNoA11yViolations(page);
    }
    await page.unroute('**/api/cms/polls/current');
    await mockPoll(page, { poll: openPoll({ myVoteOptionId: 12 }) });
    await page.reload();
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await expect(pollTitle(page)).toBeVisible();
      await shot(page, 'voted');
      await expectNoA11yViolations(page);
    }
    expect(errors).toEqual([]);
  });
});

test.describe('poll behaviours', () => {
  test('b.poll-deeplink — /polls/current redirects permanently; /polls/past never lands on a 404', async ({ request }) => {
    const current = await request.get('/polls/current', { maxRedirects: 0 });
    expect(current.status()).toBe(308);
    expect(current.headers().location).toMatch(/\/sondaje$/);
    const past = await request.get('/polls/past', { maxRedirects: 0 });
    if (POLLS_PAST_ON_WEB) {
      expect(past.status()).toBe(308);
      expect(past.headers().location).toMatch(/\/sondaje\/anterioare$/);
      expect((await request.get('/sondaje/anterioare')).status()).not.toBe(404);
    } else {
      // Until /sondaje/anterioare ships: a temporary redirect to the current poll (nothing cached forever).
      expect(past.status()).toBe(307);
      expect(past.headers().location).toMatch(/\/sondaje$/);
    }
    // Wherever /polls/past lands answers.
    expect((await request.get('/polls/past')).status()).toBe(200);
  });

  test('b.poll-notification-route — POLL_* notification rows link /sondaje', async ({ page }) => {
    const types = ['poll-opened', 'poll-closed', 'poll-suggestion-approved'];
    await page.route(/\/api\/cms\/notification-users(\/|\?|$)/, async (r) => {
      const url = new URL(r.request().url());
      if (url.pathname.endsWith('/unread')) return json(r, { count: 0 });
      if (r.request().method() !== 'GET' || !url.pathname.endsWith('/notification-users')) return r.fallback();
      return json(r, {
        data: types.map((type, i) => ({
          id: 900 + i,
          documentId: `poll-row-${i}`,
          read: true,
          readAt: '2026-10-01T10:00:00.000Z',
          notification: { id: 950 + i, documentId: `poll-n-${i}`, title: `Sondaj ${i + 1}`, body: 'Detalii', sentAt: '2026-10-03T18:31:59.032Z', data: { type }, type },
        })),
        meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: 3 } },
      });
    });
    await open(page, { path: '/notificari' });
    for (const i of [1, 2, 3]) await expect(page.getByRole('link', { name: new RegExp(`Sondaj ${i}`) })).toHaveAttribute('href', '/sondaje');
  });

  test('home.acasa.c34 — Acasă «Sugerează o opțiune» opens /sondaje focused on the field', async ({ page }) => {
    const mock = await mockPoll(page, { poll: openPoll({ options: openPoll().options.slice(0, 3) }) });
    await open(page, { path: '/' });
    // Acasă prerenders the local (closed) poll on the server; once stale (10 s) a focus refetches it
    // in the browser, where the open mock answers.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(10_500);
    // A focus until the browser has read the (mocked) poll — one event can land before hydration.
    await expect
      .poll(async () => {
        await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
        return mock.gets();
      })
      .toBeGreaterThan(0);
    const row = page.getByRole('link', { name: /Sugerează o opțiune/ }).locator('visible=true').first();
    await expect(row).toHaveAttribute('href', '/sondaje?focus=sugestie');
    await row.click();
    await expect(page).toHaveURL(/\/sondaje\?focus=sugestie$/);
    await expect(suggestField(page)).toBeFocused();
  });
});

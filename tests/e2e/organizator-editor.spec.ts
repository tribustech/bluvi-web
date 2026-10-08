import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expectNoA11yViolations as scan } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { competitionFixture, draftFixture, expect, mockRead, paginated, S3_IMAGE, signInOrganizer, test } from './helpers/fake-organizer';

/*
 * organizer.rich-text-editor (c1–c9) — the Descriere / Premii / Regulament editor over step 1 of the
 * create-competition wizard (/organizator/concursuri/nou/detalii?editor=descriere|premii|regulament;
 * fish app/(app)/create-competition/rich-text-editor.tsx + RegulationSourcePickerSheet.tsx).
 *
 * NO REAL WRITES, NO PAID CALLS: POST /ai/format-text is ALWAYS route-mocked (a paid model call on
 * the CMS); the auto-save after «Gata» (PUT draft) is route-mocked and asserted; the harness guard
 * aborts and fails on any other write. Reads are fixtures (the draft, the organizer's competitions,
 * the source details) shaped like the real DTOs (helpers/fake-organizer).
 */

test.describe.configure({ timeout: 180_000 });
test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const PHONE = { width: 375, height: 812 };
const LAPTOP = { width: 1280, height: 900 };
const WIDTHS = [PHONE, LAPTOP, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];
const SHOTS = '.shots/organizator-editor';
mkdirSync(SHOTS, { recursive: true });

const DRAFT = '/competitions/organizer/draft';
const LIST = '/competitions/organizer/my-competitions';
const AI = '/ai/format-text';
const ID = 'fx-rte';
const URL = (editor: string, id = ID) => `/organizator/concursuri/nou/detalii?ciorna=${id}&editor=${editor}`;
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (40\d|50\d)/, /ERR_|net::/];

type Values = Record<string, unknown>;
const para = (text: string, extra: Values = {}) => ({ type: 'paragraph', children: [{ type: 'text', text, ...extra }] });
const heading = (text: string, level = 2) => ({ type: 'heading', level, children: [{ type: 'text', text }] });
const list = (items: string[]) => ({ type: 'list', format: 'unordered', children: items.map((t) => ({ type: 'list-item', children: [{ type: 'text', text: t }] })) });

const draft = (over: Values = {}) => ({
  data: draftFixture({
    documentId: ID,
    id: 777,
    name: 'Cupa Editorului',
    lake: null,
    description: [para('Concurs de crap pe Chita Lake, 48 de ore.')],
    reward: null,
    regulation: null,
    ...over,
  }),
});

test.beforeEach(async ({ context, request }) => {
  await signInOrganizer(context, request);
});

/* ── helpers ─────────────────────────────────────────────────────────────────────────────────── */

// A region from 768, a modal dialog below (the full-screen layer, c6 of the review).
const editorRegion = (page: Page, name: string) => page.getByRole('region', { name, exact: true }).or(page.getByRole('dialog', { name, exact: true }));
const content = (page: Page) => page.getByTestId('rte-content');
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Formatare text' });
const panel = (page: Page) => page.locator('dialog[open]').filter({ has: page.getByTestId('rte-copy-panel') });

async function open(page: Page, editor: string, { viewport = LAPTOP, over = {} as Values, id = ID } = {}) {
  await mockRead(page, `${DRAFT}/${id}`, { json: draft({ documentId: id, ...over }) });
  await page.setViewportSize(viewport);
  await page.goto(URL(editor, id), { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('rich-text-editor')).toBeVisible({ timeout: 90_000 });
  await expect(content(page)).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __bluviWizard?: unknown }).__bluviWizard));
}

const formValue = (page: Page, key: string) =>
  page.evaluate((k) => ((window as unknown as { __bluviWizard: { values: () => Record<string, unknown> } }).__bluviWizard.values()[k] ?? '') as string, key);

async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  await page.waitForTimeout(300);
}

async function shots(page: Page, name: string, fullPage = false) {
  const before = page.viewportSize();
  for (const vp of WIDTHS) {
    await page.setViewportSize(vp);
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/${name}-${vp.width}.png`, fullPage });
  }
  if (before) await page.setViewportSize(before);
}

/** The organizer's competitions (my-competitions rows), the current draft among them. */
function sources(n: number) {
  const statuses = ['draft', 'notStarted', 'started', 'completed'] as const;
  return Array.from({ length: n }, (_, i) => {
    const status = statuses[i % 4];
    const base = { documentId: `src${i + 1}`, competitionStatus: status, name: `Cupa sursă ${i + 1}`, startDate: '2026-05-10T05:00:00.000Z' };
    return status === 'draft' ? draftFixture(base) : competitionFixture({ ...base, banner: i === 1 ? S3_IMAGE : null });
  });
}

async function mockSources(page: Page, rows: Values[], { delayMs = 0, status = 200 } = {}) {
  const asked: string[] = [];
  await mockRead(page, LIST, (url) => {
    const p = Number(url.searchParams.get('page') ?? 1);
    const size = Number(url.searchParams.get('pageSize') ?? 10);
    asked.push(`${p}/${size}`);
    return { status, delayMs, json: paginated(rows.slice((p - 1) * size, p * size), { page: p, pageSize: size, total: rows.length }) };
  });
  return asked;
}

/* ============================================================================================== */
/* c1 c3 — header, title, focused editor with its content and the toolbar                       */
/* ============================================================================================== */

test('organizer.rich-text-editor.c1 c3 — header (back · title · «Gata»), the editor focused with the field content, the toolbar', async ({ page, organizer }) => {
  const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await open(page, 'descriere');
  const region = editorRegion(page, 'Descriere');
  await expect(region.getByRole('heading', { level: 2, name: 'Descriere' })).toBeVisible();
  await expect(page.getByTestId('rte-back')).toHaveAccessibleName('Înapoi, fără să aplici modificările');
  await expect(page.getByTestId('rte-done')).toHaveText('Gata');
  // The frame hides its own action bar while the editor is open.
  await expect(page.getByTestId('wizard-next')).toHaveCount(0);

  // c3 — opened with the field's content, focused.
  await expect(content(page)).toHaveText('Concurs de crap pe Chita Lake, 48 de ore.');
  await expect(content(page)).toBeFocused();
  await expect(content(page)).toHaveAttribute('aria-label', 'Descriere');
  // The toolbar: only what Strapi blocks keep.
  await expect(toolbar(page).getByRole('button')).toHaveText(['', '', '', '', '', '', '', '', '']);
  const names = await toolbar(page).getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(names).toEqual(['Anulează', 'Refă', 'Îngroșat', 'Cursiv', 'Titlu 1', 'Titlu 2', 'Titlu 3', 'Listă cu puncte', 'Listă numerotată']);

  // Typing + the toolbar: bold, a heading, a list, undo.
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await toolbar(page).getByRole('button', { name: 'Îngroșat' }).click();
  await expect(toolbar(page).getByRole('button', { name: 'Îngroșat' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.type('Premii mari');
  await toolbar(page).getByRole('button', { name: 'Titlu 2' }).click();
  await expect(content(page).locator('h2 strong')).toHaveText('Premii mari');
  await expect(toolbar(page).getByRole('button', { name: 'Titlu 2' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await toolbar(page).getByRole('button', { name: 'Listă cu puncte' }).click();
  await page.keyboard.type('Locul 1');
  await expect(content(page).locator('ul li')).toHaveText('Locul 1');
  await toolbar(page).getByRole('button', { name: 'Anulează' }).click();
  await expect(content(page)).not.toContainText('Locul 1');
  await toolbar(page).getByRole('button', { name: 'Refă' }).click();
  await expect(content(page).locator('ul li')).toHaveText('Locul 1');
  // Keyboard: one tab stop for the toolbar, arrows move inside it; Tab leaves the text (no list nesting, no trap).
  await toolbar(page).getByRole('button', { name: 'Cursiv' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(toolbar(page).getByRole('button', { name: 'Titlu 1' })).toBeFocused();
  await content(page).click();
  await page.keyboard.press('Tab');
  await expect(content(page)).not.toBeFocused();

  await settle(page);
  await scan(page);
  await shots(page, 'descriere');

  // c1 — back leaves WITHOUT applying: the field keeps its value, nothing is saved.
  await page.getByTestId('rte-back').click();
  await expect(page).not.toHaveURL(/[?&]editor=/);
  await expect(page.getByTestId('step-detalii')).toBeVisible();
  expect(await formValue(page, 'description')).toBe('<p>Concurs de crap pe Chita Lake, 48 de ore.</p>');
  expect(organizer.writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('organizer.rich-text-editor.c1 — title per field; an unknown field falls back to Descriere (phone: full screen)', async ({ page }) => {
  await open(page, 'premii', { viewport: PHONE });
  await expect(editorRegion(page, 'Premii').getByRole('heading', { name: 'Premii' })).toBeVisible();
  // Full screen over the page on a phone.
  const box = await page.getByTestId('rich-text-editor').boundingBox();
  expect(box).toMatchObject({ x: 0, y: 0, width: 375, height: 812 });
  await expect(content(page)).toBeFocused();
  await expect(content(page)).toHaveText('');
  // The empty editor shows fish's example text (never part of the content).
  await expect(content(page)).toHaveAttribute('aria-placeholder', /^Locul 1: trofeu \+ 10\.000 lei\./);
  const ph = await content(page).locator('p').evaluate((p) => getComputedStyle(p, '::before').content);
  expect(ph).toContain('Locul 1: trofeu + 10.000 lei.');
  await settle(page);
  await scan(page);
  await shots(page, 'premii-empty');

  await page.goto(URL('regulament'), { waitUntil: 'domcontentloaded' });
  await expect(editorRegion(page, 'Regulament').getByRole('heading', { name: 'Regulament' })).toBeVisible({ timeout: 60_000 });
  await page.goto(URL('nuExista'), { waitUntil: 'domcontentloaded' });
  await expect(editorRegion(page, 'Descriere').getByRole('heading', { name: 'Descriere' })).toBeVisible({ timeout: 60_000 });
  // A deep link is the wizard's first entry: back drops the param in place.
  await page.getByTestId('rte-back').click();
  await expect(page).toHaveURL(/\/organizator\/concursuri\/nou\/detalii\?ciorna=fx-rte$/);
});

/* ============================================================================================== */
/* c2 — «Gata»                                                                                     */
/* ============================================================================================== */

test('organizer.rich-text-editor.c2 — «Gata» stores the HTML in the field (dirty), auto-saves at once and returns to the step', async ({ page, organizer }) => {
  await organizer.mockWrite('PUT', `${DRAFT}/${ID}`, (w) => ({ json: draft({ regulation: (w.body as { data: Values }).data.regulation }) }));
  // Opened from the step (a pushed entry): «Gata» goes back to it, no dead Back entry.
  await mockRead(page, `${DRAFT}/${ID}`, { json: draft() });
  await page.setViewportSize(LAPTOP);
  await page.goto(`/organizator/concursuri/nou/detalii?ciorna=${ID}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('step-detalii')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('rich-text-regulament').getByRole('button', { name: 'Editează regulament' }).click();
  await expect(page).toHaveURL(/[?&]editor=regulament/);
  await expect(content(page)).toBeFocused({ timeout: 60_000 });

  await page.keyboard.type('Maximum 4 lansete.');
  await toolbar(page).getByRole('button', { name: 'Listă numerotată' }).click();
  await page.getByTestId('rte-done').click();

  await expect(page).not.toHaveURL(/[?&]editor=/);
  await expect(page).toHaveURL(new RegExp(`\\?ciorna=${ID}$`));
  await expect(page.getByTestId('rich-text-regulament-preview')).toContainText('Maximum 4 lansete.');
  expect(await formValue(page, 'regulation')).toBe('<ol><li><p>Maximum 4 lansete.</p></li></ol>');
  // Auto-save at once: the draft PUT carries the field as Strapi blocks.
  await expect.poll(() => organizer.writes.length).toBe(1);
  expect(organizer.writes[0]).toMatchObject({ method: 'PUT', path: `${DRAFT}/${ID}` });
  expect((organizer.writes[0].body as { data: Values }).data.regulation).toEqual([
    { type: 'list', format: 'ordered', children: [{ type: 'list-item', children: [{ type: 'text', text: 'Maximum 4 lansete.' }] }] },
  ]);
  // Back now leaves the wizard step, not into the editor again.
  await page.goBack();
  await expect(page).not.toHaveURL(/[?&]editor=/);
});

/* ============================================================================================== */
/* c4 c5 — the actions row, «Formatează cu AI»                                                     */
/* ============================================================================================== */

test('organizer.rich-text-editor.c4 — «Copiază din altă competiție» only for Descriere / Regulament, «Formatează cu AI» for every field', async ({ page }) => {
  await open(page, 'premii');
  const actions = page.getByTestId('rte-actions');
  await expect(actions.getByRole('button')).toHaveText(['Formatează cu AI']);
  for (const [field, title] of [
    ['descriere', 'Descriere'],
    ['regulament', 'Regulament'],
  ] as const) {
    await page.goto(URL(field), { waitUntil: 'domcontentloaded' });
    await expect(editorRegion(page, title)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('rte-actions').getByRole('button')).toHaveText(['Copiază din altă competiție', 'Formatează cu AI']);
  }
});

test('organizer.rich-text-editor.c5 — AI: nothing on empty text; «Se formatează...» (disabled) → content replaced → «Formatat» 2 s; failure → «Eroare» 2 s', async ({ page, organizer }) => {
  let calls = 0;
  await organizer.mockWrite('POST', AI, (w) => {
    calls += 1;
    return calls === 1
      ? { delayMs: 1200, json: { data: { formatted: `<p>🎣 <strong>Premii</strong></p><ul><li>${(w.body as { text: string }).text}</li></ul>` } } }
      : { status: 500, delayMs: 300, json: { error: { message: 'Serviciul de formatare nu este disponibil.' } } };
  });
  await open(page, 'premii', { viewport: PHONE });
  const ai = page.getByTestId('rte-ai');

  // Empty: nothing happens, no request.
  await ai.click();
  await page.waitForTimeout(400);
  await expect(ai).toHaveText('Formatează cu AI');
  expect(organizer.writes).toEqual([]);

  await content(page).click();
  await page.keyboard.type('locul 1 trofeu');
  await ai.click();
  await expect(ai).toHaveText('Se formatează...');
  await expect(ai).toBeDisabled();
  await expect(page.getByTestId('rte-done')).toBeDisabled();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/ai-loading-375.png` });
  await expect(ai).toHaveText('Formatat');
  await expect(content(page).locator('strong')).toHaveText('Premii');
  await expect(content(page).locator('li')).toHaveText('locul 1 trofeu');
  expect(organizer.writes[0]).toMatchObject({ method: 'POST', path: AI, body: { text: 'locul 1 trofeu' } });
  await page.screenshot({ path: `${SHOTS}/ai-done-375.png` });
  const t0 = Date.now();
  await expect(ai).toHaveText('Formatează cu AI', { timeout: 4000 });
  expect(Date.now() - t0).toBeGreaterThan(1200);

  // Failure: «Eroare» for 2 s, the content stays.
  await ai.click();
  await expect(ai).toHaveText('Eroare');
  await expect(content(page).locator('li')).toHaveText('locul 1 trofeu');
  await page.screenshot({ path: `${SHOTS}/ai-error-375.png` });
  await expect(ai).toHaveText('Formatează cu AI', { timeout: 4000 });
  expect(organizer.writes.map((w) => w.path)).toEqual([AI, AI]);
  expect(organizer.blocked).toEqual([]);
});

/* ============================================================================================== */
/* c6 c7 — the copy panel: hint, count, list (infinite), loading / error / empty                 */
/* ============================================================================================== */

test('organizer.rich-text-editor.c6 c7 — the panel: hint, «N competiții disponibile» (current excluded), 10 per page, more on scroll, «Închide»', async ({ page, organizer }) => {
  // 13 competitions, the current draft (fx-rte) among them on page 1 → 12 available.
  const rows = sources(12);
  rows.splice(3, 0, draftFixture({ documentId: ID, name: 'Cupa Editorului' }));
  const asked = await mockSources(page, rows, { delayMs: 300 });
  await open(page, 'regulament');
  await page.getByTestId('rte-copy').click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText('Copiază din altă competiție');
  await expect(panel(page)).toContainText(
    'Selectează o altă competiție ca să copiezi regulamentul existent, apoi îl poți adapta mai ușor pentru competiția curentă.',
  );
  await expect(page.getByTestId('rte-copy-count')).toHaveText('12 competiții disponibile');
  const items = page.getByTestId('rte-copy-source');
  await expect(items).toHaveCount(9); // page 1: 10 rows minus the current draft
  await expect(page.locator(`[data-testid="rte-copy-source"][data-id="${ID}"]`)).toHaveCount(0);
  // Status badges + date.
  await expect(items.nth(0)).toContainText('Cupa sursă 1');
  await expect(items.nth(0)).toContainText('Ciornă');
  await expect(items.nth(0)).toContainText('10.05.2026');
  await expect(items.nth(1)).toContainText('În viitor');
  await expect(items.nth(2)).toContainText('În curs');
  await expect(items.nth(3)).toContainText('Terminat');
  await settle(page);
  await scan(page);
  await shots(page, 'copy-list');

  // Infinite: scrolling to the end loads page 2.
  await items.last().scrollIntoViewIfNeeded();
  await expect(items).toHaveCount(12);
  await expect(items.last()).toContainText('Cupa sursă 12');
  // Page 1 first; every mount of the list reloads what it holds (fish reloads on each opening; the
  // shots crossed 768, Sheet ⇄ Dialog, which remounts it — and a tall viewport reaches the end).
  expect(asked[0]).toBe('1/10');
  expect([...new Set(asked)].sort()).toEqual(['1/10', '2/10']);

  await page.getByTestId('rte-copy-close').click();
  await expect(panel(page)).toHaveCount(0);
  await expect(content(page)).toBeFocused();
  expect(organizer.writes).toEqual([]);
});

test('organizer.rich-text-editor.c6 — one competition: «1 competiție disponibilă»', async ({ page }) => {
  await mockSources(page, [draftFixture({ documentId: ID }), ...sources(1)]);
  await open(page, 'descriere');
  await page.getByTestId('rte-copy').click();
  await expect(page.getByTestId('rte-copy-count')).toHaveText('1 competiție disponibilă');
  await expect(panel(page)).toContainText('Selectează o altă competiție ca să copiezi descrierea existentă, apoi o poți adapta mai ușor pentru competiția curentă.');
});

test('organizer.rich-text-editor.c7 — loading «Se încarcă competițiile...», error + «Reîncearcă», first competition (empty)', async ({ page }) => {
  let fail = true;
  await mockRead(page, LIST, () => (fail ? { status: 500, delayMs: 1500, json: { error: { status: 500 } } } : { json: paginated([draftFixture({ documentId: ID })], { total: 1 }) }));
  await open(page, 'descriere', { viewport: PHONE });
  await page.getByTestId('rte-copy').click();
  await expect(page.getByTestId('rte-copy-loading')).toContainText('Se încarcă competițiile...');
  // Rule 4: no count while the list has not answered.
  await expect(page.getByTestId('rte-copy-count')).toHaveCount(0);
  await settle(page);
  await shots(page, 'copy-loading');
  await expect(page.getByTestId('rte-copy-error')).toContainText('Nu am putut încărca competițiile. Încearcă din nou.', { timeout: 10_000 });
  await settle(page);
  await scan(page);
  await shots(page, 'copy-error');
  // The shots cross 768 (Sheet ⇄ Dialog): the remounted list refetches the failed query. Let that
  // refetch fail again before the mock turns healthy, so «Reîncearcă» is what brings the list.
  await expect(page.getByTestId('rte-copy-loading')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByTestId('rte-copy-error')).toBeVisible();

  // Retry → the only competition is the current draft: the first-competition copy.
  fail = false;
  await page.getByTestId('rte-copy-error').getByRole('button', { name: 'Reîncearcă' }).click();
  await expect(page.getByTestId('rte-copy-empty')).toHaveText(
    'Ești la prima competiție pe care o creezi în Bluvi și nu avem de unde copia datele.Data viitoare va fi mai ușor.',
  );
  await expect(page.getByTestId('rte-copy-count')).toHaveText('0 competiții disponibile');
  await settle(page);
  await scan(page);
  await shots(page, 'copy-empty');
  await page.getByTestId('rte-copy-close').click();
  await expect(panel(page)).toHaveCount(0);
});

/* ============================================================================================== */
/* c8 c9 — preview and copy                                                                        */
/* ============================================================================================== */

test('organizer.rich-text-editor.c8 c9 — preview (draft source / published source), empty source, error + retry, «Înapoi», «Copiază» into an empty editor', async ({ page, organizer }) => {
  const rows = sources(4);
  await mockSources(page, rows);
  // src1 is a draft → the draft endpoint; src2 (notStarted) → /competitions/organizer/:id.
  await mockRead(page, `${DRAFT}/src1`, { delayMs: 1200, json: { data: { ...rows[0], regulation: [heading('Reguli generale'), list(['Maximum 4 lansete', 'Fără năvod'])] } } });
  await mockRead(page, '/competitions/organizer/src2', { json: { data: { documentId: 'src2', name: 'Cupa sursă 2', competitionStatus: 'notStarted', startDate: '2026-05-10T05:00:00.000Z', description: null, regulation: null } } });
  let src3Fails = true;
  await mockRead(page, '/competitions/organizer/src3', () =>
    src3Fails
      ? { status: 500, json: {} }
      : { json: { data: { documentId: 'src3', name: 'Cupa sursă 3', competitionStatus: 'started', startDate: null, description: null, regulation: [para('Regula din sursa 3.', { bold: true })] } } },
  );
  await open(page, 'regulament', { over: { regulation: null } });
  await page.getByTestId('rte-copy').click();
  const items = page.getByTestId('rte-copy-source');

  // Draft source: loading, then the content; «Copiază» disabled while loading.
  await items.nth(0).click();
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText('Previzualizare regulament');
  await expect(page.getByTestId('rte-copy-source-meta')).toContainText('Cupa sursă 1');
  await expect(page.getByTestId('rte-copy-source-meta')).toContainText('10.05.2026');
  await expect(page.getByTestId('rte-copy-source-meta')).toContainText('Ciornă');
  await expect(page.getByTestId('rte-copy-preview')).toHaveAttribute('data-state', 'loading');
  await expect(page.getByTestId('rte-copy-preview')).toContainText('Se încarcă regulamentul...');
  await expect(page.getByTestId('rte-copy-confirm')).toBeDisabled();
  await settle(page);
  await shots(page, 'copy-preview-loading');
  await expect(page.getByTestId('rte-copy-preview')).toHaveAttribute('data-state', 'content');
  await expect(page.getByTestId('rte-copy-preview').getByRole('heading', { name: 'Reguli generale' })).toBeVisible();
  await expect(page.getByTestId('rte-copy-preview').getByRole('listitem')).toHaveText([/Maximum 4 lansete/, /Fără năvod/]);
  await expect(page.getByTestId('rte-copy-confirm')).toBeEnabled();
  await settle(page);
  await scan(page);
  await shots(page, 'copy-preview');

  // «Înapoi» → the list; a published source without the field: the no-content copy, «Copiază» disabled.
  await page.getByTestId('rte-copy-back').click();
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText('Copiază din altă competiție');
  await items.nth(1).click();
  await expect(page.getByTestId('rte-copy-preview')).toHaveText('Competiția selectată nu are regulament.');
  await expect(page.getByTestId('rte-copy-source-meta')).toContainText('În viitor');
  await expect(page.getByTestId('rte-copy-confirm')).toBeDisabled();
  await settle(page);
  await shots(page, 'copy-preview-empty');

  // An error with «Reîncearcă».
  await page.getByTestId('rte-copy-back').click();
  await items.nth(2).click();
  await expect(page.getByTestId('rte-copy-preview')).toContainText('Nu am putut încărca regulamentul pentru această competiție.');
  await expect(page.getByTestId('rte-copy-confirm')).toBeDisabled();
  await settle(page);
  await scan(page);
  await shots(page, 'copy-preview-error');
  src3Fails = false;
  await page.getByTestId('rte-copy-preview').getByRole('button', { name: 'Reîncearcă' }).click();
  await expect(page.getByTestId('rte-copy-preview')).toContainText('Regula din sursa 3.');
  await expect(page.getByTestId('rte-copy-source-meta')).toContainText('În curs');

  // c9 — the editor is empty: «Copiază» replaces at once (no question) and closes the panel.
  await page.getByTestId('rte-copy-confirm').click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(content(page).locator('p strong')).toHaveText('Regula din sursa 3.');
  expect(organizer.writes).toEqual([]);
});

test('organizer.rich-text-editor.c9 — existing text: «Înlocuiești descrierea?» / «Textul existent va fi înlocuit.»; «Renunță» keeps it, «Copiază» replaces', async ({ page, organizer }) => {
  const rows = sources(2);
  await mockSources(page, rows);
  await mockRead(page, '/competitions/organizer/src2', { json: { data: { documentId: 'src2', name: 'Cupa sursă 2', competitionStatus: 'notStarted', startDate: null, description: [para('Descrierea copiată.')], regulation: null } } });
  await open(page, 'descriere', { viewport: PHONE });
  await page.getByTestId('rte-copy').click();
  await page.getByTestId('rte-copy-source').nth(1).click();
  await expect(page.getByTestId('rte-copy-preview')).toContainText('Descrierea copiată.');
  await page.getByTestId('rte-copy-confirm').click();
  const confirm = page.getByRole('alertdialog', { name: 'Înlocuiești descrierea?' });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('Textul existent va fi înlocuit.');
  await settle(page);
  await scan(page);
  await page.screenshot({ path: `${SHOTS}/copy-confirm-375.png` });
  await confirm.getByRole('button', { name: 'Renunță' }).click();
  await expect(confirm).toHaveCount(0);
  await expect(panel(page)).toBeVisible();
  await expect(content(page)).toHaveText('Concurs de crap pe Chita Lake, 48 de ore.');

  await page.getByTestId('rte-copy-confirm').click();
  await confirm.getByRole('button', { name: 'Copiază' }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(content(page)).toHaveText('Descrierea copiată.');
  // The editor now holds text again: the question is asked again (desktop dialog over the panel).
  await page.setViewportSize(LAPTOP);
  await page.getByTestId('rte-copy').click();
  await page.getByTestId('rte-copy-source').nth(1).click();
  await page.getByTestId('rte-copy-confirm').click();
  await expect(confirm).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/copy-confirm-1280.png` });
  await confirm.getByRole('button', { name: 'Renunță' }).click();
  await page.getByTestId('rte-copy-close').or(page.getByTestId('rte-copy-back')).first().click();
  // Nothing is stored until «Gata».
  expect(await formValue(page, 'description')).toBe('<p>Concurs de crap pe Chita Lake, 48 de ore.</p>');
  expect(organizer.writes).toEqual([]);
});

/* ============================================================================================== */
/* Review fixes: mixed marks + entities on save, cleared / unchanged fields, <br> from the AI,      */
/* the leave guard while the editor is open, the phone modal layer, a fresh copy list.           */
/* ============================================================================================== */

type Body = { data: Values };

test('organizer.rich-text-editor.c2 — a bold sentence with one italic word and «& >» is saved whole (PUT blocks), no entities', async ({ page, organizer }) => {
  await organizer.mockWrite('PUT', `${DRAFT}/${ID}`, (w) => ({ json: draft({ reward: (w.body as Body).data.reward }) }));
  await open(page, 'premii');
  await page.keyboard.type('Premiu mare special pentru crap & amur > 20 kg');
  await page.keyboard.press('ControlOrMeta+A');
  await toolbar(page).getByRole('button', { name: 'Îngroșat' }).click();
  // Select exactly «special» (the word after «Premiu mare »).
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="rte-content"] strong')!;
    const text = el.firstChild!;
    const start = text.textContent!.indexOf('special');
    const r = document.createRange();
    r.setStart(text, start);
    r.setEnd(text, start + 'special'.length);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
  });
  await toolbar(page).getByRole('button', { name: 'Cursiv' }).click();
  await expect(content(page).locator('strong em')).toHaveText('special');

  await page.getByTestId('rte-done').click();
  await expect(page).not.toHaveURL(/[?&]editor=/);
  await expect.poll(() => organizer.writes.length).toBe(1);
  expect((organizer.writes[0].body as Body).data.reward).toEqual([
    {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'Premiu mare ', bold: true },
        { type: 'text', text: 'special', bold: true, italic: true },
        { type: 'text', text: ' pentru crap & amur > 20 kg', bold: true },
      ],
    },
  ]);
  await expect(page.getByTestId('rich-text-premii-preview')).toContainText('Premiu mare special pentru crap & amur > 20 kg');
  expect(organizer.blocked).toEqual([]);
});

test('organizer.rich-text-editor.c2 — «Gata» without a change stores nothing (no PUT); an empty field stays empty; clearing a field clears it', async ({ page, organizer }) => {
  await organizer.mockWrite('PUT', `${DRAFT}/${ID}`, (w) => ({ json: draft({ description: (w.body as Body).data.description ?? null }) }));
  // Unchanged text.
  await open(page, 'descriere');
  await page.getByTestId('rte-done').click();
  await expect(page).not.toHaveURL(/[?&]editor=/);
  // An empty field opened and closed: still '' (never «<p></p>»).
  await page.goto(URL('premii'), { waitUntil: 'domcontentloaded' });
  await expect(content(page)).toBeFocused({ timeout: 60_000 });
  await page.getByTestId('rte-done').click();
  await expect(page).not.toHaveURL(/[?&]editor=/);
  expect(await formValue(page, 'reward')).toBe('');
  await page.waitForTimeout(600);
  expect(organizer.writes).toEqual([]);

  // Clearing a field that held text: saved, so the draft loses the old text.
  await page.goto(URL('descriere'), { waitUntil: 'domcontentloaded' });
  await expect(content(page)).toBeFocused({ timeout: 60_000 });
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await page.getByTestId('rte-done').click();
  await expect.poll(() => organizer.writes.length).toBe(1);
  expect(await formValue(page, 'description')).toBe('<p></p>');
  expect((organizer.writes[0].body as Body).data.description).toEqual([para('')]);
  await expect(page.getByTestId('rich-text-descriere')).toHaveAttribute('data-state', 'empty');
});

test('organizer.rich-text-editor.c5 — an AI answer with <br> keeps the lines apart (no «Locul 1Locul 2»)', async ({ page, organizer }) => {
  await organizer.mockWrite('POST', AI, () => ({ json: { data: { formatted: '<p>Locul 1<br>Locul 2</p><ul><li>a<br>b</li></ul>' } } }));
  await open(page, 'premii');
  await page.keyboard.type('locul 1 locul 2');
  await page.getByTestId('rte-ai').click();
  await expect(page.getByTestId('rte-ai')).toHaveText('Formatat');
  await expect(content(page).locator(':scope > p')).toHaveText(['Locul 1', 'Locul 2']);
  await expect(content(page).locator('li')).toHaveText('a b');
  expect(organizer.writes.map((w) => w.path)).toEqual([AI]);
});

test('organizer.rich-text-editor — unapplied text is never dropped silently: no header back / step jumps while open; a link asks; «Salvează» keeps the text', async ({ page, organizer }) => {
  await organizer.mockWrite('PUT', `${DRAFT}/${ID}`, (w) => ({ json: draft({ description: (w.body as Body).data.description }) }));
  await open(page, 'descriere', { viewport: { width: 1440, height: 900 } });
  const stepButtons = page.locator('[aria-label="Pașii competiției"] button');
  // The wizard's own exits are off while the editor is open (fish: a full-screen route).
  await expect(stepButtons).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ieși din asistent' })).toHaveCount(0);
  const step2 = page.getByRole('navigation', { name: 'Pașii competiției' }).getByText('Configurare competiție', { exact: true });
  await expect(step2).toBeVisible();
  await step2.click();
  await expect(page).toHaveURL(/[?&]editor=descriere/);

  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' Taxa: 200 lei.');
  // A link out of the wizard: the exit question, the text stays when the organizer stays.
  const exit = page.getByRole('dialog', { name: 'Salvezi progresul înainte de a ieși?' });
  await page.getByRole('link', { name: 'Concursurile mele' }).first().click();
  await expect(exit).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/leave-guard-1440.png` });
  await page.keyboard.press('Escape');
  await expect(exit).toHaveCount(0);
  await expect(page).toHaveURL(/[?&]editor=descriere/);
  await expect(content(page)).toHaveText('Concurs de crap pe Chita Lake, 48 de ore. Taxa: 200 lei.');
  expect(organizer.writes).toEqual([]);

  // «Salvează …» applies the editor's text, then saves and leaves.
  await page.getByRole('link', { name: 'Concursurile mele' }).first().click();
  await exit.getByRole('button', { name: /^Salvează/ }).click();
  await expect.poll(() => organizer.writes.length).toBe(1);
  expect((organizer.writes[0].body as Body).data.description).toEqual([para('Concurs de crap pe Chita Lake, 48 de ore. Taxa: 200 lei.')]);
  await expect(page).not.toHaveURL(/editor=/, { timeout: 60_000 });
});

test('organizer.rich-text-editor — after the editor closes the wizard\'s back and step jumps come back', async ({ page }) => {
  await open(page, 'descriere', { viewport: { width: 1440, height: 900 } });
  await page.getByTestId('rte-back').click();
  await expect(page.getByTestId('step-detalii')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ieși din asistent' }).first()).toBeAttached();
});

test('organizer.rich-text-editor — phone: a modal layer (role=dialog, aria-modal, the page behind inert), Escape = back', async ({ page, organizer }) => {
  await open(page, 'descriere', { viewport: PHONE });
  const layer = page.getByRole('dialog', { name: 'Descriere', exact: true });
  await expect(layer).toHaveAttribute('aria-modal', 'true');
  // Nothing outside the layer can take focus or be read.
  const live = await page.evaluate(() => {
    const layerEl = document.querySelector('[data-testid="rich-text-editor"]')!;
    return Array.from(document.querySelectorAll<HTMLElement>('a[href], button, input, textarea, [tabindex]'))
      .filter((el) => !layerEl.contains(el) && !el.contains(layerEl) && !el.closest('[inert]') && el.getClientRects().length > 0)
      .map((el) => el.outerHTML.slice(0, 80));
  });
  expect(live).toEqual([]);
  // Tab leaves the text (no trap) but stays inside the layer.
  await content(page).click();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.querySelector('[data-testid="rich-text-editor"]')!.contains(document.activeElement) || document.activeElement === document.body)).toBe(true);
  await settle(page);
  await scan(page);

  // Escape inside the copy panel closes the panel only.
  await mockSources(page, sources(2));
  await page.getByTestId('rte-copy').click();
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
  await expect(page).toHaveURL(/[?&]editor=descriere/);
  // Escape on the layer = back (nothing applied).
  await content(page).click();
  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/[?&]editor=/);
  expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
  expect(organizer.writes).toEqual([]);
});

test('organizer.rich-text-editor.c6 — the copy list reloads on every opening (a draft created since shows, the count is right)', async ({ page }) => {
  const rows: Values[] = [draftFixture({ documentId: ID, name: 'Cupa Editorului' }), ...sources(3)];
  await mockSources(page, rows, { delayMs: 400 });
  await open(page, 'regulament');
  await page.getByTestId('rte-copy').click();
  await expect(page.getByTestId('rte-copy-count')).toHaveText('3 competiții disponibile');
  await page.getByTestId('rte-copy-close').click();
  // The current draft and another competition appear in the CMS meanwhile.
  rows.unshift(draftFixture({ documentId: 'nou', name: 'Cupa nouă' }));
  await page.getByTestId('rte-copy').click();
  // The cached page is not shown while the fresh one loads.
  await expect(page.getByTestId('rte-copy-loading')).toBeVisible();
  await expect(page.getByTestId('rte-copy-count')).toHaveCount(0);
  await expect(page.getByTestId('rte-copy-count')).toHaveText('4 competiții disponibile');
  await expect(page.getByTestId('rte-copy-source').first()).toContainText('Cupa nouă');
});

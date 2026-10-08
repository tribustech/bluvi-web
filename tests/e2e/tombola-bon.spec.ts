import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { fakeRaffle, SESSION_ID, type FakeRaffleOptions } from './helpers/fake-raffle';
import { qaJwt, signIn } from './helpers/session';

/*
 * participant.raffle-upload-receipt — /tombola/bon?mod=adauga|inlocuieste «Încarcă bonul fiscal»
 * (T6; fish app/(app)/raffle/upload-receipt.tsx, an orphan there).
 *
 * Writes nothing anywhere: the active session comes from helpers/fake-raffle.ts (read-only here);
 * the participation and the receipt POST are answered by this spec's layer on top of it (registered
 * later, so it runs first), which records every upload (content type + body) — no real upload.
 */

const SHOTS = '.shots/tombola-bon';
mkdirSync(SHOTS, { recursive: true });

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const RECEIPT_URL = 'https://bluvi-staging.s3.eu-central-1.amazonaws.com/e2e-tombola-bon.png';
const FILE = { name: 'bon.png', mimeType: 'image/png', buffer: PNG };
const UPLOAD_FAILED = 'Nu am putut încărca bonul. Te rugăm să încerci din nou.';

type Participation = { joined: boolean; entriesCount: number; typeKey: string | null; receiptUploaded: boolean; receiptImageUrl: string | null };
type Opts = FakeRaffleOptions & { part?: Partial<Participation>; uploadStatus?: number; uploadDelayMs?: number };
type Rec = { uploads: { url: string; contentType: string; body: string }[]; release: () => void };

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function fakeParticipation(page: Page, o: Opts): Promise<Rec> {
  let part: Participation = { joined: true, entriesCount: 1, typeKey: 'crap', receiptUploaded: false, receiptImageUrl: null, ...o.part };
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  const rec: Rec = { uploads: [], release: () => release() };
  const dto = () => ({ ...part, receiptUnderVerification: part.receiptUploaded, canChangeType: true, sessionDocumentId: SESSION_ID });
  await page.route('**/api/cms/raffle-sessions/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/api\/cms/, '');
    if (path === '/raffle-sessions/participation' && req.method() === 'GET') return json(route, { data: dto() });
    if (path === `/raffle-sessions/${SESSION_ID}/receipt` && req.method() === 'POST') {
      rec.uploads.push({ url: req.url(), contentType: req.headers()['content-type'] ?? '', body: req.postDataBuffer()?.toString('latin1') ?? '' });
      if (o.uploadDelayMs) await Promise.race([held, new Promise((r) => setTimeout(r, o.uploadDelayMs))]);
      if ((o.uploadStatus ?? 200) !== 200) {
        return json(route, { data: null, error: { status: o.uploadStatus, name: 'Error', message: 'mock failure', details: {} } }, o.uploadStatus);
      }
      if (!part.receiptUploaded) part.entriesCount += 2;
      part = { ...part, receiptUploaded: true, receiptImageUrl: RECEIPT_URL };
      return json(route, { data: { url: RECEIPT_URL, fileId: 1, participation: dto() } });
    }
    return route.fallback();
  });
  await page.route(RECEIPT_URL, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  // «Bon încărcat» is another screen (participant.raffle-receipt-submitted): the redirect is asserted by URL.
  return rec;
}

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

async function open(page: Page, query = '', o: Opts = {}, width = 1280) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await signIn(page.context(), jwt);
  const fake = await fakeRaffle(page, o);
  const rec = await fakeParticipation(page, o);
  await page.goto(`/tombola/bon${query}`);
  await expect(page.getByRole('heading', { level: 2, name: 'Încarcă bonul fiscal' })).toBeVisible();
  return { fake, rec };
}

async function shots(page: Page, state: string, widths = [375, 768, 1280, 1440, 1920]) {
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${SHOTS}/${state}-${w}.png`, fullPage: true });
  }
}

const gallery = (page: Page) => page.getByRole('button', { name: 'Încarcă din galerie' });
const camera = (page: Page) => page.getByRole('button', { name: 'Fotografiază acum' });

test.describe('participant.raffle-upload-receipt', () => {
  test('signed out → sign-in with the way back, mode kept (proxy 307)', async ({ page }) => {
    await page.goto('/tombola/bon?mod=inlocuieste');
    await expect(page).toHaveURL(/\/intra\?next=%2Ftombola%2Fbon%3Fmod%3Dinlocuieste$/);
  });

  test('c1 — reachable by URL only: noindex; nothing on home, the confirmation or «Șansele mele» links here', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const links = 'a[href="/tombola/bon"], a[href^="/tombola/bon?"]';
    for (const path of ['/tombola/confirmare', '/tombola/sansele-mele', '/']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expect(page.locator(links)).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test('c1 — not in the raffle → handed to the intro', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await fakeRaffle(page);
    await fakeParticipation(page, { part: { joined: false, typeKey: null } });
    await page.goto('/tombola/bon?mod=adauga');
    await expect(page).toHaveURL(/\/tombola$/);
  });

  test('c1 — the draw is over → «Șansele mele» (fish hides the receipt block once ended); no upload card, no POST', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await fakeRaffle(page, { session: 'ended-winners' });
    const rec = await fakeParticipation(page, { part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } });
    await page.goto('/tombola/bon?mod=inlocuieste');
    await expect(page).toHaveURL(/\/tombola\/sansele-mele$/);
    await expect(page.getByTestId('receipt-upload-card')).toHaveCount(0);
    expect(rec.uploads).toHaveLength(0);
  });

  test('c2 — title per mode: first (no or unknown mod), add, replace — h1 and document title', async ({ page }) => {
    const cases: [string, string][] = [
      ['', 'Încarcă bonul fiscal'],
      ['?mod=altceva', 'Încarcă bonul fiscal'],
      ['?mod=adauga', 'Adaugă bon fiscal'],
      ['?mod=inlocuieste', 'Înlocuiește bonul fiscal'],
    ];
    await open(page);
    for (const [q, title] of cases) {
      await page.goto(`/tombola/bon${q}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      await expect(page).toHaveTitle(new RegExp(`^${title}`));
    }
    await expect(page.getByRole('link', { name: 'Înapoi' })).toHaveAttribute('href', '/tombola/confirmare');
  });

  test('c3 — replace with a receipt: «Bonul tău încărcat» + image + hint; not in add mode nor without a receipt', async ({ page }) => {
    await open(page, '?mod=inlocuieste', { part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } });
    const preview = page.getByTestId('receipt-preview');
    await expect(preview.getByRole('heading', { level: 2, name: 'Bonul tău încărcat' })).toBeVisible();
    const img = preview.getByRole('img', { name: 'Bonul tău încărcat' });
    await expect(img).toHaveAttribute('src', RECEIPT_URL);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(preview).toContainText('Înlocuiește cu o nouă fotografie mai jos.');
    await expectNoA11yViolations(page);
    await shots(page, 'replace-preview');

    await page.goto('/tombola/bon?mod=adauga');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Adaugă bon fiscal');
    await expect(page.getByTestId('receipt-preview')).toHaveCount(0);
  });

  test('c3 — replace at ≥1024: a compact preview row atop the right column; the drop zone alone on the left', async ({ page }) => {
    await open(page, '?mod=inlocuieste', { part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } });
    for (const w of [1280, 1920]) {
      await page.setViewportSize({ width: w, height: 900 });
      const pre = (await page.getByTestId('receipt-preview').boundingBox())!;
      const img = (await page.getByTestId('receipt-preview').getByRole('img').boundingBox())!;
      const head = (await page.getByTestId('receipt-preview').getByRole('heading').boundingBox())!;
      const ins = (await page.getByTestId('receipt-instructions').boundingBox())!;
      const up = (await page.getByTestId('receipt-upload-card').boundingBox())!;
      expect(pre.height).toBeLessThan(200);
      expect(img.x + img.width).toBeLessThanOrEqual(head.x);
      expect(pre.x).toBeCloseTo(ins.x, 0);
      expect(pre.y + pre.height).toBeLessThan(ins.y);
      expect(pre.x).toBeGreaterThan(up.x + up.width);
      expect(Math.abs(pre.y - up.y)).toBeLessThan(2);
    }
  });

  test('c3 — replace without a receipt: no preview', async ({ page }) => {
    await open(page, '?mod=inlocuieste');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Înlocuiește bonul fiscal');
    await expect(page.getByTestId('receipt-preview')).toHaveCount(0);
  });

  test('c4 c6 — instructions with the red disclaimer, the tips; phone order and ≥1024 columns; axe', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page, '', {}, 375);
    const box = page.getByTestId('receipt-instructions');
    await expect(box.getByRole('heading', { level: 2, name: 'Instrucțiuni' })).toBeVisible();
    await expect(box).toContainText(
      'Fă o fotografie bonului tău fiscal. Cumpără de minim 150 lei de la PescarMania, înscrie bonul fiscal și primești 2 șanse în plus la tragerea la sorți.',
    );
    const disclaimer = page.getByTestId('receipt-disclaimer');
    await expect(disclaimer).toHaveText('Dacă câștigi, vom verifica bonul fiscal. Dacă bonul nu este corect sau este duplicat, vei fi descalificat.');
    const red = await disclaimer.evaluate((el) => getComputedStyle(el).color);
    const [r, g, b] = red.match(/[\d.]+/g)!.map(Number);
    expect(r).toBeGreaterThan(g + 60);
    expect(r).toBeGreaterThan(b + 60);
    const tips = page.getByTestId('receipt-tips');
    await expect(tips.getByRole('heading', { level: 2, name: 'Sfaturi pentru o fotografie bună' })).toBeVisible();
    await expect(tips.getByRole('listitem')).toHaveText([
      'Asigură-te că bonul este complet vizibil',
      'Verifică ca data și numele magazinului să fie lizibile',
      'Folosește lumină naturală pentru claritate',
    ]);
    // Phone: fish's order — instructions, upload, tips — in one column.
    const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y;
    expect(await y('receipt-instructions')).toBeLessThan(await y('receipt-upload-card'));
    expect(await y('receipt-upload-card')).toBeLessThan(await y('receipt-tips'));
    await expectNoA11yViolations(page);
    // ≥1024: upload card left, instructions + tips right, side by side.
    await page.setViewportSize({ width: 1280, height: 900 });
    const up = (await page.getByTestId('receipt-upload-card').boundingBox())!;
    const ins = (await page.getByTestId('receipt-instructions').boundingBox())!;
    const tip = (await page.getByTestId('receipt-tips').boundingBox())!;
    expect(ins.x).toBeGreaterThan(up.x + up.width);
    expect(Math.abs(ins.y - up.y)).toBeLessThan(2);
    expect(tip.x).toBeCloseTo(ins.x, 0);
    expect(tip.y).toBeGreaterThan(ins.y + ins.height);
    await expectNoA11yViolations(page);
    await shots(page, 'first');
    expect(errors).toEqual([]);
  });

  test('a11y — DOM order is the phone order: preview, instructions, upload card, tips (no CSS reordering)', async ({ page }) => {
    await open(page, '?mod=inlocuieste', { part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } });
    const ids = ['receipt-preview', 'receipt-instructions', 'receipt-upload-card', 'receipt-tips'];
    const order = await page.evaluate(
      (list) => {
        const els = list.map((id) => document.querySelector(`[data-testid="${id}"]`)!);
        const sorted = [...els].sort((x, y) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        return { dom: sorted.map((el) => el.getAttribute('data-testid')), orders: els.map((el) => getComputedStyle(el).order) };
      },
      ids,
    );
    expect(order.dom).toEqual(ids);
    expect(order.orders).toEqual(['0', '0', '0', '0']);
    for (const w of [375, 768]) {
      await page.setViewportSize({ width: w, height: 812 });
      const ys = [];
      for (const id of ids) ys.push((await page.getByTestId(id).boundingBox())!.y);
      expect([...ys].sort((x, y) => x - y)).toEqual(ys);
    }
  });

  test('pointer — a photo dropped outside the drop zone is taken by the page (no browser navigation) and uploaded', async ({ page }) => {
    const { rec } = await open(page, '?mod=adauga');
    const drag = await page.evaluateHandle((b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], 'bon.png', { type: 'image/png' }));
      return dt;
    }, PNG.toString('base64'));
    for (const id of ['receipt-tips', 'receipt-instructions']) {
      const prevented = await page.getByTestId(id).evaluate((el, dt) => {
        const ev = new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
        return ev.defaultPrevented;
      }, drag);
      expect(prevented).toBe(true);
    }
    const dropped = await page.locator('header').first().evaluate((el, dt) => {
      const ev = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      return ev.defaultPrevented;
    }, drag);
    expect(dropped).toBe(true);
    await expect(page).toHaveURL(/\/tombola\/bon-trimis$/);
    expect(rec.uploads).toHaveLength(1);
    expect(rec.uploads[0].contentType).toMatch(/^multipart\/form-data/);
  });

  test('pointer — a photo dropped on the drop zone uploads once (the window does not take it again)', async ({ page }) => {
    const { rec } = await open(page);
    const drag = await page.evaluateHandle((b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], 'bon.png', { type: 'image/png' }));
      return dt;
    }, PNG.toString('base64'));
    await page.getByTestId('receipt-upload-card').dispatchEvent('drop', { dataTransfer: drag });
    await expect(page).toHaveURL(/\/tombola\/bon-trimis$/);
    expect(rec.uploads).toHaveLength(1);
  });

  test('c5 — pointer: «Încarcă din galerie» only (primary), with the drop hint', async ({ page }) => {
    await open(page);
    const card = page.getByTestId('receipt-upload-card');
    await expect(card.getByRole('heading', { level: 2, name: 'Încarcă bonul fiscal' })).toBeVisible();
    await expect(card).toContainText('Alege o metodă de încărcare');
    await expect(gallery(page)).toBeEnabled();
    await expect(camera(page)).toHaveCount(0);
    await expect(card.getByText('Sau trage fotografia bonului aici.')).toBeVisible();
    await expect(page.getByTestId('receipt-upload-gallery')).toHaveAttribute('accept', 'image/*');
  });

  test('c5 c7 — uploading: both busy + disabled, «Se încarcă bonul…»; then multipart POST → «Bon încărcat»', async ({ page }) => {
    const { rec } = await open(page, '?mod=adauga', { uploadDelayMs: 20_000 });
    await page.getByTestId('receipt-upload-gallery').setInputFiles(FILE);
    await expect(gallery(page)).toBeDisabled();
    await expect(gallery(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('receipt-upload-status')).toHaveText('Se încarcă bonul…');
    await expect.poll(() => rec.uploads.length).toBe(1);
    await shots(page, 'uploading', [375, 1280]);
    rec.release();
    await expect(page).toHaveURL(/\/tombola\/bon-trimis$/);
    const [u] = rec.uploads;
    expect(new URL(u.url).pathname).toBe(`/api/cms/raffle-sessions/${SESSION_ID}/receipt`);
    expect(u.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(u.body).toMatch(/name="files"; filename="[^"]+"/);
    expect(rec.uploads).toHaveLength(1);
  });

  test('c7 — replace uses the same POST receipt endpoint, then «Bon încărcat» (history replaced)', async ({ page }) => {
    const { rec } = await open(page, '?mod=inlocuieste', { part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } });
    await page.getByTestId('receipt-upload-gallery').setInputFiles(FILE);
    await expect(page).toHaveURL(/\/tombola\/bon-trimis$/);
    expect(rec.uploads).toHaveLength(1);
    expect(new URL(rec.uploads[0].url).pathname).toBe(`/api/cms/raffle-sessions/${SESSION_ID}/receipt`);
    expect(rec.uploads[0].contentType).toMatch(/^multipart\/form-data/);
  });

  test('c7 — a failed upload: the error is said, the page stays, the buttons come back', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const { rec } = await open(page, '', { uploadStatus: 500 });
    await page.getByTestId('receipt-upload-gallery').setInputFiles(FILE);
    await expect(page.getByTestId('receipt-upload-error')).toHaveText(UPLOAD_FAILED);
    await expect(page.getByRole('alert').filter({ hasText: UPLOAD_FAILED })).toBeVisible();
    await expect(page).toHaveURL(/\/tombola\/bon$/);
    await expect(gallery(page)).toBeEnabled();
    await expect(gallery(page)).toHaveAccessibleDescription(UPLOAD_FAILED);
    await expect(page.getByTestId('receipt-upload-status')).toHaveText('');
    expect(rec.uploads).toHaveLength(1);
    await expectNoA11yViolations(page);
    await shots(page, 'failed');
    // The 500 is the mock's: the browser logs the failed resource, nothing else.
    expect(errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
  });

  test('keyboard — Tab reaches back then «Încarcă din galerie»; Enter opens the file chooser', async ({ page }) => {
    await open(page);
    await page.getByRole('heading', { level: 1 }).focus();
    await page.keyboard.press('Tab');
    let guard = 0;
    while (!(await gallery(page).evaluate((el) => el === document.activeElement)) && guard++ < 30) await page.keyboard.press('Tab');
    await expect(gallery(page)).toBeFocused();
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    const fc = await chooser;
    expect(fc.isMultiple()).toBe(false);
    // The hidden inputs are never a tab stop.
    await expect(page.getByTestId('receipt-upload-gallery')).toHaveAttribute('tabindex', '-1');
    await page.getByRole('link', { name: 'Înapoi' }).focus();
    await expect(page.getByRole('link', { name: 'Înapoi' })).toBeFocused();
  });
});

test.describe('participant.raffle-upload-receipt — touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

  test('c5 — «Fotografiază acum» (capture) then «Încarcă din galerie»; both busy + disabled while uploading', async ({ page }) => {
    const { rec } = await open(page, '', { uploadDelayMs: 20_000 }, 375);
    await expect(camera(page)).toBeVisible();
    await expect(gallery(page)).toBeVisible();
    expect((await camera(page).boundingBox())!.y).toBeLessThan((await gallery(page).boundingBox())!.y);
    await expect(page.getByTestId('receipt-upload-camera')).toHaveAttribute('capture', 'environment');
    await expect(page.getByText('Sau trage fotografia bonului aici.')).toHaveCount(0);
    await expectNoA11yViolations(page);
    // Not fullPage: a full-page capture resizes the emulated device and drops its touch pointer.
    await page.screenshot({ path: `${SHOTS}/touch-375.png` });
    await page.getByTestId('receipt-upload-camera').setInputFiles(FILE);
    await expect(camera(page)).toBeDisabled();
    await expect(gallery(page)).toBeDisabled();
    await expect(camera(page)).toHaveAttribute('aria-busy', 'true');
    await expect(gallery(page)).toHaveAttribute('aria-busy', 'true');
    await page.getByTestId('receipt-upload-card').screenshot({ path: `${SHOTS}/touch-uploading-375.png` });
    rec.release();
    await expect(page).toHaveURL(/\/tombola\/bon-trimis$/);
    expect(rec.uploads).toHaveLength(1);
  });
});

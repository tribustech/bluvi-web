import type { BrowserContext, Locator, Page, Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { collectConsoleErrors } from './helpers/console';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { CMS, qaJwt, signIn } from './helpers/session';
import { expect, mockUpload, test } from './helpers/fake-chat';

/*
 * Chat concurs — «Decupează poza» (parity docs/parity/areas/participant.yml, screen
 * participant.chat-photo, c1–c7). The crop is a dialog over /concursuri/[id]/chat opened from a
 * pending photo in the composer tray (the File lives only in memory: no URL).
 *
 * Firestore is NEVER touched: the auto fixture (helpers/fake-chat.ts) installs the in-page fake and
 * fails the test on any request to Firebase; /upload is route-mocked. Nothing is written anywhere.
 *
 * The browser's image I/O is wrapped (init script below) so a test can slow the decode (the
 * «measuring» state), make it fail (an unreadable photo), make the JPEG encode fail (a failed crop),
 * hold it (a removal while saving) and count the encodes (a double «Salvează»). It also records the
 * largest canvas the page allocates and can emulate iOS Safari's canvas cap (~16.7 MP: getContext
 * returns null above it), for a real-size phone photo.
 */

const ID = process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa';
const CHAT = `/concursuri/${ID}/chat`;
const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const LAPTOP = { width: 1280, height: 800 };
const DESKTOP = { width: 1440, height: 900 };
const WIDE = { width: 1920, height: 1080 };
const SHOTS = path.join(process.cwd(), '.shots', 'chat-foto');
const READ_ERROR = 'Nu am putut citi poza. Încearcă din nou.';
const CROP_ERROR = 'Nu am putut aplica decuparea. Încearcă din nou.';

let coreName = '';
let jwt = '';

test.describe.configure({ timeout: 120_000 });

test.beforeAll(async ({ request }) => {
  const res = await request.get(`${CMS}/feed/competitions/${ID}`);
  expect(res.ok(), `competition ${ID} exists in the local CMS`).toBeTruthy();
  coreName = (await res.json()).data.name;
  jwt = await qaJwt(request);
  mkdirSync(SHOTS, { recursive: true });
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type CropTest = {
  bitmapDelay: number;
  bitmapFail: boolean;
  toBlobNull: boolean;
  toBlobCalls: number;
  hold: Promise<void> | null;
  release: (() => void) | null;
  /** 0 = no cap; else getContext('2d') returns null on a canvas larger than this many pixels. */
  canvasCap: number;
  maxCanvasArea: number;
};

async function instrumentImageIo(context: BrowserContext) {
  await context.addInitScript(() => {
    const t: CropTest = { bitmapDelay: 0, bitmapFail: false, toBlobNull: false, toBlobCalls: 0, hold: null, release: null, canvasCap: 0, maxCanvasArea: 0 };
    (window as unknown as { __cropTest: CropTest }).__cropTest = t;
    const cib = window.createImageBitmap.bind(window) as (...a: unknown[]) => Promise<ImageBitmap>;
    (window as unknown as { createImageBitmap: unknown }).createImageBitmap = async (...a: unknown[]) => {
      if (t.bitmapFail) throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
      if (t.bitmapDelay) await new Promise(r => setTimeout(r, t.bitmapDelay));
      return cib(...a);
    };
    const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, ...a: unknown[]) => unknown;
    (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = function (this: HTMLCanvasElement, ...a: unknown[]) {
      const area = this.width * this.height;
      t.maxCanvasArea = Math.max(t.maxCanvasArea, area);
      if (t.canvasCap && area > t.canvasCap) return null;
      return getContext.apply(this, a);
    };
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback, ...rest: unknown[]) {
      t.toBlobCalls += 1;
      if (t.toBlobNull) {
        setTimeout(() => cb(null));
        return;
      }
      const go = () => toBlob.call(this, cb, ...(rest as [string?, number?]));
      if (t.hold) void t.hold.then(go);
      else go();
    };
  });
}

const io = (page: Page, patch: Partial<Omit<CropTest, 'hold' | 'release'>>) =>
  page.evaluate(p => Object.assign((window as unknown as { __cropTest: CropTest }).__cropTest, p), patch);
const maxCanvasArea = (page: Page) => page.evaluate(() => (window as unknown as { __cropTest: CropTest }).__cropTest.maxCanvasArea);
const toBlobCalls = (page: Page) => page.evaluate(() => (window as unknown as { __cropTest: CropTest }).__cropTest.toBlobCalls);
const holdEncode = (page: Page) =>
  page.evaluate(() => {
    const t = (window as unknown as { __cropTest: CropTest }).__cropTest;
    t.hold = new Promise<void>(r => (t.release = r));
  });
const releaseEncode = (page: Page) =>
  page.evaluate(() => {
    const t = (window as unknown as { __cropTest: CropTest }).__cropTest;
    t.release?.();
    t.hold = null;
  });

async function mockViewer(context: BrowserContext) {
  await context.route(`**/api/cms/user/profile/competition/${ID}/statute`, (route: Route) => route.fulfill({ json: { userRole: 'participant' } }));
  await context.route(`**/api/cms/feed/competitions/${ID}/my-status`, (route: Route) =>
    route.fulfill({ json: { data: { isFollowing: true, userRegistrationStatus: 'registered' } } }),
  );
}

async function openChat(page: Page, context: BrowserContext, size = PHONE) {
  await instrumentImageIo(context);
  await mockViewer(context);
  await mockUpload(page);
  await signIn(context, jwt, BASE_URL);
  await page.setViewportSize(size);
  await page.goto(CHAT);
  await expect(page.getByRole('heading', { level: 1, name: coreName })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('textbox', { name: 'Mesaj' })).toBeEnabled({ timeout: 30_000 });
}

const tray = (page: Page) => page.getByRole('list', { name: /^Poze atașate/ });
const thumb = (page: Page, i = 1) => tray(page).getByRole('button', { name: `Decupează poza ${i}`, exact: true });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Decupează' });
const preset = (page: Page, name: string) => dialog(page).getByRole('radio', { name, exact: true });
const stage = (page: Page) => dialog(page).getByRole('application', { name: 'Poza în cadrul de decupare' });
const frame = (page: Page) => dialog(page).getByTestId('crop-frame');
/** «Salvează» — named «Se aplică…» while the crop is applied. */
const save = (page: Page) => dialog(page).getByRole('button', { name: /^(Salvează|Se aplică…)$/ });
const cancel = (page: Page) => dialog(page).getByRole('button', { name: 'Anulează' });

/** A decodable 320 × 240 PNG (drawn in the page) into the tray. */
async function pickPhoto(page: Page, n = 1) {
  const data = await page.evaluate(count =>
    Array.from({ length: count }, (_, i) => {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 240;
      const g = c.getContext('2d')!;
      const grad = g.createLinearGradient(0, 0, 320, 240);
      grad.addColorStop(0, `hsl(${i * 70 + 190} 60% 55%)`);
      grad.addColorStop(1, `hsl(${i * 70 + 250} 55% 30%)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 320, 240);
      g.fillStyle = '#fff';
      g.fillRect(20, 20, 60, 40); // a mark in a corner: rotation and flip are visible in the shots
      return c.toDataURL('image/png').split(',')[1];
    }),
  n);
  await page.getByTestId('chat-gallery-input').setInputFiles(data.map((b64, i) => ({ name: `poza-${i + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') })));
  await expect(tray(page).getByRole('listitem')).toHaveCount(n);
}

async function dims(page: Page, i = 1) {
  const li = tray(page).getByRole('listitem').nth(i - 1);
  return { width: Number(await li.getAttribute('data-width')), height: Number(await li.getAttribute('data-height')) };
}

async function openCrop(page: Page, i = 1) {
  await thumb(page, i).click();
  await expect(dialog(page)).toBeVisible();
  await expect(stage(page).locator('img')).toBeVisible();
}

async function box(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error('no box');
  return b;
}

/** c4 «without gaps»: the (transformed) photo covers the whole frame. */
async function expectNoGaps(page: Page) {
  const img = await box(stage(page).locator('img'));
  const f = await box(frame(page));
  expect(img.x).toBeLessThanOrEqual(f.x + 1.5);
  expect(img.y).toBeLessThanOrEqual(f.y + 1.5);
  expect(img.x + img.width).toBeGreaterThanOrEqual(f.x + f.width - 1.5);
  expect(img.y + img.height).toBeGreaterThanOrEqual(f.y + f.height - 1.5);
}

async function frameRatio(page: Page) {
  const f = await box(frame(page));
  return f.width / f.height;
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}-${page.viewportSize()?.width}.png`) });
}

/** The transitions (300 ms) settle before a geometry read. */
const settle = (page: Page) => page.waitForTimeout(400);

/* ------------------------------------------------------------------ */
/* c1 + c5 (cancel) — open from the tray, measuring, Escape / «Anulează» */
/* ------------------------------------------------------------------ */

test('participant.chat-photo.c1 participant.chat-photo.c5 — «Decupează poza» opens the photo on black once measured (neutral skeleton meanwhile); «Anulează» and Escape close it unchanged and return focus to the thumbnail', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await openChat(page, context);
  await pickPhoto(page, 2);
  expect(await dims(page, 1)).toEqual({ width: 320, height: 240 });

  // Measuring: the decode is slowed, the skeleton shows, then the overlay with the crop frame.
  await io(page, { bitmapDelay: 1500 });
  await thumb(page, 1).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByTestId('chat-photo-crop-measuring')).toBeVisible();
  await expect(dialog(page).getByRole('status')).toHaveText('Se pregătește poza…');
  await page.waitForTimeout(350); // the dialog's fade-in
  await shot(page, 'measuring');
  await expect(stage(page).locator('img')).toBeVisible();
  await io(page, { bitmapDelay: 0 });
  await expect(dialog(page).getByTestId('chat-photo-crop-measuring')).toHaveCount(0);
  await expect(frame(page)).toBeVisible();
  // The skeleton's «Anulează» (the initial focus) is gone: focus lands on the stage, never on <body>.
  await expect(stage(page)).toBeFocused();
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog[open]'))).toBe(true);
  await expect(stage(page)).toHaveAttribute('aria-describedby', 'crop-help');
  // fish's overlay opens on 4:3; black stage.
  await expect(preset(page, '4:3')).toHaveAttribute('aria-checked', 'true');
  await expect(dialog(page)).toHaveCSS('background-color', /rgb\(\s*\d+,\s*\d+,\s*\d+\)/);
  const bg = await dialog(page).evaluate(el => getComputedStyle(el).backgroundColor);
  const [r, g, b] = bg.match(/\d+/g)!.map(Number);
  expect(r + g + b).toBeLessThan(90);
  // Phone: full screen.
  const d = await box(dialog(page));
  expect(Math.round(d.width)).toBe(375);
  expect(Math.round(d.height)).toBe(812);
  await settle(page);
  await shot(page, 'editing');
  await expectNoA11yViolations(page);

  // Escape = «Anulează»: nothing changes, focus back on the thumbnail.
  await preset(page, '1:1').click();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(thumb(page, 1)).toBeFocused();
  expect(await dims(page, 1)).toEqual({ width: 320, height: 240 });

  // «Anulează» on the second photo.
  const src = await tray(page).getByRole('listitem').nth(1).locator('img').getAttribute('src');
  await openCrop(page, 2);
  await preset(page, '1:1').click();
  await dialog(page).getByRole('button', { name: 'Rotește' }).click();
  await cancel(page).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(thumb(page, 2)).toBeFocused();
  expect(await dims(page, 2)).toEqual({ width: 320, height: 240 });
  expect(await tray(page).getByRole('listitem').nth(1).locator('img').getAttribute('src')).toBe(src);
  expect(await toBlobCalls(page)).toBe(0);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* c2 — presets + the free frame                                       */
/* ------------------------------------------------------------------ */

test('participant.chat-photo.c2 — presets Original, Liber, 4:3, 1:1, 3:4, 16:9 shape the frame; the free frame resizes from its corners down to 60 px', async ({ page, context }) => {
  await openChat(page, context, LAPTOP);
  await pickPhoto(page);
  await openCrop(page);
  const names = ['Original', 'Liber', '4:3', '1:1', '3:4', '16:9'];
  await expect(dialog(page).getByRole('radiogroup', { name: 'Format decupare' }).getByRole('radio')).toHaveText(names);
  const expected: Record<string, number> = { Original: 4 / 3, '4:3': 4 / 3, '1:1': 1, '3:4': 3 / 4, '16:9': 16 / 9 };
  for (const name of names) {
    await preset(page, name).click();
    await expect(preset(page, name)).toHaveAttribute('aria-checked', 'true');
    for (const other of names.filter(n => n !== name)) await expect(preset(page, other)).toHaveAttribute('aria-checked', 'false');
    await settle(page);
    if (name !== 'Liber') expect(await frameRatio(page)).toBeCloseTo(expected[name], 1);
    // Only «Liber» has draggable corners.
    await expect(dialog(page).getByRole('button', { name: /^Colțul / })).toHaveCount(name === 'Liber' ? 4 : 0);
  }
  // 16:9 saves a 16:9 crop of the photo's full width.
  await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  const wide = await dims(page);
  expect(wide.width).toBe(320);
  expect(wide.width / wide.height).toBeCloseTo(16 / 9, 1);

  // Liber: the bottom-right corner from the keyboard, the top-left with the mouse — never under 60 px.
  await openCrop(page);
  await preset(page, 'Liber').click();
  await settle(page);
  const full = await box(frame(page));
  const br = dialog(page).getByRole('button', { name: 'Colțul dreapta jos al cadrului' });
  await br.focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft');
  await settle(page);
  expect((await box(frame(page))).width).toBeCloseTo(full.width - 96, 0);
  for (let i = 0; i < 80; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 80; i++) await page.keyboard.press('ArrowUp');
  await settle(page);
  let f = await box(frame(page));
  expect(Math.round(f.width)).toBe(60);
  expect(Math.round(f.height)).toBe(60);
  const tl = await box(dialog(page).getByRole('button', { name: 'Colțul stânga sus al cadrului' }));
  await page.mouse.move(tl.x + tl.width / 2, tl.y + tl.height / 2);
  await page.mouse.down();
  await page.mouse.move(tl.x + tl.width / 2 + 200, tl.y + tl.height / 2 + 200, { steps: 8 });
  await page.mouse.up();
  await settle(page);
  f = await box(frame(page));
  expect(Math.round(f.width)).toBe(60);
  // The bottom-right corner with the mouse grows it again.
  const brBox = await box(br);
  await page.mouse.move(brBox.x + brBox.width / 2, brBox.y + brBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(brBox.x + brBox.width / 2 + 40, brBox.y + brBox.height / 2 + 30, { steps: 6 });
  await page.mouse.up();
  await settle(page);
  f = await box(frame(page));
  expect(Math.round(f.width)).toBe(100);
  expect(Math.round(f.height)).toBe(90);
  await shot(page, 'free');
  await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  const free = await dims(page);
  expect(free.width).toBeLessThan(wide.width);
  expect(free.width / free.height).toBeCloseTo(100 / 90, 1);
});

/* ------------------------------------------------------------------ */
/* c3 — rotate, flip, Reset                                            */
/* ------------------------------------------------------------------ */

test('participant.chat-photo.c3 — rotate 90° clockwise, flip horizontally, «Reset» (0°, unflipped, 4:3); a rotated Original saves the photo turned', async ({ page, context }) => {
  await openChat(page, context, DESKTOP);
  await pickPhoto(page);
  await openCrop(page);
  const img = stage(page).locator('img');
  const rotate = dialog(page).getByRole('button', { name: 'Rotește' });
  const flip = dialog(page).getByRole('button', { name: 'Oglindește' });
  await expect(img).toHaveAttribute('style', /scaleX\(1\) rotate\(0deg\)/);
  await rotate.click();
  await expect(img).toHaveAttribute('style', /rotate\(90deg\)/);
  await rotate.click();
  await expect(img).toHaveAttribute('style', /rotate\(180deg\)/);
  await expect(flip).toHaveAttribute('aria-pressed', 'false');
  await flip.click();
  await expect(flip).toHaveAttribute('aria-pressed', 'true');
  await expect(img).toHaveAttribute('style', /scaleX\(-1\) rotate\(180deg\)/);
  await preset(page, '1:1').click();
  await settle(page);
  await shot(page, 'rotated-flipped');
  await dialog(page).getByRole('button', { name: 'Reset' }).click();
  await expect(img).toHaveAttribute('style', /scaleX\(1\) rotate\(0deg\)/);
  await expect(flip).toHaveAttribute('aria-pressed', 'false');
  await expect(preset(page, '4:3')).toHaveAttribute('aria-checked', 'true');

  // A quarter turn on «Original»: the saved photo is 240 × 320.
  await rotate.click();
  await preset(page, 'Original').click();
  await settle(page);
  expect(await frameRatio(page)).toBeCloseTo(3 / 4, 1);
  await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await dims(page)).toEqual({ width: 240, height: 320 });
});

/* ------------------------------------------------------------------ */
/* c4 — zoom / pan without gaps                                        */
/* ------------------------------------------------------------------ */

test('participant.chat-photo.c4 — in a ratio preset the photo zooms (+/−, the wheel) and pans (arrows, drag) under the frame and never leaves a gap', async ({ page, context }) => {
  await openChat(page, context, LAPTOP);
  await pickPhoto(page);
  await openCrop(page);
  await preset(page, '1:1').click();
  await settle(page);
  await expectNoGaps(page);
  const start = await box(stage(page).locator('img'));

  // Keyboard: + zooms, the arrows pan; pushed far past the edge, the photo stops at it.
  await stage(page).focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('+');
  await settle(page);
  const zoomed = await box(stage(page).locator('img'));
  expect(zoomed.width).toBeGreaterThan(start.width * 1.3);
  await expectNoGaps(page);
  for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
    for (let i = 0; i < 40; i++) await page.keyboard.press(key);
    await settle(page);
    await expectNoGaps(page);
  }
  // − all the way back: never under «just covers».
  for (let i = 0; i < 10; i++) await page.keyboard.press('-');
  await settle(page);
  expect((await box(stage(page).locator('img'))).width).toBeCloseTo(start.width, 0);
  await expectNoGaps(page);

  // The wheel zooms, a drag pans — still no gap.
  const s = await box(stage(page));
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.wheel(0, -400);
  await settle(page);
  expect((await box(stage(page).locator('img'))).width).toBeGreaterThan(start.width * 1.5);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 600, s.y + s.height / 2 + 600, { steps: 10 });
  await page.mouse.up();
  await settle(page);
  await expectNoGaps(page);
  await shot(page, 'zoomed');

  // The saved crop is the zoomed square: smaller than the photo's 240 px height.
  await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  const out = await dims(page);
  expect(out.width).toBe(out.height);
  expect(out.width).toBeLessThan(240);
});

/* ------------------------------------------------------------------ */
/* c5 — «Salvează» replaces the attachment; a double click is ignored  */
/* ------------------------------------------------------------------ */

test('participant.chat-photo.c5 — «Salvează» replaces that pending photo (preview, width, height) and a second quick «Salvează» is ignored; the cropped photo is what gets sent', async ({ page, context, fakeChat }) => {
  await openChat(page, context, DESKTOP);
  await pickPhoto(page, 2);
  const before = await tray(page).getByRole('listitem').nth(0).locator('img').getAttribute('src');
  const other = await tray(page).getByRole('listitem').nth(1).locator('img').getAttribute('src');
  await openCrop(page);
  // Desktop: a large centred modal, not the whole screen.
  const d = await box(dialog(page));
  expect(d.width).toBeLessThanOrEqual(960);
  expect(d.height).toBeLessThanOrEqual(720);
  expect(Math.abs(d.x + d.width / 2 - 720)).toBeLessThan(2);
  await preset(page, '1:1').click();
  await settle(page);
  // A stray click on the backdrop around the modal keeps the editor and its edit (fish: no backdrop).
  await page.mouse.click(d.x / 2, d.y + d.height / 2);
  await page.mouse.click(d.x + d.width / 2, Math.max(1, d.y / 2));
  await expect(dialog(page)).toBeVisible();
  await expect(preset(page, '1:1')).toHaveAttribute('aria-checked', 'true');
  // The encode is held so both clicks land while the first save is running.
  await holdEncode(page);
  await save(page).dblclick();
  await expect(save(page)).toBeDisabled();
  await expect(save(page)).toHaveText('Se aplică…');
  // While applying, Escape does nothing (a cancelled crop must never land).
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeVisible();
  await releaseEncode(page);
  await expect(dialog(page)).toHaveCount(0);
  expect(await toBlobCalls(page)).toBe(1);
  expect(await dims(page, 1)).toEqual({ width: 240, height: 240 });
  await expect(tray(page).getByRole('listitem').nth(0).locator('img')).not.toHaveAttribute('src', before!);
  // The other photo is untouched; still two photos, in order.
  await expect(tray(page).getByRole('listitem')).toHaveCount(2);
  expect(await tray(page).getByRole('listitem').nth(1).locator('img').getAttribute('src')).toBe(other);
  expect(await dims(page, 2)).toEqual({ width: 320, height: 240 });
  await expect(thumb(page, 1)).toBeFocused();
  await shot(page, 'tray-after-save');

  // Sent: two uploads, one message doc with two attachments (the fake records it; nothing leaves).
  await page.getByRole('button', { name: 'Trimite' }).click();
  await expect
    .poll(async () => (await fakeChat.writes()).filter(w => w.op === 'set' && w.path.includes('/messages/')).length)
    .toBe(1);
  const [w] = (await fakeChat.writes()).filter(w => w.op === 'set' && w.path.includes('/messages/'));
  expect((w.data?.attachments as unknown[]).length).toBe(2);
});

/* ------------------------------------------------------------------ */
/* c6 — unreadable photo, failed crop                                  */
/* ------------------------------------------------------------------ */

test('participant.chat-photo.c6 — an unreadable photo toasts «Nu am putut citi poza…» and closes; a failed crop says «Nu am putut aplica decuparea…» and stays', async ({ page, context }) => {
  await openChat(page, context);
  await pickPhoto(page);
  // The file cannot be decoded any more (a corrupted / unsupported file).
  await io(page, { bitmapFail: true });
  await thumb(page).click();
  await expect(page.getByRole('alert').filter({ hasText: READ_ERROR })).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  await expect(tray(page).getByRole('listitem')).toHaveCount(1);
  expect(await dims(page)).toEqual({ width: 320, height: 240 });
  await shot(page, 'read-error');
  await io(page, { bitmapFail: false });

  // The crop cannot be encoded: the error in the dialog, the dialog stays, «Salvează» works again.
  await openCrop(page);
  await preset(page, '1:1').click();
  await io(page, { toBlobNull: true });
  await save(page).click();
  await expect(dialog(page).getByRole('alert')).toHaveText(CROP_ERROR);
  await expect(dialog(page)).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await expect(preset(page, '1:1')).toHaveAttribute('aria-checked', 'true');
  expect(await dims(page)).toEqual({ width: 320, height: 240 });
  await settle(page);
  await shot(page, 'crop-error');
  await expectNoA11yViolations(page);
  await io(page, { toBlobNull: false });
  await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await dims(page)).toEqual({ width: 240, height: 240 });
});

/* ------------------------------------------------------------------ */
/* c7 — removed while the dialog is open                               */
/* ------------------------------------------------------------------ */

test('participant.chat-photo.c7 — a photo removed from the tray while it is being cropped ignores the result', async ({ page, context }) => {
  await openChat(page, context);
  await pickPhoto(page, 2);
  const ids = () => page.evaluate(() => (window as unknown as { __BLUVI_FAKE_CHAT__: { attachments: { ids: () => string[] } } }).__BLUVI_FAKE_CHAT__.attachments.ids());
  const remove = (id: string) =>
    page.evaluate(i => (window as unknown as { __BLUVI_FAKE_CHAT__: { attachments: { remove: (id: string) => void } } }).__BLUVI_FAKE_CHAT__.attachments.remove(i), id);
  await page.waitForFunction(() => !!(window as unknown as { __BLUVI_FAKE_CHAT__?: { attachments?: unknown } }).__BLUVI_FAKE_CHAT__?.attachments);
  const [first, second] = await ids();

  // Removed while the crop is being applied.
  await openCrop(page, 1);
  await preset(page, '1:1').click();
  await holdEncode(page);
  await save(page).click();
  await remove(first);
  await releaseEncode(page);
  await expect(dialog(page)).toHaveCount(0);
  expect(await ids()).toEqual([second]);
  expect(await dims(page, 1)).toEqual({ width: 320, height: 240 });

  // Removed before «Salvează»: the dialog keeps its photo, the save is a no-op on the tray.
  await openCrop(page, 1);
  await remove(second);
  await expect(dialog(page)).toBeVisible();
  await expect(stage(page).locator('img')).toBeVisible();
  await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await ids()).toEqual([]);
  await expect(tray(page)).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* A real-size phone photo (6000 × 4000) under iOS Safari's canvas cap */
/* ------------------------------------------------------------------ */

test('participant.chat-photo — a 6000 × 4000 phone photo crops under a 16.7 MP canvas cap: the photo is worked at ≤ 2560 px, one crop-sized canvas', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await openChat(page, context, LAPTOP);
  // A 24 MP JPEG with a mark in its top-left corner (drawn before the cap is on).
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 6000;
    c.height = 4000;
    const g = c.getContext('2d')!;
    g.fillStyle = '#1d4ed8';
    g.fillRect(0, 0, 6000, 4000);
    g.fillStyle = '#ef4444';
    g.fillRect(0, 0, 1200, 800);
    const blob = await new Promise<Blob>(r => c.toBlob(b => r(b!), 'image/jpeg', 0.8));
    c.width = c.height = 0;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  });
  await io(page, { canvasCap: 4096 * 4096, maxCanvasArea: 0 });
  await page.getByTestId('chat-gallery-input').setInputFiles({ name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
  await expect(tray(page).getByRole('listitem')).toHaveCount(1);
  expect(await dims(page)).toEqual({ width: 6000, height: 4000 });

  // A quarter turn on «Original»: the whole photo, turned, at the working size (2560 × 1707 → 1707 × 2560).
  await openCrop(page);
  await dialog(page).getByRole('button', { name: 'Rotește' }).click();
  await preset(page, 'Original').click();
  await settle(page);
  await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByText(CROP_ERROR)).toHaveCount(0);
  const out = await dims(page);
  expect(Math.max(out.width, out.height)).toBeGreaterThanOrEqual(2558);
  expect(Math.max(out.width, out.height)).toBeLessThanOrEqual(2560);
  expect(out.height).toBeGreaterThan(out.width);
  expect(out.width / out.height).toBeCloseTo(2 / 3, 2);
  // Never a canvas over the working size (6.5 MP), let alone the 16.7 MP cap.
  expect(await maxCanvasArea(page)).toBeLessThanOrEqual(2560 * 2560);

  // The pixels are the turned photo: the red top-left mark is now top-right.
  const corners = await tray(page)
    .getByRole('listitem')
    .first()
    .locator('img')
    .evaluate(async (img: HTMLImageElement) => {
      const bmp = await createImageBitmap(await (await fetch(img.src)).blob());
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const g = c.getContext('2d')!;
      g.drawImage(bmp, 0, 0);
      const px = (x: number, y: number) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3));
      return { tr: px(bmp.width - 20, 20), tl: px(20, 20) };
    });
  expect(corners.tr[0]).toBeGreaterThan(200);
  expect(corners.tl[2]).toBeGreaterThan(150);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* Widths                                                              */
/* ------------------------------------------------------------------ */

test('participant.chat-photo — shots at 375 / 768 / 1280 / 1440 / 1920 and the keyboard path (Tab never reaches the chat behind)', async ({ page, context }) => {
  await openChat(page, context, PHONE);
  await pickPhoto(page);
  for (const size of [PHONE, TABLET, LAPTOP, DESKTOP, WIDE]) {
    await page.setViewportSize(size);
    await openCrop(page);
    await settle(page);
    const d = await box(dialog(page));
    if (size.width >= 768) {
      expect(d.width).toBeLessThanOrEqual(960);
      expect(d.height).toBeLessThanOrEqual(720);
    } else {
      expect(Math.round(d.width)).toBe(size.width);
    }
    // No horizontal overflow inside the dialog.
    expect(await dialog(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await shot(page, 'editing');
    if (size === DESKTOP) await expectNoA11yViolations(page);
    // Focus trap (native modal <dialog>): Tab never reaches the chat behind — inside the dialog, or
    // out to the browser's own UI (document.body) and back in.
    let inside = 0;
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() =>
        document.activeElement?.closest('dialog[open]') ? 'inside' : document.activeElement === document.body ? 'chrome' : 'page',
      );
      expect(where).not.toBe('page');
      if (where === 'inside') inside += 1;
    }
    expect(inside).toBeGreaterThan(10);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
  }
});

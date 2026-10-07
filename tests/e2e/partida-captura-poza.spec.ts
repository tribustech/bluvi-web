import path from 'node:path';
import type { Page, Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { expect, test, type FakeLiveDoc } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.captura-poza — the capture flow's photo-preview dialog (fish app/(app)/partide/
 * photo-preview.tsx), driven through its dev harness /dev/partide-poza: a file input, the dialog,
 * and what «Gata» / «Renunță» handed back. Members come from the Firestore fake (fake-live, which
 * also fails the test on any Firebase request). Nothing is written: every non-GET request fails the
 * test.
 *
 * The last block drives the same dialog on the REAL route /partide/[id]/captura (members from the
 * live session, tags seeded from the edited catch, the reopen of an already-uploaded photo, and what
 * the save sends). Firestore is the fake; every CMS write is route-mocked and recorded, and an
 * unmocked write fails the test — nothing reaches any CMS.
 *
 * Fixture: tests/fixtures/partide/catch-quadrants.jpg, 1200×900, quadrants red (top-left), green
 * (top-right), blue (bottom-left), yellow (bottom-right) — so a rotation is visible in the pixels.
 */

const FIXTURE = path.join(__dirname, '../fixtures/partide/catch-quadrants.jpg');
const FIXTURE_BYTES = 107_277;

const member = (uid: string, name: string) => ({ uid, name, avatar: null, joinedAt: '2026-10-07T05:00:00.000Z' });
const doc = (members: ReturnType<typeof member>[]): FakeLiveDoc => ({ startedAt: '2026-10-07T05:00:00.000Z', status: 'active', venueType: 'pin', manualVenueName: 'Balta lui Ion', members });

const SOLO = 'e2e-poza-solo';
const COOP = 'e2e-poza-coop';

async function open(page: Page, sessionId: string, query = '') {
  await page.goto(`/dev/partide-poza?sesiune=${sessionId}${query}`);
  await expect(page.locator('[data-testid="harness-members"][data-ready]')).toBeAttached();
  await page.getByTestId('harness-file').setInputFiles(FIXTURE);
  const dialog = page.getByTestId('photo-preview');
  await expect(dialog).toBeVisible();
  return dialog;
}

const imageSize = (page: Page) =>
  page.getByTestId('photo-preview-image').evaluate(el => [Number(el.getAttribute('data-width')), Number(el.getAttribute('data-height'))]);

/** The working image's colour at a point (as a fraction of its size), read off the decoded pixels. */
const pixelAt = (page: Page, fx: number, fy: number) =>
  page.getByTestId('photo-preview-image').evaluate(async (el, [x, y]) => {
    const img = el as HTMLImageElement;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(Math.floor(c.width * x), Math.floor(c.height * y), 1, 1).data.slice(0, 3));
  }, [fx, fy] as const);

const dominant = ([r, g, b]: number[]) => (r > 180 && g > 160 ? 'yellow' : r > 150 ? 'red' : g > 130 ? 'green' : b > 200 ? 'blue' : 'other');

const result = async (page: Page) => JSON.parse((await page.getByTestId('harness-result').textContent()) ?? 'null');

/** A size×size noise photo (the worst case for JPEG), generated in the page and handed to the harness input. */
async function pickNoise(page: Page, size: number) {
  await page.getByTestId('harness-file').evaluate(async (input, n) => {
    const c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(n, n);
    let seed = 12345;
    for (let i = 0; i < img.data.length; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      img.data[i] = i % 4 === 3 ? 255 : seed >>> 24;
    }
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise<Blob>(r => c.toBlob(b => r(b!), 'image/jpeg', 0.95));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'zgomot.jpg', { type: 'image/jpeg' }));
    (input as HTMLInputElement).files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, size);
}

let writes: string[] = [];

test.describe('partide.captura-poza', () => {
test.beforeEach(async ({ page, fakeLive }) => {
  writes = [];
  await fakeLive.seed({ docs: { [SOLO]: doc([member('u-self', 'Eu Pescar')]), [COOP]: doc([member('u-self', 'Eu Pescar'), member('u-ana', 'Ana Crap'), member('u-mihai', 'Mihai Somn')]) } });
  page.on('request', req => {
    if (req.method() !== 'GET' && req.method() !== 'HEAD' && !req.url().startsWith('blob:') && !req.url().startsWith('data:') && !new URL(req.url()).pathname.startsWith('/__nextjs')) {
      writes.push(`${req.method()} ${req.url()}`);
    }
  });
});

test.afterEach(() => {
  expect(writes, 'no network write may leave the dialog').toEqual([]);
});

  test('c1 phone: full-bleed photo, «Renunță» / «Decupează» on top, «Gata» at the bottom; «Renunță» discards', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const errors = collectConsoleErrors(page);
    const dialog = await open(page, SOLO);
    await expect(dialog.getByRole('img', { name: 'Poza capturii' })).toBeVisible();
    expect(await imageSize(page)).toEqual([1200, 900]);
    const cancel = dialog.getByRole('button', { name: 'Renunță' });
    const crop = dialog.getByRole('button', { name: 'Decupează' });
    const done = dialog.getByRole('button', { name: 'Gata' });
    await expect(crop).toBeEnabled();
    // Full-bleed: the stage covers the whole screen; the chrome sits over it, top and bottom.
    const img = (await dialog.getByTestId('photo-preview-image').boundingBox())!;
    expect(img.width).toBe(375);
    expect(img.height).toBeGreaterThan(800);
    const [c, k, d] = [await cancel.boundingBox(), await crop.boundingBox(), await done.boundingBox()];
    expect(c!.y).toBeLessThan(80);
    expect(k!.y).toBeLessThan(80);
    expect(c!.x).toBeLessThan(k!.x);
    expect(d!.y).toBeGreaterThan(700);
    await expectNoA11yViolations(page, { include: '[data-testid="photo-preview"]' });
    await cancel.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('harness-cancelled')).toHaveText('1');
    await expect(page.getByTestId('harness-result')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('c1 desktop: the photo centred at its largest, every control in one bottom bar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const dialog = await open(page, COOP);
    const img = (await dialog.getByTestId('photo-preview-image').boundingBox())!;
    const done = (await dialog.getByRole('button', { name: 'Gata' }).boundingBox())!;
    const cancel = (await dialog.getByRole('button', { name: 'Renunță' }).boundingBox())!;
    const crop = (await dialog.getByRole('button', { name: 'Decupează' }).boundingBox())!;
    // The controls share the bar under the photo; nothing floats over the picture.
    for (const b of [done, cancel, crop]) expect(b.y).toBeGreaterThanOrEqual(img.y + img.height);
    expect(cancel.x).toBeLessThan(crop.x);
    expect(crop.x).toBeLessThan(done.x);
    await expect(dialog.getByText('Cine e în poză?')).toBeVisible();
    await expectNoA11yViolations(page, { include: '[data-testid="photo-preview"]' });
  });

  test('c1 «Decupează» is disabled until the image is measured', async ({ page }) => {
    await page.addInitScript(() => {
      const real = window.createImageBitmap.bind(window);
      let release!: () => void;
      const gate = new Promise<void>(r => (release = r));
      (window as unknown as { __releaseMeasure: () => void }).__releaseMeasure = release;
      window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
        await gate;
        return real(...args);
      }) as typeof createImageBitmap;
    });
    const dialog = await open(page, SOLO);
    const crop = dialog.getByRole('button', { name: 'Decupează' });
    await expect(crop).toBeDisabled();
    await page.evaluate(() => (window as unknown as { __releaseMeasure: () => void }).__releaseMeasure());
    await expect(crop).toBeEnabled();
  });

  test('c2 crop is repeatable, each measured against the current image; «Gata» returns the smaller blob', async ({ page }) => {
    const dialog = await open(page, SOLO);
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    const overlay = dialog.getByTestId('crop-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.getByRole('radio', { name: '4:3' })).toHaveAttribute('aria-checked', 'true');
    await overlay.getByRole('radio', { name: '1:1' }).click();
    await overlay.getByRole('button', { name: 'Salvează' }).click();
    await expect(overlay).toBeHidden();
    await expect.poll(() => imageSize(page)).toEqual([900, 900]);

    // Second crop: 4:3 of the CURRENT 900×900 image (not of the 1200×900 original).
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    await overlay.getByRole('radio', { name: '4:3' }).click();
    await overlay.getByRole('button', { name: 'Salvează' }).click();
    await expect.poll(() => imageSize(page)).toEqual([900, 675]);

    await dialog.getByRole('button', { name: 'Gata' }).click();
    await expect(dialog).toBeHidden();
    const r = await result(page);
    expect(r).toMatchObject({ width: 900, height: 675, type: 'image/jpeg', tags: null, changed: true });
    expect(r.bytes).toBeLessThan(FIXTURE_BYTES);
  });

  test('c2 rotate and flip apply before the crop, the crop on the rotated size', async ({ page }) => {
    const dialog = await open(page, SOLO);
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    const overlay = dialog.getByTestId('crop-overlay');
    await overlay.getByRole('button', { name: 'Rotește' }).click();
    await overlay.getByRole('radio', { name: 'Original' }).click();
    await overlay.getByRole('button', { name: 'Salvează' }).click();
    // 90° clockwise: 1200×900 → 900×1200, and what was bottom-left (blue) is now top-left.
    await expect.poll(() => imageSize(page)).toEqual([900, 1200]);
    expect(dominant(await pixelAt(page, 0.1, 0.1))).toBe('blue');
    expect(dominant(await pixelAt(page, 0.9, 0.1))).toBe('red');

    // Flip + 1:1 on the rotated image: the square is cut from the 900×1200 portrait.
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    await overlay.getByRole('button', { name: 'Oglindește' }).click();
    await overlay.getByRole('radio', { name: '1:1' }).click();
    await overlay.getByRole('button', { name: 'Salvează' }).click();
    await expect.poll(() => imageSize(page)).toEqual([900, 900]);
    expect(dominant(await pixelAt(page, 0.1, 0.1))).toBe('red');
    expect(dominant(await pixelAt(page, 0.9, 0.9))).toBe('yellow');
  });

  test('c2 «Anulează» leaves the working image untouched; Escape in the crop goes back to the preview', async ({ page }) => {
    const dialog = await open(page, SOLO);
    const overlay = dialog.getByTestId('crop-overlay');
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    await overlay.getByRole('radio', { name: '1:1' }).click();
    await overlay.getByRole('button', { name: 'Anulează' }).click();
    await expect(overlay).toBeHidden();
    expect(await imageSize(page)).toEqual([1200, 900]);
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    await expect(overlay).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
    await expect(dialog).toBeVisible();
    expect(await imageSize(page)).toEqual([1200, 900]);
    // Nothing cropped: «Gata» reports the source unchanged (the form keeps the attached photo).
    await dialog.getByRole('button', { name: 'Gata' }).click();
    expect(await result(page)).toMatchObject({ width: 1200, height: 900, changed: false });
  });

  test('c2 while a crop is applied «Anulează» is disabled (as Escape is) — a crop is never applied after a cancel', async ({ page }) => {
    await page.addInitScript(() => {
      const real = HTMLCanvasElement.prototype.toBlob;
      let release!: () => void;
      const gate = new Promise<void>(r => (release = r));
      (window as unknown as { __releaseEncode: () => void }).__releaseEncode = release;
      HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback, ...rest: [string?, number?]) {
        void gate.then(() => real.call(this, cb, ...rest));
      };
    });
    const dialog = await open(page, SOLO);
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    const overlay = dialog.getByTestId('crop-overlay');
    await overlay.getByRole('radio', { name: '1:1' }).click();
    await overlay.getByRole('button', { name: 'Salvează' }).click();
    await expect(overlay.getByRole('button', { name: 'Se aplică…' })).toBeDisabled();
    const cancel = overlay.getByRole('button', { name: 'Anulează' });
    await expect(cancel).toBeDisabled();
    await cancel.click({ force: true });
    await page.keyboard.press('Escape');
    await expect(overlay).toBeVisible();
    await page.evaluate(() => (window as unknown as { __releaseEncode: () => void }).__releaseEncode());
    // The crop the user did not cancel lands; «Anulează» is live again on the next crop.
    await expect(overlay).toBeHidden();
    await expect.poll(() => imageSize(page)).toEqual([900, 900]);
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    await expect(overlay.getByRole('button', { name: 'Anulează' })).toBeEnabled();
  });

  test('c2 the selected crop preset reads as a light pill on the dark crop screen (fish rgba(255,255,255,0.18))', async ({ page }) => {
    const dialog = await open(page, SOLO);
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    const overlay = dialog.getByTestId('crop-overlay');
    // The computed background, resolved to sRGB rgba by painting it (browsers report oklab for Tailwind 4 colours).
    const bg = (name: string) =>
      overlay.getByRole('radio', { name }).evaluate(el => {
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.fillStyle = getComputedStyle(el).backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
      });
    await expect(overlay.getByRole('radio', { name: '4:3' })).toHaveAttribute('aria-checked', 'true');
    const [r, g, b, a] = await bg('4:3');
    expect(Math.min(r, g, b)).toBeGreaterThan(245);
    expect(a / 255).toBeCloseTo(0.18, 1);
    expect((await bg('1:1'))[3]).toBe(0);
  });

  test('c2 a detailed photo whose crop would re-encode over the upload cap steps quality down and stays ≤ 4 MB', async ({ page }) => {
    // Noise is the worst case for JPEG: 2800×2800 encodes to ~6.5 MB at 0.9 and ~3.5 MB at 0.6.
    await page.goto(`/dev/partide-poza?sesiune=${SOLO}`);
    await expect(page.locator('[data-testid="harness-members"][data-ready]')).toBeAttached();
    await pickNoise(page, 2800);
    const dialog = page.getByTestId('photo-preview');
    await expect.poll(() => imageSize(page), { timeout: 15_000 }).toEqual([2800, 2800]);
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    const overlay = dialog.getByTestId('crop-overlay');
    // «Original» + rotate: crops nothing, yet the image is re-encoded.
    await overlay.getByRole('button', { name: 'Rotește' }).click();
    await overlay.getByRole('radio', { name: 'Original' }).click();
    await overlay.getByRole('button', { name: 'Salvează' }).click();
    await expect(overlay).toBeHidden({ timeout: 20_000 });
    await dialog.getByRole('button', { name: 'Gata' }).click();
    const r = await result(page);
    expect(r).toMatchObject({ width: 2800, height: 2800, type: 'image/jpeg', changed: true });
    expect(r.bytes).toBeLessThanOrEqual(4 * 1024 * 1024);
  });

  test('c3 a crop that cannot fit the upload cap even at the lowest quality: «Nu am putut aplica decuparea. Încearcă din nou.»', async ({ page }) => {
    await page.goto(`/dev/partide-poza?sesiune=${SOLO}`);
    await expect(page.locator('[data-testid="harness-members"][data-ready]')).toBeAttached();
    await pickNoise(page, 4000);
    const dialog = page.getByTestId('photo-preview');
    await expect.poll(() => imageSize(page), { timeout: 15_000 }).toEqual([4000, 4000]);
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    const overlay = dialog.getByTestId('crop-overlay');
    await overlay.getByRole('radio', { name: 'Original' }).click();
    await overlay.getByRole('button', { name: 'Salvează' }).click();
    await expect(dialog.getByTestId('photo-preview-notice')).toHaveText('Nu am putut aplica decuparea. Încearcă din nou.', { timeout: 30_000 });
    await expect(overlay).toBeVisible();
    await overlay.getByRole('button', { name: 'Anulează' }).click();
    expect(await imageSize(page)).toEqual([4000, 4000]);
  });

  test('c2 keyboard and pointer: pan the image under the fixed frame, resize the freeform frame', async ({ page }) => {
    const dialog = await open(page, SOLO);
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    const overlay = dialog.getByTestId('crop-overlay');
    await overlay.getByRole('radio', { name: '1:1' }).click();
    const stage = overlay.getByTestId('crop-stage');
    await stage.focus();
    for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight');
    await overlay.getByRole('button', { name: 'Salvează' }).click();
    // Panned fully right → the square is the image's LEFT edge (red / blue quadrants).
    await expect.poll(() => imageSize(page)).toEqual([900, 900]);
    expect(dominant(await pixelAt(page, 0.05, 0.1))).toBe('red');
    expect(dominant(await pixelAt(page, 0.95, 0.1))).toBe('green');

    await dialog.getByRole('button', { name: 'Decupează' }).click();
    await overlay.getByRole('radio', { name: 'Liber' }).click();
    const handle = overlay.getByTestId('crop-handle-br');
    const box = (await handle.boundingBox())!;
    const frame = (await overlay.getByTestId('crop-frame').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - frame.width / 2, box.y + box.height / 2 - frame.height / 2, { steps: 8 });
    await page.mouse.up();
    await overlay.getByRole('button', { name: 'Salvează' }).click();
    await expect.poll(async () => (await imageSize(page))[0]).toBeLessThan(500);
    expect(dominant(await pixelAt(page, 0.5, 0.5))).toBe('red');
  });

  test('c3 a file that is not an image: «Nu am putut citi poza. Încearcă din nou.»', async ({ page }) => {
    await page.goto(`/dev/partide-poza?sesiune=${SOLO}`);
    await expect(page.locator('[data-testid="harness-members"][data-ready]')).toBeAttached();
    await page.getByTestId('harness-file').setInputFiles({ name: 'captura.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a jpeg at all') });
    const dialog = page.getByTestId('photo-preview');
    await expect(dialog.getByRole('alert')).toHaveText('Nu am putut citi poza. Încearcă din nou.');
    await expect(dialog.getByRole('button', { name: 'Decupează' })).toBeDisabled();
    // An unreadable file is never handed to the capture form.
    await expect(dialog.getByRole('button', { name: 'Gata' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Renunță' }).click();
    await expect(page.getByTestId('harness-cancelled')).toHaveText('1');
  });

  test('c3 a crop that fails: «Nu am putut aplica decuparea. Încearcă din nou.», the crop stays open', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
        setTimeout(() => cb(null), 0);
      };
    });
    const dialog = await open(page, SOLO);
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    const overlay = dialog.getByTestId('crop-overlay');
    await overlay.getByRole('button', { name: 'Salvează' }).click();
    await expect(dialog.getByTestId('photo-preview-notice')).toHaveText('Nu am putut aplica decuparea. Încearcă din nou.');
    await expect(overlay).toBeVisible();
    await expect(overlay.getByRole('button', { name: 'Salvează' })).toBeEnabled();
  });

  test('c4 solo partidă: no «Cine e în poză?»', async ({ page }) => {
    const dialog = await open(page, SOLO);
    await expect(page.getByTestId('harness-members')).toHaveText('1');
    await expect(dialog.getByTestId('photo-preview-image')).toBeVisible();
    await expect(dialog.getByText('Cine e în poză?')).toHaveCount(0);
    await expect(dialog.getByTestId('photo-tag-picker')).toHaveCount(0);
  });

  test('c4 + c5 co-op: «Toți» by default, one chip per member, deselecting everyone returns to «Toți»', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const dialog = await open(page, COOP);
    const picker = dialog.getByTestId('photo-tag-picker');
    await expect(picker.getByText('Cine e în poză?')).toBeVisible();
    const toti = picker.getByRole('button', { name: 'Toți' });
    const ana = picker.getByRole('button', { name: 'Ana Crap' });
    const mihai = picker.getByRole('button', { name: 'Mihai Somn' });
    await expect(picker.getByRole('button')).toHaveCount(4);
    await expect(toti).toHaveAttribute('aria-pressed', 'true');
    const helper = picker.getByTestId('photo-tag-helper');
    await expect(helper).toHaveText('Poza apare pe profilul tuturor membrilor, dacă partida e publică.');

    await ana.click();
    await expect(toti).toHaveAttribute('aria-pressed', 'false');
    await expect(ana).toHaveAttribute('aria-pressed', 'true');
    await expect(helper).toHaveText('Poza apare doar pe profilul celor selectați, dacă partida e publică.');
    await mihai.click();
    await ana.click();
    await mihai.click();
    await expect(toti).toHaveAttribute('aria-pressed', 'true');
    await expect(helper).toHaveText('Poza apare pe profilul tuturor membrilor, dacă partida e publică.');

    await mihai.click();
    await expectNoA11yViolations(page, { include: '[data-testid="photo-preview"]' });
    await dialog.getByRole('button', { name: 'Gata' }).click();
    // c5: the tags only name whose gallery shows the photo — the same blob goes back either way.
    expect(await result(page)).toMatchObject({ tags: ['u-mihai'], width: 1200, height: 900, changed: false });
  });

  test('c6 «Gata» returns the image and «Toți»; re-opening restores the preselected tags', async ({ page }) => {
    const dialog = await open(page, COOP);
    await dialog.getByRole('button', { name: 'Gata' }).click();
    expect(await result(page)).toMatchObject({ tags: null, width: 1200, height: 900, type: 'image/jpeg', changed: false });

    const again = await open(page, COOP, '&etichete=u-ana,u-self');
    const picker = again.getByTestId('photo-tag-picker');
    await expect(picker.getByRole('button', { name: 'Toți' })).toHaveAttribute('aria-pressed', 'false');
    await expect(picker.getByRole('button', { name: 'Ana Crap' })).toHaveAttribute('aria-pressed', 'true');
    await expect(picker.getByRole('button', { name: 'Eu Pescar' })).toHaveAttribute('aria-pressed', 'true');
    await expect(picker.getByRole('button', { name: 'Mihai Somn' })).toHaveAttribute('aria-pressed', 'false');
    // A fast double activation hands the result over once: two clicks in the SAME task, before any
    // re-render could disable or unmount the button — only the latch stops the second.
    await expect(page.getByTestId('harness-done-count')).toHaveText('0');
    await again.getByTestId('photo-preview-done').evaluate(btn => {
      (btn as HTMLButtonElement).click();
      (btn as HTMLButtonElement).click();
    });
    await expect(page.getByTestId('harness-result')).toBeVisible();
    expect((await result(page)).tags.sort()).toEqual(['u-ana', 'u-self']);
    await expect(page.getByTestId('harness-done-count')).toHaveText('1');
  });

  test('keyboard: Escape = «Renunță», focus stays inside the dialog', async ({ page }) => {
    const dialog = await open(page, COOP);
    await expect(dialog.getByRole('button', { name: 'Decupează' })).toBeEnabled();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="photo-preview"]') || document.activeElement === document.body)).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('harness-cancelled')).toHaveText('1');
    await expect(page.getByTestId('harness-result')).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------------------------------------
 * The real route: /partide/[id]/captura with a fake-live co-op partidă
 * ---------------------------------------------------------------------------------------------- */

test.describe('partide.captura-poza on /partide/[id]/captura', () => {
  const LIVE = { documentId: 'e2e-poza-live', clientId: 'e2e-pozac-live' };
  const PHOTO_URL = 'https://e2e-photos.invalid/somn.jpg';
  let selfId = '';
  let jwt = '';

  test.beforeAll(async ({ request }) => {
    jwt = await qaJwt(request);
    const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
    expect(me.ok(), 'QA profile read').toBe(true);
    selfId = (await me.json()).documentId as string;
  });

  test.beforeEach(async ({ context }) => {
    await signIn(context, jwt);
  });

  const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  const liveDoc = (): FakeLiveDoc => ({
    startedAt: ago(120),
    endedAt: null,
    status: 'active',
    venueType: 'lake',
    lakeId: 'e2e-lake-1',
    lakeName: 'Balta Mock',
    standName: '7',
    plannedDurationMs: 8 * 3_600_000,
    visibleOnProfile: true,
    hostUid: selfId,
    members: [member(selfId, 'Eu Pescar'), member('u-ana', 'Ana Crap'), member('u-mihai', 'Mihai Somn')],
    targetSpecies: [{ documentId: 'f-somn', name: 'Somn' }],
    rods: [],
    catches: [
      {
        clientId: 'ev-photo',
        outcome: 'capture',
        occurredAt: ago(60),
        rodIndex: null,
        weightKg: 8.69,
        weightEstimated: false,
        species: 'Somn',
        speciesId: 'f-somn',
        bait: 'Viermi',
        photoUrl: PHOTO_URL,
        photoFileId: 77,
        photoTagUids: ['u-ana'],
      },
    ],
    rev: 2,
  });

  type Calls = { events: Record<string, unknown>[]; uploads: number; eventPatches: { eventDocumentId: string; data: Record<string, unknown> }[]; unmocked: string[] };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  /** Every CMS write recorded and answered here; an unmocked write is recorded as a failure, never sent. */
  async function mockCms(page: Page, { photoReadable = true } = {}): Promise<Calls> {
    const calls: Calls = { events: [], uploads: 0, eventPatches: [], unmocked: [] };
    await page.route('**/api/cms/**', route => {
      if (route.request().method() === 'GET' || route.request().method() === 'HEAD') return route.fallback();
      calls.unmocked.push(`${route.request().method()} ${route.request().url()}`);
      return route.abort();
    });
    // The <img> thumb always loads; the form's fetch() of it (the reopen) fails when unreadable — what
    // a CDN without CORS for this origin, or a dropped connection, looks like to the page.
    await page.route('https://e2e-photos.invalid/**', r =>
      !photoReadable && r.request().resourceType() === 'fetch'
        ? r.abort('failed')
        : r.fulfill({ status: 200, contentType: 'image/jpeg', path: FIXTURE, headers: { 'access-control-allow-origin': '*' } }),
    );
    await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
    await page.route('**/api/cms/feed/session-follows/mine', route => json(route, { data: { sessionDocumentIds: [] } }));
    await page.route(/\/fishes(\?.*)?$/, route =>
      json(route, { data: [{ id: 3, documentId: 'f-somn', Name: 'Somn', competitionPriority: 3, partidaDefaultRank: 1 }], meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 1 } } }),
    );
    await page.route('**/api/cms/feed/sessions/active', route => json(route, { data: { documentId: LIVE.documentId, clientId: LIVE.clientId, firestoreId: LIVE.clientId } }));
    await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, route => json(route, { data: [], meta: { page: 1, pageSize: 100, total: 0 } }));
    await page.route('**/api/cms/feed/sessions/photo', route => {
      calls.uploads += 1;
      return json(route, { fileId: 4242, url: 'https://e2e-photos.invalid/up.jpg', thumbUrl: null });
    });
    await page.route(/\/api\/cms\/feed\/sessions\/(e2e-[^/?]+)(\/[^?]*)?(\?.*)?$/, route => {
      const rest = /\/feed\/sessions\/e2e-[^/]+(\/.*)?$/.exec(new URL(route.request().url()).pathname)![1] ?? '';
      const method = route.request().method();
      if (method === 'POST' && rest === '/events') {
        const body = (route.request().postDataJSON() as { data: Record<string, unknown> }).data;
        calls.events.push(body);
        return json(route, { data: { ...body, id: 901, documentId: `evd-${body.clientId as string}`, photoUrl: null, photoThumbUrl: null, notes: null, photoTagUids: [] } });
      }
      if (method === 'PATCH' && rest.startsWith('/events/')) {
        calls.eventPatches.push({ eventDocumentId: rest.slice('/events/'.length), data: (route.request().postDataJSON() as { data: Record<string, unknown> }).data });
        return json(route, { data: { ok: true } });
      }
      return route.fallback();
    });
    return calls;
  }

  const dialogOf = (page: Page) => page.getByTestId('photo-preview');
  const save = (page: Page) => page.getByTestId('capture-save');

  test('c6 + c8 a new catch: pick → crop 1:1 → «Gata» → the thumb; the members are the live session’s; save uploads the cropped photo', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    const calls = await mockCms(page);
    const uploaded: { width: number; height: number }[] = [];
    await page.route('**/api/cms/feed/sessions/photo', async route => {
      calls.uploads += 1;
      const buf = route.request().postDataBuffer()!;
      // The JPEG's SOF0/SOF2 marker carries height then width.
      for (let i = 0; i < buf.length - 9; i++) {
        if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc2)) {
          uploaded.push({ height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) });
          break;
        }
      }
      return json(route, { fileId: 4242, url: 'https://e2e-photos.invalid/up.jpg', thumbUrl: null });
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/partide/${LIVE.documentId}/captura`);
    await page.getByTestId('photo-input').setInputFiles(FIXTURE);
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    const picker = dialog.getByTestId('photo-tag-picker');
    await expect(picker.getByRole('button')).toHaveCount(4);
    await expect(picker.getByRole('button', { name: 'Toți' })).toHaveAttribute('aria-pressed', 'true');
    await expect(picker.getByRole('button', { name: 'Ana Crap' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    await dialog.getByTestId('crop-overlay').getByRole('radio', { name: '1:1' }).click();
    await dialog.getByTestId('crop-overlay').getByRole('button', { name: 'Salvează' }).click();
    await expect.poll(() => imageSize(page)).toEqual([900, 900]);
    await dialog.getByRole('button', { name: 'Gata' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('detail-photo-thumb')).toBeVisible();
    await save(page).click();
    await expect.poll(() => calls.events.length).toBe(1);
    expect(calls.events[0]).not.toHaveProperty('photo');
    await expect.poll(() => calls.uploads).toBe(1);
    expect(uploaded).toEqual([{ width: 900, height: 900 }]);
    await expect.poll(() => calls.eventPatches.length).toBe(1);
    expect(calls.eventPatches[0]).toEqual({ eventDocumentId: 'evd-' + (calls.events[0].clientId as string), data: { photo: 4242 } });
    expect(calls.unmocked).toEqual([]);
  });

  test('c6 + c11 edit: reopening the uploaded photo restores its tags; «Gata» without a crop → no upload, no `photo`, nothing patched', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    const calls = await mockCms(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/partide/${LIVE.documentId}/captura?editare=ev-photo`);
    await expect(page.getByTestId('detail-photo-thumb')).toBeVisible();
    await page.getByTestId('detail-photo').click();
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    expect(await imageSize(page).catch(() => null)).not.toBeNull();
    const picker = dialog.getByTestId('photo-tag-picker');
    await expect(picker.getByRole('button', { name: 'Ana Crap' })).toHaveAttribute('aria-pressed', 'true');
    await expect(picker.getByRole('button', { name: 'Toți' })).toHaveAttribute('aria-pressed', 'false');
    await expect(picker.getByRole('button', { name: 'Mihai Somn' })).toHaveAttribute('aria-pressed', 'false');
    await dialog.getByRole('button', { name: 'Gata' }).click();
    await expect(dialog).toBeHidden();
    await save(page).click();
    await expect.poll(() => calls.events.length).toBe(1);
    expect(calls.events[0]).toMatchObject({ clientId: 'ev-photo' });
    expect(calls.events[0]).not.toHaveProperty('photo');
    await page.waitForTimeout(1300);
    expect(calls.uploads).toBe(0);
    expect(calls.eventPatches).toEqual([]);
    expect(calls.unmocked).toEqual([]);
  });

  test('c6 + c11 edit: only the tags change → no upload, no `photo`; ONLY photoTagUids is patched', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    const calls = await mockCms(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/partide/${LIVE.documentId}/captura?editare=ev-photo`);
    await page.getByTestId('detail-photo').click();
    const dialog = dialogOf(page);
    await dialog.getByTestId('photo-tag-picker').getByRole('button', { name: 'Mihai Somn' }).click();
    await dialog.getByRole('button', { name: 'Gata' }).click();
    await expect(dialog).toBeHidden();
    await save(page).click();
    await expect.poll(() => calls.events.length).toBe(1);
    expect(calls.events[0]).not.toHaveProperty('photo');
    await expect.poll(() => calls.eventPatches.length).toBe(1);
    expect(calls.eventPatches[0].eventDocumentId).toBe('evd-ev-photo');
    expect(Object.keys(calls.eventPatches[0].data)).toEqual(['photoTagUids']);
    expect((calls.eventPatches[0].data.photoTagUids as string[]).sort()).toEqual(['u-ana', 'u-mihai']);
    await page.waitForTimeout(800);
    expect(calls.uploads).toBe(0);
    expect(calls.unmocked).toEqual([]);
  });

  test('c11 edit: cropping the reopened photo replaces it → upload + `photo` PATCH', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    const calls = await mockCms(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/partide/${LIVE.documentId}/captura?editare=ev-photo`);
    await page.getByTestId('detail-photo').click();
    const dialog = dialogOf(page);
    await dialog.getByRole('button', { name: 'Decupează' }).click();
    await dialog.getByTestId('crop-overlay').getByRole('radio', { name: '1:1' }).click();
    await dialog.getByTestId('crop-overlay').getByRole('button', { name: 'Salvează' }).click();
    await expect.poll(() => imageSize(page)).toEqual([900, 900]);
    await dialog.getByRole('button', { name: 'Gata' }).click();
    await expect(dialog).toBeHidden();
    await save(page).click();
    await expect.poll(() => calls.uploads).toBe(1);
    await expect.poll(() => calls.eventPatches.some(p => p.data.photo === 4242)).toBe(true);
    expect(calls.unmocked).toEqual([]);
  });

  test('c3 the uploaded photo cannot be read back (CORS / network) → «Nu am putut pregăti poza…» toast, the photo stays attached', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    const calls = await mockCms(page, { photoReadable: false });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/partide/${LIVE.documentId}/captura?editare=ev-photo`);
    await page.getByTestId('detail-photo').click();
    await expect(page.getByText('Nu am putut pregăti poza. Încearcă din nou.')).toBeVisible();
    await expect(dialogOf(page)).toBeHidden();
    await expect(page.getByTestId('detail-photo-thumb')).toBeVisible();
    expect(calls.unmocked).toEqual([]);
  });
});

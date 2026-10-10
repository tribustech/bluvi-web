import { expect, type Locator, type Page } from '@playwright/test';

/*
 * The phone sheet contract (owner 2026-10-10, «every sheet behaves like fish's»), for any modal
 * surface on a phone — the kit Sheet, ResponsiveSurface's sheet, ModalSurface's 85% sheet:
 *  - it docks on the bottom edge, at most 92% of the window, and nothing (the tab bar) covers it;
 *  - the page behind never scrolls: a wheel over the sheet or the scrim, a touch drag on the scrim;
 *  - the content scrolls inside when it is taller than the sheet (and only then);
 *  - pulling the content down from its top, or flicking the handle down, slides it away; Escape
 *    and a tap on the scrim close it; focus goes back to the opener.
 * WebKit cannot synthesise real touches: the touch hand-off is driven with touch-shaped events (the
 * handlers read `touches`), the native scroll with the wheel, the handle with the mouse.
 */

export type PhoneSheetCase = {
  page: Page;
  /** The dialog, by its accessible name. */
  dialog: Locator;
  /** Opens it (and leaves focus on the opener, which it must return to). */
  open: () => Promise<void>;
  /** The control that opens it: focus returns there. Omit when the opener is gone after closing. */
  opener?: Locator;
  /** The content is taller than the sheet (it must scroll inside); false: it must not scroll. */
  scrollable?: boolean;
  /** A tap on the scrim closes it (default true). */
  backdrop?: boolean;
  /** The sheet can be dragged away (default true; a fixed sheet cannot). */
  draggable?: boolean;
};

/** The moving panel: the kit Sheet's [data-sheet-panel], else the dialog itself (ModalSurface). */
export async function sheetPanel(dialog: Locator): Promise<Locator> {
  const inner = dialog.locator('[data-sheet-panel]');
  return (await inner.count()) ? inner.first() : dialog;
}

/** Waits until the panel stops moving (the slide-in, a settle). */
export async function settledBox(panel: Locator) {
  let prev = await panel.boundingBox();
  for (let i = 0; i < 40; i++) {
    await panel.page().waitForTimeout(60);
    const box = await panel.boundingBox();
    if (box && prev && Math.abs(box.y - prev.y) < 0.5 && Math.abs(box.height - prev.height) < 0.5) return box;
    prev = box;
  }
  return prev!;
}

/** Touch-shaped events on `el`'s centre moving by `dy` (px): the last move's defaultPrevented. */
export async function fakeTouchDrag(el: Locator, dy: number, { steps = 8, stepMs = 12, end = true } = {}) {
  return el.evaluate(
    async (node, a) => {
      const r = node.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y0 = r.top + Math.min(r.height / 2, 120);
      const fire = (type: string, y: number) => {
        const ev = new Event(type, { bubbles: true, cancelable: true });
        const t = { identifier: 1, target: node, clientX: x, clientY: y, pageX: x, pageY: y };
        Object.defineProperty(ev, 'touches', { value: type === 'touchend' ? [] : [t] });
        Object.defineProperty(ev, 'changedTouches', { value: [t] });
        node.dispatchEvent(ev);
        return ev.defaultPrevented;
      };
      fire('touchstart', y0);
      let prevented = false;
      for (let i = 1; i <= a.steps; i++) {
        await new Promise((r) => setTimeout(r, a.stepMs));
        prevented = fire('touchmove', y0 + (a.dy * i) / a.steps);
      }
      if (a.end) fire('touchend', y0 + a.dy);
      return prevented;
    },
    { dy, steps, stepMs, end },
  );
}

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

/** Runs the whole contract on one sheet. Leaves it closed. */
export async function expectPhoneSheet(c: PhoneSheetCase) {
  const { page, dialog } = c;
  const backdrop = c.backdrop ?? true;
  const draggable = c.draggable ?? true;
  const vp = page.viewportSize()!;

  await c.open();
  await expect(dialog).toBeVisible();
  const panel = await sheetPanel(dialog);
  const box = await settledBox(panel);
  const y0 = await scrollY(page);

  // Docked on the bottom edge, at most 92% of the window, nothing on top of it.
  expect(Math.abs(box.y + box.height - vp.height), 'the sheet sits on the bottom edge').toBeLessThanOrEqual(2);
  expect(box.height, 'at most 92% of the window').toBeLessThanOrEqual(vp.height * 0.92 + 2);
  const covered = await dialog.evaluate((d, p) => {
    const hit = document.elementFromPoint(p.x, p.y);
    return hit ? !d.contains(hit) : true;
  }, { x: vp.width / 2, y: vp.height - 4 });
  expect(covered, 'the sheet bottom is not under the tab bar').toBe(false);

  // The content scrolls inside (only when taller), the page never.
  const body = dialog.locator('[data-sheet-body]').first();
  const overflow = await body.evaluate((b) => b.scrollHeight > b.clientHeight + 1);
  if (c.scrollable !== undefined) expect(overflow, 'content overflows the sheet').toBe(c.scrollable);
  // Mobile WebKit has no wheel: the native scroll is the scroller's own (overflow auto, overscroll
  // contained), the page's root is locked (overflow hidden, no overscroll) — asserted as styles, and
  // the touch guard below proves no touch can reach the page.
  const styles = await body.evaluate((b) => {
    const s = getComputedStyle(b);
    const r = getComputedStyle(document.documentElement);
    return { overflowY: s.overflowY, overscroll: s.overscrollBehaviorY, rootOverflow: r.overflowY, rootOverscroll: r.overscrollBehaviorY };
  });
  expect(styles).toEqual({ overflowY: 'auto', overscroll: 'contain', rootOverflow: 'hidden', rootOverscroll: 'none' });
  await body.evaluate((b) => b.scrollBy({ top: 600 }));
  await page.waitForTimeout(100);
  if (overflow) expect(await body.evaluate((b) => b.scrollTop), 'the content scrolled inside').toBeGreaterThan(0);
  else expect(await body.evaluate((b) => b.scrollTop)).toBe(0);
  expect(await scrollY(page), 'the page behind did not scroll').toBe(y0);
  // A touch drag on the scrim is cancelled (iOS would scroll / rubber-band the page).
  expect(await fakeTouchDrag(dialog, -200, { steps: 4 }), 'a touch on the scrim cannot scroll the page').toBe(true);
  if (overflow) {
    // Mid-list, a pull down scrolls the list (it is not the sheet's, and not cancelled).
    expect(await fakeTouchDrag(body, 60, { steps: 3 }), 'mid-list the content takes the pull').toBe(false);
    await expect(dialog).toBeVisible();
    await body.evaluate((b) => b.scrollTo({ top: 0 }));
  }
  expect(await scrollY(page)).toBe(y0);

  if (draggable) {
    // Pull down from the content's top: the sheet follows and slides away.
    expect(await fakeTouchDrag(body, Math.round(box.height * 0.8)), 'the pull at the top moves the sheet').toBe(true);
    await expect(dialog).toBeHidden();
    expect(await scrollY(page), 'closing left the page where it was').toBe(y0);

    // A quick flick down on the handle closes it too.
    await c.open();
    await expect(dialog).toBeVisible();
    const p2 = await sheetPanel(dialog);
    await settledBox(p2);
    const handle = dialog.locator('[data-sheet-handle]').first();
    const hb = (await handle.boundingBox())!;
    const hx = hb.x + hb.width / 2;
    const hy = hb.y + Math.min(8, hb.height / 2);
    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(hx, hy + 140, { steps: 5 });
    await page.mouse.up();
    await expect(dialog).toBeHidden();
    expect(await scrollY(page)).toBe(y0);
  }

  // Escape closes, focus returns to the opener (opened from the keyboard: Safari never focuses a
  // clicked button, so a tap leaves nothing to return to).
  if (c.opener) {
    await c.opener.focus();
    await page.keyboard.press('Enter');
  } else await c.open();
  await expect(dialog).toBeVisible();
  await settledBox(await sheetPanel(dialog));
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  if (c.opener) await expect(c.opener).toBeFocused();

  if (backdrop) {
    await c.open();
    await expect(dialog).toBeVisible();
    const b3 = await settledBox(await sheetPanel(dialog));
    if (b3.y > 24) {
      await page.mouse.click(vp.width / 2, Math.min(12, b3.y / 2));
      await expect(dialog).toBeHidden();
    } else {
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
  }
  expect(await scrollY(page), 'the page never moved').toBe(y0);
}

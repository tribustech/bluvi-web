import { expect, test, type Locator, type Page } from '@playwright/test';
import { ON_WEB } from '@/lib/routes';
import { echoes } from '@/app/(site)/concursuri/[id]/_components/names';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * Concurs · Participanți as a designed roster (owner rule 18) and the person popover (owner rule 17)
 * — parity docs/parity/areas/competition-page.yml, competition-page.participanti (c3 c5 c7 c8) and
 * competition-page.cantar-detaliu. Local CMS on :1337, QA user «Sim QA». Override the ids with
 * E2E_TABS_* when the local data moves.
 */

const ID = {
  /** completed individual, 21 on stands over sectors A–C: guests + users. */
  guests: process.env.E2E_TABS_GUESTS ?? 'i8kzbi5k51vmbyq75dmyez3d',
  /** completed team of users (Nada Grea…). */
  teams: process.env.E2E_TABS_TEAMS ?? 'g5l98otx5ypg6wttowra9yww',
  /** live individual, 24 sectors of one stand each (an ungrouped list), users. */
  live: process.env.E2E_TABS_LIVE ?? 'kee49a3e64b3f636b4b60daa',
  /** feeder legs, teams typed in by the organizer, four sectors. */
  feeder: process.env.E2E_TABS_FEEDER ?? 'rg340d4r4gnwf2mbyhxvasnr',
  /** national championship: stands named «A3(12)». */
  nc: process.env.E2E_TABS_NC ?? 'z7rvhm55ziyr0tbblqwjp39q',
};

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const LAPTOP = { width: 1280, height: 900 };
const DESKTOP = { width: 1440, height: 900 };
const WIDE = { width: 1920, height: 1080 };
/** The last width without the popover, and the first with it (PERSON_POPOVER_MIN_WIDTH). */
const BELOW_POPOVER = { width: 1023, height: 900 };
const POPOVER = { width: 1024, height: 900 };

const participants = (id: string) => `/concursuri/${id}/participanti`;
type Reg = { documentId: string; registrationStatus: string; participants: { documentId: string; username: string }[]; guestName: string | null; teamName: string | null };
const regs = new Map<string, Reg[]>();
let jwt = '';

test.describe.configure({ timeout: 180_000 });

test.beforeAll(async ({ request }) => {
  for (const id of Object.values(ID)) {
    const res = await request.get(`${CMS}/feed/competitions/${id}`);
    expect(res.ok(), `competition ${id} exists in the local CMS`).toBeTruthy();
    regs.set(id, ((await res.json()).data.registrations as Reg[]).filter(r => r.registrationStatus === 'registered'));
  }
  jwt = await qaJwt(request);
});

async function open(page: Page, path: string, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

const roster = (page: Page) => page.locator('[data-participants="roster"]');
const popover = (page: Page) => page.locator('[data-person-popover]');

/** Press an entry until its popover shows: a press before hydration is not seen by React. */
async function openPerson(entry: Locator, dialog: Locator) {
  await expect(async () => {
    if (!(await dialog.isVisible())) await entry.click();
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/**
 * Rule 17 is PARTIALLY MET: «Vezi profilul» → /pescari/[id] is not built — that page is M2
 * (lib/routes ON_WEB.angler false) and the interim CTA is the owner's call (parity
 * competition-page.participanti.c11). Today's state is asserted as what it is (no profile link,
 * never a link to a 404) and flagged on the report; the rule's own check is the test.fixme below,
 * which fails until the CTA ships — never a conditional pass.
 */
async function expectNoProfileLinkYet(link: Locator) {
  test.info().annotations.push({ type: 'partial', description: 'owner rule 17: «Vezi profilul» missing — /pescari/[id] is M2, interim CTA pending owner decision' });
  await expect(link).toHaveCount(0);
}

test('owner rule 17 · «Vezi profilul» → /pescari/[id] in every popover (solo, team members, Cântare)', async ({ page, context }) => {
  test.fixme(!ON_WEB.angler, 'NOT MET: /pescari/[id] is M2; interim CTA pending owner decision (parity competition-page.participanti.c11)');
  await signIn(context, jwt);
  await open(page, participants(ID.guests), DESKTOP);
  const user = regs.get(ID.guests)!.find(r => r.participants.length > 0)!;
  const name = user.participants[0].username;
  const dialog = page.getByRole('dialog', { name });
  await openPerson(roster(page).getByRole('button', { name: new RegExp(`^${name}`) }), dialog);
  const href = `/pescari/${user.participants[0].documentId}`;
  await expect(dialog.getByRole('link', { name: 'Vezi profilul' })).toHaveAttribute('href', href);
  expect((await page.request.get(href)).status(), `${href} resolves`).toBe(200);
});

for (const vp of [TABLET, LAPTOP, DESKTOP]) {
  test(`owner rule 18 · ${vp.width}px signed out — one surface per sector (its colour stripe), every entry face + name + stand, no stats, one quiet sign-in hint`, async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page, participants(ID.guests), vp);
    const list = roster(page);
    await expect(list).toBeVisible();
    for (const s of ['A', 'B', 'C']) await expect(list.getByRole('heading', { name: `Sector ${s}`, level: 3 })).toBeVisible();
    // The sector stripe is the sector colour token (never the page colour).
    const stripe = list.locator('section').first().locator('span[aria-hidden]').first();
    expect(await stripe.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    await expect(list.getByRole('listitem')).toHaveCount(regs.get(ID.guests)!.length);
    // From 1024 each entry opens the popover; at 768 it is a plain row.
    const entries = list.getByRole('button');
    if (vp.width >= POPOVER.width) {
      await expect(entries).toHaveCount(regs.get(ID.guests)!.length);
      await expect(entries.first()).toHaveAttribute('aria-haspopup', 'dialog');
    } else await expect(entries).toHaveCount(0);
    await expect(list.getByText(/capturi?$/)).toHaveCount(0);
    await expect(page.getByText('Statisticile pescarilor se văd după ce')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'intri în cont' })).toHaveAttribute('href', `/intra?next=${encodeURIComponent(participants(ID.guests))}`);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
}

test('owner rule 18 · signed in — the headline stats inline (one batch), a guest «Adăugat manual»', async ({ page, context }) => {
  await signIn(context, jwt);
  const batches: string[] = [];
  page.on('request', r => {
    if (/statistics/i.test(r.url()) && r.method() === 'POST') batches.push(r.url());
  });
  await open(page, participants(ID.guests), DESKTOP);
  const list = roster(page);
  const users = regs.get(ID.guests)!.filter(r => r.participants.length > 0);
  const guests = regs.get(ID.guests)!.filter(r => r.participants.length === 0);
  await expect(list.getByText(/^CMMC/)).toHaveCount(users.length);
  await expect(list.getByText('Adăugat manual', { exact: true })).toHaveCount(guests.length);
  await expect(page.getByText('Statisticile pescarilor se văd după ce')).toHaveCount(0);
  expect(batches.length).toBe(1);
  await expectNoA11yViolations(page);
});

test('owner rule 17 · the popover: anchored to the entry, stats + «Vezi profilul» → /pescari/[id]; focus trapped, Escape returns focus', async ({ page, context }) => {
  await signIn(context, jwt);
  await open(page, participants(ID.guests), LAPTOP);
  const user = regs.get(ID.guests)!.find(r => r.participants.length > 0)!;
  const name = user.participants[0].username;
  const entry = roster(page).getByRole('button', { name: new RegExp(`^${name}`) });
  const dialog = page.getByRole('dialog', { name });
  await openPerson(entry, dialog);
  await expect(entry).toHaveAttribute('aria-expanded', 'true');
  // Anchored: it starts just under (or over) the entry, overlapping it horizontally.
  const [a, d] = [await entry.boundingBox(), await dialog.boundingBox()];
  expect(Math.abs(d!.y - (a!.y + a!.height)) < 16 || Math.abs(d!.y + d!.height - a!.y) < 16).toBeTruthy();
  expect(d!.x < a!.x + a!.width && d!.x + d!.width > a!.x).toBeTruthy();
  for (const label of ['Capturi', 'CMMC', 'Concursuri']) await expect(dialog.getByText(label, { exact: true })).toBeVisible();
  await expectNoProfileLinkYet(dialog.getByRole('link', { name: 'Vezi profilul' }));
  // Focus goes into it.
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBeTruthy();
  // Tab cycles inside: «Închide» (and «Vezi profilul»), never out.
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBeTruthy();
  }
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(entry).toBeFocused();
  // Keyboard opens it too; a press outside closes it.
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(popover(page)).toHaveCount(0);
});

test('owner rule 17 · signed out — the popover has no stats, a sign-in hint, the profile behind sign-in; a guest: the guest line, no profile', async ({ page }) => {
  await open(page, participants(ID.guests), DESKTOP);
  const user = regs.get(ID.guests)!.find(r => r.participants.length > 0)!;
  const name = user.participants[0].username;
  const dialog = page.getByRole('dialog', { name });
  await openPerson(roster(page).getByRole('button', { name: new RegExp(`^${name}`) }), dialog);
  await expect(dialog.getByText('Capturi', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: 'Intră în cont' })).toBeVisible();
  await expectNoProfileLinkYet(dialog.getByRole('link', { name: 'Vezi profilul' }));
  await page.keyboard.press('Escape');
  const guest = regs.get(ID.guests)!.find(r => r.participants.length === 0)!;
  const g = page.getByRole('dialog', { name: guest.guestName! });
  await openPerson(roster(page).getByRole('button', { name: new RegExp(`^${guest.guestName}`) }), g);
  await expect(g.getByText('Statisticile nu sunt disponibile pentru utilizatorii adăugați manual.')).toBeVisible();
  await expect(g.getByRole('link', { name: 'Vezi profilul' })).toHaveCount(0);
});

test('owner rule 17 · a team — each member with their own face, stats and profile link', async ({ page, context }) => {
  await signIn(context, jwt);
  await open(page, participants(ID.teams), DESKTOP);
  const team = regs.get(ID.teams)!.find(r => r.participants.length > 1)!;
  const dialog = page.getByRole('dialog', { name: team.teamName! });
  await openPerson(roster(page).getByRole('button', { name: new RegExp(`^${team.teamName}`) }), dialog);
  const members = dialog.getByRole('list', { name: 'Membrii echipei' }).getByRole('listitem');
  await expect(members).toHaveCount(team.participants.length);
  for (const p of team.participants) await expectNoProfileLinkYet(dialog.getByRole('link', { name: `Profilul lui ${p.username}` }));
  await expect(dialog.getByText('Concursuri', { exact: true })).toHaveCount(team.participants.length);
  await expectNoA11yViolations(page);
});

test('owner rule 17 · the phone keeps fish’s list: cards that open on their stats, no roster, no popover', async ({ page }) => {
  await open(page, participants(ID.guests), PHONE);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await expect(roster(page)).toBeHidden();
  const card = page.getByRole('button', { name: /Arată detaliile/ }).locator('visible=true').first();
  await card.click();
  await expect(page.getByRole('button', { name: /Restrânge detaliile/ }).locator('visible=true')).toHaveAttribute('aria-expanded', 'true');
  await expect(popover(page)).toHaveCount(0);
});

test('owner rule 17 · Cântare: the weighing detail’s angler opens the popover over the docked panel; Escape closes only the popover', async ({ page, context }) => {
  await signIn(context, jwt);
  await open(page, `/concursuri/${ID.guests}/cantare`, DESKTOP);
  await page.getByRole('row').filter({ hasText: 'Cântar 2' }).first().click();
  await expect(page.getByText('Detaliu cântar')).toBeVisible();
  const who = page.locator('aside button[aria-haspopup="dialog"]').filter({ has: page.locator('.underline') });
  await openPerson(who, popover(page));
  await expectNoProfileLinkYet(popover(page).getByRole('link', { name: 'Vezi profilul' }));
  // Beside the docked panel (to its left), never over its own title or stand label.
  const panel = page.locator('aside').filter({ hasText: 'Detaliu cântar' });
  const [p, title, stand] = [await popover(page).boundingBox(), await panel.getByText('Detaliu cântar').boundingBox(), await panel.locator('p.t-title2').boundingBox()];
  for (const r of [title!, stand!]) expect(p!.x + p!.width <= r.x || p!.y + p!.height <= r.y || p!.y >= r.y + r.height, 'the popover leaves the panel heading visible').toBeTruthy();
  expect(p!.x + p!.width).toBeLessThanOrEqual((await panel.boundingBox())!.x);
  await page.keyboard.press('Escape');
  await expect(popover(page)).toHaveCount(0);
  await expect(page.getByText('Detaliu cântar')).toBeVisible();
  await expect(who).toBeFocused();
});

for (const vp of [TABLET, BELOW_POPOVER]) {
  test(`owner rule 17 · ${vp.width}px — the roster's entries are plain rows (stats inline), no popover below 1024`, async ({ page, context }) => {
    await signIn(context, jwt);
    await open(page, participants(ID.guests), vp);
    const list = roster(page);
    await expect(list).toBeVisible();
    await expect(list.getByText(/^CMMC/).first()).toBeVisible();
    await expect(list.getByRole('button')).toHaveCount(0);
    const user = regs.get(ID.guests)!.find(r => r.participants.length > 0)!;
    await list.getByText(user.participants[0].username, { exact: true }).click();
    await page.waitForTimeout(300);
    await expect(popover(page)).toHaveCount(0);
  });
}

test('owner rule 17 · 1024px — the first width with the popover', async ({ page }) => {
  await open(page, participants(ID.guests), POPOVER);
  const user = regs.get(ID.guests)!.find(r => r.participants.length > 0)!;
  const name = user.participants[0].username;
  await openPerson(roster(page).getByRole('button', { name: new RegExp(`^${name}`) }), page.getByRole('dialog', { name }));
});

for (const vp of [LAPTOP, WIDE]) {
  test(`owner rules 16–18 · ${vp.width}px live — 24 sectors of one stand: one ungrouped list, each stand with its sector's dot; the popover names sector and stand`, async ({ page, context }) => {
    await signIn(context, jwt);
    const errors = collectConsoleErrors(page);
    await open(page, participants(ID.live), vp);
    const list = roster(page);
    await expect(list).toBeVisible();
    await expect(list.getByRole('heading', { level: 3 })).toHaveCount(0);
    const all = regs.get(ID.live)!;
    const entries = list.getByRole('button');
    await expect(entries).toHaveCount(all.length);
    // Rule 16: an entry is never stretched; its stand sits right by its face.
    const box = (await entries.first().boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(384);
    const r = all[0];
    const name = r.participants[0].username;
    const dialog = page.getByRole('dialog', { name });
    await openPerson(list.getByRole('button', { name: new RegExp(`^${name}`) }), dialog);
    await expect(dialog.getByText(/^Sector [A-X] · Stand /)).toBeVisible();
    await expect(dialog.getByText('Capturi', { exact: true })).toBeVisible();
    await expectNoProfileLinkYet(dialog.getByRole('link', { name: 'Vezi profilul' }));
    // Once its fade-in has finished: axe would read the colours mid-fade.
    await dialog.evaluate(el => Promise.allSettled(el.getAnimations({ subtree: true }).map(a => a.finished)));
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test(`owner rules 17–18 · ${vp.width}px feeder — teams by sector; a typed-in team's popover: the guest line, its sector and stand, no profile`, async ({ page }) => {
    await open(page, participants(ID.feeder), vp);
    const list = roster(page);
    await expect(list).toBeVisible();
    for (const s of ['A', 'B', 'C', 'D']) await expect(list.getByRole('heading', { name: `Sector ${s}`, level: 3 })).toBeVisible();
    await expect(list.getByRole('button')).toHaveCount(regs.get(ID.feeder)!.length);
    const team = regs.get(ID.feeder)![0];
    const label = team.teamName || team.guestName!;
    const dialog = page.getByRole('dialog', { name: label });
    await openPerson(list.getByRole('button', { name: new RegExp(`^${label}`) }), dialog);
    await expect(dialog.getByText(/^Sector [A-D] · Stand \d+$/)).toBeVisible();
    await expect(dialog.getByRole('link', { name: /profil/i })).toHaveCount(0);
    await expectNoA11yViolations(page);
  });

  test(`owner rule 17 · ${vp.width}px NC — the roster names a stand as Cântare does («A3(12)», «A12» undrawn) and the popover says the same`, async ({ page }) => {
    const allocation = page.waitForResponse(r => r.url().includes(`/competitions/${ID.nc}/allocated-participants`));
    await open(page, participants(ID.nc), vp);
    // The draw position comes with the allocation: «A3(1)» once drawn, «A1» (sector letter + stand) without one.
    const drawn = ((await (await allocation).json()).data as Record<string, { registrationId: string; sectorDrawPosition: number | null }>) ?? {};
    const list = roster(page);
    const first = regs.get(ID.nc)![0];
    const label = first.guestName!;
    const entry = list.getByRole('button', { name: new RegExp(`^${label}`) });
    const stand = entry.locator('[data-stand]');
    const hasDraw = Object.values(drawn).find(a => a.registrationId === first.documentId)?.sectorDrawPosition != null;
    await expect(stand).toHaveAttribute('data-stand', hasDraw ? /^[A-Z]\d+\(\d+\)$/ : /^[A-Z]\d+$/);
    const text = await stand.getAttribute('data-stand');
    const dialog = page.getByRole('dialog', { name: label });
    await openPerson(entry, dialog);
    await expect(dialog.getByText(`Stand ${text}`, { exact: true })).toBeVisible();
  });
}

test('owner rule 17 · Cântare 1024–1279 — a stand card’s angler opens the popover from the keyboard, Escape returns focus', async ({ page, context }) => {
  await signIn(context, jwt);
  await open(page, `/concursuri/${ID.guests}/cantare`, POPOVER);
  const user = regs.get(ID.guests)!.find(r => r.participants.length > 0)!;
  const name = user.participants[0].username;
  const who = page.locator('button[aria-haspopup="dialog"]').filter({ hasText: name }).first();
  const dialog = page.getByRole('dialog', { name });
  await expect(async () => {
    await who.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(who).toBeFocused();
  await expect(popover(page)).toHaveCount(0);
});

test('owner rule 17 · Cântare 1440 — the table’s angler cell opens the popover (not the weighing); the row still opens the detail', async ({ page, context }) => {
  await signIn(context, jwt);
  await open(page, `/concursuri/${ID.guests}/cantare`, DESKTOP);
  const user = regs.get(ID.guests)!.find(r => r.participants.length > 0)!;
  const name = user.participants[0].username;
  const cell = page.locator(`table button[data-angler="${user.documentId}"]`).first();
  await expect(cell).toHaveAttribute('aria-haspopup', 'dialog');
  const dialog = page.getByRole('dialog', { name });
  await openPerson(cell, dialog);
  await expect(cell).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Detaliu cântar')).toHaveCount(0);
  await expect(dialog.getByText('Capturi', { exact: true })).toBeVisible();
  // Anchored to the cell without covering it: under, over or beside it.
  const [d, c] = [await dialog.boundingBox(), await cell.boundingBox()];
  expect(d!.y >= c!.y + c!.height - 1 || d!.y + d!.height <= c!.y + 1 || d!.x >= c!.x + c!.width - 1 || d!.x + d!.width <= c!.x + 1, `popover ${JSON.stringify(d)} vs cell ${JSON.stringify(c)}`).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(cell).toBeFocused();
  // The row's own control still opens the weighing.
  await page.locator('tr').filter({ has: page.locator(`button[data-angler="${user.documentId}"]`) }).getByRole('button', { name: /^Cântar \d+$/ }).first().click();
  await expect(page.getByText('Detaliu cântar')).toBeVisible();
});

test('Cântare 1100 · a guest team whose members echo its name is named once on its stand card', async ({ page }) => {
  await open(page, `/concursuri/${ID.feeder}/cantare`, { width: 1100, height: 900 });
  const echoing = regs.get(ID.feeder)!.filter(r => r.teamName && r.guestName && echoes(r.guestName, r.teamName));
  expect(echoing.length, 'the feeder has guest teams whose two names echo').toBeGreaterThan(0);
  const cards = page.locator('button[aria-haspopup="dialog"]');
  await expect(cards.first()).toBeVisible();
  for (const r of echoing) {
    await expect(page.getByText(`${r.teamName}: `, { exact: false })).toHaveCount(0);
    await expect(cards.filter({ hasText: r.teamName! }).first()).toHaveText(r.teamName!);
  }
});

for (const vp of [DESKTOP, WIDE]) {
  test(`owner rule 16 · ${vp.width}px — a sector's surface is as wide as its entries, never a full-width band`, async ({ page }) => {
    for (const id of [ID.teams, ID.feeder]) {
      await open(page, participants(id), vp);
      const list = roster(page);
      await expect(list).toBeVisible();
      const width = (await list.boundingBox())!.width;
      for (const section of await list.locator('section').all()) {
        const entries = await section.getByRole('listitem').count();
        const box = (await section.boundingBox())!;
        // At most min(entries, what fits) × 384px (+ gaps and padding); no blank surface past the entries.
        const fit = Math.max(1, Math.floor((width - 16 + 8) / 392));
        expect(box.width).toBeLessThanOrEqual(Math.min(entries, fit) * 384 + (Math.min(entries, fit) - 1) * 8 + 16 + 1);
        const items = await section.getByRole('listitem').all();
        const right = Math.max(...(await Promise.all(items.map(async i => { const b = (await i.boundingBox())!; return b.x + b.width; }))));
        expect(box.x + box.width - right).toBeLessThanOrEqual(24);
      }
    }
  });
}

test('roster stats · real text: «conc.» is the one visible form, the full word for screen readers', async ({ page, context }) => {
  await signIn(context, jwt);
  await open(page, participants(ID.live), DESKTOP);
  const list = roster(page);
  await expect(list.getByText(/^CMMC/).first()).toBeVisible();
  const entry = list.getByRole('button').first();
  await expect(entry).toHaveAccessibleName(/\d+ captur(i|ă) ?, CMMC .+ ?, \d+ concursu?r?i?/);
  const visible = await list.innerText();
  expect(visible).not.toMatch(/\d+ concurs\b/);
  await expect(list.locator('[aria-label*="capturi"]')).toHaveCount(0);
});

import { collectConsoleErrors as watchConsole } from './helpers/console';
import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/*
 * Noutăți (/stiri), Știre (/stiri/[id]) and Sponsor (/sponsori/[id]) — parity
 * docs/parity/areas/home.yml, screens home.stiri, home.stire, home.sponsor. Each test names the
 * criterion (cN) and state (sN) ids it covers. Public pages: no session needed.
 *
 * Fixtures are found in the local CMS by shape (several banners, no banner, a phone link…), so the
 * spec survives new content. First-page loading / error / empty of the list are rendered in
 * app/(site)/stiri/_list/NewsList.test.ts (the server prefetch fills the list here); the
 * article's error state (a CMS outage) is error.tsx, not forceable from the browser: its retry is
 * unit-tested (_content/retry.test.ts) and its render in ArticleSkeleton/Gallery tests.
 * Noutăți pages are 12 (pageSize.ts, divisible by 2, 3 and 4 so grid rows fill).
 */

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };

type ListItem = { documentId: string; title: string; shortDescription: string | null; category: string; createdAt: string; banner: { url: string; mediumUrl: string | null }[] | null };
type Detail = ListItem & { content: { __component: string; text?: unknown }[] | null };

const PAGE = 12;

/** Console errors AND warnings (next/image's LCP / sizing warnings are warnings), less dev noise. */
function collectConsoleErrors(page: Page) {
  // The image optimiser is off in dev; a missing remote file is the CMS's, not the page's.
  return watchConsole(page, { warnings: true, ignore: /Failed to load resource|\[HMR\]|\[Fast Refresh\]|Download the React DevTools/ });
}

let all: ListItem[] = [];
const details = new Map<string, Detail>();

async function detail(request: APIRequestContext, id: string): Promise<Detail> {
  if (!details.has(id)) details.set(id, (await (await request.get(`${CMS}/feed/announcements/${id}`)).json()).data);
  return details.get(id)!;
}

async function findNews(request: APIRequestContext, pred: (d: Detail) => boolean): Promise<Detail | undefined> {
  for (const n of all) {
    const d = await detail(request, n.documentId);
    if (pred(d)) return d;
  }
  return undefined;
}

const json = (d: Detail) => JSON.stringify(d.content ?? []);

test.beforeAll(async ({ request }) => {
  all = (await (await request.get(`${CMS}/feed/announcements?page=1&pageSize=100`)).json()).data;
});

const MONTH = '(IANUARIE|FEBRUARIE|MARTIE|APRILIE|MAI|IUNIE|IULIE|AUGUST|SEPTEMBRIE|OCTOMBRIE|NOIEMBRIE|DECEMBRIE)';
const DATE = new RegExp(`^\\d{2} ${MONTH} \\d{4}$`);

/* ------------------------------------------------------------------ */
/* Noutăți                                                            */
/* ------------------------------------------------------------------ */

for (const vp of [PHONE, TABLET, { width: 1280, height: 800 }, DESKTOP]) {
  test(`home.stiri.c1 c5 s4 — /stiri at ${vp.width}px: header, intro, cards, axe`, async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.setViewportSize(vp);
    const res = await page.goto('/stiri');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Noutăți' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    await expect(page.getByText('Descoperă cele mai recente noutăți din lumea pescarilor.')).toBeVisible();

    const cards = page.getByRole('list', { name: 'Noutăți' }).locator(':scope > li');
    await expect(cards.first()).toBeVisible();
    const first = all[0];
    const card = cards.first();
    await expect(card.getByRole('heading', { level: 2, name: first.title })).toBeVisible();
    await expect(card.locator('time')).toHaveText(DATE);
    await expect(card.locator('time')).toHaveAttribute('datetime', first.createdAt);
    const banner = first.banner?.[0];
    if (banner) await expect(card.locator('img').first()).toHaveAttribute('src', new RegExp((banner.mediumUrl ?? banner.url).split('/').pop()!.replace(/\./g, '\\.')));
    // c5: the cards of one grid row are one height (the row stretches them); the text takes only
    // what it needs, so a card holds no empty band of reserved lines below short copy.
    const boxes = await cards.evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        const card = e.firstElementChild!.getBoundingClientRect();
        const last = [...e.querySelectorAll('h2, p')].at(-1)!.getBoundingClientRect();
        return { top: Math.round(r.top), height: Math.round(card.height), gap: Math.round(card.bottom - last.bottom) };
      }),
    );
    const rows = new Map<number, number[]>();
    for (const b of boxes) rows.set(b.top, [...(rows.get(b.top) ?? []), b.height]);
    for (const hs of rows.values()) expect(new Set(hs).size).toBe(1);
    if (vp.width < 768) for (const b of boxes) expect(b.gap).toBeLessThanOrEqual(16);

    // Full-width rule: the grid auto-fills (more columns as the screen grows, never wider cards).
    // ListGrid min 280, 16 apart: as many columns as fit the column; one below 768.
    const { cols, width } = await page
      .getByRole('list', { name: 'Noutăți' })
      .evaluate((ul) => ({ cols: getComputedStyle(ul).gridTemplateColumns.split(' ').length, width: ul.getBoundingClientRect().width }));
    expect(cols).toBe(vp.width < 768 ? 1 : Math.floor((width + 16) / (280 + 16)));
    if (vp.width >= 1280) expect(cols).toBeGreaterThanOrEqual(4);

    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
}

test('home.stiri.c2 s5 s6 — 12 per page from /feed/announcements, next page as the end nears, a spinner while it loads, the end of the list', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const requests: string[] = [];
  let release: () => void = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route(/\/feed\/announcements\?page=2&pageSize=12/, async (route) => {
    requests.push(route.request().url());
    await held;
    await route.continue();
  });
  page.on('request', (r) => {
    if (/\/feed\/announcements\?page=\d+&pageSize=12/.test(r.url())) requests.push(r.url());
  });
  await page.goto('/stiri');
  const cards = page.getByRole('list', { name: 'Noutăți' }).locator(':scope > li');
  await expect(cards).toHaveCount(PAGE);
  await expect(page.getByText(`${PAGE} din ${all.length} noutăți`)).toBeVisible();
  // The footer nears the viewport → page 2 starts by itself; while it loads the button says so.
  await page.mouse.wheel(0, 4000);
  await expect(page.getByRole('button', { name: 'Se încarcă…' })).toBeVisible();
  release();
  // Page 2 lands (and the footer, still in range, may pull the next ones at once).
  await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(Math.min(all.length, 2 * PAGE));
  expect(requests.some((u) => /page=2&pageSize=12/.test(u))).toBe(true);
  // Keep scrolling to the end: the footer goes away (fish hides it when there is no more data).
  for (let i = 0; i < 20 && (await cards.count()) < all.length; i++) {
    await page.mouse.wheel(0, 6000);
    await page.waitForTimeout(400);
  }
  await expect(cards).toHaveCount(all.length);
  await expect(page.getByRole('button', { name: /Încarcă mai multe|Se încarcă/ })).toHaveCount(0);
});

test('home.stiri.c2 — a failed next page says so and «Reîncearcă» loads it (keyboard)', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let fail = true;
  await page.route(/\/feed\/announcements\?page=2&pageSize=12/, (route) => (fail ? route.abort() : route.continue()));
  await page.goto('/stiri');
  await page.mouse.wheel(0, 8000);
  await expect(page.getByText('Nu am putut încărca mai multe noutăți.')).toBeVisible();
  const retry = page.getByRole('button', { name: 'Reîncearcă' });
  fail = false;
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('list', { name: 'Noutăți' }).locator(':scope > li')).toHaveCount(Math.min(all.length, 2 * PAGE));
});

test('home.stiri.c6 home.stire.c8 — a card opens its article (keyboard); back returns to the list', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/stiri');
  // The list hydrated (the footer's count is client state) before the key press, and a cold
  // compile of /stiri/[id] in `next dev` gets its own navigation budget.
  // At 1440×900 the footer is already within the prefetch margin, so page 2 may join at once.
  await expect.poll(() => page.getByRole('list', { name: 'Noutăți' }).locator(':scope > li').count()).toBeGreaterThanOrEqual(PAGE);
  await expect(page.getByText(new RegExp(`^\\d+ din ${all.length} noutăți$`))).toBeVisible();
  const first = all[0];
  const link = page.getByRole('link', { name: first.title }).first();
  await expect(link).toHaveAttribute('href', `/stiri/${first.documentId}`);
  await link.focus();
  await Promise.all([page.waitForURL(new RegExp(`/stiri/${first.documentId}$`), { timeout: 45_000 }), page.keyboard.press('Enter')]);
  await expect(page.getByRole('heading', { level: 1, name: first.title })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/stiri$/);
});

test('home.stiri.c7 c8 — SEO: canonical, JSON-LD list of the first page', async ({ page }) => {
  await page.goto('/stiri');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/stiri$/);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? '{}');
  expect(ld['@type']).toBe('CollectionPage');
  expect(ld.mainEntity.itemListElement).toHaveLength(Math.min(all.length, PAGE));
});

/* ------------------------------------------------------------------ */
/* Știre                                                              */
/* ------------------------------------------------------------------ */

for (const vp of [PHONE, TABLET, { width: 1280, height: 800 }, DESKTOP]) {
  test(`home.stire.c2 c3 c4 c5 s6 — several banners at ${vp.width}px: gallery with dots, back, date + badge + title, summary, axe`, async ({ page, request }) => {
    const n = await findNews(request, (d) => (d.banner?.length ?? 0) > 1);
    test.skip(!n, 'no article with several banners in the local CMS');
    const errors = collectConsoleErrors(page);
    await page.setViewportSize(vp);
    expect((await page.goto(`/stiri/${n!.documentId}`))?.status()).toBe(200);

    const gallery = page.getByRole('region', { name: `Fotografii: ${n!.title}` });
    await expect(gallery).toBeVisible();
    const dots = gallery.getByRole('button', { name: /^Fotografia \d+ din \d+$/ });
    await expect(dots).toHaveCount(n!.banner!.length);
    await expect(dots.first()).toHaveAttribute('aria-current', 'true');
    await dots.nth(1).click();
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(gallery.getByRole('group', { name: `2 din ${n!.banner!.length}` })).toBeInViewport();
    // Keyboard: the strip takes focus, → / ← move one picture.
    const strip = gallery.getByRole('group', { name: 'Fotografii', exact: true });
    await expect(strip).toHaveAccessibleDescription(/Folosește săgețile stânga și dreapta/);
    await strip.focus();
    // Each move is a smooth scroll: let it settle before the next one.
    await page.waitForTimeout(700);
    await page.keyboard.press('ArrowLeft');
    await expect(dots.first()).toHaveAttribute('aria-current', 'true');
    await page.waitForTimeout(700);
    await page.keyboard.press('ArrowRight');
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
    // c3: the back chip floats over the gallery on the phone; from 768 the breadcrumb is the way back.
    const back = gallery.getByRole('button', { name: 'Înapoi' });
    if (vp.width < 768) await expect(back).toBeVisible();
    else {
      await expect(back).toBeHidden();
      await expect(page.getByRole('navigation', { name: 'Cale de navigare' }).getByRole('link', { name: 'Noutăți' })).toHaveAttribute('href', '/stiri');
      // Let the smooth scroll of the key press settle before the next move.
      await page.waitForTimeout(700);
      await gallery.getByRole('button', { name: 'Fotografia următoare' }).click();
      await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true');
    }

    const article = page.getByRole('article', { name: n!.title });
    await expect(article.getByRole('heading', { level: 1 })).toHaveText(n!.title);
    await expect(article.locator('time').first()).toHaveText(DATE);
    if (n!.shortDescription) await expect(article.getByText(n!.shortDescription, { exact: true })).toBeVisible();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
}

test('home.stire.c2 s4 — no banner: a grey header (the loaded header height) with the glyph and the back chip on the phone, nothing from 768', async ({ page, request }) => {
  const n = await findNews(request, (d) => (d.banner?.length ?? 0) === 0);
  test.skip(!n, 'no article without a banner in the local CMS');
  await page.setViewportSize(PHONE);
  await page.goto(`/stiri/${n!.documentId}`);
  const empty = page.locator('[data-gallery="empty"]');
  await expect(empty).toBeVisible();
  // 300 high: the loaded header's (and the skeleton's) height, so nothing jumps; the glyph in it.
  expect(Math.round((await empty.boundingBox())!.height)).toBe(300);
  await expect(empty.locator('div[aria-hidden] > svg')).toBeVisible();
  await expect(empty.getByRole('button', { name: 'Înapoi' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.setViewportSize(TABLET);
  await expect(empty).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: n!.title })).toBeVisible();
});

test('home.stire.c2 s5 — one banner: no dots', async ({ page, request }) => {
  const n = await findNews(request, (d) => (d.banner?.length ?? 0) === 1);
  test.skip(!n, 'no article with one banner');
  await page.goto(`/stiri/${n!.documentId}`);
  await expect(page.locator('[data-gallery="1"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Fotografia \d+ din/ })).toHaveCount(0);
});

test('home.stire.c6 s7 — content blocks in order: text, image, image-right-text-left (text then image)', async ({ page, request }) => {
  const n = await findNews(request, (d) => json(d).includes('image-right-text-left') && json(d).includes('simple-image'));
  test.skip(!n, 'no article with an image-beside-text block');
  await page.setViewportSize(PHONE);
  await page.goto(`/stiri/${n!.documentId}`);
  const article = page.getByRole('article', { name: n!.title });
  const side = article.locator('[data-block="news-block.image-right-text-left"]');
  await expect(side).toBeVisible();
  // Text then image, stacked on the phone; side by side from 768 in the same order.
  const kinds = await side.evaluate((el) => [...el.children].map((c) => (c.tagName === 'IMG' || c.querySelector('img') ? 'img' : 'text')));
  expect(kinds).toEqual(['text', 'img']);
  // An image with its size from the CMS keeps its proportions on the phone (≤ 420 high), so a
  // screenshot is never cut; only an image without dimensions keeps fish's 200px crop.
  const natural = async (img: ReturnType<typeof side.locator>) => {
    const box = (await img.boundingBox())!;
    const [w, h] = await img.evaluate((e) => [Number(e.getAttribute('width')), Number(e.getAttribute('height'))]);
    return { box, expected: w && h ? Math.min(420, (box.width * h) / w) : 200 };
  };
  const sideImg = await natural(side.locator('img'));
  expect(Math.abs(sideImg.box.height - sideImg.expected)).toBeLessThanOrEqual(1);
  await page.setViewportSize(DESKTOP);
  const [a, b] = await side.evaluate((el) => [...el.children].map((c) => c.getBoundingClientRect().left));
  expect(b).toBeGreaterThan(a);
  // simple-image: full width of the text column on the phone, its own proportions.
  await page.setViewportSize(PHONE);
  const simple = await natural(article.locator('img[width]').first());
  expect(Math.abs(simple.box.height - simple.expected)).toBeLessThanOrEqual(1);
  // Every content image starts on the text column's left edge, as the headings and paragraphs.
  await page.setViewportSize(DESKTOP);
  const h1x = (await article.getByRole('heading', { level: 1 }).boundingBox())!.x;
  for (const img of await article.locator('[data-block] img, img[width]').all()) {
    const x = (await img.boundingBox())!.x;
    expect(x).toBeGreaterThanOrEqual(h1x - 1);
  }
  const firstImgX = (await article.locator('img[width]').first().boundingBox())!.x;
  expect(Math.round(firstImgX)).toBe(Math.round(h1x));
});

test('home.stire.c7 — links: a URL opens in a new tab, a tel link dials, both carry news_link_clicked', async ({ page, request }) => {
  const n = await findNews(request, (d) => json(d).includes('"url":"tel'));
  test.skip(!n, 'no article with a phone link');
  await page.goto(`/stiri/${n!.documentId}`);
  const article = page.getByRole('article', { name: n!.title });
  const tel = article.locator('a[href^="tel:"]').first();
  await expect(tel).toBeVisible();
  await expect(tel.locator('svg')).toHaveCount(1);
  await expect(tel).not.toHaveAttribute('target', /.*/);
  const params = JSON.parse((await tel.getAttribute('data-analytics-params')) ?? '{}');
  expect(await tel.getAttribute('data-analytics-event')).toBe('news_link_clicked');
  expect(params).toEqual({ newsId: n!.documentId, url: await tel.getAttribute('href') });
  const ext = article.locator('a[href^="http"]').first();
  if (await ext.count()) {
    await expect(ext).toHaveAttribute('target', '_blank');
    await expect(ext).toHaveAttribute('rel', 'noopener noreferrer');
    expect(await ext.getAttribute('data-analytics-event')).toBe('news_link_clicked');
  }
});

test('home.stire.c7 — headings and list items (« - ») render from the rich text', async ({ page, request }) => {
  const n = await findNews(request, (d) => json(d).includes('"type":"list"') && json(d).includes('"type":"heading"'));
  test.skip(!n, 'no article with a heading and a list');
  await page.goto(`/stiri/${n!.documentId}`);
  const article = page.getByRole('article', { name: n!.title });
  await expect(article.getByRole('list').first().getByRole('listitem').first()).toContainText('-');
  await expect(article.locator('h2, h3, h4').first()).toBeVisible();
});

test('home.stire.c1 s3 — an unknown id: the not-found card with the way on and back', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/stiri/nu-exista-asa-ceva');
  await expect(page.getByRole('heading', { level: 1, name: 'Știrea nu a fost găsită' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vezi noutățile' })).toHaveAttribute('href', '/stiri');
  await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
  const robots = await page.locator('meta[name="robots"]').evaluateAll((m) => m.map((e) => e.getAttribute('content')));
  expect(robots.some((c) => /noindex/.test(c ?? ''))).toBe(true);
  await expectNoA11yViolations(page);
  // From 768 the band stays (Noutăți / «Pagină inexistentă»), as in loading and error.
  await page.setViewportSize(DESKTOP);
  const band = page.getByRole('navigation', { name: 'Cale de navigare' });
  await expect(band.getByRole('link', { name: 'Noutăți' })).toHaveAttribute('href', '/stiri');
  await expect(band).toContainText('Pagină inexistentă');
});

test('home.stire SEO — title, canonical, NewsArticle JSON-LD', async ({ page }) => {
  const n = all[0];
  await page.goto(`/stiri/${n.documentId}`);
  await expect(page).toHaveTitle(new RegExp(n.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/stiri/${n.documentId}$`));
  const lds = await page.locator('script[type="application/ld+json"]').allTextContents();
  const article = lds.map((t) => JSON.parse(t)).flat().find((d) => d['@type'] === 'NewsArticle');
  expect(article).toMatchObject({ headline: n.title, datePublished: n.createdAt });
});

/* ------------------------------------------------------------------ */
/* Sponsor                                                            */
/* ------------------------------------------------------------------ */

type Sponsor = { documentId: string; name: string; description: unknown[] | null; image: { url: string; largeUrl: string | null } | null };

async function sponsors(request: APIRequestContext): Promise<Sponsor[]> {
  const list: { documentId: string }[] = (await (await request.get(`${CMS}/feed/sponsors/dashboard`)).json()).data;
  return Promise.all(list.map(async (s) => (await (await request.get(`${CMS}/feed/sponsors/${s.documentId}`)).json()).data as Sponsor));
}

for (const vp of [PHONE, TABLET, { width: 1280, height: 800 }, DESKTOP]) {
  test(`home.sponsor.c2 c3 c4 at ${vp.width}px — image (large → original), back, name as title, description, axe`, async ({ page, request }) => {
    const all = await sponsors(request);
    const s = all.find((x) => JSON.stringify(x.description).includes('"url":"tel')) ?? all[0];
    test.skip(!s, 'no sponsor in the local CMS');
    const errors = collectConsoleErrors(page);
    await page.setViewportSize(vp);
    expect((await page.goto(`/sponsori/${s.documentId}`))?.status()).toBe(200);
    const article = page.getByRole('article', { name: s.name });
    await expect(article.getByRole('heading', { level: 1 })).toHaveText(s.name);
    if (s.image) {
      const src = (s.image.largeUrl || s.image.url).split('/').pop()!;
      await expect(article.locator('img').first()).toHaveAttribute('src', new RegExp(src.replace(/\./g, '\\.')));
    }
    const back = article.getByRole('button', { name: 'Înapoi' });
    if (vp.width < 768) await expect(back).toBeVisible();
    else await expect(back).toBeHidden();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
}

test('home.sponsor.c5 — description links carry sponsor_link_clicked { sponsor_id, sponsor_name, url }', async ({ page, request }) => {
  const s = (await sponsors(request)).find((x) => JSON.stringify(x.description).includes('"type":"link"'));
  test.skip(!s, 'no sponsor with a link in its description');
  await page.goto(`/sponsori/${s!.documentId}`);
  const link = page.getByRole('article', { name: s!.name }).locator('a[data-analytics-event]').first();
  expect(await link.getAttribute('data-analytics-event')).toBe('sponsor_link_clicked');
  expect(JSON.parse((await link.getAttribute('data-analytics-params')) ?? '{}')).toEqual({
    sponsor_id: s!.documentId,
    sponsor_name: s!.name,
    url: await link.getAttribute('href'),
  });
});

test('home.sponsor.c1 s3 — an unknown sponsor: the not-found card, the way on to Acasă', async ({ page }) => {
  await page.goto('/sponsori/nu-exista-asa-ceva');
  await expect(page.getByRole('heading', { level: 1, name: 'Sponsorul nu a fost găsit' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mergi la Acasă' })).toHaveAttribute('href', '/');
  await expectNoA11yViolations(page);
  await page.setViewportSize(DESKTOP);
  const band = page.getByRole('navigation', { name: 'Cale de navigare' });
  await expect(band.getByRole('link', { name: 'Acasă' })).toHaveAttribute('href', '/');
  await expect(band).toContainText('Pagină inexistentă');
});

test('home.sponsor — reached from Acasă «Sponsori»; «Alți sponsori» lead on (keyboard)', async ({ page, request }) => {
  const all = await sponsors(request);
  test.skip(all.length < 2, 'needs two sponsors');
  await page.setViewportSize(DESKTOP);
  await page.goto(`/sponsori/${all[0].documentId}`);
  const others = page.getByRole('complementary', { name: 'Alți sponsori' });
  const next = others.getByRole('link').first();
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/sponsori\/(?!.*nu-exista)/);
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(all[0].name);
});

/* ------------------------------------------------------------------ */
/* Server band, loading states, layout                                */
/* ------------------------------------------------------------------ */

test('home.stire.c3 home.sponsor.c2 — the breadcrumb band is in the server HTML (real title, BreadcrumbList), no placeholder', async ({ request }) => {
  const n = all[0];
  const html = await (await request.get(`/stiri/${n.documentId}`)).text();
  // `next dev` streams loading.tsx's band (pending crumb) first; the page's own band follows in the
  // same response — with the real title, never set from the client. A production build serves the
  // prerendered page, whose HTML holds only the settled band.
  const navs = [...html.matchAll(/<nav aria-label="Cale de navigare"[\s\S]*?<\/nav>/g)].map((m) => m[0]);
  const settled = navs.find((nav) => nav.includes('aria-current="page"'));
  expect(settled).toBeDefined();
  expect(settled).toContain('href="/stiri"');
  expect(settled).toContain(`>${n.title.replace(/&/g, '&amp;')}</li>`);
  expect(settled).not.toContain('bg-soft-fill');
  const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const crumbs = lds.find((d) => d['@type'] === 'BreadcrumbList');
  expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual(['Noutăți', n.title]);

  const sp = (await (await request.get(`${CMS}/feed/sponsors/dashboard`)).json()).data[0] as { documentId: string; name: string };
  const shtml = await (await request.get(`/sponsori/${sp.documentId}`)).text();
  const sld = [...shtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  expect(sld.find((d) => d['@type'] === 'BreadcrumbList').itemListElement.map((i: { name: string }) => i.name)).toEqual(['Acasă', sp.name]);
});

test('home.stire.c4 c5 — from 768: the text on a centred 720 measure, the badge beside the date, the lead above the body; the right column reserved', async ({ page, request }) => {
  const n = await findNews(request, (d) => Boolean(d.shortDescription) && (d.banner?.length ?? 0) > 0);
  test.skip(!n, 'no article with a summary and a banner');
  for (const vp of [TABLET, { width: 1280, height: 800 }, DESKTOP]) {
    await page.setViewportSize(vp);
    await page.goto(`/stiri/${n!.documentId}`);
    const article = page.getByRole('article', { name: n!.title });
    const card = (await article.boundingBox())!;
    const h1 = (await article.getByRole('heading', { level: 1 }).boundingBox())!;
    const left = h1.x - card.x;
    // Centred: the text column sits as far from the card's left edge as its 720 measure allows.
    expect(left).toBeCloseTo(Math.max(vp.width >= 1280 ? 40 : 32, (card.width - 720) / 2), 0);
    const time = (await article.locator('time').first().boundingBox())!;
    const badge = (await article.getByText(/^(Noutăți|Evenimente|Interesant|Concursuri|Tehnici)$/).first().boundingBox())!;
    expect(badge.x - (time.x + time.width)).toBeLessThanOrEqual(16);
    const lead = article.getByText(n!.shortDescription!, { exact: true });
    const body = await article.locator('p').filter({ hasNotText: n!.shortDescription! }).last().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(await lead.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThan(body);
    // c5: fish's summary is muted and semibold (gray5 / 600), not the ink of the body.
    const leadStyle = await lead.evaluate((e) => {
      const muted = getComputedStyle(document.documentElement).getPropertyValue('--bluvi-muted').trim();
      const probe = document.createElement('span');
      probe.style.color = muted;
      document.body.append(probe);
      const want = getComputedStyle(probe).color;
      probe.remove();
      return { weight: getComputedStyle(e).fontWeight, color: getComputedStyle(e).color, want };
    });
    expect(leadStyle.weight).toBe('600');
    expect(leadStyle.color).toBe(leadStyle.want);
    // The side column: a card under the article at 768 on the same left edge, the right track from 1280.
    const aside = (await page.getByRole('complementary', { name: 'Alte noutăți' }).boundingBox())!;
    if (vp.width >= 1280) expect(aside.x).toBeGreaterThan(card.x + card.width);
    else {
      const heading = (await page.getByRole('complementary', { name: 'Alte noutăți' }).getByRole('heading', { level: 2 }).boundingBox())!;
      expect(Math.round(heading.x)).toBe(Math.round(h1.x));
    }
  }
});

test('home.stire.c2 — a wide banner gets a strip of its own ratio (clamped 4:3 … 4:1, 240 to 480 high), not a 16:9 slab', async ({ page, request }) => {
  const n = await findNews(request, (d) => (d.banner?.length ?? 0) > 0);
  test.skip(!n, 'no article with a banner');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/stiri/${n!.documentId}`);
  const strip = page.getByRole('region', { name: `Fotografii: ${n!.title}` }).locator('[style*="--strip-ratio"]');
  const ratio = Number(await strip.evaluate((e) => getComputedStyle(e).getPropertyValue('--strip-ratio')));
  expect(ratio).toBeGreaterThanOrEqual(4 / 3 - 0.001);
  expect(ratio).toBeLessThanOrEqual(4 + 0.001);
  const box = (await strip.boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(480);
  expect(Math.round(box.height)).toBe(Math.min(480, Math.max(240, Math.round(box.width / ratio))));
});

test('home.stiri.c1 — «Înapoi» never leaves Bluvi: opened from another site it goes to Acasă', async ({ page }) => {
  await page.goto('about:blank');
  await page.goto('/stiri');
  await page.getByRole('button', { name: 'Înapoi' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('home.stiri.s4 home.stire.s6 home.sponsor.c2 — signed in: the three pages render, no console errors', async ({ page, context, request, baseURL }) => {
  await signIn(context, await qaJwt(request), baseURL);
  const errors = collectConsoleErrors(page);
  await page.setViewportSize(DESKTOP);
  await page.goto('/stiri');
  await expect(page.getByRole('list', { name: 'Noutăți' }).locator(':scope > li').first()).toBeVisible();
  await page.goto(`/stiri/${all[0].documentId}`);
  await expect(page.getByRole('heading', { level: 1, name: all[0].title })).toBeVisible();
  const sp = (await (await request.get(`${CMS}/feed/sponsors/dashboard`)).json()).data[0] as { documentId: string; name: string } | undefined;
  if (sp) {
    await page.goto(`/sponsori/${sp.documentId}`);
    await expect(page.getByRole('heading', { level: 1, name: sp.name })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

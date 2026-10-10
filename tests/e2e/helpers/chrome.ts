import type { Page } from '@playwright/test';

/*
 * The site chrome at a given width (ROADMAP §4b rule 25): below 768 fish's bottom tab bar (tab roots
 * only, no top bar), from 768 the top bar (role banner). Both carry the «Navigare principală» label;
 * only one is visible at any width.
 */

/** The phone's bottom tab bar (app/(site)/_shell/BottomTabBar.tsx). */
export const tabBar = (page: Page) => page.locator('nav[data-tab-bar]');

/** The chrome that carries the sections and the account slot at `width`: the tab bar or the top bar. */
export const chrome = (page: Page, width: number) => (width < 768 ? tabBar(page) : page.getByRole('banner'));

/** The visible primary navigation (the tab bar below 768, the top bar's links from 768). */
export const primaryNav = (page: Page) => page.getByRole('navigation', { name: 'Navigare principală' }).filter({ visible: true });

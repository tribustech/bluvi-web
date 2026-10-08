import type { Page } from '@playwright/test';
import { captureRoute } from './capture';

/*
 * Partide · «Alătură-te unei partide» (/partide/intra, T6), signed in as the QA user. Nothing is
 * written: the join POST is route-mocked (an error, or an answer that never comes for «joining»),
 * and the live layer's pointer probe answers «no partidă». States: empty (focused field, button
 * off), a complete code (button on), the inline failure from 768 (a phone shows fish's toast,
 * masked: it times out), and joining (spinner, form busy).
 */

async function mockProbe(page: Page) {
  await page.route('**/api/cms/feed/sessions/active', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) }));
}

const joinAnswer = (answer: 'error' | 'hang') => async (page: Page) => {
  await mockProbe(page);
  await page.route('**/api/cms/feed/sessions/join', route => {
    if (answer === 'hang') return; // never answered: the form stays busy
    return route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ data: null, error: { status: 409, name: 'Error', message: 'mock', details: { bluCode: 'PARTIDA:ALREADY_ACTIVE' } } }),
    });
  });
};

const type = (submit: boolean) => async (page: Page) => {
  const field = page.getByRole('textbox', { name: 'Codul de acces' });
  await field.pressSequentially('k7m2qx');
  if (submit) await field.press('Enter');
};

captureRoute({
  name: 'partide-intra',
  path: '/partide/intra',
  widths: [375, 768, 1280, 1440, 1920],
  states: [
    { name: 'empty', signedIn: true, prepare: mockProbe },
    { name: 'complete', signedIn: true, prepare: mockProbe, setup: type(false) },
    {
      name: 'error',
      signedIn: true,
      prepare: joinAnswer('error'),
      setup: async page => {
        await type(true)(page);
        await page.getByRole('button', { name: 'Alătură-te' }).isEnabled();
        await page.waitForTimeout(300);
      },
      mask: ['[role="alert"] > *'],
    },
    { name: 'joining', signedIn: true, prepare: joinAnswer('hang'), setup: type(true) },
  ],
});

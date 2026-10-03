import localFont from 'next/font/local';

/** Nunito, the app's only family (variable 200–900 + italic), from the design-system bundle. */
export const nunito = localFont({
  src: [
    { path: './fonts/Nunito.ttf', weight: '200 900', style: 'normal' },
    { path: './fonts/Nunito-Italic.ttf', weight: '200 600', style: 'italic' },
  ],
  variable: '--font-nunito',
  display: 'swap',
});

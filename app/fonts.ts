import localFont from 'next/font/local';

/**
 * Nunito, the app's only family (variable 200–900 + italic), from the design-system bundle.
 *
 * Served as WOFF2 subsets, not the bundle's TTFs (fonts/Nunito.ttf, fonts/Nunito-Italic.ttf, kept as
 * the sources): both files are preloaded on every page, at high priority, ahead of the page's own
 * scripts and images, so their weight is paid before the first contentful paint on a phone. The
 * TTFs were 188 KB over the wire (gzip); the subsets are 100 KB. The subset keeps every Latin block
 * (Romanian ă â î ș ț and their capitals, Latin-1, Extended-A/B and Additional), the combining marks
 * and Greek, punctuation, currency, letterlike, arrows, math and the box/dingbat glyphs the font
 * has, and the variable `wght` axis and every OpenType feature; it drops the Cyrillic block (the
 * system font draws it). Rebuilt with fontTools:
 *
 *   pyftsubset fonts/Nunito.ttf --unicodes="U+0000-03FF,U+1E00-1EFF,U+2000-22FF,U+2500-27FF,U+F800-F8FF,U+FB00-FB06" \
 *     --layout-features='*' --flavor=woff2 --no-hinting --desubroutinize --output-file=fonts/Nunito-latin.woff2
 *   (the same for Nunito-Italic.ttf → fonts/Nunito-Italic-latin.woff2)
 */
export const nunito = localFont({
  src: [
    { path: './fonts/Nunito-latin.woff2', weight: '200 900', style: 'normal' },
    { path: './fonts/Nunito-Italic-latin.woff2', weight: '200 600', style: 'italic' },
  ],
  variable: '--font-nunito',
  display: 'swap',
});

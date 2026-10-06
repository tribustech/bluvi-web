import type { ReactNode, SVGProps } from "react";

/*
 * Bluvi logos, inlined from design/assets (logo_horizontal.svg, fish-logo.svg). The small brand
 * icons (fish, scale, …) live in components/icons/brand.tsx.
 * Single-colour artwork: fill is currentColor so the theme tokens (text-accent-ink) drive it and the
 * dark palette applies without a second asset.
 * LogoHorizontal's viewBox is cropped horizontally to the ink (getBBox: x 130.88 → 1963.82), so the
 * fish sits exactly on the gutter it is placed at; the height keeps the full 624 artboard.
 *
 * The path data is the assets run through SVGO (multipass, integer precision — a unit is 1/26 of a
 * pixel at the top bar's 24px height, and the 1000px-wide render is pixel-identical): 4 KB per logo
 * instead of 28 KB. The logo is in every page's top bar, its streaming fallback and the menu panel —
 * four copies in a page's HTML, and the paths again in the client bundle — so the raw artwork cost
 * every page ~110 KB of HTML (half the competition page's static shell) before its first paint.
 */
type Props = SVGProps<SVGSVGElement> & { title?: string };

function mark(displayName: string, viewBox: string, children: ReactNode) {
  function Mark({ title, ...props }: Props) {
    return (
      <svg viewBox={viewBox} fill="currentColor" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} {...props}>
        {title ? <title>{title}</title> : null}
        {children}
      </svg>
    );
  }
  Mark.displayName = displayName;
  return Mark;
}

export const LogoHorizontal = mark("LogoHorizontal", "130.883 0 1832.937 624", (
  <>
    <path fillRule="evenodd" clipRule="evenodd" d="m576 448-2 2zm75-77 2-2h-1v2m-23-80 4 1z" />
    <path fillRule="evenodd" clipRule="evenodd" d="m361 392 2-2zm215 56-2 2zm75-77 2-2h-1v2m-81-166v-3zm62 87-4-1zm152-88v-2zm-12-9" />
    <path fillRule="evenodd" clipRule="evenodd" d="m361 392 2-2zm215 56-2 2zm75-77 2-2h-1v2m-81-166v-3zm62 87-4-1zm152-88v-2zm-12-9" />
    <path fillRule="evenodd" clipRule="evenodd" d="m361 392 2-2zm215 56-2 2zm75-77 2-2h-1v2m-81-166v-3zm62 87-4-1zm152-88v-2zM363 390l-2 2zm213 58-2 2zm74-77v-2h1zm-80-166v-3zm62 87-4-1zm152-88v-2zm-11-8v-1zm-174 92q-3 0-4 4l-2 7-1 5q0 4-4 6l-1 1-18 12-1 1-28 15-7 3-2 1q-8 3-11 11-2 11 2 20l1 2q8 16 25 22l3 1c8 4 20 6 28 3 11-5 20-17 24-27l2-3 3-6v-1l3-12 1-2 3-19v-5l1-1c5 0 17 0 14-5l-3-3-3-1-6-1-2-1q-10-4-15-14v-11zm-2 29-1-1-2 1-1 1-3 3-16 10-10 6-2 1-4 2v1l-5 2-5 4-2 1q-8 3-13 10-2 7 0 14 4 10 13 14l2 1q6 4 14 5 11 0 19-7l1-1 6-7 1-2 2-4 2-5 4-8v-2l4-13 1-6 2-9v-4l-1-1-3-2-2-2z" />
    <path fillRule="evenodd" clipRule="evenodd" d="M644 172q-7 4-9 13l-1 2q-6 16-4 34l1 2q1 14 11 26l1 1q14 15 34 17l14-2 4-1c25-7 38-24 51-43l3-5 4-5 1-1v-1q1-2-1-2h-1l-3 2q-7 4-9 0-1-3 1-4l2-3 1-1 6-5v-1q6-2 6-8 1-4-3-6h-3q-4 0-4 4h1v1h-1l-10 8q-8 5-9 15-1 4 1 6l5 4-5 9-7 7q-8 8-20 14l-2 1-15 4h-8l-3-1q-19-7-30-26a56 56 0 0 1 0-46c3-6 3-6 2-8zm34 14q-2-5 1-9 3-6 10-6l8 5q3 4 1 8-2 5-5 6-4 3-9 1zm-491 90-16-8q-9-5-19-8l-3-1q-9-5-17 3v1l-1 2v1q4 9 12 17l5 4 2 1 29 28 4 5h1l11 12 11 14 5-2q13-11 30-11h5a83 83 0 0 1 28 4l10-1h1l7-7 2-2 8-10 2-3 10-17 4-6 1-1 3-7q0-6-2-8c-6-2-6-2-12-1l-2 1-12 3h-1l-2 1-4 1h-2q-28 10-58 8h-2q-12-1-22-7l-8-3-7-3zm264-83-2-1c-7-3-20-9-25-4l-1 1v2l-2 12v2q-3 10-9 18c-8 13-14 22-14 36l-4 17-5 12-1 2-9 14q-7 9-8 20-2 8-6 14-2 6-13 14c-8 7-12 11-14 20v2l3 3q6 3 12 2 13-6 19-19l4-7 7-14 1-2 12-23v-2l9-17 3-6 7-11 7-10 1-2v-1l5-9 1-2 7-12 1-2 5-7 17-22 1-1 1-1 2-3-1-4v-1l-1-2-3-3zm155-45h-2c-33-2-70 12-97 31l-1 1-4 3-2 1a138 138 0 0 0-32 30l-19 28-7 10-1 2-5 8-12 20-6 13-11 22-16 32-2 4-4 6-2 3-1 2-2 2-1 2-2 3-4 6-28 30-1 1q-14 10-30 14l-2 1-21 2h-2q-13 0-25-4l-1-1h-1l-2-1h-1l-7-3 7 9 10 10 1 2 1 1q14 15 30 25h1l20 10q9 5 18 7 5 0 9-3l9-6 2-1 17-7h1l26-7h3l2-1 4-1 1-2 2-3 1-1c2-4 10-9 11-9q3 2 1 3l-5 8q-1 7 2 15 4 4 10 5l2 1h2q6 1 6 4l-4 1h-3l-3 1h-9l-3 4-3 7 5 1h4l19-1h4l7-1h3l27-5 23-5h2l14-5 13-6 5-2a272 272 0 0 0 48-30h1l15-12 3-3 9-9v-1h1l5-6 9-11 3-5 9-16h1v-2h1l6-12 1-2 3-8 2-8 1-2 1-3 6-15v-1l4-9 5-8q-16 5-32 7h-4l-15-2c-8-3-20-11-24-14l-1-1a96 96 0 0 1-32-53q-3-9-3-17v-20l2-9 1-5 5-10 1-2q1-4 5-5l1 2-2 6a51 51 0 0 0-3 21l1 23 1 1v3a64 64 0 0 0 7 24q7 13 17 25l2 1 6 7 2 1 1 1 11 6 4 1q11 5 21 3l2-1c27-4 45-15 66-32l3-2 20-19 1-2 7-7a94 94 0 0 1 24-23l2-1h1l5-4v-2l-5-2h-1l-2-1-2-1-1-2-1-1v-5q1-7 7-12h1q3-1 5-5 0-3-3-4-2-1-5 1-6 6-10 16l-1 3-1 5-5 8-1-1-1-3a45 45 0 0 1 9-27l1-1 1-2 1-1-1-2a239 239 0 0 1-57-7l-21-4-2-1-15-3h-3q-13-1-23 8l-4 2h-3l-1-1-1-1-9-5h-2l-5-1-3-1zM269 351l-8-1c-12-4-31-7-40 5q-2 3-1 7v2q3 12 11 22l2 2c8 10 22 17 34 22h2q9 5 18 3h2q22-1 41-11v-1a53 53 0 0 1-26-4q-9-3-16-9-13-15-14-34v-1zm146 115-1-1q-30 5-56 19-12 6-17 17v1l1 2q8 5 15 4a41 41 0 0 1 18 3q8 3 16 2 5-1 7-6l2-4 5-6 4-7v-1l3-6 6-9 1-1-2-1-1-2-1-2zm294-135-12-1q-7-2-13 1l-5 8a157 157 0 0 1-17 39l4-1 2-1q8-2 14-6h2l9-7q9-7 22-12l5-3h2l11-8 1-1 1-2 1-1q2 0-1-2h-4l-4-1-8-1z" />
    <path d="M1964 155q0 11-4 18a46 46 0 0 1-43 29q-10 0-18-4-9-4-15-10t-10-15a46 46 0 0 1 0-36l10-14a46 46 0 0 1 33-14q9 0 18 4a45 45 0 0 1 25 24q4 9 4 18m-12 347h-70V229h70zm-270 0-104-273h79l60 170 59-170h79l-103 273zm-171-32a193 193 0 0 1-37 26 121 121 0 0 1-45 11 126 126 0 0 1-86-34q-17-16-26-40t-9-53V229h69v151q0 13 4 25 5 11 11 18 8 7 17 11t20 4 21-5 16-13 12-19 4-21V229h69v273h-17zm-253 32h-70V121h70zm-109-139q0 32-11 59-10 26-30 45-18 20-44 30a140 140 0 0 1-108-1 139 139 0 0 1-85-133V121h69v127l14-13a85 85 0 0 1 37-14q10-3 19-2a135 135 0 0 1 98 41 144 144 0 0 1 41 103m-70 0q0-15-5-29-6-13-15-24a68 68 0 0 0-49-21q-15 0-27 6-12 7-22 17a75 75 0 0 0-20 51q0 16 5 29a72 72 0 0 0 37 40 66 66 0 0 0 76-16q9-10 15-24 5-13 5-29" />
  </>
));

export const FishLogo = mark("FishLogo", "0 0 1025 1024", (
  <>
    <path d="m861 217-3 12a29 29 0 0 1-27 18l-12-3-9-6-6-9a29 29 0 0 1 0-23q2-6 6-9a29 29 0 0 1 21-9l11 2a29 29 0 0 1 16 16q3 5 3 11m-8 221h-44V264h44zm-172 0-66-174h51l37 109 38-109h51l-66 174zm-108-20-24 16a77 77 0 0 1-28 7 80 80 0 0 1-55-22q-11-10-17-25t-6-34v-96h44v96q0 9 3 16l7 12 11 7 13 2 12-3q7-3 11-8 5-6 7-12 3-6 3-14v-96h44v174h-11zm-162 20h-44V195h44zm-69-88q0 20-7 37-6 17-19 29-12 12-28 19a89 89 0 0 1-69-1 88 88 0 0 1-54-84V195h44v81l9-8a54 54 0 0 1 23-9l13-1a86 86 0 0 1 62 26 91 91 0 0 1 26 66m-44 0q0-10-4-19-3-9-9-15a43 43 0 0 0-31-14q-9 0-18 5-7 4-13 10a48 48 0 0 0-13 33q0 10 3 18a46 46 0 0 0 23 25 42 42 0 0 0 49-10q6-6 9-15 4-8 4-18" />
    <path fillRule="evenodd" clipRule="evenodd" d="M485 838h3zm-91-47-2-2v1zm-4-79-3 2z" />
    <path fillRule="evenodd" clipRule="evenodd" d="m661 721-2-1zM485 838h3zm-91-47-2-2v1zm22-175-1-3zm-29 98 3-2zm-164-33v-2zm8-12" />
    <path fillRule="evenodd" clipRule="evenodd" d="m661 721-2-1zM485 838h3zm-91-47-2-2v1zm22-175-1-3zm-29 98 3-2zm-164-33v-2zm8-12" />
    <path fillRule="evenodd" clipRule="evenodd" d="m661 721-2-1zM485 838h3zm-91-47-2-2v1zm22-175-1-3zm-29 98 3-2zm-164-33v-2zm436 39 2 1zM485 838h3zm-90-47v-1h-1v-1zm21-175-1-3zm-29 98 3-2zm-164-33v-2zm8-11" />
    <path fillRule="evenodd" clipRule="evenodd" d="M352 618q-4-7-13-9v1q-1 3 4 7l4 5q12 16 10 37-3 20-19 32l-2 2-2 1-3 1-2 1h-17q-12-1-23-6l-8-5-7-6q3-2 3-5v-6q-5-8-13-11l-12-4h-1v-1q0-3-5-2l-2 1q-2 3-1 6 3 5 8 6h1l7 3 1 1 2 1 3 4q0 5-9 3l-2-1h-2v3l2 1 4 3 5 4c18 13 34 24 59 23h4l13-3q18-7 26-25v-2q6-13 2-27v-2q-3-16-14-30zm-42 6q3 4 3 9 0 3-4 6-3 3-8 2t-6-4l-2-8q2-4 6-6 6-2 11 1m482-70-9 9-1 1-6 4-5 6q-8 8-18 13l-2 1q-27 10-55 10h-9l-11 1-2 1c-6 0-6 0-11 4q-1 4 1 7l5 6 1 1 9 8 13 11 21 11h1q4 1 7-1l2-1h1v-1l6-4 17-8h2l2-1h1q16-4 30 0l5 1 6-16 7-14v-1l2-5 18-34 1-2 3-5q6-10 6-19v-1l-1-1-1-1q-8-6-17 2l-2 2q-8 5-14 13zm-272 14-1 1-4 4-2 4v3l1 3 3 2 1 1 1 1 22 14 6 5 2 1 10 9 1 1 8 8 2 1 9 8 9 8 5 4 13 13 1 1 18 18 1 1 17 15q9 11 22 12 6 0 11-6l1-3v-2q-7-10-19-13l-16-9q-6-5-9-11-5-10-14-16l-12-10-1-1-9-9-9-14c-4-14-12-20-23-29q-9-6-13-14l-2-1-6-12-1-1c-6-3-15 6-21 12zm-151 8h-2l-12 7-2 1-5 3-1 1-7 7-1 1v1l-3 2-4-2q-12-4-23 1h-2l-1 1-13 7-1 1-22 13a233 233 0 0 1-45 21v2l1 1 1 1 2 1 3 2q9 9 13 20v3q-5-2-7-5l-3-4-2-2q-6-7-14-12l-5 1-1 4q2 4 6 3h1q8 2 10 9l1 4v1l-1 3-1 1-1 1-1 1-4 3v2l6 2h1l2 1 4 1q13 3 25 11l8 5 2 1 24 11 3 1c24 9 44 14 69 9h2q10-1 18-9l11-11 1-1 1-2 4-8 1-1q6-14 8-29v-3q1-10-1-20v-3l-1-1v-4l-7-20q-2-8-8-15l-3-5v-2q3 0 7 3l1 1 7 9 3 3 4 8 6 16 1 2 2 20q2 29-13 54v1c-3 4-12 15-18 20l-13 6-1 1h-2q-15 4-31 4l6 6 7 7 1 1 9 11 2 3 1 1 5 7 6 6 1 1 9 9v1h1v1h1l13 12 4 3h1q5 5 11 7l6 4h1v1h1l14 6 17 7h1l4 2 20 5 33 6 14 1h16l47-7h3v-1l11-2 10-3 7-2 2-1h2l4-3-4-4-1-1-4-3-8 2-3 1-1 1h-6q0-3 5-5l1-1 2-1q6-2 7-8 2-8-3-14l-6-6s-3-1 0-3c1 0 9 2 12 5l2 1 2 2 1 1h7l2-1 26-2h1l18 2h2l9 2q4 2 9 0 9-5 14-11l5-4 10-11 1-1q12-14 20-32v-1l1-2 9-23-5 5-2 1v1h-1v1h-1q-9 8-21 12l-2 1-20 4h-2q-16 2-31-3l-2-1a66 66 0 0 1-21-10l-13-9-5-4-3-2-2-2-1-1-2-1-3-3-5-4-3-3-11-9-14-14-6-7-10-10-10-9-10-10-7-5-7-6-1-1-41-30q-15-8-32-14h-2l-5-2h-1c-30-9-67-10-96 2m369 77-6 3-4 3v1q6 18-2 35-4 7-11 13l-3 2q-8 7-19 10 20 4 40-2h1q9-2 16-8l1-1q16-13 25-31l1-2q3-10 3-24l-1-1q0-4-3-6c-12-8-27 0-38 8M636 803v6l-1 1v2l1 1 7 6 5 5h1l5 5 6 4 4 4q3 3 8 3 7-2 13-7l1-1q6-5 14-7 9-2 13-9v-3q-8-8-20-10-28-4-57 0m-295-35-11 5-9 4-6 3h-1l-3 2h-1l-2 1-1 1v2h1l2 1 1 1 12 4h8q12 1 23 5l10 3h2l15 1h5l-4-5-8-8-15-17-6-6q-7-1-12 3m79-66 3 5 3 4q1 3 5 4v1h2q9 4 19 6h2q13 4 28 5h2l6 1h3q8 1 13 6 4 10 4 19v2q-3 17-16 28l-2 1v1q-11 10-25 11-17-3-30-17l-2-2-4-5-1-1-7-9v-2l-9-16-1-2-1-1v-2h-1l-3 1c-5 1-12 3-12-2l2-2v-1l3-1v-1h1l4-3 1-1q9-7 9-17c1-4-2-10-2-10l1-3 4 2m7 23-1 1v2l-1 2-2 3-1 2 1 2v1l5 8 3 5 7 10 1 1 6 7 6 7 2 1 7 5h1q10 5 20 1l11-9 1-2q7-6 8-16 0-7-5-13-6-4-13-5h-1l-2-1-6-1-5-1h-1l-4-1h-2l-31-8-2-1z" />
  </>
));

/**
 * The Bluvi fish (components/icons/brand.tsx FishIcon) as a UI outline icon, for navigation rows
 * that sit beside 24 outline Heroicons (Fundații §05): the silhouette is stroked, not filled, and
 * the 18-unit square viewBox draws it at ~19.6px wide in a 24 box with a 1.5px stroke
 * (1.125 × 24/18), like its row-mates. The eye is a dot, as in the filled mark. The filled fish
 * stays for domain content (catches, Partide cards).
 */
export function FishOutlineIcon({ title, ...props }: Props) {
  return (
    <svg
      viewBox="-0.5 -1 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.125}
      strokeLinejoin="round"
      strokeLinecap="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path d="M8.50033 13.5L9.05766 11.3C6.66699 11.146 4.53299 10.1267 3.91699 8.792C3.85099 9.144 3.75566 9.46667 3.60899 9.70867C3.12499 10.5667 2.14233 10.5667 1.16699 10.5667C1.97366 10.5667 2.26699 9.41533 2.26699 8C2.26699 6.58467 1.97366 5.43333 1.16699 5.43333C2.14233 5.43333 3.12499 5.43333 3.60899 6.29133C3.75566 6.53333 3.85099 6.856 3.91699 7.208C4.39366 6.16667 5.80166 5.32333 7.51766 4.93467L6.30033 2.5C7.76699 2.5 9.23366 2.5 10.209 2.99133C11.0377 3.402 11.5143 4.16467 11.9397 4.97867C14.081 5.492 15.8337 6.65067 15.8337 8C15.8337 9.37867 14.0003 10.5667 11.8003 11.0507C11.1917 11.8573 10.5977 12.6053 10.0917 13.0087C9.47566 13.5 8.99166 13.5 8.50033 13.5Z" />
      <circle cx="12.167" cy="7.633" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

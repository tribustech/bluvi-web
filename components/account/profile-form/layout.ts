/*
 * The profile form's geometry, shared by <ProfileForm> and <ProfileFormSkeleton> so nothing moves
 * when the profile lands. Container queries (the form's own width decides, not the viewport), so
 * the same form stays one column in a narrow sheet:
 * - below 672 (@2xl): one column — the avatar block centred over the fields, the provider row last;
 * - from 672 (a tablet card, the ≥1280 main track): two columns — the avatar block in a 240px left
 *   column, top-aligned, and the fields in a right column capped at 576 (max-w-xl), so a 3–20
 *   character username never gets a 900px input. The provider row closes the right column.
 * - from 1024 (@5xl: the ≥1280 main track on a wide screen, ~1200 at 1920): the right column takes
 *   the card's whole inner width and the fields go two up — username | phone, the bio full width
 *   under them — so the card is never half empty (owner rule: full-width bento).
 */

/** On the <form> (or the skeleton's root): the query container. */
export const FORM_CONTAINER = '@container';

/** The grid inside it (the form's fieldset). */
export const FORM_GRID = 'grid min-w-0 gap-5 md:gap-6 @2xl:grid-cols-[15rem_minmax(0,36rem)] @2xl:gap-x-10 @5xl:grid-cols-[15rem_minmax(0,1fr)]';

/** The fields (username, phone, bio): stacked, two up from @5xl with the last one (bio) full width. */
export const FIELDS = 'flex min-w-0 flex-col gap-4 @5xl:grid @5xl:grid-cols-2 @5xl:gap-x-6 @5xl:[&>:last-child]:col-span-2';

/** The avatar block: the left column, over both rows of the right one. */
export const AVATAR_CELL = '@2xl:row-span-2 @2xl:self-start';

/** «Autentificat cu …»: under the fields, set off by a hairline. */
export const PROVIDER_ROW = 'flex min-h-6 items-center gap-2 border-t border-hairline pt-4 md:pt-5 @2xl:col-start-2';

/*
 * The profile form's geometry, shared by <ProfileForm> and <ProfileFormSkeleton> so nothing moves
 * when the profile lands. Container queries (the form's own width decides, not the viewport), so
 * the same form stays one column in a narrow sheet:
 * - below 672 (@2xl): one column — the avatar block centred over the fields, the provider row last;
 * - from 672 (a tablet card, the ≥1280 main track): two columns — the avatar block in a 240px left
 *   column, top-aligned, and the fields in a right column capped at 576 (max-w-xl), so a 3–20
 *   character username never gets a 900px input. The provider row closes the right column.
 */

/** On the <form> (or the skeleton's root): the query container. */
export const FORM_CONTAINER = '@container';

/** The grid inside it (the form's fieldset). */
export const FORM_GRID = 'grid min-w-0 gap-5 md:gap-6 @2xl:grid-cols-[15rem_minmax(0,36rem)] @2xl:gap-x-10';

/** The avatar block: the left column, over both rows of the right one. */
export const AVATAR_CELL = '@2xl:row-span-2 @2xl:self-start';

/** «Autentificat cu …»: under the fields, set off by a hairline. */
export const PROVIDER_ROW = 'flex min-h-6 items-center gap-2 border-t border-hairline pt-4 md:pt-5 @2xl:col-start-2';

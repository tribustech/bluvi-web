/*
 * Screen names and reportable ids for page_view (m8.ga4) — fish analytics/screenNames.ts and
 * analytics/screenParams.ts on the web's routes.
 *
 * Keys are web route patterns without route groups («/balti/[id]»). Each name is the one fish logs
 * for the same screen (GA4 reports stay comparable across app and site); a web route with no fish
 * screen gets a name derived from its path like fish's deriveName, so no page is silently untracked.
 * Unit table: tests/unit/screen-names.test.ts.
 */

export type RouteParams = Record<string, string | string[] | undefined>;

/** fish create-competition step names by the wizard's [pas] (lib/routes WIZARD_STEPS). */
const WIZARD_STEP_NAMES: Record<string, string> = {
  detalii: 'Create Competition Basics',
  configurare: 'Create Competition Config',
  clasament: 'Create Competition Ranking',
  'lac-si-sectoare': 'Create Competition Lake Sectors',
  standuri: 'Create Competition Stand Allocation',
  revizuire: 'Create Competition Review',
};

type Name = string | ((params: RouteParams) => string);

const wizardStep: Name = (p) => WIZARD_STEP_NAMES[String(p.pas)] ?? 'Create Competition Basics';

export const WEB_SCREEN_NAMES: Record<string, Name> = {
  // Shell, account
  '/': 'Dashboard',
  '/intra': 'Sign In Page',
  '/profil': 'Profile',
  '/profil/completeaza': 'Complete Profile Page',
  '/setari': 'Settings',
  '/setari/profil': 'Edit Profile Page',
  '/setari/notificari': 'Notification Settings',
  '/setari/notificari/concursuri': 'Notification Preferences',
  '/notificari': 'Notifications Page',
  '/cookie-uri': 'CMP Personalize',
  '/[...rest]': 'Not Found',

  // Anglers
  '/pescari': 'Anglers Search',
  '/pescari/sugerati': 'Anglers Suggested',
  '/pescari/[id]': 'Angler Profile',
  '/pescari/[id]/conexiuni': 'Angler Connections',

  // Lakes
  '/balti': 'Lakes List',
  '/balti/harta': 'Lakes List',
  '/balti/[id]': 'Lake Page',
  '/balti/[id]/capturi': 'Lake Capturi',
  '/balti/[id]/clasament': 'Lake Clasament',
  '/balti/[id]/concursuri': 'Lake Competitions',
  '/balti/[id]/galerie': 'Lake Gallery',
  '/balti/[id]/harta': 'Lake Map',
  '/balti/[id]/partide': 'Lake Partide',
  '/balti/[id]/recenzii': 'Lake Reviews',
  '/balti/[id]/recenzie': 'Lake Review Form',
  '/balti/[id]/standuri': 'Lake Standuri',
  '/balti/[id]/statistici': 'Lake Statistici',

  // Booking
  '/balti/[id]/rezerva': 'Book Lake',
  '/balti/[id]/rezerva/extra': 'Book Lake Extras',
  '/balti/[id]/rezerva/confirmare': 'Book Lake Review',
  '/rezervari': 'My Bookings',
  '/rezervari/[id]': 'Booking Detail',

  // Public waters
  '/ape-publice': 'Public Waters List',
  '/ape-publice/[id]': 'Public Water Page',
  '/ape-publice/[id]/capturi': 'Public Water Capturi',
  '/ape-publice/[id]/clasament': 'Public Water Clasament',
  '/ape-publice/[id]/harta': 'Public Water Map',
  '/ape-publice/[id]/partide': 'Public Water Partide',
  '/ape-publice/[id]/statistici': 'Public Water Statistici',

  // Competitions list (fish: one tab; the status lists are its started / notStarted / completed)
  '/concursuri': 'Competitions List',
  '/concursuri/viitoare': 'Competitions List',
  '/concursuri/live': 'Competitions List',
  '/concursuri/rezultate': 'Competitions List',

  // Competition page: fish has one screen with in-page tabs; each web tab is a route of it.
  '/concursuri/[id]': 'Competition Page',
  '/concursuri/[id]/clasament': 'Competition Page',
  '/concursuri/[id]/informatii': 'Competition Page',
  '/concursuri/[id]/participanti': 'Competition Page',
  '/concursuri/[id]/extra-cantare': 'Competition Page',
  '/concursuri/[id]/regulament': 'Competition Page',
  '/concursuri/[id]/cantare': 'Competition Page',
  '/concursuri/[id]/capturi': 'Competition Page',
  '/concursuri/[id]/statistici': 'Competition Page',
  '/concursuri/[id]/statistici/cronologie': 'Stand Timeline',
  '/concursuri/[id]/clasament/imagine': 'Ranking Image',
  '/concursuri/[id]/chat': 'Competitions Chat',

  // Registration
  '/concursuri/[id]/inscriere': 'Register Competition Page',
  '/concursuri/[id]/inscriere/echipa': 'Register Team Disclaimer',
  '/concursuri/[id]/inscriere/fara-cont': 'Register Guests',

  // Organizer
  '/organizator': 'Organizer',
  '/organizator/concursuri/nou/[pas]': wizardStep,
  '/concursuri/[id]/editeaza/[pas]': wizardStep,
  '/concursuri/[id]/sectoare': 'Configure Sectors Page',
  '/concursuri/[id]/alocare': 'Configure Participants Page',
  '/concursuri/[id]/cantar': 'Scale Sector-Stands Page',
  '/concursuri/[id]/cantar/[standId]': 'Add Scale Page',
  '/concursuri/[id]/cantar/[standId]/[weighingId]': 'Scale History Page',
  '/concursuri/[id]/cantar/[standId]/[weighingId]/modificari': 'Scale Revisions',
  '/concursuri/[id]/penalizari': 'Penalties',
  '/concursuri/[id]/penalizari/stand': 'Penalties Select Stand',
  '/concursuri/[id]/penalizari/aplica': 'Penalties Apply',

  // Operator
  '/operator': 'Operator Lakes',
  '/operator/[lakeId]': 'Operator Lake Dashboard',
  '/operator/[lakeId]/blocaje': 'Operator Blocks',
  '/operator/[lakeId]/blocaje/nou': 'Operator Blocks',
  '/operator/[lakeId]/rezervari': 'Operator Bookings',
  '/operator/[lakeId]/calendar': 'Operator Walk In',
  '/operator/[lakeId]/calendar/extra': 'Operator Walk In Extras',
  '/operator/[lakeId]/calendar/confirmare': 'Operator Walk In Review',
  '/operator/evalueaza/[bookingId]': 'Operator Rate Angler',

  // Partide
  '/partide': 'Partide Tab',
  '/partide/exploreaza': 'Partide Tab',
  '/partide/ale-mele': 'Partide Tab',
  '/partide/[id]': 'Partida Spectator',
  '/partide/[id]/capturi': 'Partida Spectator Capturi',
  '/partide/[id]/galerie': 'Partida Spectator Galerie',
  '/partide/sesiune/[clientId]': 'Partida Detail',
  '/partide/istoric': 'Partida Istoric',
  '/partide/statistici': 'Partida Statistici',
  '/partide/clasament': 'Partida Clasament',
  '/partide/capturile-mele': 'Partida Capturi',

  // News, sponsors, polls, raffle
  '/stiri': 'News List',
  '/stiri/[id]': 'News Page',
  '/sponsori/[id]': 'Sponsor Page',
  '/sondaje': 'Poll Current',
  '/sondaje/anterioare': 'Poll Past',
  '/tombola': 'Raffle Intro',
  '/tombola/bon': 'Raffle Upload Receipt',
  '/tombola/confirmare': 'Raffle Confirmation',
  '/tombola/bon-trimis': 'Raffle Receipt Submitted',
  '/tombola/sansele-mele': 'Raffle Status',
  '/tombola/castigatori': 'Raffle Winners',
};

/**
 * Route params promoted to GA4 event params (fish screenParams.ts), by route prefix: the web names
 * most params `id`, so each is resolved per area. Default-deny: an angler's id (a person), booking,
 * partidă, session, stand and weighing ids are never logged, as in fish.
 */
const ENTITY_PARAMS: { prefix: string; param: string; eventParam: string }[] = [
  { prefix: '/balti/[id]', param: 'id', eventParam: 'lake_id' },
  { prefix: '/operator/[lakeId]', param: 'lakeId', eventParam: 'lake_id' },
  { prefix: '/concursuri/[id]', param: 'id', eventParam: 'competition_id' },
  { prefix: '/stiri/[id]', param: 'id', eventParam: 'news_id' },
  { prefix: '/sponsori/[id]', param: 'id', eventParam: 'creative_id' },
  { prefix: '/ape-publice/[id]', param: 'id', eventParam: 'public_water_id' },
];

const startsWithPattern = (pattern: string, prefix: string) => pattern === prefix || pattern.startsWith(`${prefix}/`);

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

type PatternPart = { kind: 'static' | 'param' | 'catchAll'; value: string };

const parsePattern = (pattern: string): PatternPart[] =>
  pattern
    .split('/')
    .filter(Boolean)
    .map((p) => {
      const catchAll = /^\[\.\.\.([A-Za-z0-9_]+)\]$/.exec(p);
      if (catchAll) return { kind: 'catchAll', value: catchAll[1]! };
      const param = /^\[([A-Za-z0-9_]+)\]$/.exec(p);
      return param ? { kind: 'param', value: param[1]! } : { kind: 'static', value: p };
    });

const KNOWN_ROUTES = Object.keys(WEB_SCREEN_NAMES).map((pattern) => ({ pattern, parts: parsePattern(pattern) }));
const RANK = { static: 3, param: 2, catchAll: 1 } as const;

function matchParts(parts: PatternPart[], segments: string[]): RouteParams | null {
  const params: RouteParams = {};
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (part.kind === 'catchAll') {
      if (i !== parts.length - 1 || segments.length <= i) return null;
      params[part.value] = segments.slice(i);
      return params;
    }
    const segment = segments[i];
    if (segment === undefined) return null;
    if (part.kind === 'param') params[part.value] = segment;
    else if (part.value !== segment) return null;
  }
  return parts.length === segments.length ? params : null;
}

/** Static beats [param] beats [...catchAll], segment by segment (Next's own precedence). */
function moreSpecific(a: PatternPart[], b: PatternPart[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ra = a[i] ? RANK[a[i]!.kind] : 0;
    const rb = b[i] ? RANK[b[i]!.kind] : 0;
    if (ra !== rb) return ra > rb;
  }
  return false;
}

/** Fallback for a page outside the table (dev pages): each param value back to its `[name]`. */
function patternFromParams(rawSegments: string[], params: RouteParams): string {
  const unused = new Map(Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string | string[]][]);
  const out: string[] = [];
  for (let i = 0; i < rawSegments.length; i++) {
    const decoded = safeDecode(rawSegments[i]!);
    let match: string | null = null;
    for (const [name, value] of unused) {
      if (Array.isArray(value)) {
        const rest = rawSegments.slice(i).map(safeDecode).join('/');
        if (rest === value.map(safeDecode).join('/')) {
          match = `[...${name}]`;
          i = rawSegments.length;
        }
      } else if (decoded === safeDecode(value)) {
        match = `[${name}]`;
      }
      if (match) {
        unused.delete(name);
        break;
      }
    }
    out.push(match ?? rawSegments[i] ?? '');
  }
  return `/${out.join('/')}`;
}

/**
 * The route of a pathname: its pattern in WEB_SCREEN_NAMES (route groups never appear in a
 * pathname) and the param values read from the pathname itself. Built from usePathname() only, not
 * from the router tree: a screen that moves the URL with history.pushState / replaceState (a tab,
 * a list filter, a wizard step) updates the pathname while Next keeps the old layout segments and
 * params (ACTION_RESTORE). `fallbackParams` (useParams) only serves pages outside the table.
 */
export function resolveRoute(pathname: string, fallbackParams: RouteParams = {}): { pattern: string; params: RouteParams } {
  const raw = pathname.split('?')[0]!.split('/').filter(Boolean);
  const segments = raw.map(safeDecode);
  let best: { pattern: string; parts: PatternPart[]; params: RouteParams } | null = null;
  for (const route of KNOWN_ROUTES) {
    const params = matchParts(route.parts, segments);
    if (!params) continue;
    // The not-found catch-all only when Next says so: a page outside the table (dev) is a real route.
    const catchAll = route.parts.find((p) => p.kind === 'catchAll');
    if (catchAll && !Array.isArray(fallbackParams[catchAll.value])) continue;
    if (!best || moreSpecific(route.parts, best.parts)) best = { ...route, params };
  }
  if (best) return { pattern: best.pattern, params: best.params };
  return { pattern: patternFromParams(raw, fallbackParams), params: fallbackParams };
}

export function routePattern(pathname: string, fallbackParams: RouteParams = {}): string {
  return resolveRoute(pathname, fallbackParams).pattern;
}

/** `/pescari/[id]/conexiuni` → `Pescari Conexiuni` (fish deriveName: params dropped, words capitalised). */
function deriveName(pattern: string): string {
  const words = pattern
    .split('/')
    .filter((s) => s && !s.startsWith('['))
    .flatMap((s) => s.split('-'))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.length > 0 ? words.join(' ') : 'Unknown';
}

export function resolveScreenName(pattern: string, params: RouteParams = {}): string {
  const name = WEB_SCREEN_NAMES[pattern];
  if (typeof name === 'function') return name(params);
  return name ?? deriveName(pattern);
}

function paramValue(params: RouteParams, name: string): string | null {
  const v = params[name];
  return typeof v === 'string' && v.length > 0 ? safeDecode(v) : null;
}

export function extractEntityParams(pattern: string, params: RouteParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { prefix, param, eventParam } of ENTITY_PARAMS) {
    if (!startsWithPattern(pattern, prefix)) continue;
    const v = paramValue(params, param);
    if (v) out[eventParam] = v;
  }
  return out;
}

/**
 * The page path GA4 sees: the pattern with only the reportable ids filled in (the others stay
 * `[name]`) and no query string (it can carry names, e.g. «Evaluează pescarul»).
 */
export function reportablePath(pattern: string, params: RouteParams): string {
  const allowed = new Set(ENTITY_PARAMS.filter((e) => startsWithPattern(pattern, e.prefix)).map((e) => e.param));
  return pattern.replace(/\[([A-Za-z0-9_]+)\]/g, (whole, name: string) => {
    const v = allowed.has(name) ? paramValue(params, name) : null;
    return v ? encodeURIComponent(v) : whole;
  });
}

/**
 * Screens whose web routes are tabs of ONE fish screen (fish switches them in place and logs a tab
 * event, never a screen_view): the Competition Page tabs (competition_page_tab_pressed) per
 * competition, and the Competitions List status tabs (competitions_status_changed). Value: the
 * route param that tells two instances apart (null: one instance).
 */
const SCREEN_INSTANCE: Record<string, string | null> = {
  'Competition Page': 'id',
  'Competitions List': null,
};

/**
 * The page_view dedupe key: one per fish screen instance — switching a competition's tabs logs
 * nothing, another competition logs one; any other route is keyed on its pathname (fish
 * ScreenViewTracker: one lake to another re-logs, a re-render does not).
 */
export function screenInstanceKey(pathname: string, pattern: string, params: RouteParams): string {
  const name = resolveScreenName(pattern, params);
  if (name in SCREEN_INSTANCE) {
    const param = SCREEN_INSTANCE[name];
    return `${name}|${param ? (paramValue(params, param) ?? '') : ''}`;
  }
  return `${pathname} ${pattern}`;
}

/** Everything a page_view carries for the active route. */
export function screenViewParams(pattern: string, params: RouteParams): Record<string, string> {
  const name = resolveScreenName(pattern, params);
  return { screen_name: name, screen_class: name, page_path: reportablePath(pattern, params), ...extractEntityParams(pattern, params) };
}

#!/usr/bin/env node
// Parity inventory checker. Loads docs/parity/areas/*.yml, validates the schema (docs/ROADMAP.md §3,
// docs/parity/README.md), checks that every fish screen file is inventoried, flags web routes claimed
// by more than one area, and prints a status table. Exits 1 on any problem.
//
//   npm run parity               # validate + table
//   npm run parity -- --verbose  # also list every screen with its status
//   npm run parity -- --json     # machine-readable summary (for /web-drift)
//
// fish is read from ../fish (override with FISH_DIR).

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AREAS_DIR = join(ROOT, "docs/parity/areas");
const FISH = resolve(process.env.FISH_DIR ?? join(ROOT, "../fish"));
const args = new Set(process.argv.slice(2));

const TEMPLATES = new Set(["T1", "T2", "T3", "T4", "T5", "T6", "none"]);
const MILESTONES = new Set(["M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"]);
const STATUSES = ["todo", "proposed", "passing", "shipped"];
// participant = angler registered in the competition being viewed (competition-page).
const ROLES = new Set(["guest", "angler", "participant", "organizer", "referee", "operator", "admin"]);
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isStrList = (v, { empty = false } = {}) =>
  Array.isArray(v) && (empty || v.length > 0) && v.every(isStr);

// "path/file.tsx:12-30,44" → "path/file.tsx". Refs may cite several files separated by ";" or ", ".
function refFiles(ref) {
  return String(ref)
    .split(/;|\s\+\s|,\s+(?=[\w(@.[-]+\/)/)
    .map((p) => p.trim().replace(/:[\d,\-–\s]+.*$/, "").replace(/\s.*$/, ""))
    .filter((p) => p && /[/.]/.test(p));
}

const fishExists = (p) => existsSync(join(FISH, p));

// ---------------------------------------------------------------------------------------------
// Load
const files = readdirSync(AREAS_DIR).filter((f) => f.endsWith(".yml")).sort();
const areas = [];
for (const f of files) {
  const where = `areas/${f}`;
  let doc;
  try {
    doc = parse(readFileSync(join(AREAS_DIR, f), "utf8"));
  } catch (e) {
    err(where, `YAML parse error: ${e.message.split("\n")[0]}`);
    continue;
  }
  if (!doc || typeof doc !== "object") {
    err(where, "empty document");
    continue;
  }
  const key = f.replace(/\.yml$/, "");
  if (doc.area !== key) err(where, `area: "${doc.area}" must equal the file name "${key}"`);
  if (!Array.isArray(doc.screens)) err(where, "screens must be a list");
  if (doc.behaviours != null && !Array.isArray(doc.behaviours)) err(where, "behaviours must be a list");
  areas.push({ file: f, key, screens: doc.screens ?? [], behaviours: doc.behaviours ?? [] });
}

// ---------------------------------------------------------------------------------------------
// Validate
const ids = new Map(); // id → where
function claimId(id, where) {
  if (!isStr(id)) return err(where, "missing id");
  if (!ID_RE.test(id)) err(where, `id "${id}" is not dotted kebab-case`);
  if (ids.has(id)) err(where, `duplicate id "${id}" (also ${ids.get(id)})`);
  else ids.set(id, where);
}

const fishCoverage = new Map(); // fish path → [screen ids]
const routes = new Map(); // normalized route → [{id, area}]
const mergedRefs = []; // {where, id, target}
let behaviourCount = 0;
let criteriaCount = 0;

// First URL path in web_route ("/concursuri/[id]?tab=x" → "/concursuri/[]"). Dialog-only screens
// ("dialogs over operator.rezervari / …") have no path of their own and claim no route.
function normalizeRoute(r) {
  const s = String(r).trim();
  // A bare "/" counts only when the value starts with it ("/", "/?x"), never " / " used as a separator.
  const m = s.match(/^\/(?=$|[\s?#(])/) ? ["/"] : s.match(/(?:^|\s)\/[A-Za-z0-9[*][^\s?#()]*/);
  if (!m) return null;
  return m[0].trim().replace(/\[[^\]]+\]/g, "[]").replace(/\/+$/, "") || "/";
}

for (const area of areas) {
  for (const [i, s] of area.screens.entries()) {
    const where = `${area.file} screens[${i}]${s?.id ? ` ${s.id}` : ""}`;
    if (!s || typeof s !== "object") {
      err(where, "not a mapping");
      continue;
    }
    claimId(s.id, where);
    if (isStr(s.id) && !s.id.startsWith(`${area.key}.`)) err(where, `id must start with "${area.key}."`);
    if (!isStr(s.title)) err(where, "missing title");
    if (!isStrList(s.fish)) err(where, "fish must be a non-empty list of paths");
    else
      for (const p of s.fish) {
        if (!fishExists(p)) err(where, `fish path does not exist: ${p}`);
        if (!fishCoverage.has(p)) fishCoverage.set(p, []);
        fishCoverage.get(p).push(s.id);
      }
    if (!isStr(s.web_route) && !s.mobile_only) err(where, "missing web_route");
    if (!TEMPLATES.has(s.template)) err(where, `template "${s.template}" not in ${[...TEMPLATES].join("|")}`);
    if (!MILESTONES.has(s.milestone)) err(where, `milestone "${s.milestone}" not in M0..M8`);
    if (!isStrList(s.roles)) err(where, "roles must be a non-empty list");
    else for (const r of s.roles) if (!ROLES.has(r)) err(where, `unknown role "${r}"`);
    if (!isStrList(s.core, { empty: true })) err(where, "core must be a list (may be empty)");
    if (!isStrList(s.states)) err(where, "states must be a non-empty list");
    if (!STATUSES.includes(s.status)) err(where, `status "${s.status}" not in ${STATUSES.join("|")}`);
    if (typeof s.mobile_only !== "boolean") err(where, "mobile_only must be true or false");
    if (s.mobile_only && !isStr(s.web_replacement)) err(where, "mobile_only screens need web_replacement");
    if (s.merged_into != null) {
      if (!isStr(s.merged_into)) err(where, "merged_into must be a screen id");
      else mergedRefs.push({ where, id: s.id, target: s.merged_into });
    }

    if (!Array.isArray(s.criteria) || s.criteria.length === 0) err(where, "criteria must be a non-empty list");
    else {
      if (!s.mobile_only && !s.merged_into && s.criteria.length < 5) warn(where, `only ${s.criteria.length} criteria`);
      for (const [j, c] of s.criteria.entries()) {
        const cw = `${area.file} ${s.id ?? `screens[${i}]`}.criteria[${j}]`;
        criteriaCount++;
        claimId(c?.id, cw);
        if (isStr(c?.id) && isStr(s.id) && !c.id.startsWith(`${s.id}.c`)) err(cw, `id must be ${s.id}.c<n>`);
        if (!isStr(c?.text)) err(cw, "missing text");
        if (!isStr(c?.fish_ref)) err(cw, "missing fish_ref");
        else for (const p of refFiles(c.fish_ref)) if (!fishExists(p)) err(cw, `fish_ref file not found: ${p}`);
      }
    }

    // A merged screen lives on its owner's page and claims no route of its own.
    if (!s.mobile_only && !s.merged_into && isStr(s.web_route)) {
      const r = normalizeRoute(s.web_route);
      if (r) {
        if (!routes.has(r)) routes.set(r, []);
        routes.get(r).push({ id: s.id, area: area.key });
      }
    }
  }

  for (const [i, b] of area.behaviours.entries()) {
    const where = `${area.file} behaviours[${i}]${b?.id ? ` ${b.id}` : ""}`;
    behaviourCount++;
    claimId(b?.id, where);
    if (isStr(b?.id) && !b.id.startsWith(`${area.key}.b.`)) err(where, `id must start with "${area.key}.b."`);
    if (!isStr(b?.text)) err(where, "missing text");
    if (!isStr(b?.fish_ref)) err(where, "missing fish_ref");
    else for (const p of refFiles(b.fish_ref)) if (!fishExists(p)) err(where, `fish_ref file not found: ${p}`);
  }
}

// merged_into must name an existing, non-merged, non-mobile-only screen.
const screenById = new Map(areas.flatMap((a) => a.screens.filter((s) => isStr(s?.id)).map((s) => [s.id, s])));
for (const { where, id, target } of mergedRefs) {
  const t = screenById.get(target);
  if (!t) err(where, `merged_into "${target}" is not a screen id`);
  else if (t.merged_into || t.mobile_only) err(where, `merged_into "${target}" must be a screen with its own web page`);
  else if (target === id) err(where, "merged_into points at itself");
}

// Every fish screen file must be inventoried.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "__tests__") walk(p, out);
    } else if (name.endsWith(".tsx") && name !== "_layout.tsx") out.push(relative(FISH, p));
  }
  return out;
}
if (!existsSync(join(FISH, "app"))) err("fish", `fish app/ not found at ${FISH} (set FISH_DIR)`);
const fishScreens = existsSync(join(FISH, "app")) ? walk(join(FISH, "app")).sort() : [];
const uncovered = fishScreens.filter((p) => !fishCoverage.has(p));
for (const p of uncovered) err("coverage", `fish screen not in any screen's fish list: ${p}`);

// A web route belongs to one area. Several screens of the same area may share a route on purpose
// (one page split into reviewable parts, or dialogs on that page).
for (const [r, owners] of routes) {
  const owningAreas = [...new Set(owners.map((o) => o.area))];
  if (owningAreas.length > 1)
    err("routes", `${r} is claimed by several areas: ${owners.map((o) => o.id).join(", ")}`);
}

// ---------------------------------------------------------------------------------------------
// Report
const screens = areas.flatMap((a) => a.screens.map((s) => ({ ...s, area: a.key })));
const milestones = [...MILESTONES].filter((m) => screens.some((s) => s.milestone === m));

if (args.has("--json")) {
  console.log(
    JSON.stringify(
      {
        ok: errors.length === 0,
        errors,
        warnings,
        fishScreens: fishScreens.length,
        uncovered,
        areas: areas.map((a) => ({
          area: a.key,
          screens: a.screens.length,
          behaviours: a.behaviours.length,
          criteria: a.screens.reduce((n, s) => n + (s.criteria?.length ?? 0), 0),
        })),
        screens: screens.map((s) => ({
          id: s.id,
          route: s.web_route,
          milestone: s.milestone,
          status: s.status,
          mobile_only: s.mobile_only,
          merged_into: s.merged_into ?? null,
          criteria: s.criteria?.length ?? 0,
        })),
      },
      null,
      2,
    ),
  );
  process.exit(errors.length ? 1 : 0);
}

const pad = (v, n) => String(v).padEnd(n);
const padL = (v, n) => String(v).padStart(n);

console.log("\nParity inventory\n");
console.log(`${pad("area", 20)}${padL("screens", 9)}${padL("behav.", 8)}${padL("criteria", 10)}`);
for (const a of areas) {
  const c = a.screens.reduce((n, s) => n + (s.criteria?.length ?? 0), 0);
  console.log(`${pad(a.key, 20)}${padL(a.screens.length, 9)}${padL(a.behaviours.length, 8)}${padL(c, 10)}`);
}
console.log(`${pad("total", 20)}${padL(screens.length, 9)}${padL(behaviourCount, 8)}${padL(criteriaCount, 10)}`);

console.log(`\n${pad("milestone", 11)}${STATUSES.map((s) => padL(s, 10)).join("")}${padL("mobile", 8)}${padL("total", 7)}`);
for (const m of milestones) {
  const ms = screens.filter((s) => s.milestone === m);
  const row = STATUSES.map((st) => padL(ms.filter((s) => s.status === st && !s.mobile_only).length, 10)).join("");
  console.log(`${pad(m, 11)}${row}${padL(ms.filter((s) => s.mobile_only).length, 8)}${padL(ms.length, 7)}`);
}
const all = STATUSES.map((st) => padL(screens.filter((s) => s.status === st && !s.mobile_only).length, 10)).join("");
console.log(`${pad("total", 11)}${all}${padL(screens.filter((s) => s.mobile_only).length, 8)}${padL(screens.length, 7)}`);

console.log(
  `\nfish screens: ${fishScreens.length} under app/, ${fishScreens.length - uncovered.length} inventoried, ${uncovered.length} missing`,
);

if (args.has("--verbose")) {
  console.log("");
  for (const s of screens)
    console.log(
      `${pad(s.status, 9)}${pad(s.milestone, 4)}${pad(s.id, 48)}${s.mobile_only ? "(mobile only)" : s.merged_into ? `→ ${s.merged_into}` : s.web_route}`,
    );
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error(`  x ${e}`);
  process.exit(1);
}
console.log("\nOK");

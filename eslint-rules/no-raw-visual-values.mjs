/**
 * bluvi/no-raw-visual-values — the only visual values allowed in app/** and components/** are the
 * tokens in app/globals.css (ROADMAP §5 «Lint»). It reads every string and template literal, splits
 * it into class tokens and rejects:
 *  - hex / rgb / hsl / oklch colours in arbitrary values (`bg-[#fff]`, `text-[rgb(…)]`) and hex in
 *    a `style` prop;
 *  - Tailwind's default palette (`text-white`, `bg-gray-100`): use the semantic colours;
 *  - font sizes and line heights outside the t-* steps (`text-[14px]`, `text-sm`, `text-sm/[18px]`,
 *    `leading-[20px]`, `font-[…]`);
 *  - raw z-index (`z-10`, `z-[60]`, `-z-10`): use the z-* layer tokens.
 * Token utilities (`text-ink`, `t-body`, `z-sticky`, `text-initials-48`, `shadow-[var(--shadow-e2)]`)
 * pass. Spacing / radius arbitrary values are not checked yet.
 */

const COLOR_PREFIX =
  '(?:bg|text|border(?:-[xytrbles])?|fill|stroke|ring(?:-offset)?|outline|from|via|to|decoration|divide|placeholder|caret|accent|shadow|inset-shadow|drop-shadow|text-shadow)';
const PALETTE =
  '(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3})';

const CHECKS = [
  {
    id: 'arbitraryColor',
    re: new RegExp(`^${COLOR_PREFIX}-\\[(?:color:)?(?:#|rgba?\\(|hsla?\\(|oklch\\(|oklab\\(|lab\\(|hwb\\()`, 'i'),
    msg: 'Raw colour «{{token}}»: use a semantic colour token (text-ink, bg-surface, …) from app/globals.css.',
  },
  {
    id: 'hexInArbitrary',
    re: /\[[^\]]*#[0-9a-f]{3,8}\b[^\]]*\]/i,
    msg: 'Raw hex colour in «{{token}}»: use a colour token from app/globals.css.',
  },
  {
    id: 'paletteColor',
    re: new RegExp(`^${COLOR_PREFIX}-${PALETTE}(?:\\/.*)?$`),
    msg: 'Tailwind palette colour «{{token}}»: use a semantic colour token from app/globals.css.',
  },
  {
    id: 'arbitraryFontSize',
    re: /^text-\[(?:length:|\d|\.\d|calc\(|clamp\(|min\(|max\()/,
    msg: 'Raw font size «{{token}}»: use a t-* type step (t-body, t-label, …) or a --text-* token.',
  },
  {
    id: 'defaultFontSize',
    re: /^text-(?:xs|sm|base|lg|\d?xl)(?:\/.*)?$/,
    msg: 'Tailwind default font size «{{token}}»: use a t-* type step from app/globals.css.',
  },
  {
    id: 'arbitraryLineHeight',
    re: /^(?:leading-\[.*\]|text-[\w-]+\/\[.*\]|font-\[.*\])$/,
    msg: 'Raw line height / font «{{token}}»: use a t-* type step from app/globals.css.',
  },
  {
    id: 'rawZIndex',
    re: /^z-(?:[1-9]\d*|\[.*\])$/,
    msg: 'Raw z-index «{{token}}»: use a z-* layer token (z-above, z-sticky, z-overlay, z-toast, z-skip, z-behind…).',
  },
];

/** The utility part of a class token: no variants (`md:`, `hover:`), no `!`, no leading `-`. */
function utilityOf(token) {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth--;
    else if (c === ':' && depth === 0) start = i + 1;
  }
  return token.slice(start).replace(/^!/, '').replace(/!$/, '').replace(/^-/, '');
}

function tokensOf(text) {
  // Brackets may hold underscores but never spaces, so whitespace splitting is safe.
  return text.split(/\s+/).filter(Boolean);
}

const HEX = /^#[0-9a-f]{3,8}$/i;

function insideStyleProp(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === 'JSXAttribute') return p.name && p.name.name === 'style';
    if (p.type === 'Program') return false;
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow raw colours, font sizes, line heights and z-index outside the design tokens.' },
    schema: [],
  },
  create(context) {
    function check(node, text) {
      if (typeof text !== 'string' || !text) return;
      if (HEX.test(text.trim()) && insideStyleProp(node)) {
        context.report({ node, message: 'Raw hex colour «{{token}}» in style: use a colour token (var(--color-…)).', data: { token: text.trim() } });
        return;
      }
      for (const token of tokensOf(text)) {
        const util = utilityOf(token);
        for (const c of CHECKS) {
          if (c.re.test(util) || (c.id === 'hexInArbitrary' && c.re.test(token))) {
            context.report({ node, message: c.msg, data: { token } });
            break;
          }
        }
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
      JSXText() {},
    };
  },
};

const plugin = {
  meta: { name: "bluvi" },
  rules: { "no-raw-visual-values": rule },
};

export default plugin;

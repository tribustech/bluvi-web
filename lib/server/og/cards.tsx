import type { ReactNode } from 'react';
import type { BrandCard, EntityCard, Figure, Media, MetaLine, Pill, PodiumLine } from './model';
import {
  entityLayout,
  LEGEND_GAP,
  LOGO_GAP,
  LOGO_H,
  PAD,
  placeSlot,
  PODIUM_GAP,
  PODIUM_PAD_X,
  PODIUM_PAD_Y,
  podiumRowHeight,
} from './layout';
import { FISH_PATHS, FISH_RATIO, FISH_VIEWBOX, LOGO_PATHS, LOGO_RATIO, LOGO_VIEWBOX, META_ICON, STAR_PATHS, type MarkPath } from './marks';
import { OG_SIZE, s, textStyle, withAlpha, type OgTokens } from './tokens';

/*
 * The Open Graph cards, drawn for Satori (next/og) at 1200×630 — fish's visual language on the
 * site's tokens (tokens.ts): white cards, ink text, rounded chips, the status pills, the podium's
 * medal colours, the brand indigo of Acasă's share image (_home/assets/og-home.jpg).
 *
 *  - EntityCard: the facts on the left (the logo, eyebrow + status pill, the name, ≤ 2 meta lines,
 *    then the rating / price / area figures or the podium), the picture on the right: a photo or
 *    poster (render.tsx readPicture: cropped, or whole on its blurred copy), a sponsor logo on white,
 *    a public water's outline — or, with no picture, a narrow brand band (gradient + fish) and the
 *    facts take the width. Widths, title step / lines and which meta lines fit: layout.ts. The logo,
 *    eyebrow and title start on the same lines whatever the picture. With figures or a podium they
 *    sit at the bottom; without, the facts are centred under the logo.
 *  - BrandCard: the lists — the indigo ground, the logo chip, the title and a short tagline.
 * Satori lays out flexbox only: every element with more than one child is `display: flex`.
 */


function Mark({ paths, viewBox, size, color, height }: { paths: MarkPath[]; viewBox: string; size: number; color: string; height?: number }) {
  return (
    <svg width={size} height={height ?? size} viewBox={viewBox} fill={color}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fillRule={p.evenodd ? 'evenodd' : undefined} clipRule={p.evenodd ? 'evenodd' : undefined} />
      ))}
    </svg>
  );
}

function Logo({ height, color }: { height: number; color: string }) {
  return <Mark paths={LOGO_PATHS} viewBox={LOGO_VIEWBOX} size={Math.round(height * LOGO_RATIO)} height={height} color={color} />;
}

/** The brand panel / ground: the indigo of Acasă's share image, the fish as a watermark. */
function BrandGround({ t, width, height, fish }: { t: OgTokens; width: number; height: number; fish: number }) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        backgroundImage: `linear-gradient(135deg, ${t.color.bentoIndigo2} 0%, ${t.color.bentoIndigo} 100%)`,
      }}
    >
      <div style={{ display: 'flex', position: 'absolute', right: fish * 0.02, bottom: fish * FISH_RATIO * 0.08 }}>
        <Mark paths={FISH_PATHS} viewBox={FISH_VIEWBOX} size={fish} height={Math.round(fish * FISH_RATIO)} color={withAlpha(t.color.onBentoIndigo, 0.12)} />
      </div>
    </div>
  );
}

function PillChip({ t, pill }: { t: OgTokens; pill: Pill }) {
  const [bg, fg] =
    pill.tone === 'live' ? [t.color.liveBg, t.color.liveFg] : pill.tone === 'info' ? [t.color.infoBg, t.color.infoFg] : [t.color.neutralBg, t.color.neutralFg];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: s(4),
        padding: `${s(3)}px ${s(8)}px`,
        borderRadius: 999,
        backgroundColor: bg,
        color: fg,
        ...textStyle(t, 'label'),
      }}
    >
      {pill.tone === 'live' ? <div style={{ display: 'flex', width: s(5), height: s(5), borderRadius: 999, backgroundColor: fg }} /> : null}
      {pill.text}
    </div>
  );
}

function Meta({ t, line }: { t: OgTokens; line: MetaLine }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: s(6), color: t.color.ink2, ...textStyle(t, 'body') }}>
      <Mark paths={META_ICON[line.icon]} viewBox="0 0 20 20" size={s(15)} color={t.color.muted} />
      <div style={{ display: 'block', flexShrink: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{line.text}</div>
      {/* A joined date («Lac · 10–11 oct. 2026»): the place is cut first, never the date. */}
      {line.tail ? <div style={{ display: 'flex', flexShrink: 0, whiteSpace: 'nowrap' }}>{`· ${line.tail}`}</div> : null}
    </div>
  );
}

/** A number and its unit apart (owner rule 10). */
function FigureText({ t, figure, step }: { t: OgTokens; figure: Figure; step: 'stat' | 'heading' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: s(3) }}>
      <div style={{ display: 'flex', color: t.color.ink, ...textStyle(t, step) }}>{figure.value}</div>
      {figure.unit ? <div style={{ display: 'flex', color: t.color.muted, ...textStyle(t, 'caption') }}>{figure.unit}</div> : null}
    </div>
  );
}

const MEDAL = (t: OgTokens, p: number) => (p === 1 ? t.color.medalGold : p === 2 ? t.color.medalSilver : p === 3 ? t.color.medalBronze : null);

/**
 * The podium: one row per competitor (badge, name, figure). A shared place reads «=1» in its badge
 * and the legend under the box says «la egalitate» once (fish ResultsFooter: a tie is never shown as
 * one winner) — the names keep the row's whole width, the tie never shortens them.
 */
function Podium({ t, lines, legend }: { t: OgTokens; lines: PodiumLine[]; legend: boolean }) {
  const row = podiumRowHeight(lines.length);
  const slot = placeSlot(lines);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: LEGEND_GAP }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: s(t.radius.card),
          backgroundColor: t.color.page,
          padding: `${PODIUM_PAD_Y}px ${PODIUM_PAD_X}px`,
        }}
      >
        {lines.map((l, i) => {
          const medal = MEDAL(t, l.position);
          return (
            <div
              key={l.position + l.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: PODIUM_GAP,
                height: row,
                borderTop: i === 0 ? 'none' : `${s(0.5)}px solid ${t.color.hairline}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0, width: slot }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: s(20),
                    height: s(20),
                    padding: l.tied ? `0 ${s(4)}px` : 0,
                    borderRadius: 999,
                    backgroundColor: medal ?? t.color.surface,
                    color: medal ? t.color.onMedal : t.color.ink2,
                    ...textStyle(t, 'label'),
                    lineHeight: `${s(20)}px`,
                  }}
                >
                  {l.tied ? `=${l.position}` : String(l.position)}
                </div>
              </div>
              <div
                style={{
                  display: 'block',
                  flexGrow: 1,
                  flexShrink: 1,
                  color: t.color.ink,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  ...textStyle(t, 'body-strong'),
                  lineHeight: `${row}px`,
                }}
              >
                {l.name}
              </div>
              <div style={{ display: 'flex', flexShrink: 0 }}>
                <FigureText t={t} figure={l.figure} step="heading" />
              </div>
            </div>
          );
        })}
      </div>
      {legend ? (
        <div style={{ display: 'flex', paddingLeft: PODIUM_PAD_X, color: t.color.muted, ...textStyle(t, 'caption') }}>= la egalitate</div>
      ) : null}
    </div>
  );
}

function Figures({ t, card }: { t: OgTokens; card: EntityCard }) {
  const blocks: ReactNode[] = [];
  if (card.rating)
    blocks.push(
      <div key="rating" style={{ display: 'flex', alignItems: 'center', gap: s(4) }}>
        <div style={{ display: 'flex', color: t.color.ink, ...textStyle(t, 'stat') }}>{card.rating.score}</div>
        <Mark paths={STAR_PATHS} viewBox="0 0 20 20" size={s(18)} color={t.color.rating} />
        <div style={{ display: 'flex', color: t.color.muted, ...textStyle(t, 'body') }}>({card.rating.count})</div>
      </div>,
    );
  if (card.price)
    blocks.push(
      <div key="price" style={{ display: 'flex', alignItems: 'baseline', gap: s(4) }}>
        {card.price.unit === 'RON' ? <div style={{ display: 'flex', color: t.color.muted, ...textStyle(t, 'caption') }}>de la</div> : null}
        <div style={{ display: 'flex', color: t.color.ink, ...textStyle(t, 'stat') }}>{card.price.amount}</div>
        <div style={{ display: 'flex', color: t.color.muted, ...textStyle(t, 'caption') }}>{card.price.unit}</div>
      </div>,
    );
  if (!blocks.length) return null;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: s(4) }}>{blocks}</div>;
}

function MediaPanel({ t, media, width }: { t: OgTokens; media: Media; width: number }) {
  const h = OG_SIZE.height;
  const frame = { display: 'flex', position: 'relative' as const, flexShrink: 0, width, height: h, overflow: 'hidden' as const };
  switch (media.kind) {
    case 'photo':
      return (
        <div style={frame}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image */}
          <img src={media.src} width={width} height={h} style={{ width, height: h, objectFit: 'cover' }} alt="" />
        </div>
      );
    case 'logo':
      return (
        <div style={{ ...frame, alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.surface, borderLeft: `${s(1)}px solid ${t.color.hairline}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image */}
          <img src={media.src} style={{ maxWidth: width - s(64), maxHeight: h - s(96), objectFit: 'contain' }} alt="" />
        </div>
      );
    case 'outline': {
      const box = width - s(64);
      const { d, closed } = media.outline;
      return (
        <div
          style={{
            ...frame,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: `linear-gradient(160deg, ${t.color.bentoLavender2} 0%, ${t.color.bentoLavender} 100%)`,
          }}
        >
          <svg width={box} height={box} viewBox="-4 -4 108 108">
            <path
              d={d}
              fill={closed ? withAlpha(t.color.accent, 0.22) : 'none'}
              stroke={t.color.accentInk}
              strokeWidth={closed ? 1 : 1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>
      );
    }
    case 'brand':
      return (
        // A narrow band (layout.ts BAND_W): only the gradient and the fish, the logo is the facts
        // column's on every card — the width goes to the facts.
        <div style={frame}>
          <BrandGround t={t} width={width} height={h} fish={width * 1.4} />
        </div>
      );
  }
}

export function EntityCardView({ t, card }: { t: OgTokens; card: EntityCard }) {
  const layout = entityLayout(t, card);
  const step = layout.titleStep;
  const { padTop, gap } = layout.spacing;
  return (
    <div style={{ display: 'flex', width: OG_SIZE.width, height: OG_SIZE.height, backgroundColor: t.color.surface, fontFamily: 'Nunito' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: OG_SIZE.width - layout.mediaW,
          height: OG_SIZE.height,
          padding: PAD,
          gap: LOGO_GAP,
        }}
      >
        {/* The logo heads the facts on every card (brand band or picture alike). */}
        <Logo height={LOGO_H} color={t.color.accentInk} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            gap,
            // No figure, no podium: the facts centred in the column; else the figures / podium at its foot.
            justifyContent: layout.bottom ? 'space-between' : 'center',
            paddingTop: layout.bottom ? padTop : 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: s(8) }}>
              {card.pill ? <PillChip t={t} pill={card.pill} /> : null}
              <div style={{ display: 'flex', color: t.color.accentInk, ...textStyle(t, 'label') }}>{card.eyebrow}</div>
            </div>
            <div
              style={{
                display: 'block',
                color: t.color.ink,
                ...textStyle(t, step),
                letterSpacing: step === 'hero' ? -s(0.5) : 0,
                overflow: 'hidden',
                // Lines of even length (no «Etapa 3» alone under a full line); a dash binds to its word
                // (model.ts bindDashes). Satori mis-wraps a balanced text clamped at exactly its own line
                // count, so a balanced (whole) title is held by its height instead of the clamp.
                ...(layout.balance
                  ? { textWrap: 'balance' as const, maxHeight: layout.titleLines * parseFloat(textStyle(t, step).lineHeight) }
                  : { lineClamp: layout.titleLines }),
              }}
            >
              {card.title}
            </div>
            {layout.meta.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: s(2) }}>
                {layout.meta.map(m => (
                  <Meta key={m.icon + m.text} t={t} line={m} />
                ))}
              </div>
            ) : null}
          </div>
          {card.podium.length ? <Podium t={t} lines={card.podium} legend={layout.legend} /> : <Figures t={t} card={card} />}
        </div>
      </div>
      <MediaPanel t={t} media={card.media} width={layout.mediaW} />
    </div>
  );
}

export function BrandCardView({ t, card }: { t: OgTokens; card: BrandCard }) {
  return (
    <div style={{ display: 'flex', position: 'relative', width: OG_SIZE.width, height: OG_SIZE.height, fontFamily: 'Nunito' }}>
      <BrandGround t={t} width={OG_SIZE.width} height={OG_SIZE.height} fish={OG_SIZE.width * 0.6} />
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', width: OG_SIZE.width * 0.8, height: OG_SIZE.height, padding: s(32) }}>
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            padding: `${s(10)}px ${s(14)}px`,
            borderRadius: s(t.radius.card),
            backgroundColor: t.color.surface,
          }}
        >
          <Logo height={s(20)} color={t.color.accentInk} />
        </div>
        <div style={{ display: 'flex', flexGrow: 1 }} />
        <div style={{ display: 'block', color: t.color.onBentoIndigo, ...textStyle(t, 'hero'), maxHeight: 3 * parseFloat(textStyle(t, 'hero').lineHeight), overflow: 'hidden', letterSpacing: -s(0.5), textWrap: 'balance' }}>
          {card.title}
        </div>
        <div style={{ display: 'block', marginTop: s(10), color: t.color.onBentoIndigo2, ...textStyle(t, 'title2'), textWrap: 'balance' }}>{card.tagline}</div>
      </div>
    </div>
  );
}

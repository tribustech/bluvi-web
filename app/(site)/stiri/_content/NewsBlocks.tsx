import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { NewsBlock } from '@/core/news';
import type { StrapiImage } from '@/core/shared';
import { cn } from '@/components/ui/cn';
import { blurDataUrl } from '@/lib/blurhash';
import { hasRichText, sideImage, simpleImage, type LinkTracking } from './content';
import { RichText } from './RichText';

/*
 * fish helpers/renderNewsContentBlock.tsx — the article's dynamic zone, in order:
 *  - simple-text: the rich text;
 *  - simple-image: the first image, medium → small → original, full width, 200 high, radius 10;
 *  - image-right-text-left: the text, then the image (small → thumbnail → original), 8 apart;
 *  - image-left-text-right: the image, then the text.
 * Block types fish has no case for never get here (core/news drops them before validation); a
 * block with nothing to show (no image, no text) renders nothing.
 *
 * An image keeps its own proportions whenever the CMS gives width / height (fish crops every one
 * to 200px, which cut the text off the screenshots most articles carry — a deliberate deviation):
 * full width on the phone, at most 420 high there (taller ones contained on soft-fill); from 768
 * never wider than its own pixels nor taller than 480. Without dimensions, fish's fixed 200px
 * crop. Every image starts on the text column's left edge (as the headings and the list dashes),
 * is framed by the hairline (so a picture on a white ground keeps its edge on the white card), and
 * has more air above and below than a paragraph, so the line after it never reads as its caption.
 * The two «image beside text» blocks become what their names say — two columns in the order fish
 * stacks them — only when BOTH sides exist; with one side missing it takes the full measure, as
 * simple-text / simple-image.
 */
export function NewsBlocks({ blocks, tracking }: { blocks: NewsBlock[]; tracking: LinkTracking }) {
  return (
    <>
      {blocks.map((block) => {
        switch (block.__component) {
          case 'news-block.simple-text':
            return <RichText key={`simple-text-${block.id}`} blocks={block.text} tracking={tracking} />;
          case 'news-block.simple-image': {
            const img = simpleImage(block.image);
            return img ? (
              <BlockImage key={`simple-image-${block.id}`} img={img} source={block.image?.[0]} sizes="(min-width: 768px) 720px, 100vw" className={FIGURE_AIR} />
            ) : null;
          }
          case 'news-block.image-right-text-left':
          case 'news-block.image-left-text-right': {
            const img = sideImage(block.image);
            const text = hasRichText(block.text);
            if (!img && !text) return null;
            const both = Boolean(img) && text;
            const imageFirst = block.__component === 'news-block.image-left-text-right';
            const picture = img ? (
              <BlockImage img={img} source={block.image} sizes={both ? '(min-width: 768px) 360px, 100vw' : '(min-width: 768px) 720px, 100vw'} />
            ) : null;
            return (
              <div
                key={`${block.__component}-${block.id}`}
                data-block={block.__component}
                className={cn('flex flex-col gap-2', img && FIGURE_AIR, both && 'md:grid md:grid-cols-2 md:items-start md:gap-6')}
              >
                {imageFirst ? picture : null}
                <RichText blocks={block.text} tracking={tracking} />
                {imageFirst ? null : picture}
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
}

/** A figure's extra air over the 16px block gap: 24 / 32 above and below. */
const FIGURE_AIR = 'my-2 md:my-4';

/** From 768 the image's largest box: its own pixels, at most 480 high. */
const MAX_HEIGHT_PX = 480;

function BlockImage({
  img,
  source,
  sizes,
  className,
}: {
  img: { src: string; width?: number; height?: number };
  source: StrapiImage | null | undefined;
  sizes: string;
  className?: string;
}) {
  const alt = source?.alternativeText || source?.caption || '';
  const blur = blurDataUrl(source?.blurhash);
  const placeholder = blur ? ({ placeholder: 'blur', blurDataURL: blur } as const) : {};
  if (img.width && img.height) {
    const maxWidth = Math.round(Math.min(img.width, (MAX_HEIGHT_PX * img.width) / img.height));
    return (
      <Image
        src={img.src}
        alt={alt}
        width={img.width}
        height={img.height}
        sizes={sizes}
        {...placeholder}
        style={{ '--img-max': `${maxWidth}px` } as CSSProperties}
        className={cn(
          'h-auto w-full rounded-card bg-soft-fill object-contain ring-1 ring-hairline max-md:max-h-105 md:max-w-[min(100%,var(--img-max))]',
          className,
        )}
      />
    );
  }
  // No dimensions from the CMS: fish's fixed 200px box at every width.
  return (
    <div className={cn('relative h-50 w-full overflow-hidden rounded-card bg-soft-fill ring-1 ring-hairline', className)}>
      <Image src={img.src} alt={alt} fill sizes={sizes} {...placeholder} className="object-cover" />
    </div>
  );
}

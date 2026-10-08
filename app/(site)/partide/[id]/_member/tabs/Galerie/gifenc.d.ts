// gifenc 1.0.3 ships no types — only what the Galerie GIF export calls.
declare module 'gifenc' {
  export type Palette = number[][];
  export type GifEncoder = {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: Palette; delay?: number; repeat?: number; transparent?: boolean; first?: boolean },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GifEncoder;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' }): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: 'rgb565' | 'rgb444' | 'rgba4444'): Uint8Array;
}

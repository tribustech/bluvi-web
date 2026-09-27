import { describe, expect, it } from 'vitest';
import { MAX_LONG_EDGE_PX, targetSize } from './compress-image';

describe('targetSize', () => {
  it('caps the long edge and keeps the aspect ratio', () => {
    expect(targetSize(4032, 3024)).toEqual({ width: MAX_LONG_EDGE_PX, height: 1536 });
    expect(targetSize(3024, 4032)).toEqual({ width: 1536, height: MAX_LONG_EDGE_PX });
  });

  it('never upscales', () => {
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

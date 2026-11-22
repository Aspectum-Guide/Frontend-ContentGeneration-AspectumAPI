import { describe, expect, it } from 'vitest';
import { isLazyChunkLoadError } from './lazyChunkRecovery';

describe('isLazyChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: /assets/Step.js',
    'Loading chunk 42 failed',
    'ChunkLoadError: stale deployment asset',
    'Importing a module script failed',
  ])('recognizes a lazy chunk failure: %s', (message) => {
    expect(isLazyChunkLoadError(new Error(message))).toBe(true);
  });

  it('does not classify an application exception as a chunk failure', () => {
    expect(isLazyChunkLoadError(new Error('Cannot read properties of null'))).toBe(false);
  });
});

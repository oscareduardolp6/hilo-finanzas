import { describe, it, expect } from 'vitest';

describe('tooling', () => {
  it('corre vitest', () => {
    expect(1 + 1).toBe(2);
  });

  it('tiene CompressionStream (necesario para sync/QR)', () => {
    expect(typeof CompressionStream).toBe('function');
  });

  it('tiene indexedDB (fake-indexeddb)', () => {
    expect(typeof indexedDB).toBe('object');
  });
});

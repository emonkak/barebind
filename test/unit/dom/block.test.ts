import { describe, expect, it } from 'vitest';
import { DOMBlock } from '@/dom/block.js';

describe('DOMBlock', () => {
  it('throws for an empty fragment', () => {
    expect(() => {
      new DOMBlock(document.createDocumentFragment(), []);
    }).toThrow('DOMBlock must have at least one child node.');
  });
});

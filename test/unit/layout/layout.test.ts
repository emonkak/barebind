import { describe, expect, it } from 'vitest';

import { PartType } from '@/internal.js';
import { DefaultLayout } from '@/layout/layout.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import {
  MockBinding,
  MockLayout,
  MockPrimitive,
  MockSlot,
} from '../../mocks.js';

describe('DefaultLayout', () => {
  describe('compose()', () => {
    it('returns itself', () => {
      const layout = DefaultLayout.compose(new MockLayout());
      expect(layout).toBe(DefaultLayout);
    });
  });

  describe('placeBinding()', () => {
    it('places the binding with default layout', () => {
      const source = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new MockBinding(MockPrimitive, source, part);
      const slot = DefaultLayout.placeBinding(binding, new MockLayout());

      expect(slot).toBeInstanceOf(MockSlot);
      expect(slot.type).toBe(binding.type);
      expect(slot.value).toBe(binding.value);
      expect(slot.part).toBe(binding.part);
    });
  });
});

import { describe, expect, it } from 'vitest';

import { formatValue } from '@/debug/value.js';
import { DirectiveSpecifier } from '@/directive.js';
import { $directive, PartType } from '@/internal.js';
import { DefaultLayout, LayoutSpecifier } from '@/layout/layout.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import {
  MockBinding,
  MockDirective,
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

describe('LayoutSpecifier', () => {
  describe('[$debug]()', () => {
    it('returns a string representation of the value', () => {
      const source = new DirectiveSpecifier(new MockDirective(), 'foo');
      const layout = new MockLayout();
      const bindable = new LayoutSpecifier(source, layout);

      expect(formatValue(bindable)).toBe(
        'MockDirective("foo") with MockLayout',
      );
    });
  });

  describe('[$directive]()', () => {
    it('returns a directive with Primitive', () => {
      const source = 'foo';
      const layout = new MockLayout();
      const bindable = new LayoutSpecifier(source, layout);
      const directive = bindable[$directive]();

      expect(directive.type).toBe(undefined);
      expect(directive.value).toBe(source);
      expect(directive.layout).toBe(layout);
    });

    it('returns a directive with Bindable', () => {
      const source = new DirectiveSpecifier(new MockDirective(), 'foo');
      const layout = new MockLayout();
      const bindable = new LayoutSpecifier(source, layout);
      const directive = bindable[$directive]();

      expect(directive.type).toBe(source.type);
      expect(directive.value).toBe(source.value);
      expect(directive.layout).toBe(layout);
    });

    it('returns a directive with nested layout', () => {
      const source = new DirectiveSpecifier(new MockDirective(), 'foo');
      const layout = new MockLayout();
      const bindable = new LayoutSpecifier(
        new LayoutSpecifier(source, layout),
        new MockLayout(),
      );
      const directive = bindable[$directive]();

      expect(directive.type).toBe(source.type);
      expect(directive.value).toBe(source.value);
      expect(directive.layout).toStrictEqual(new MockLayout(new MockLayout()));
    });
  });
});

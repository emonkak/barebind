import { describe, expect, it } from 'vitest';

import { formatValue } from '@/debug/value.js';
import { DirectiveSpecifier, LayoutModifier } from '@/directive.js';
import { $directive } from '@/internal.js';
import { MockDirective, MockLayout } from '../mocks.js';

describe('DirectiveSpecifier', () => {
  describe('[$debug]()', () => {
    it('returns a string representation for debugging', () => {
      const type = new MockDirective();
      const value = 'foo';
      const bindable = new DirectiveSpecifier(type, value);

      expect(formatValue(bindable)).toBe('MockDirective("foo")');
    });
  });

  describe('[$directive]()', () => {
    it('returns itself as a directive', () => {
      const type = new MockDirective();
      const value = 'foo';
      const bindable = new DirectiveSpecifier(type, value);

      expect(bindable.type).toBe(type);
      expect(bindable.value).toBe(value);
      expect(bindable[$directive]()).toBe(bindable);
    });
  });
});

describe('LayoutModifier', () => {
  describe('[$debug]()', () => {
    it('returns a string representation of the value', () => {
      const source = new DirectiveSpecifier(new MockDirective(), 'foo');
      const layout = new MockLayout();
      const bindable = new LayoutModifier(source, layout);

      expect(formatValue(bindable)).toBe(
        'MockDirective("foo") with MockLayout',
      );
    });
  });

  describe('[$directive]()', () => {
    it('returns a directive with Primitive', () => {
      const source = 'foo';
      const layout = new MockLayout();
      const bindable = new LayoutModifier(source, layout);
      const directive = bindable[$directive]();

      expect(directive.type).toBe(undefined);
      expect(directive.value).toBe(source);
      expect(directive.layout).toBe(layout);
    });

    it('returns a directive with Bindable', () => {
      const source = new DirectiveSpecifier(new MockDirective(), 'foo');
      const layout = new MockLayout();
      const bindable = new LayoutModifier(source, layout);
      const directive = bindable[$directive]();

      expect(directive.type).toBe(source.type);
      expect(directive.value).toBe(source.value);
      expect(directive.layout).toBe(layout);
    });

    it('returns a directive with nested layout', () => {
      const source = new DirectiveSpecifier(new MockDirective(), 'foo');
      const layout = new MockLayout();
      const bindable = new LayoutModifier(
        new LayoutModifier(source, layout),
        new MockLayout(),
      );
      const directive = bindable[$directive]();

      expect(directive.type).toBe(source.type);
      expect(directive.value).toBe(source.value);
      expect(directive.layout).toStrictEqual(new MockLayout(new MockLayout()));
    });
  });
});

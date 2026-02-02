import { describe, expect, it } from 'vitest';

import { formatValue } from '@/debug/value.js';
import { DirectiveSpecifier } from '@/directive.js';
import { $directive } from '@/internal.js';
import { LayoutSpecifier } from '@/layout/layout.js';
import { MockDirective, MockLayout } from '../../mocks.js';

describe('LayoutSpecifier', () => {
  describe('[$debug]()', () => {
    it('returns a string representation of the value', () => {
      const source = new DirectiveSpecifier(new MockDirective(), 'foo');
      const layout = MockLayout;
      const bindable = new LayoutSpecifier(source, layout);

      expect(formatValue(bindable)).toBe('MockDirective("foo") in MockLayout');
    });
  });

  describe('[$directive]()', () => {
    it('returns a directive with the primitive value', () => {
      const source = 'foo';
      const layout = MockLayout;
      const bindable = new LayoutSpecifier(source, layout);
      const directive = bindable[$directive]();

      expect(directive.type).toBe(undefined);
      expect(directive.value).toBe(source);
      expect(directive.layout).toBe(layout);
    });

    it('returns a directive with the bindable value', () => {
      const source = new DirectiveSpecifier(new MockDirective(), 'foo');
      const layout = MockLayout;
      const bindable = new LayoutSpecifier(source, layout);
      const directive = bindable[$directive]();

      expect(directive.type).toBe(source.type);
      expect(directive.value).toBe(source.value);
      expect(directive.layout).toBe(layout);
    });
  });
});

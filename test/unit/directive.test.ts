import { describe, expect, it } from 'vitest';

import { formatValue } from '@/debug/value.js';
import { DirectiveSpecifier } from '@/directive.js';
import { $directive } from '@/internal.js';
import { MockDirective } from '../mocks.js';

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

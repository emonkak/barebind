import { describe, expect, it } from 'vitest';

import { formatValue } from '@/debug/value.js';
import { DirectiveSpecifier } from '@/directive.js';
import { $toDirective } from '@/internal.js';
import { MockDirective } from '../mocks.js';

describe('DirectiveSpecifier', () => {
  describe('[$toDirectiveElement]()', () => {
    it('returns itself as a directive element', () => {
      const type = new MockDirective();
      const value = 'foo';
      const bindable = new DirectiveSpecifier(type, value);

      expect(bindable.type).toBe(type);
      expect(bindable.value).toBe(value);
      expect(bindable[$toDirective]()).toBe(bindable);
    });
  });

  describe('[$debug]()', () => {
    it('returns a string representation for debugging', () => {
      const type = new MockDirective();
      const value = 'foo';
      const bindable = new DirectiveSpecifier(type, value);

      expect(formatValue(bindable)).toBe('MockDirective("foo")');
    });
  });
});

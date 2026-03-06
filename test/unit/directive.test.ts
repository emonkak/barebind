import { describe, expect, it } from 'vitest';
import { $directive } from '@/core.js';
import { formatValue } from '@/debug/value.js';
import {
  areDirectiveTypesEqual,
  DirectiveSpecifier,
  isBindable,
  LayoutModifier,
} from '@/directive.js';
import {
  MockBindable,
  MockDirective,
  MockLayout,
  MockPrimitive,
} from '../mocks.js';

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

describe('areDirectiveTypesEqual()', () => {
  it('returns the result from Directive.equals() if it is definied', () => {
    const type1 = new MockDirective();
    const type2 = MockPrimitive;

    expect(areDirectiveTypesEqual(type1, type1)).toBe(true);
    expect(areDirectiveTypesEqual(type1, type2)).toBe(false);
    expect(areDirectiveTypesEqual(type2, type1)).toBe(false);
    expect(areDirectiveTypesEqual(type2, type2)).toBe(true);
  });
});

describe('isBindable()', () => {
  it('returns true if the value is a bindable', () => {
    expect(
      isBindable(
        new MockBindable({
          type: MockPrimitive,
          value: 'foo',
        }),
      ),
    ).toBe(true);
    expect(isBindable('foo')).toBe(false);
  });
});

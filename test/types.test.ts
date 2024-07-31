import { describe, expect, it } from 'vitest';

import { directiveTag, isDirective, nameOf, nameTag } from '../src/types.js';

describe('isDirective()', () => {
  it('should return true if the value is directive', () => {
    expect(isDirective(null)).toBe(false);
    expect(isDirective(undefined)).toBe(false);
    expect(isDirective('foo')).toBe(false);
    expect(isDirective(123)).toBe(false);
    expect(isDirective(true)).toBe(false);
    expect(isDirective({})).toBe(false);
    expect(isDirective(() => {})).toBe(false);
    expect(isDirective({ [directiveTag]: () => {} })).toBe(true);
  });
});

describe('nameOf()', () => {
  it('should return the name of the value', () => {
    expect(nameOf(() => {})).toBe('Function');
    expect(nameOf(123)).toBe('123');
    expect(nameOf(function foo() {})).toBe('foo');
    expect(nameOf(new Date())).toBe('Date');
    expect(nameOf(null)).toBe('null');
    expect(nameOf(true)).toBe('true');
    expect(nameOf(undefined)).toBe('undefined');
    expect(nameOf({})).toBe('Object');
    expect(nameOf({ [nameTag]: 'foo' })).toBe('foo');
  });
});

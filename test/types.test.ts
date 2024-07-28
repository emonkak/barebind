import { describe, expect, it } from 'vitest';

import {
  comparePriorities,
  directiveTag,
  isDirective,
  nameOf,
  nameTag,
} from '../src/types.js';

describe('comparePriorities()', () => {
  it('should returns a negative number, zero, or a number integer as the first priority is less than, equal to, or greater than the second', () => {
    expect(comparePriorities('user-blocking', 'user-blocking')).toBe(0);
    expect(comparePriorities('user-blocking', 'user-visible')).toBeGreaterThan(
      0,
    );
    expect(comparePriorities('user-blocking', 'background')).toBeGreaterThan(0);
    expect(comparePriorities('user-visible', 'user-blocking')).toBeLessThan(0);
    expect(comparePriorities('user-visible', 'user-visible')).toBe(0);
    expect(comparePriorities('user-visible', 'background')).toBeGreaterThan(0);
    expect(comparePriorities('background', 'user-blocking')).toBeLessThan(0);
    expect(comparePriorities('background', 'user-visible')).toBeLessThan(0);
    expect(comparePriorities('background', 'background')).toBe(0);
  });
});

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

import { describe, expect, it } from 'vitest';

import {
  directiveTag,
  ensureDirective,
  ensureNonDirective,
  hintTag,
  isDirective,
  nameOf,
} from '../src/types.js';
import { MockDirective } from './mocks.js';

describe('ensureDirective', () => {
  it('should throw an error if the value is not instance of the expected class', () => {
    expect(() => ensureDirective(MockDirective, null)).toThrow(
      'A value must be a instance of "MockDirective", but got "null".',
    );
  });

  it('should do nothing if the value is instance of the expected class', () => {
    ensureDirective(MockDirective, new MockDirective());
  });
});

describe('ensureNonDirective', () => {
  it('should throw an error if the value is any directive', () => {
    expect(() => ensureNonDirective(new MockDirective())).toThrow(
      'A value must not be a directive, but got "MockDirective".',
    );
  });

  it('should do nothing if the value is instance of the expected class', () => {
    ensureNonDirective(null);
    ensureNonDirective(undefined);
    ensureNonDirective('foo');
    ensureNonDirective(123);
    ensureNonDirective(true);
    ensureNonDirective({});
    ensureNonDirective(() => {});
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
    expect(nameOf({ [hintTag]: 'foo' })).toBe('foo');
  });
});

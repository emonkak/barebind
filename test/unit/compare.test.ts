import { describe, expect, it } from 'vitest';

import { sequentialEqual, shallowEqual } from '@/compare.js';

describe('sequentialEqual()', () => {
  it('returns false if the lengths of the first and second are different', () => {
    expect(sequentialEqual([], ['foo'])).toBe(false);
    expect(sequentialEqual(['foo'], [])).toBe(false);
    expect(sequentialEqual(['foo'], ['foo', 'bar'])).toBe(false);
    expect(sequentialEqual(['foo', 'bar'], ['foo'])).toBe(false);
  });

  it('returns false if there is a value that is not same from the other one', () => {
    expect(sequentialEqual(['foo'], ['FOO'])).toBe(false);
    expect(sequentialEqual(['FOO'], ['foo'])).toBe(false);
    expect(sequentialEqual(['foO', 'bar'], ['FOO', 'bar'])).toBe(false);
    expect(sequentialEqual(['FOO', 'bar'], ['foo', 'bar'])).toBe(false);
    expect(sequentialEqual(['foo', 'bar'], ['foo', 'BAR'])).toBe(false);
    expect(sequentialEqual(['foo', 'BAR'], ['foo', 'bar'])).toBe(false);
    expect(sequentialEqual(['foo', 'bar'], ['FOO', 'BAR'])).toBe(false);
    expect(sequentialEqual(['FOO', 'BAR'], ['foo', 'bar'])).toBe(false);
    expect(sequentialEqual<unknown>(['0'], [0])).toBe(false);
    expect(sequentialEqual<unknown>([0], ['0'])).toBe(false);
    expect(sequentialEqual<unknown>([1], ['1'])).toBe(false);
    expect(sequentialEqual<unknown>(['1'], [1])).toBe(false);
  });

  it('returns true if all values are same', () => {
    expect(sequentialEqual(['foo'], ['foo'])).toBe(true);
    expect(sequentialEqual(['foo', 'bar'], ['foo', 'bar'])).toBe(true);
    expect(sequentialEqual([0], [0])).toBe(true);
    expect(sequentialEqual(['0'], ['0'])).toBe(true);
    expect(sequentialEqual([1], [1])).toBe(true);
    expect(sequentialEqual(['1'], ['1'])).toBe(true);
    expect(sequentialEqual([Number.NaN], [Number.NaN])).toBe(true);
  });

  it('returns true if there are no values', () => {
    expect(sequentialEqual([], [])).toBe(true);
  });

  it('returns true if two values are the same', () => {
    const xs = [] as const;
    expect(sequentialEqual(xs, xs)).toBe(true);
  });
});

describe('shallowEqual()', () => {
  it('returns true if two values are the same', () => {
    const props = { foo: 1 };
    expect(shallowEqual(props, props)).toBe(true);
  });

  it('returns true if all properties have the same value', () => {
    expect(shallowEqual({}, {})).toBe(true);
    expect(shallowEqual({ foo: 1 }, { foo: 1 })).toBe(true);
    expect(shallowEqual({ foo: 1, bar: 2 }, { foo: 1, bar: 2 })).toBe(true);
    expect(shallowEqual({ foo: Number.NaN }, { foo: Number.NaN })).toBe(true);
  });

  it('returns false if there is a property that is not same from the other one', () => {
    expect(shallowEqual({ foo: '1' }, { foo: 1 })).toBe(false);
    expect(shallowEqual({ foo: 1 }, { foo: '1' })).toBe(false);
  });

  it('returns false if the number of properties does not match', () => {
    expect(shallowEqual({ foo: 1 }, {})).toBe(false);
    expect(shallowEqual({ foo: 1 }, { foo: 1, bar: 1 })).toBe(false);
    expect(shallowEqual({ foo: 1, bar: 1 }, {})).toBe(false);
    expect(shallowEqual({ foo: 1, bar: 1 }, { foo: 1 })).toBe(false);
    expect(shallowEqual({}, { foo: 1 })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  areDependenciesChanged,
  sequentialEqual,
  shallowEqual,
} from '@/compare.js';

describe('areDependenciesChanged()', () => {
  it('returns true when next is null', () => {
    expect(areDependenciesChanged(null, [1, 2])).toBe(true);
  });

  it('returns true when prev is null', () => {
    expect(areDependenciesChanged([1, 2], null)).toBe(true);
  });

  it('returns true when both are null', () => {
    expect(areDependenciesChanged(null, null)).toBe(true);
  });

  it('returns false when arrays are equal', () => {
    expect(areDependenciesChanged([1, 2], [1, 2])).toBe(false);
  });

  it('returns true when arrays differ', () => {
    expect(areDependenciesChanged([1, 2], [1, 3])).toBe(true);
  });

  it('returns false for the same reference', () => {
    const dependencies = [1, 2];
    expect(areDependenciesChanged(dependencies, dependencies)).toBe(false);
  });
});

describe('sequentialEqual()', () => {
  it('returns true for the same reference', () => {
    const xs = [1, 2, 3];
    expect(sequentialEqual(xs, xs)).toBe(true);
  });

  it('returns false when lengths differ', () => {
    expect(sequentialEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('returns true for element-wise equal arrays', () => {
    expect(sequentialEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it('returns false when an element differs', () => {
    expect(sequentialEqual([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  it('returns true for empty arrays', () => {
    expect(sequentialEqual([], [])).toBe(true);
  });

  it('uses a custom equals function when provided', () => {
    const caseInsensitive = (x: string, y: string) =>
      x.toLowerCase() === y.toLowerCase();
    expect(sequentialEqual(['A', 'B'], ['a', 'b'], caseInsensitive)).toBe(true);
    expect(sequentialEqual(['A', 'B'], ['a', 'c'], caseInsensitive)).toBe(
      false,
    );
  });
});

describe('shallowEqual()', () => {
  it('returns true for the same reference', () => {
    const obj = { a: 1 };
    expect(shallowEqual(obj, obj)).toBe(true);
  });

  it('returns false when key counts differ', () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('returns true for objects with equal values', () => {
    expect(shallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
  });

  it('returns false when a value differs', () => {
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
  });

  it('returns false when ys is missing a key from xs', () => {
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
  });

  it('returns true for empty objects', () => {
    expect(shallowEqual({}, {})).toBe(true);
  });

  it('uses a custom equals function when provided', () => {
    const loose = (x: unknown, y: unknown) => x == y;
    expect(shallowEqual({ a: 1 }, { a: '1' } as any, loose)).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: '2' } as any, loose)).toBe(false);
  });

  it('does not compare inherited properties', () => {
    const xs = Object.create({ inherited: 1 });
    const ys = Object.create({ inherited: 2 });
    expect(shallowEqual(xs, ys)).toBe(true);
  });
});

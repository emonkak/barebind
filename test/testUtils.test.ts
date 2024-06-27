import { describe, expect, it } from 'vitest';

import {
  allCombinations,
  combination,
  factorial,
  permutations,
} from './testUtils.js';

describe('factorial()', () => {
  it('should calculate n! result', () => {
    expect(factorial(5)).toBe(120);
    expect(factorial(4)).toBe(24);
    expect(factorial(3)).toBe(6);
    expect(factorial(2)).toBe(2);
    expect(factorial(1)).toBe(1);
    expect(factorial(0)).toBe(1);
  });
});

describe('combination()', () => {
  it('should calculate nCr result', () => {
    expect(combination(5, 5)).toBe(1);
    expect(combination(5, 4)).toBe(5);
    expect(combination(5, 3)).toBe(10);
    expect(combination(5, 2)).toBe(10);
    expect(combination(5, 1)).toBe(5);
  });
});

describe('allCombinations()', () => {
  it.each([[[1]], [[1, 2]], [[1, 2, 3]], [[1, 2, 3, 4]], [[1, 2, 3, 4, 5]]])(
    'should return subsequences of elements with length between 0 to the length of the array',
    (source) => {
      const results = Array.from(allCombinations(source));

      expect(results).toHaveLength(
        source
          .map((_x, i, array) => combination(array.length, i + 1))
          .reduce((total, combination) => total + combination, 0),
      );
      expect(new Set(results.map((result) => result.join(','))).size).toBe(
        results.length,
      );

      for (const result of results) {
        expect(new Set(result).size).toBe(result.length);
        expect(result.filter((x) => source.includes(x))).toHaveLength(
          result.length,
        );
      }
    },
  );
});

describe('permutations()', () => {
  it.each([[[1]], [[1, 2]], [[1, 2, 3]], [[1, 2, 3, 4]], [[1, 2, 3, 4, 5]]])(
    'should return successive permutations of elements',
    (source) => {
      const results = Array.from(permutations(source));

      expect(results).toHaveLength(factorial(source.length));
      expect(new Set(results.map((xs) => xs.join(','))).size).toBe(
        results.length,
      );

      for (const result of results) {
        expect(result.sort()).toEqual(source);
      }
    },
  );
});

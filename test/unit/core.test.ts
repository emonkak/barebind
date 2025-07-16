import { describe, expect, it } from 'vitest';
import {
  areDirectiveTypesEqual,
  DEFAULT_LANES,
  getFlushLanesFromOptions,
  getScheduleLanesFromOptions,
  isBindable,
  Lane,
  type UpdateOptions,
} from '@/core.js';
import { MockBindable, MockDirective, MockPrimitive } from '../mocks.js';

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

describe('getFlushLanesFromOptions()', () => {
  it.each([
    [{}, DEFAULT_LANES],
    [{ priority: 'user-blocking' }, Lane.UserBlocking],
    [{ priority: 'user-visible' }, Lane.UserBlocking | Lane.UserVisible],
    [
      { priority: 'background' },
      Lane.UserBlocking | Lane.UserVisible | Lane.Background,
    ],
    [{ transition: true }, DEFAULT_LANES | Lane.Transition],
    [
      { priority: 'user-blocking', transition: true },
      Lane.UserBlocking | Lane.Transition,
    ],
    [
      { priority: 'user-visible', transition: true },
      Lane.UserBlocking | Lane.UserVisible | Lane.Transition,
    ],
    [
      { priority: 'background', transition: true },
      Lane.UserBlocking | Lane.UserVisible | Lane.Background | Lane.Transition,
    ],
  ] as [UpdateOptions, Lane][])(
    'returns the lanes for flush',
    (options, lanes) => {
      expect(getFlushLanesFromOptions(options)).toBe(lanes);
    },
  );
});

describe('getScheduleLanesFromOptions()', () => {
  it.each([
    [{}, DEFAULT_LANES],
    [{ priority: 'user-blocking' }, Lane.UserBlocking],
    [{ priority: 'user-visible' }, Lane.UserVisible],
    [{ priority: 'background' }, Lane.Background],
    [{ transition: true }, DEFAULT_LANES | Lane.Transition],
    [
      { priority: 'user-blocking', transition: true },
      Lane.UserBlocking | Lane.Transition,
    ],
    [
      { priority: 'user-visible', transition: true },
      Lane.UserVisible | Lane.Transition,
    ],
    [
      { priority: 'background', transition: true },
      Lane.Background | Lane.Transition,
    ],
  ] as [UpdateOptions, Lane][])(
    'returns lanes for schedule',
    (options, lanes) => {
      expect(getScheduleLanesFromOptions(options)).toBe(lanes);
    },
  );
});

describe('isBindable()', () => {
  it('returns true if the value is a bindable', () => {
    expect(
      isBindable(new MockBindable({ type: MockPrimitive, value: 'foo' })),
    ).toBe(true);
    expect(isBindable('foo')).toBe(false);
  });
});

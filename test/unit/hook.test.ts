import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LANES,
  ensureHookType,
  getFlushLanesFromOptions,
  getScheduleLanesFromOptions,
  HookType,
  Lane,
  type UpdateOptions,
} from '@/hook.js';

describe('ensureHookType()', () => {
  it('throws error if the hook has a different type than expected', () => {
    expect(() =>
      ensureHookType(HookType.Id, {
        type: HookType.Finalizer,
      }),
    ).toThrow('Unexpected hook type.');
    expect(() =>
      ensureHookType(HookType.Finalizer, {
        type: HookType.Finalizer,
      }),
    ).not.toThrow();
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

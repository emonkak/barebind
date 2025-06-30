import { describe, expect, it } from 'vitest';

import {
  ensureHookType,
  getLanesFromPriority,
  HookType,
  Lane,
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

describe('getLanesFromPriority()', () => {
  it.each([
    ['user-blocking', Lane.UserInput],
    ['user-visible', Lane.UserInput | Lane.ContinuousInput],
    ['background', Lane.UserInput | Lane.ContinuousInput | Lane.Idle],
  ] as const)('returns lanes according to priority', (priority, lanes) => {
    expect(getLanesFromPriority(priority)).toBe(lanes);
  });
});

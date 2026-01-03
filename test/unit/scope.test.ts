import { describe, expect, it } from 'vitest';

import { createScope, getSharedContext, setSharedContext } from '@/scope.js';

describe('getSharedContext()', () => {
  it('returns the own entry value', () => {
    const scope = createScope();

    setSharedContext(scope, 'foo', 1);

    expect(getSharedContext(scope, 'foo')).toBe(1);
    expect(getSharedContext(scope, 'bar')).toBe(undefined);
  });

  it('returns the inherited entry value', () => {
    const parentScope = createScope();
    const childScope = createScope(parentScope);

    setSharedContext(parentScope, 'foo', 1);
    setSharedContext(parentScope, 'bar', 2);
    setSharedContext(childScope, 'foo', 3);

    expect(getSharedContext(parentScope, 'foo')).toBe(1);
    expect(getSharedContext(parentScope, 'bar')).toBe(2);
    expect(getSharedContext(parentScope, 'baz')).toBe(undefined);

    expect(getSharedContext(childScope, 'foo')).toBe(3);
    expect(getSharedContext(childScope, 'bar')).toBe(2);
    expect(getSharedContext(childScope, 'baz')).toBe(undefined);
  });
});

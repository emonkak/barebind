import { describe, expect, it } from 'vitest';

import { Scope } from '@/scope.js';

describe('Scope', () => {
  it('gets the own entry value', () => {
    const scope = new Scope(null);

    scope.set('foo', 1);

    expect(scope.get('foo')).toBe(1);
    expect(scope.get('bar')).toBe(undefined);
  });

  it('gets the inherited entry value', () => {
    const parentScope = new Scope(null);
    const childScope = new Scope(parentScope);

    parentScope.set('foo', 1);
    parentScope.set('bar', 2);
    childScope.set('foo', 3);

    expect(childScope.get('foo')).toBe(3);
    expect(childScope.get('bar')).toBe(2);
    expect(childScope.get('baz')).toBe(undefined);
  });
});

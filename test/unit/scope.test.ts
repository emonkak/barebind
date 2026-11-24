import { describe, expect, it } from 'vitest';
import { areScopesDirty, createScope, enterScope } from '@/scope.js';

describe('areScopesDirty()', () => {
  it('returns false when both injections are null', () => {
    const a = createScope({});
    const b = createScope({});
    expect(areScopesDirty(a, b)).toBe(false);
  });

  it('returns true when one injection is null and the other is not', () => {
    const a = createScope({});
    const b = createScope({});
    b.injection = { instance: {}, next: null };
    expect(areScopesDirty(a, b)).toBe(true);
    expect(areScopesDirty(b, a)).toBe(true);
  });

  it('returns false when injection lists are identical', () => {
    const a = createScope({});
    const b = createScope({});
    const injection = { instance: {}, next: null };
    a.injection = injection;
    b.injection = injection;
    expect(areScopesDirty(a, b)).toBe(false);
  });

  it('returns true when an instance differs', () => {
    const a = createScope({});
    const b = createScope({});
    a.injection = { instance: {}, next: null };
    b.injection = { instance: {}, next: null };
    expect(areScopesDirty(a, b)).toBe(true);
  });

  it('returns false when all injections are equal', () => {
    const a = createScope({});
    const b = createScope({});
    const instance1 = {};
    const instance2 = {};
    a.injection = {
      instance: instance1,
      next: { instance: instance2, next: null },
    };
    b.injection = {
      instance: instance1,
      next: { instance: instance2, next: null },
    };
    expect(areScopesDirty(a, b)).toBe(false);
  });
});

describe('createScope()', () => {
  it('creates a root scope with the given owner and no parent', () => {
    const owner = {};
    const scope = createScope(owner);
    expect(scope.owner).toBe(owner);
    expect(scope.parent).toBe(null);
    expect(scope.level).toBe(0);
    expect(scope.injection).toBe(null);
  });
});

describe('enterScope()', () => {
  it('creates a child scope with incremented level and inherited injection', () => {
    const parent = createScope({});
    parent.injection = { instance: {}, next: null };
    const owner = (() => {}) as any;
    const child = enterScope(parent, owner);
    expect(child.owner).toBe(owner);
    expect(child.level).toBe(1);
    expect(child.injection).toBe(parent.injection);
    expect(child.parent).toBe(parent);
  });
});

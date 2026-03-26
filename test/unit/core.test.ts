import { describe, expect, it } from 'vitest';
import {
  Directive,
  EffectQueue,
  isBindable,
  Primitive,
  Scope,
  toDirectiveNode,
} from '@/core.js';
import { NoLanes } from '@/lane.js';
import { createEffect, MockCoroutine, MockType } from '../mocks.js';

describe('Directive', () => {
  describe('constructor()', () => {
    it('assigns parameters', () => {
      const type = new MockType();
      const directive = new Directive(type, 'value', 'key');
      expect(directive.type).toBe(type);
      expect(directive.value).toBe('value');
      expect(directive.key).toBe('key');
    });
  });

  describe('[Directive.toDirective]()', () => {
    it('returns itself', () => {
      const directive = new Directive(new MockType(), 'value');
      expect(directive[Directive.toDirective]()).toBe(directive);
    });
  });

  describe('withKey()', () => {
    it('returns a new instance with the given key', () => {
      const directive = new Directive(new MockType(), 'value');
      const keyed = directive.withKey('key');
      expect(keyed).not.toBe(directive);
      expect(keyed.key).toBe('key');
    });
  });
});

describe('EffectQueue', () => {
  describe('size', () => {
    it('is 0 for a new queue', () => {
      const queue = new EffectQueue();
      expect(queue.size).toBe(0);
    });

    it('increments by 1 for each push', () => {
      const queue = new EffectQueue();
      queue.push(createEffect(), 0);
      queue.push(createEffect(), 0);
      expect(queue.size).toBe(2);
    });

    it('increments by 1 for pushBefore', () => {
      const queue = new EffectQueue();
      queue.pushBefore(createEffect());
      expect(queue.size).toBe(1);
    });

    it('increments by 1 for pushAfter', () => {
      const queue = new EffectQueue();
      queue.pushAfter(createEffect());
      expect(queue.size).toBe(1);
    });

    it('resets to 0 after clear', () => {
      const queue = new EffectQueue();
      queue.push(createEffect(), 0);
      queue.clear();
      expect(queue.size).toBe(0);
    });

    it('resets to 0 after flush', () => {
      const queue = new EffectQueue();
      queue.push(createEffect(), 0);
      queue.flush();
      expect(queue.size).toBe(0);
    });
  });

  describe('flush()', () => {
    it('calls commit on a single effect', () => {
      const queue = new EffectQueue();
      const effect = createEffect();
      queue.push(effect, 0);
      queue.flush();
      expect(effect.commit).toHaveBeenCalledTimes(1);
    });

    it('does nothing when queue is empty', () => {
      const queue = new EffectQueue();
      expect(() => queue.flush()).not.toThrow();
    });

    it('commits effects in child-to-parent order (deeper level first)', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      const child = createEffect(() => order.push(1));
      const parent = createEffect(() => order.push(2));
      queue.push(child, 2);
      queue.push(parent, 1);
      queue.flush();
      expect(order).toStrictEqual([1, 2]);
    });

    it('commits effects in parent-to-child order when pushed ascending', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      const parent = createEffect(() => order.push(1));
      const child = createEffect(() => order.push(2));
      queue.push(parent, 1);
      queue.push(child, 2);
      queue.flush();
      expect(order).toStrictEqual([2, 1]);
    });

    it('commits pushBefore effects before push effects', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.push(
        createEffect(() => order.push(2)),
        0,
      );
      queue.pushBefore(createEffect(() => order.push(1)));
      queue.flush();
      expect(order).toStrictEqual([1, 2]);
    });

    it('commits pushAfter effects after push effects', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.push(
        createEffect(() => order.push(1)),
        0,
      );
      queue.pushAfter(createEffect(() => order.push(2)));
      queue.flush();
      expect(order).toStrictEqual([1, 2]);
    });

    it('commits effects in pushBefore, push, pushAfter order', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.pushBefore(createEffect(() => order.push(1)));
      queue.push(
        createEffect(() => order.push(2)),
        0,
      );
      queue.pushAfter(createEffect(() => order.push(3)));
      queue.flush();
      expect(order).toStrictEqual([1, 2, 3]);
    });

    it('empties the queue after flush', () => {
      const queue = new EffectQueue();
      queue.push(createEffect(), 0);
      queue.flush();
      const effect = createEffect();
      queue.push(effect, 0);
      queue.flush();
      expect(effect.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('push()', () => {
    it('groups effects at the same level together', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.push(
        createEffect(() => order.push(1)),
        1,
      );
      queue.push(
        createEffect(() => order.push(2)),
        1,
      );
      queue.push(
        createEffect(() => order.push(3)),
        1,
      );
      queue.flush();
      expect(order).toStrictEqual([1, 2, 3]);
    });

    it('moves to tail when level increases', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.push(
        createEffect(() => order.push(1)),
        1,
      );
      queue.push(
        createEffect(() => order.push(2)),
        2,
      );
      queue.push(
        createEffect(() => order.push(3)),
        1,
      );
      queue.flush();
      expect(order).toStrictEqual([2, 1, 3]);
    });

    it('handles alternating levels correctly', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.push(
        createEffect(() => order.push(1)),
        2,
      );
      queue.push(
        createEffect(() => order.push(2)),
        1,
      );
      queue.push(
        createEffect(() => order.push(3)),
        2,
      );
      queue.push(
        createEffect(() => order.push(4)),
        1,
      );
      queue.flush();
      expect(order).toStrictEqual([1, 3, 2, 4]);
    });
  });

  describe('clear()', () => {
    it('prevents previously pushed effects from being committed', () => {
      const queue = new EffectQueue();
      const effect = createEffect();
      queue.push(effect, 0);
      queue.clear();
      queue.flush();
      expect(effect.commit).not.toHaveBeenCalled();
    });

    it('clears effects from all three internal lists', () => {
      const queue = new EffectQueue();
      const before = createEffect();
      const middle = createEffect();
      const after = createEffect();
      queue.pushBefore(before);
      queue.push(middle, 0);
      queue.pushAfter(after);
      queue.clear();
      queue.flush();
      expect(before.commit).not.toHaveBeenCalled();
      expect(middle.commit).not.toHaveBeenCalled();
      expect(after.commit).not.toHaveBeenCalled();
    });

    it('allows the queue to be reused after clear', () => {
      const queue = new EffectQueue();
      queue.push(createEffect(), 0);
      queue.clear();
      const effect = createEffect();
      queue.push(effect, 0);
      queue.flush();
      expect(effect.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('pushBefore()', () => {
    it('commits multiple pushBefore effects in insertion order', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.pushBefore(createEffect(() => order.push(1)));
      queue.pushBefore(createEffect(() => order.push(2)));
      queue.flush();
      expect(order).toStrictEqual([1, 2]);
    });
  });

  describe('pushAfter()', () => {
    it('commits multiple pushAfter effects in insertion order', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.pushAfter(createEffect(() => order.push(1)));
      queue.pushAfter(createEffect(() => order.push(2)));
      queue.flush();
      expect(order).toStrictEqual([1, 2]);
    });
  });
});

describe('Scope', () => {
  describe('Orphan', () => {
    it('is frozen', () => {
      expect(Object.isFrozen(Scope.Orphan)).toBe(true);
    });

    it('has level 0', () => {
      expect(Scope.Orphan.level).toBe(0);
    });

    it('has symbol as owner', () => {
      expect(Scope.Orphan.owner).toBeTypeOf('symbol');
    });
  });

  describe('Child()', () => {
    it('has the given coroutine as owner', () => {
      const coroutine = new MockCoroutine();
      expect(Scope.Child(coroutine).owner).toBe(coroutine);
    });

    it('has one level higher than the parent scope', () => {
      expect(Scope.Child(new MockCoroutine()).level).toBe(1);
    });
  });

  describe('Root()', () => {
    it('returns a Scope with level 0', () => {
      expect(Scope.Root().level).toBe(0);
    });

    it('has symbol as owner', () => {
      expect(Scope.Root().owner).toBeTypeOf('symbol');
    });
  });

  describe('getPendingAncestor()', () => {
    it('returns null when called on a root scope', () => {
      expect(Scope.Root().getPendingAncestor(NoLanes)).toBe(null);
    });

    it('returns the scope when its coroutine has all requested lanes pending', () => {
      const scope = Scope.Child(new MockCoroutine());
      expect(scope.getPendingAncestor(0)).toBe(scope);
      expect(scope.getPendingAncestor(-1)).toBe(scope);
    });

    it('walks up to an ancestor scope that matches the lanes', () => {
      const parent = Scope.Child(new MockCoroutine('Parent'));
      const child = Scope.Child(new MockCoroutine('Child', parent, 0));
      expect(child.getPendingAncestor(0)).toBe(child);
      expect(child.getPendingAncestor(-1)).toBe(parent);
    });

    it('returns null when no ancestor has all requested lanes pending', () => {
      const parent = Scope.Child(new MockCoroutine('Parent', Scope.Root(), 0));
      const child = Scope.Child(new MockCoroutine('Child', parent, 0));
      expect(parent.getPendingAncestor(-1)).toBe(null);
      expect(child.getPendingAncestor(-1)).toBe(null);
    });
  });

  describe('isChild()', () => {
    it.each<[Scope, boolean]>([
      [Scope.Orphan, false],
      [Scope.Root(), false],
      [Scope.Child(new MockCoroutine()), true],
    ])('returns whether the scope is Scope.Child', (scope, expectedResult) => {
      expect(scope.isChild()).toBe(expectedResult);
    });
  });

  describe('isOrphan()', () => {
    it.each<[Scope, boolean]>([
      [Scope.Orphan, true],
      [Scope.Root(), false],
      [Scope.Child(new MockCoroutine()), false],
    ])('returns whether the scope is Scope.Orphan', (scope, expectedResult) => {
      expect(scope.isOrphan()).toBe(expectedResult);
    });
  });

  describe('isRoot()', () => {
    it.each<[Scope, boolean]>([
      [Scope.Orphan, false],
      [Scope.Root(), true],
      [Scope.Child(new MockCoroutine()), false],
    ])('returns whether the scope is Scope.Root', (scope, expectedResult) => {
      expect(scope.isRoot()).toBe(expectedResult);
    });
  });
});

describe('isBindable()', () => {
  it('returns true when the value is a bindable', () => {
    expect(isBindable(new Directive(new MockType(), 'foo'))).toBe(true);
  });

  it('returns false when the value is not a bindable', () => {
    expect(isBindable('foo')).toBe(false);
  });
});

describe('toDirectiveNode()', () => {
  it('converts to directive when the source is bindable', () => {
    const directive = new Directive(new MockType(), 'foo');
    expect(toDirectiveNode(directive)).toBe(directive);
  });

  it('returns a primitive directive the source is primitive', () => {
    const directive = toDirectiveNode('foo');
    expect(directive.type).toBe(Primitive);
    expect(directive.value).toBe('foo');
    expect(directive.key).toBe(undefined);
  });
});

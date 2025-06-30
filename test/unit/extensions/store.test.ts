import { describe, expect, it, vi } from 'vitest';
import { Atom, Lazy } from '@/extensions/signal.js';
import { createStore } from '@/extensions/store.js';
import { $customHook, type HookContext } from '@/hook.js';

describe('Store', () => {
  it('recalculates the computed property when any dependent properties are updated', () => {
    const store = new CounterStore(100);

    expect(store.count).toBe(100);
    expect(store.doublyCount).toBe(200);
    expect(store.quadruplyCount).toBe(400);
    expect(store.getDoublyCountVersion()).toBe(1);
    expect(store.getQuadruplyCountVersion()).toBe(1);

    store.count++;

    expect(store.count).toBe(101);
    expect(store.doublyCount).toBe(202);
    expect(store.quadruplyCount).toBe(404);
    expect(store.getDoublyCountVersion()).toBe(2);
    expect(store.getQuadruplyCountVersion()).toBe(2);

    store.count++;

    expect(store.count).toBe(102);
    expect(store.doublyCount).toBe(204);
    expect(store.quadruplyCount).toBe(408);
    expect(store.getDoublyCountVersion()).toBe(3);
    expect(store.getQuadruplyCountVersion()).toBe(3);
  });

  describe('static [$customHook]', () => {
    it('returns the store in the context', () => {
      const store = new CounterStore();
      const contextStorage = new Map();
      const context = {
        getContextValue(key: unknown): unknown {
          return contextStorage.get(key);
        },
        setContextValue(key: unknown, value: unknown): void {
          contextStorage.set(key, value);
        },
      } as HookContext;

      store[$customHook](context);

      expect(CounterStore[$customHook](context)).toBe(store);
    });

    it('throws the error when the store is not registered in the context', () => {
      const context = {
        getContextValue(_key: unknown): unknown {
          return undefined;
        },
        setContextValue(_key: unknown, _value: unknown): void {},
      } as HookContext;

      expect(() => {
        CounterStore[$customHook](context);
      }).toThrow(
        `The context value for the store of ${Counter.name} is not registered,`,
      );
    });
  });

  describe('asSignal()', () => {
    it('returns the signal having the itself as the value', () => {
      const store = new CounterStore();
      const signal = store.asSignal();
      const subscriber = vi.fn();

      signal.subscribe(subscriber);

      expect(subscriber).not.toHaveBeenCalled();
      expect(signal.value).toBe(store);
      expect(signal.version).toBe(0);

      store.count++;

      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(signal.value).toBe(store);
      expect(signal.version).toBe(1);

      store.count++;

      expect(subscriber).toHaveBeenCalledTimes(2);
      expect(signal.value).toBe(store);
      expect(signal.version).toBe(2);
    });
  });

  describe('getSignal()', () => {
    it('returns the signal for the property', () => {
      const store = new CounterStore();

      const count$ = store.getSignal('count');
      const doublyCount$ = store.getSignal('doublyCount');

      expect(count$).toBeInstanceOf(Atom);
      expect(count$.value).toBe(0);
      expect(count$.version).toBe(0);
      expect(doublyCount$).toBeInstanceOf(Lazy);
      expect(doublyCount$.value).toBe(0);
      expect(doublyCount$.version).toBe(0);

      store.count++;

      expect(count$.value).toBe(1);
      expect(count$.version).toBe(1);
      expect(doublyCount$.value).toBe(2);
      expect(doublyCount$.version).toBe(1);
    });

    it('returns undefinied if the property does not have the signal', () => {
      const store = new CounterStore();

      expect(store.getSignal($doublyCountVersion)).toBe(undefined);
      expect(store.getSignal($quadruplyCountVersion)).toBe(undefined);
    });
  });

  describe('toSnapshot()', () => {
    it('returns a snapshot of the current state', () => {
      const store = new CounterStore();

      expect(store.toSnapshot()).toStrictEqual({
        count: 0,
      });

      store.count++;

      expect(store.toSnapshot()).toStrictEqual({
        count: 1,
      });
    });
  });

  describe('subscribe()', () => {
    it('invokes the subscriber on update', () => {
      const store = new CounterStore();
      const subscriber = vi.fn();

      store.subscribe(subscriber);
      expect(subscriber).toHaveBeenCalledTimes(0);

      store.count++;
      expect(subscriber).toHaveBeenCalledTimes(1);

      store.count++;
      expect(subscriber).toHaveBeenCalledTimes(2);
    });

    it('does not invoke the invalidated subscriber', () => {
      const store = new CounterStore();
      const subscriber = vi.fn();

      store.subscribe(subscriber)();
      expect(subscriber).not.toHaveBeenCalled();

      store.count++;
      expect(subscriber).not.toHaveBeenCalled();

      store.count++;
      expect(subscriber).not.toHaveBeenCalled();
    });
  });

  describe('restoreSnapshot()', () => {
    it('restores the state from the snapshot', () => {
      const store = new CounterStore();
      const count$ = store.getSignal('count');

      store.restoreSnapshot({
        count: 123,
      });

      expect(store.count).toBe(123);
      expect(count$.value).toBe(123);
      expect(count$.version).toBe(1);
    });
  });
});

const $doublyCountVersion = Symbol('$doublyCountVersion');
const $quadruplyCountVersion = Symbol('$quadruplyCountVersion');

class Counter {
  count: number;

  [$doublyCountVersion]: number = 0;

  [$quadruplyCountVersion]: number = 0;

  constructor(initialCount: number = 0) {
    this.count = initialCount;
  }

  get doublyCount(): number {
    this.incrementDoublyCountVersion();
    return this.count * 2;
  }

  get quadruplyCount(): number {
    this.incrementQuadruplyCountVersion();
    return this.doublyCount * 2;
  }

  getDoublyCountVersion(): number {
    return this[$doublyCountVersion];
  }

  getQuadruplyCountVersion(): number {
    return this[$quadruplyCountVersion];
  }

  incrementDoublyCountVersion(): number {
    return this[$doublyCountVersion]++;
  }

  incrementQuadruplyCountVersion(): number {
    return this[$quadruplyCountVersion]++;
  }
}

const CounterStore = createStore(Counter);

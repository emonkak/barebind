import { describe, expect, it, vi } from 'vitest';
import type { HookContext } from '@/core.js';
import { Atom, Computed } from '@/extensions/signal.js';
import { defineStore } from '@/extensions/store.js';

class AppState {
  readonly counterStore: CounterStore;

  constructor(counterStore: CounterStore) {
    this.counterStore = counterStore;
  }
}

class CounterState {
  count: number;

  private _doublyCountVersion: number = 0;

  private _quadruplyCountVersion: number = 0;

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

  get _privateCount(): number {
    return this.count;
  }

  getDoublyCountVersion(): number {
    return this._doublyCountVersion;
  }

  getQuadruplyCountVersion(): number {
    return this._quadruplyCountVersion;
  }

  incrementDoublyCountVersion(): number {
    return this._doublyCountVersion++;
  }

  incrementQuadruplyCountVersion(): number {
    return this._quadruplyCountVersion++;
  }
}

const AppStore = defineStore(AppState);

const CounterStore = defineStore(CounterState);

type CounterStore = InstanceType<typeof CounterStore>;

describe('StoreExtensions', () => {
  describe('static onCustomHook()', () => {
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

      store.onCustomHook(context);

      expect(CounterStore.onCustomHook(context)).toBe(store);
    });

    it('throws an error when the store is not registered in the context', () => {
      const context = {
        getContextValue(_key: unknown): unknown {
          return undefined;
        },
        setContextValue(_key: unknown, _value: unknown): void {},
      } as HookContext;

      expect(() => {
        CounterStore.onCustomHook(context);
      }).toThrow(
        `The context value for the store of ${CounterState.name} is not registered,`,
      );
    });
  });

  describe('applySnapshot()', () => {
    it('apply a snapshot into the state', () => {
      const counterStore = new CounterStore(100);
      const appStore = new AppStore(counterStore);

      counterStore.applySnapshot({
        count: 200,
      });

      expect(counterStore.count).toStrictEqual(200);

      appStore.applySnapshot({
        counterStore: {
          count: 300,
        },
      });

      expect(counterStore.count).toStrictEqual(300);
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
      expect(doublyCount$).toBeInstanceOf(Computed);
      expect(doublyCount$.value).toBe(0);
      expect(doublyCount$.version).toBe(0);

      store.count++;

      expect(count$.value).toBe(1);
      expect(count$.version).toBe(1);
      expect(doublyCount$.value).toBe(2);
      expect(doublyCount$.version).toBe(1);
    });

    it('returns undefinied if the property is private', () => {
      const store = new CounterStore();

      expect(store.getSignal('_doublyCountVersion')).toBe(undefined);
      expect(store.getSignal('_quadruplyCountVersion')).toBe(undefined);
      expect(store.getSignal('_privateCount')).toBe(undefined);
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

  describe('toSnapshot()', () => {
    it('create a snapshot from the state', () => {
      const counterStore = new CounterStore(100);
      const appStore = new AppStore(counterStore);

      expect(counterStore.toSnapshot()).toStrictEqual({
        count: 100,
      });
      expect(appStore.toSnapshot()).toStrictEqual({
        counterStore: {
          count: 100,
        },
      });
    });
  });

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

  it('should handle nested store', () => {
    const counterStore = new CounterStore(100);
    const appStore = new AppStore(counterStore);
    const subscriber = vi.fn();

    appStore.subscribe(subscriber);

    expect(appStore.counterStore).toBe(counterStore);
    expect(appStore.getVersion()).toBe(0);
    expect(counterStore.count).toBe(100);
    expect(subscriber).toHaveBeenCalledTimes(0);

    counterStore.count++;

    expect(appStore.counterStore).toBe(counterStore);
    expect(appStore.getVersion()).toBe(1);
    expect(counterStore.count).toBe(101);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });
});

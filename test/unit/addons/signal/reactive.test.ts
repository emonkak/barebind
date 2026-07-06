import { describe, expect, it, vi } from 'vitest';
import { Reactive } from '@/addons/signal/reactive.js';
import { Atom } from '@/addons/signal/signal.js';

describe('Reactive', () => {
  describe('static from()', () => {
    it('creates a Reactive from a plain object', () => {
      const state$ = Reactive.from({ count: 0 });
      expect(state$.value).toStrictEqual({ count: 0 });
      expect(state$.version).toBe(0);
    });

    it('creates a Reactive from a class instance', () => {
      class Store {
        count = 0;
      }
      const state$ = Reactive.from(new Store());
      expect(state$.value).toBeInstanceOf(Store);
      expect(state$.value.count).toBe(0);
    });

    it('creates a shallow Reactive with shallow option', () => {
      const state$ = Reactive.from({ nested: { value: 1 } }, { shallow: true });
      expect(state$.value).toStrictEqual({ nested: { value: 1 } });
    });
  });

  describe('get value()', () => {
    it('returns the initial state at first', () => {
      const intialState = {};
      const state$ = Reactive.from(intialState);
      expect(state$.value).toBe(intialState);
    });

    it('returns the same reference if no changes were made', () => {
      const state$ = Reactive.from({ count: 0 });
      expect(state$.value).toBe(state$.value);
    });

    it('reflects pending child changes after reading', () => {
      const state$ = Reactive.from({ count: 0 });
      const count$ = state$.get('count');
      count$.value = 5;
      expect(state$.value).toStrictEqual({ count: 5 });
    });
  });

  describe('set value()', () => {
    it('replaces the entire value', () => {
      const state$ = Reactive.from({ count: 0 });
      const nextState = { count: 10 };
      state$.value = nextState;
      expect(state$.value).toBe(nextState);
    });

    it('increments version', () => {
      const state$ = Reactive.from({ count: 0 });
      expect(state$.version).toBe(0);
      state$.value = { count: 1 };
      expect(state$.version).toBe(1);
    });

    it('notifies subscribers', () => {
      const state$ = Reactive.from({ count: 0 });
      const subscriber = vi.fn();
      state$.subscribe(subscriber);
      state$.value = { count: 1 };
      expect(subscriber).toHaveBeenCalledOnce();
      expect(subscriber).toHaveBeenLastCalledWith({
        source: expect.any(Atom),
        path: [],
        oldValue: { count: 0 },
        newValue: { count: 1 },
      });
    });
  });

  describe('get version()', () => {
    it('starts at 0', () => {
      const state$ = Reactive.from({});
      expect(state$.version).toBe(0);
    });

    it('increments on root value assignment', () => {
      const state$ = Reactive.from({ count: 0 });
      state$.value = { count: 1 };
      expect(state$.version).toBe(1);
      state$.value = { count: 2 };
      expect(state$.version).toBe(2);
    });

    it('increments on nested property assignment', () => {
      const state$ = Reactive.from({ count: 0 });
      state$.get('count').value = 5;
      expect(state$.version).toBe(1);
    });

    it('increments once per scope batch', () => {
      const state$ = Reactive.from({ a: 1, b: 2 });
      state$.scope((s) => {
        s.a++;
        s.b++;
      });
      expect(state$.version).toBe(2);
    });
  });

  describe('get()', () => {
    it('returns a child reactive for a nested property', () => {
      const state$ = Reactive.from({ count: 0 });
      const count$ = state$.get('count');
      expect(count$).toBeInstanceOf(Reactive);
      expect(count$.value).toBe(0);
    });

    it('returns a reactive for an array index', () => {
      const state$ = Reactive.from([10, 20, 30]);
      const item$ = state$.get(0);
      expect(item$.value).toBe(10);
      item$.value = 99;
      expect(state$.value).toStrictEqual([99, 20, 30]);
    });

    it('returns null for a primitive value', () => {
      const state$ = Reactive.from(42);
      expect(state$.get('toString')).toBe(null);
    });

    it('returns undefined for a missing key from an object', () => {
      const state$ = Reactive.from({} as Record<string, number>);
      expect(state$.get('foo').value).toBe(undefined);
    });

    it('returns a writable reactive for a read-write accessor', () => {
      const store = {
        _count: 0,
        get count(): number {
          return this._count;
        },
        set count(count: number) {
          this._count = count;
        },
      };
      const state$ = Reactive.from(store);
      const count$ = state$.get('count');
      count$.value = 5;
      expect(state$.value.count).toBe(5);
    });

    it('returns a writable reactive for a writable property', () => {
      const state$ = Reactive.from({ count: 0 });
      const count$ = state$.get('count');
      count$.value = 10;
      expect(count$.value).toBe(10);
      expect(state$.value).toStrictEqual({ count: 10 });
    });

    it('returns a read-only reactive for a readonly property', () => {
      class Store {
        get id() {
          return 1;
        }
      }
      const state$ = Reactive.from(new Store());
      const id$ = state$.get('id');
      expect(() => {
        (id$ as any).value = 2;
      }).toThrow('Cannot set value on a read-only signal.');
    });

    it('returns a child that notifies on change', () => {
      const state$ = Reactive.from({ items: [{ id: 1 }] });
      const subscriber = vi.fn();
      state$.subscribe(subscriber);
      const item$ = state$.get('items').get(0);
      item$.get('id')!.value = 2;
      expect(subscriber).toHaveBeenCalledOnce();
      expect(subscriber).toHaveBeenCalledWith({
        source: expect.any(Atom),
        path: ['items', 0, 'id'],
        oldValue: 1,
        newValue: 2,
      });
    });

    it('re-evaluates a computed reactive when a dependency changes', () => {
      class Store {
        count = 0;
        get doubled() {
          return this.count * 2;
        }
      }
      const state$ = Reactive.from(new Store());
      const doubled$ = state$.get('doubled');
      expect(doubled$.value).toBe(0);
      state$.get('count').value = 5;
      expect(doubled$.value).toBe(10);
    });
  });

  describe('scope()', () => {
    it('mutates the value via proxy', () => {
      const state$ = Reactive.from({ count: 0 });
      state$.scope((state) => {
        state.count++;
      });
      expect(state$.value).toStrictEqual({ count: 1 });
    });

    it('increments version on mutation', () => {
      const state$ = Reactive.from({ count: 0 });
      state$.scope((state) => {
        state.count++;
      });
      expect(state$.version).toBe(1);
    });

    it('returns the callback result', () => {
      const state$ = Reactive.from({ count: 0 });
      const result = state$.scope((state) => {
        state.count++;
        return state.count;
      });
      expect(result).toBe(1);
    });

    it('preserves class methods through mutations', () => {
      class Counter {
        count = 0;
        increment() {
          this.count++;
        }
      }
      const state$ = Reactive.from(new Counter());
      state$.scope((state) => {
        state.increment();
      });
      expect(state$.value.count).toBe(1);
    });

    it('reads nested properties on a computed child', () => {
      class Store {
        count = 0;
        get doubled() {
          return this.count * 2;
        }
      }
      const state$ = Reactive.from(new Store());
      const doubled$ = state$.get('doubled');
      let result: number;
      doubled$.scope((v) => {
        result = v;
      });
      expect(result!).toBe(0);
    });

    it('calls callback directly for primitive values', () => {
      const state$ = Reactive.from(42);
      let result: number;
      state$.scope((v) => {
        result = v;
      });
      expect(result!).toBe(42);
    });

    it('throws when trying to set a getter-only property inside scope', () => {
      class Store {
        count = 0;
        get doubled() {
          return this.count * 2;
        }
      }
      const state$ = Reactive.from(new Store());
      expect(() =>
        state$.scope((state: any) => {
          state.doubled = 10;
        }),
      ).toThrow();
    });
  });

  describe('subscribe()', () => {
    it('notifies on root value change', () => {
      const state$ = Reactive.from({ count: 0 });
      const subscriber = vi.fn();
      state$.subscribe(subscriber);
      state$.value = { count: 1 };

      expect(subscriber).toHaveBeenCalledOnce();
      expect(subscriber).toHaveBeenCalledWith({
        source: expect.any(Atom),
        path: [],
        oldValue: { count: 0 },
        newValue: { count: 1 },
      });
    });

    it('notifies on nested property change', () => {
      const state$ = Reactive.from({ items: [{ id: 1 }] });
      const subscriber = vi.fn();
      state$.subscribe(subscriber);
      state$.get('items').get(0).get('id')!.value = 2;

      expect(subscriber).toHaveBeenCalledOnce();
      expect(subscriber).toHaveBeenCalledWith({
        source: expect.any(Atom),
        path: ['items', 0, 'id'],
        oldValue: 1,
        newValue: 2,
      });
    });

    it('does not notify on nested changes for shallow subscription', () => {
      const state$ = Reactive.from({ nested: { value: 1 } }, { shallow: true });
      const subscriber = vi.fn();
      state$.subscribe(subscriber);
      state$.get('nested').get('value').value = 2;

      expect(subscriber).not.toHaveBeenCalled();
    });

    it('notifies on root value change for shallow subscription', () => {
      const state$ = Reactive.from({ nested: { value: 1 } }, { shallow: true });
      const subscriber = vi.fn();
      state$.subscribe(subscriber);
      state$.value = { nested: { value: 2 } };

      expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('does not invoke unsubscribed subscriber', () => {
      const state$ = Reactive.from({ count: 0 });
      const subscriber = vi.fn();
      const unsubscribe = state$.subscribe(subscriber);
      unsubscribe();
      state$.value = { count: 1 };

      expect(subscriber).not.toHaveBeenCalled();
    });
  });
});

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
      state$.scope((draft) => {
        draft.a++;
        draft.b++;
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

    it('returns undefined for a primitive value', () => {
      const state$ = Reactive.from(42);
      expect(state$.get('toString')).toBe(undefined);
    });

    it('returns undefined for a missing key', () => {
      const state$ = Reactive.from({});
      expect(state$.get('foo').value).toBe(undefined);
    });

    it('returns a read-only reactive for a read-only accessor', () => {
      const store = {
        count: 0,
        get doublyCount(): number {
          return this.count * 2;
        },
      };
      const state$ = Reactive.from(store);
      const count$ = state$.get('count');
      const doublyCount$ = state$.get('doublyCount');
      count$.value++;
      expect(doublyCount$.value).toBe(2);
    });

    it('returns a nested reactive for a read-only accessor returning an object', () => {
      const store = {
        count: 0,
        get counter(): { count: number } {
          return { count: this.count };
        },
      };
      const state$ = Reactive.from(store);
      const count$ = state$.get('count');
      const counterCount$ = state$.get('counter').get('count');
      count$.value++;
      expect(counterCount$.value).toBe(1);
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

    it('returns a child that notifies on change', () => {
      const state$ = Reactive.from({ items: [{ id: 1 }] });
      const subscriber = vi.fn();
      state$.subscribe(subscriber);
      const item$ = state$.get('items').get(0);
      item$.get('id')!.value = 2;
      expect(subscriber).toHaveBeenCalledOnce();
      expect(subscriber).toHaveBeenCalledWith({
        source: expect.any(Atom),
        path: ['items', '0', 'id'],
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

    it('throws when trying to set a read-only property', () => {
      class Store {
        get id() {
          return 1;
        }
      }
      const state$ = Reactive.from(new Store());
      const id$ = state$.get('id');
      expect(() => {
        (id$ as any).value = 2;
      }).toThrow(TypeError);
    });
  });

  describe('scope()', () => {
    it('mutates the property via proxy', () => {
      const state$ = Reactive.from({ count: 0 });
      const count$ = state$.get('count');
      state$.scope((draft) => {
        draft.count++;
      });
      expect(state$.value).toStrictEqual({ count: 1 });
      expect(count$.value).toBe(1);
    });

    it('mutates the nested property via proxy', () => {
      const state$ = Reactive.from({ counter: { count: 0 } });
      const counter$ = state$.get('counter');
      const counterCount$ = counter$.get('count');
      state$.scope((draft) => {
        draft.counter.count++;
      });
      expect(state$.value).toStrictEqual({ counter: { count: 1 } });
      expect(counter$.value).toStrictEqual({ count: 1 });
      expect(counterCount$.value).toBe(1);
    });

    it('mutates the array via proxy', () => {
      const state$ = Reactive.from([] as number[]);
      state$.scope((draft) => {
        draft.push(0);
        draft.push(1);
        draft.push(2);
        draft.splice(1, 1);
      });
      expect(state$.value).toStrictEqual([0, 2]);
    });

    it('returns object keys via proxy', () => {
      const state$ = Reactive.from({ a: 0, b: 1 });
      const keys = state$.scope((draft) => Object.keys(draft));
      expect(keys).toStrictEqual(['a', 'b']);
    });

    it('returns numeric keys via proxy', () => {
      const state$ = Reactive.from([]);
      state$.get(0).value = 0;
      state$.get(1).value = 2;
      const keys = state$.scope((draft) => Object.keys(draft));
      expect(keys).toStrictEqual(['0', '1']);
    });

    it('adds a dynamic property via proxy', () => {
      const state$ = Reactive.from({} as Record<string, number>);
      state$.scope((draft) => {
        draft['a'] = 0;
        draft['b'] = 1;
        expect(draft['a']).toBe(0);
        expect(draft['b']).toBe(1);
        expect('a' in draft).toBe(true);
        expect('b' in draft).toBe(true);
        expect(Object.hasOwn(draft, 'a')).toBe(true);
        expect(Object.hasOwn(draft, 'b')).toBe(true);
        expect(Object.keys(draft)).toStrictEqual(['a', 'b']);
      });
      expect(state$.value).toStrictEqual({ a: 0, b: 1 });
    });

    it('deletes a property via proxy', () => {
      const state$ = Reactive.from({ a: 0, b: 1 } as Record<string, number>);
      state$.scope((draft) => {
        delete draft['a'];
        expect(draft['a']).toBe(undefined);
        expect(draft['b']).toBe(1);
        expect('a' in draft).toBe(false);
        expect('b' in draft).toBe(true);
        expect(Object.hasOwn(draft, 'a')).toBe(false);
        expect(Object.hasOwn(draft, 'b')).toBe(true);
        expect(Object.keys(draft)).toStrictEqual(['b']);
      });
      expect(state$.value).toStrictEqual({ b: 1 });
    });

    it('notifies when a property is deleted', () => {
      const state$ = Reactive.from({ a: 0, b: 1 } as Record<string, number>);
      const subscriber = vi.fn();
      state$.subscribe(subscriber);
      state$.scope((draft) => {
        delete draft['a'];
      });
      expect(subscriber).toHaveBeenCalledOnce();
      expect(subscriber).toHaveBeenCalledWith({
        source: expect.any(Atom),
        path: ['a'],
        oldValue: 0,
        newValue: undefined,
      });
    });

    it('increments version on mutation', () => {
      const state$ = Reactive.from({ count: 0 });
      state$.scope((draft) => {
        draft.count++;
      });
      expect(state$.version).toBe(1);
    });

    it('returns the callback result', () => {
      const state$ = Reactive.from({ count: 0 });
      const result = state$.scope((draft) => {
        draft.count++;
        return draft.count;
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
      state$.scope((draft) => {
        draft.increment();
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
      doubled$.scope((draft) => {
        result = draft;
      });
      expect(result!).toBe(0);
    });

    it('calls callback directly for primitive values', () => {
      const state$ = Reactive.from(42);
      const result = state$.scope((draft) => draft);
      expect(result).toBe(42);
    });

    it('returns a plain object from toSnapshot', () => {
      const state$ = Reactive.from({ count: 0 });
      state$.scope((draft, toSnapshot) => {
        const snapshot = toSnapshot(draft);
        expect(snapshot).toStrictEqual({ count: 0 });
        expect(snapshot).toBe(state$.value);
      });
    });

    it('returns the same value for primitive via toSnapshot', () => {
      const state$ = Reactive.from(42);
      const snapshot = state$.scope((draft, toSnapshot) => toSnapshot(draft));
      expect(snapshot).toBe(42);
    });

    it('reflects mutations made in scope via toSnapshot', () => {
      const state$ = Reactive.from({ a: 0, b: 1 });
      const snapshot = state$.scope((draft, toSnapshot) => {
        draft.a = 2;
        draft.b = 3;
        return toSnapshot(draft);
      });
      expect(snapshot).toStrictEqual({ a: 2, b: 3 });
      expect(structuredClone(snapshot)).toStrictEqual({ a: 2, b: 3 });
    });

    it('reflects nested mutations made in scope via toSnapshot', () => {
      const state$ = Reactive.from({ nested: { value: 1 } });
      const snapshot = state$.scope((draft, toSnapshot) => {
        draft.nested.value = 2;
        return toSnapshot(draft.nested);
      });
      expect(snapshot).toStrictEqual({ value: 2 });
      expect(structuredClone(snapshot)).toStrictEqual({ value: 2 });
    });

    it('throws when trying to set a read-only property inside scope', () => {
      class Store {
        count = 0;
        get doubled() {
          return this.count * 2;
        }
      }
      const state$ = Reactive.from(new Store());
      expect(() =>
        state$.scope((draft: any) => {
          draft.doubled = 10;
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
        path: ['items', '0', 'id'],
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

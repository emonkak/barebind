import { describe, expect, it, vi } from 'vitest';
import { Reactive } from '@/addons/signal/reactive.js';
import { Signal } from '@/addons/signal.js';

describe('Reactive', () => {
  describe('static from()', () => {
    it('creates a Reactive from a plain object', () => {
      const state$ = Reactive.from({ count: 0 });
      expect(state$.value).toStrictEqual({ count: 0 });
      expect(state$.version).toBe(0);
    });

    it('creates a Reactive from a class instance', () => {
      class State {
        count = 0;
      }
      const state$ = Reactive.from(new State());
      expect(state$.value).toBeInstanceOf(State);
      expect(state$.value.count).toBe(0);
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
        type: 'set',
        source: expect.any(Signal),
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
      const state$ = Reactive.from(123);
      expect(state$.get('toString')).toBe(undefined);
    });

    it('returns undefined for a missing key', () => {
      const state$ = Reactive.from({});
      expect(state$.get('foo').value).toBe(undefined);
    });

    it('returns a read-only reactive for a read-only accessor', () => {
      const State = {
        count: 0,
        get doubledCount(): number {
          return this.count * 2;
        },
      };
      const state$ = Reactive.from(State);
      const count$ = state$.get('count');
      const doubledCount$ = state$.get('doubledCount');
      count$.value++;
      expect(doubledCount$.value).toBe(2);
    });

    it('returns a nested reactive for a read-only accessor returning an object', () => {
      const state = {
        count: 0,
        get counter(): { count: number } {
          return { count: this.count };
        },
      };
      const state$ = Reactive.from(state);
      const count$ = state$.get('count');
      const counter$ = state$.get('counter');
      const counterCount$ = counter$.get('count');
      count$.value++;
      expect(counter$.value).toStrictEqual({ count: 1 });
      expect(counterCount$.value).toBe(0);
    });

    it('returns the same reactive reference for a getter returning the same property', () => {
      const state = {
        foo: { value: 0 },
        get bar(): { value: number } {
          return this.foo;
        },
      };
      const state$ = Reactive.from(state);
      const foo$ = state$.get('foo');
      const bar$ = state$.get('bar');
      expect(foo$.value).toStrictEqual({ value: 0 });
      expect(bar$.value).toBe(foo$.value);
    });

    it('reflects child mutations through both a property and a getter returning the same reference', () => {
      const state = {
        foo: { value: 0 },
        get bar(): { value: number } {
          return this.foo;
        },
      };
      const state$ = Reactive.from(state);
      const foo$ = state$.get('foo');
      const bar$ = state$.get('bar');
      const value$ = foo$.get('value');
      value$.value++;
      expect(foo$.value).toStrictEqual({ value: 1 });
      expect(bar$.value).toBe(foo$.value);
    });

    it('returns the same value for a getter/setter pair and its backing property', () => {
      const state = {
        _counter: { count: 0 },
        get counter(): { count: number } {
          return this._counter;
        },
        set counter(counter: { count: number }) {
          this._counter = counter;
        },
      };
      const state$ = Reactive.from(state);
      const privateCounter$ = state$.get('_counter');
      const counter$ = state$.get('counter');
      expect(counter$.value).toStrictEqual(privateCounter$.value);
    });

    it('reflects setter mutations on the backing property', () => {
      const state = {
        _counter: { count: 0 },
        get counter(): { count: number } {
          return this._counter;
        },
        set counter(counter: { count: number }) {
          this._counter = counter;
        },
      };
      const state$ = Reactive.from(state);
      const privateCounter$ = state$.get('_counter');
      const counter$ = state$.get('counter');
      counter$.value = { count: 1 };
      expect(counter$.value).toStrictEqual(privateCounter$.value);
    });

    it('returns a writable reactive for a read-write accessor', () => {
      const state = {
        _count: 0,
        get count(): number {
          return this._count;
        },
        set count(count: number) {
          this._count = count;
        },
      };
      const state$ = Reactive.from(state);
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
        type: 'set',
        source: expect.any(Signal),
        path: ['items', '0', 'id'],
        oldValue: 1,
        newValue: 2,
      });
    });

    it('ignores stale child mutations after property reassignment', () => {
      const state$ = Reactive.from({ nested: { value: 0 } });
      const nested$ = state$.get('nested');
      const value$ = nested$.get('value');
      nested$.value = { value: 1 };
      value$.value = 2;
      expect(state$.value).toStrictEqual({ nested: { value: 1 } });
    });

    it('ignores stale child mutations after property set to null', () => {
      const state$ = Reactive.from({ nested: { value: 0 } } as {
        nested: { value: number } | null;
      });
      const nested$ = state$.get('nested');
      const value$ = nested$.get('value');
      nested$.value = { value: 1 };
      value$!.value = 2;
      expect(state$.value).toStrictEqual({ nested: { value: 1 } });
    });

    it('re-evaluates a computed reactive when a dependency changes', () => {
      const state$ = Reactive.from({
        count: 0,
        get doubledCount() {
          return this.count * 2;
        },
      });
      const doubledCount$ = state$.get('doubledCount');
      expect(doubledCount$.value).toBe(0);
      state$.get('count').value = 5;
      expect(doubledCount$.value).toBe(10);
    });

    it('throws when trying to set a read-only property', () => {
      class State {
        get id() {
          return 1;
        }
      }
      const state$ = Reactive.from(new State());
      const id$ = state$.get('id');
      expect(() => {
        (id$ as any).value = 2;
      }).toThrow('Cannot set property value');
    });
  });

  describe('scope()', () => {
    it('increments version on mutation', () => {
      const state$ = Reactive.from({ count: 0 });
      state$.scope((draft) => {
        draft.count++;
      });
      expect(state$.version).toBe(1);
    });

    it('increments version on deletion', () => {
      const state$ = Reactive.from({ a: 0, b: 1 } as Record<string, number>);
      state$.scope((draft) => {
        delete draft['a'];
      });
      expect(state$.version).toBe(1);
    });

    it('returns object keys via proxy', () => {
      const state$ = Reactive.from({ a: 0, b: 1 });
      const keys = state$.scope((draft) => Object.keys(draft));
      expect(keys).toStrictEqual(['a', 'b']);
    });

    it('returns numeric keys via proxy', () => {
      const state$ = Reactive.from([] as number[]);
      state$.get(0).value = 0;
      state$.get(1).value = 2;
      const keys = state$.scope((draft) => Object.keys(draft));
      expect(keys).toStrictEqual(['0', '1']);
    });

    it('returns a computed value via getter', () => {
      const state$ = Reactive.from({
        count: 0,
        get doubledCount() {
          return this.count * 2;
        },
      });
      const doubledCount = state$.scope((draft) => {
        draft.count++;
        return draft.doubledCount;
      });
      expect(doubledCount).toStrictEqual(2);
    });

    it('returns a computed value via getter returning object', () => {
      const state$ = Reactive.from({
        counter: { count: 0 },
        get doubledCounter() {
          return { count: this.counter.count * 2 };
        },
      });
      const doubledCount = state$.scope((draft) => {
        draft.counter.count++;
        return draft.doubledCounter.count;
      });
      expect(doubledCount).toStrictEqual(2);
    });

    it('returns the same value for primitive values', () => {
      const state$ = Reactive.from(123);
      const result = state$.scope((draft) => draft);
      expect(result).toBe(123);
    });

    it('mutates an array', () => {
      const state$ = Reactive.from([] as number[]);
      state$.scope((draft) => {
        draft.push(0);
        draft.push(1);
        draft.push(2);
        draft.splice(1, 1);
      });
      expect(state$.value).toStrictEqual([0, 2]);
    });

    it('adds a dynamic property', () => {
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

    it('deletes a property', () => {
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

    it('resets a deleted property', () => {
      const state$ = Reactive.from({ a: 0 } as Record<string, number>);
      state$.scope((draft) => {
        delete draft['a'];
        draft['a'] = 1;
      });
      expect(state$.value).toStrictEqual({ a: 1 });
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
        type: 'delete',
        source: expect.any(Signal),
        path: ['a'],
      });
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

    it('throws when trying to set a read-only property', () => {
      const state$ = Reactive.from({
        count: 0,
        get doubledCount() {
          return this.count * 2;
        },
      });
      expect(() =>
        state$.scope((draft) => {
          (draft as any).doubledCount = 10;
        }),
      ).toThrow(
        'Cannot set property value of #<Computed> which has only a getter',
      );
    });

    it('throws when trying to set a frozen property', () => {
      const state$ = Reactive.from(Object.freeze({ count: 0 }));
      expect(() =>
        state$.scope((draft: any) => {
          draft.count++;
        }),
      ).toThrow("'set' on proxy: trap returned falsish for property 'count'");
    });

    it('throws when trying to delete a frozen property', () => {
      const state$ = Reactive.from(Object.freeze({ count: 0 }));
      expect(() =>
        state$.scope((draft: any) => {
          delete draft.count;
        }),
      ).toThrow(
        "'deleteProperty' on proxy: trap returned falsish for property 'count'",
      );
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
        type: 'set',
        source: expect.any(Signal),
        path: [],
        oldValue: { count: 0 },
        newValue: { count: 1 },
      });
    });

    it('notifies on nested property change', () => {
      const state$ = Reactive.from({ nested: { value: 1 } });
      const subscriber = vi.fn();
      state$.subscribe(subscriber);
      state$.get('nested').subscribe(subscriber);
      state$.get('nested').get('value').subscribe(subscriber);
      state$.get('nested').get('value').value = 2;

      expect(subscriber).toHaveBeenCalledTimes(3);
      expect(subscriber).toHaveBeenNthCalledWith(1, {
        type: 'set',
        source: expect.any(Signal),
        path: [],
        oldValue: 1,
        newValue: 2,
      });
      expect(subscriber).toHaveBeenNthCalledWith(2, {
        type: 'set',
        source: expect.any(Signal),
        path: ['value'],
        oldValue: 1,
        newValue: 2,
      });
      expect(subscriber).toHaveBeenNthCalledWith(3, {
        type: 'set',
        source: expect.any(Signal),
        path: ['nested', 'value'],
        oldValue: 1,
        newValue: 2,
      });
    });

    it('notifies when nested property is deleted', () => {
      const state$ = Reactive.from({
        nested: { a: 1, b: 2 } as Record<string, number>,
      });
      const subscriber = vi.fn();
      state$.subscribe(subscriber);
      state$.get('nested').subscribe(subscriber);
      state$.get('nested').scope((nested) => {
        delete nested['a'];
      });

      expect(subscriber).toHaveBeenCalledTimes(2);
      expect(subscriber).toHaveBeenNthCalledWith(1, {
        type: 'delete',
        source: expect.any(Signal),
        path: ['a'],
      });
      expect(subscriber).toHaveBeenNthCalledWith(2, {
        type: 'delete',
        source: expect.any(Signal),
        path: ['nested', 'a'],
      });
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

import { describe, expect, it, vi } from 'vitest';
import { Derivable } from '@/addons/signal/derivable.js';
import { Signal, unwrap } from '@/addons/signal.js';

describe('Derivable', () => {
  describe('static from()', () => {
    it('creates a Derivable from a plain object', () => {
      const state$ = Derivable.from({ count: 0 });
      expect(state$.value).toStrictEqual({ count: 0 });
      expect(state$.version).toBe(0);
    });

    it('creates a Derivable from a class instance', () => {
      class State {
        count = 0;
      }
      const state$ = Derivable.from(new State());
      expect(state$.value).toBeInstanceOf(State);
      expect(state$.value.count).toBe(0);
    });
  });

  describe('get value()', () => {
    it('returns the initial state at first', () => {
      const intialState = {};
      const state$ = Derivable.from(intialState);
      expect(state$.value).toBe(intialState);
    });

    it('returns the same reference if no changes were made', () => {
      const state$ = Derivable.from({ count: 0 });
      expect(state$.value).toBe(state$.value);
    });

    it('reflects pending property changes after reading', () => {
      const state$ = Derivable.from({ count: 0 });
      const count$ = state$.get('count');
      count$.value = 5;
      expect(state$.value).toStrictEqual({ count: 5 });
    });
  });

  describe('set value()', () => {
    it('replaces the entire value', () => {
      const state$ = Derivable.from({ count: 0 });
      const nextState = { count: 10 };
      state$.value = nextState;
      expect(state$.value).toBe(nextState);
    });

    it('increments version', () => {
      const state$ = Derivable.from({ count: 0 });
      expect(state$.version).toBe(0);
      state$.value = { count: 1 };
      expect(state$.version).toBe(1);
    });

    it('notifies subscribers', () => {
      const state$ = Derivable.from({ count: 0 });
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
      const state$ = Derivable.from({});
      expect(state$.version).toBe(0);
    });

    it('increments on root value assignment', () => {
      const state$ = Derivable.from({ count: 0 });
      state$.value = { count: 1 };
      expect(state$.version).toBe(1);
      state$.value = { count: 2 };
      expect(state$.version).toBe(2);
    });

    it('increments on nested property assignment', () => {
      const state$ = Derivable.from({ count: 0 });
      state$.get('count').value = 5;
      expect(state$.version).toBe(1);
    });

    it('increments once per scope batch', () => {
      const state$ = Derivable.from({ a: 1, b: 2 });
      state$.scope((state) => {
        state.a++;
        state.b++;
      });
      expect(state$.version).toBe(2);
    });
  });

  describe('get()', () => {
    it('returns a derivable for a nested property', () => {
      const state$ = Derivable.from({ count: 0 });
      const count$ = state$.get('count');
      expect(count$).toBeInstanceOf(Derivable);
      expect(count$.value).toBe(0);
    });

    it('returns a derivable for an array index', () => {
      const state$ = Derivable.from([10, 20, 30]);
      const item$ = state$.get(0);
      expect(item$.value).toBe(10);
      item$.value = 99;
      expect(state$.value).toStrictEqual([99, 20, 30]);
    });

    it('returns undefined for a primitive value', () => {
      const state$ = Derivable.from(123);
      expect(state$.get('toString')).toBe(undefined);
    });

    it('returns undefined for a missing key', () => {
      const state$ = Derivable.from({});
      expect(state$.get('foo').value).toBe(undefined);
    });

    it('returns a read-only derivable for a read-only accessor', () => {
      const State = {
        count: 0,
        get doubledCount(): number {
          return this.count * 2;
        },
      };
      const state$ = Derivable.from(State);
      const count$ = state$.get('count');
      const doubledCount$ = state$.get('doubledCount');
      count$.value++;
      expect(state$.value).toStrictEqual({ count: 1, doubledCount: 2 });
      expect(doubledCount$.value).toBe(2);
    });

    it('returns a nested derivable for a read-only accessor returning an object', () => {
      const state = {
        counter: { count: 0 },
        get doubledCounter(): { count: number } {
          return { count: this.counter.count * 2 };
        },
      };
      const state$ = Derivable.from(state);
      const count$ = state$.get('counter').get('count');
      const doubledCounter$ = state$.get('doubledCounter');
      const doubledCount$ = doubledCounter$.get('count');
      count$.value++;
      expect(state$.value).toStrictEqual({
        counter: { count: 1 },
        doubledCounter: { count: 2 },
      });
      expect(doubledCounter$.value).toStrictEqual({ count: 2 });
      expect(doubledCount$.value).toBe(0);
    });

    it('returns the same derivable reference for a getter returning the same property', () => {
      const state = {
        foo: { value: 0 },
        get bar(): { value: number } {
          return this.foo;
        },
      };
      const state$ = Derivable.from(state);
      const foo$ = state$.get('foo');
      const bar$ = state$.get('bar');
      expect(foo$.value).toStrictEqual({ value: 0 });
      expect(bar$.value).toBe(foo$.value);
    });

    it('reflects property mutations through both a property and a getter returning the same reference', () => {
      const state = {
        foo: { value: 0 },
        get bar(): { value: number } {
          return this.foo;
        },
      };
      const state$ = Derivable.from(state);
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
      const state$ = Derivable.from(state);
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
      const state$ = Derivable.from(state);
      const privateCounter$ = state$.get('_counter');
      const counter$ = state$.get('counter');
      counter$.value = { count: 1 };
      expect(counter$.value).toStrictEqual(privateCounter$.value);
    });

    it('returns a writable derivable for a read-write accessor', () => {
      const state = {
        _count: 0,
        get count(): number {
          return this._count;
        },
        set count(count: number) {
          this._count = count;
        },
      };
      const state$ = Derivable.from(state);
      const count$ = state$.get('count');
      count$.value = 5;
      expect(state$.value.count).toBe(5);
    });

    it('returns a writable derivable for a writable property', () => {
      const state$ = Derivable.from({ count: 0 });
      const count$ = state$.get('count');
      count$.value = 10;
      expect(count$.value).toBe(10);
      expect(state$.value).toStrictEqual({ count: 10 });
    });

    it('notifies when property changes', () => {
      const state$ = Derivable.from({ items: [{ id: 1 }] });
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

    it('ignores stale property mutations after property reassignment', () => {
      const state$ = Derivable.from({ nested: { value: 0 } });
      const nested$ = state$.get('nested');
      const value$ = nested$.get('value');
      nested$.value = { value: 1 };
      value$.value = 2;
      expect(state$.value).toStrictEqual({ nested: { value: 1 } });
    });

    it('ignores stale property mutations after property set to null', () => {
      const state$ = Derivable.from({ nested: { value: 0 } } as {
        nested: { value: number } | null;
      });
      const nested$ = state$.get('nested');
      const value$ = nested$.get('value');
      nested$.value = { value: 1 };
      value$!.value = 2;
      expect(state$.value).toStrictEqual({ nested: { value: 1 } });
    });

    it('re-evaluates a computed derivable when a dependency changes', () => {
      const state$ = Derivable.from({
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
      const state$ = Derivable.from(new State());
      const id$ = state$.get('id');
      expect(() => {
        (id$ as any).value = 2;
      }).toThrow('Cannot set property value');
    });
  });

  describe('delete()', () => {
    it('increments version', () => {
      const state$ = Derivable.from({ a: 0, b: 1 } as Record<string, number>);
      state$.get('a').delete();
      expect(state$.version).toBe(1);
    });

    it('deletes a property of the owner', () => {
      const state$ = Derivable.from({ a: 0, b: 1 } as Record<string, number>);
      state$.get('a').delete();
      expect(state$.value).toStrictEqual({ b: 1 });
    });

    it('does nothing when the root owner is deleted', () => {
      const state$ = Derivable.from({ a: 0, b: 1 } as Record<string, number>);
      state$.delete();
      expect(state$.value).toStrictEqual({ a: 0, b: 1 });
    });
  });

  describe('scope()', () => {
    it('increments version on mutation', () => {
      const state$ = Derivable.from({ count: 0 });
      state$.scope((state) => {
        state.count++;
      });
      expect(state$.version).toBe(1);
    });

    it('increments version on deletion', () => {
      const state$ = Derivable.from({ a: 0, b: 1 } as Record<string, number>);
      state$.scope((state) => {
        delete state['a'];
      });
      expect(state$.version).toBe(1);
    });

    it('returns object keys via proxy', () => {
      const state$ = Derivable.from({ a: 0, b: 1 });
      const keys = state$.scope((state) => Object.keys(state));
      expect(keys).toStrictEqual(['a', 'b']);
    });

    it('returns numeric keys via proxy', () => {
      const state$ = Derivable.from([] as number[]);
      state$.get(0).value = 0;
      state$.get(1).value = 2;
      const keys = state$.scope((state) => Object.keys(state));
      expect(keys).toStrictEqual(['0', '1']);
    });

    it('returns the same object via unwrap', () => {
      const state$ = Derivable.from({ count: 0 });
      const state = state$.scope((state) => unwrap(state));
      expect(state).toBe(state$.value);
    });

    it('returns a modified object via unwrap', () => {
      const state$ = Derivable.from({ count: 0 });
      const state = state$.scope((state) => {
        state.count++;
        return unwrap(state);
      });
      expect(state).toStrictEqual({ count: 1 });
    });

    it('returns the same value for primitives', () => {
      const state$ = Derivable.from(123);
      const state = state$.scope((state) => state);
      expect(state).toBe(123);
    });

    it('returns the same value for primitives via unwrap', () => {
      const state$ = Derivable.from(123);
      const state = state$.scope((state) => unwrap(state));
      expect(state).toBe(123);
    });

    it.for([
      null,
      undefined,
    ])('returns %s for primitives via unwrap', (value) => {
      const state$ = Derivable.from(value);
      const state = state$.scope((state) => unwrap(state));
      expect(state).toBe(value);
    });

    it('returns a computed value via getter', () => {
      const state$ = Derivable.from({
        count: 0,
        get doubledCount() {
          return this.count * 2;
        },
      });
      const doubledCount = state$.scope((state) => {
        state.count++;
        return state.doubledCount;
      });
      expect(doubledCount).toStrictEqual(2);
    });

    it('returns a computed value via getter returning object', () => {
      const state$ = Derivable.from({
        counter: { count: 0 },
        get doubledCounter() {
          return { count: this.counter.count * 2 };
        },
      });
      const doubledCount = state$.scope((state) => {
        state.counter.count++;
        return state.doubledCounter.count;
      });
      expect(doubledCount).toStrictEqual(2);
    });

    it('mutates an array', () => {
      const state$ = Derivable.from([] as number[]);
      state$.scope((state) => {
        state.push(0);
        state.push(1);
        state.push(2);
        state.splice(1, 1);
      });
      expect(state$.value).toStrictEqual([0, 2]);
    });

    it('adds a dynamic property', () => {
      const state$ = Derivable.from({} as Record<string, number>);
      state$.scope((state) => {
        state['a'] = 0;
        state['b'] = 1;
        expect(state['a']).toBe(0);
        expect(state['b']).toBe(1);
        expect('a' in state).toBe(true);
        expect('b' in state).toBe(true);
        expect(Object.hasOwn(state, 'a')).toBe(true);
        expect(Object.hasOwn(state, 'b')).toBe(true);
        expect(Object.keys(state)).toStrictEqual(['a', 'b']);
      });
      expect(state$.value).toStrictEqual({ a: 0, b: 1 });
    });

    it('deletes a property', () => {
      const state$ = Derivable.from({ a: 0, b: 1 } as Record<string, number>);
      state$.scope((state) => {
        delete state['a'];
        expect(state['a']).toBe(undefined);
        expect(state['b']).toBe(1);
        expect('a' in state).toBe(false);
        expect('b' in state).toBe(true);
        expect(Object.hasOwn(state, 'a')).toBe(false);
        expect(Object.hasOwn(state, 'b')).toBe(true);
        expect(Object.keys(state)).toStrictEqual(['b']);
      });
      expect(state$.value).toStrictEqual({ b: 1 });
    });

    it('resets a deleted property', () => {
      const state$ = Derivable.from({ a: 0 } as Record<string, number>);
      state$.scope((state) => {
        delete state['a'];
        state['a'] = 1;
      });
      expect(state$.value).toStrictEqual({ a: 1 });
    });

    it('notifies when a property is deleted', () => {
      const state$ = Derivable.from({ a: 0, b: 1 } as Record<string, number>);
      const subscriber = vi.fn();
      state$.subscribe(subscriber);
      state$.scope((state) => {
        delete state['a'];
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
      const state$ = Derivable.from(new Counter());
      state$.scope((state) => {
        state.increment();
      });
      expect(state$.value.count).toBe(1);
    });

    it('throws when trying to set a read-only property', () => {
      const state$ = Derivable.from({
        count: 0,
        get doubledCount() {
          return this.count * 2;
        },
      });
      expect(() =>
        state$.scope((state) => {
          (state as any).doubledCount = 11;
        }),
      ).toThrow(
        "'set' on proxy: trap returned falsish for property 'doubledCount'",
      );
    });

    it('throws when trying to set a frozen property', () => {
      const state$ = Derivable.from(Object.freeze({ count: 0 }));
      expect(() =>
        state$.scope((state: any) => {
          state.count++;
        }),
      ).toThrow("'set' on proxy: trap returned falsish for property 'count'");
    });

    it('throws when trying to delete a frozen property', () => {
      const state$ = Derivable.from(Object.freeze({ count: 0 }));
      expect(() =>
        state$.scope((state: any) => {
          delete state.count;
        }),
      ).toThrow(
        "'deleteProperty' on proxy: trap returned falsish for property 'count'",
      );
    });

    it('revokes the proxy after call', () => {
      const state$ = Derivable.from({});
      const state = state$.scope((state) => state);
      expect(() => state.toString()).toThrow(
        "Cannot perform 'get' on a proxy that has been revoked",
      );
    });

    it('revokes the nested proxy after call', () => {
      const state$ = Derivable.from({ nested: {} });
      const nested = state$.scope((state) => state.nested);
      expect(() => nested.toString()).toThrow(
        "Cannot perform 'get' on a proxy that has been revoked",
      );
    });
  });

  describe('subscribe()', () => {
    it('notifies on root value change', () => {
      const state$ = Derivable.from({ count: 0 });
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
      const state$ = Derivable.from({ nested: { value: 1 } });
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
      const state$ = Derivable.from({
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
      const state$ = Derivable.from({ count: 0 });
      const subscriber = vi.fn();
      const unsubscribe = state$.subscribe(subscriber);
      unsubscribe();
      state$.value = { count: 1 };

      expect(subscriber).not.toHaveBeenCalled();
    });
  });
});

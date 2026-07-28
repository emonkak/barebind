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

    it('increments on property assignment', () => {
      const state$ = Derivable.from({ count: 0 });
      state$.get('count').value = 5;
      expect(state$.version).toBe(1);
    });

    it('increments on property assignment in scope', () => {
      const state$ = Derivable.from({ count: 0 });
      state$.scope((state) => {
        state.count++;
      });
      expect(state$.version).toBe(1);
    });

    it('increments on property deletion', () => {
      const state$ = Derivable.from({ a: 0, b: 1 } as Record<string, number>);
      state$.get('a').delete();
      expect(state$.version).toBe(1);
    });

    it('increments on property deletion in scope', () => {
      const state$ = Derivable.from({ a: 0, b: 1 } as Record<string, number>);
      state$.scope((state) => {
        delete state['a'];
      });
      expect(state$.version).toBe(1);
    });
  });

  describe('get()', () => {
    it('returns a Derivable for a writable property', () => {
      const state$ = Derivable.from({ value: 123 });
      const value$ = state$.get('value');
      expect(value$.value).toBe(123);
    });

    it('returns a Derivable for a read-only accessor', () => {
      const State = {
        get value() {
          return 123;
        },
      };
      const state$ = Derivable.from(State);
      const value$ = state$.get('value');
      expect(value$.value).toBe(123);
    });

    it('returns a Derivable for a read-only accessor returning a reference to other property', () => {
      const state = {
        internalCounter: { count: 0 },
        get counter(): { count: number } {
          return this.internalCounter;
        },
      };
      const state$ = Derivable.from(state);
      const internalCounter$ = state$.get('internalCounter');
      const counter$ = state$.get('counter');
      expect(counter$.value).toStrictEqual(internalCounter$.value);
    });

    it('returns a Derivable for a read-write accessor', () => {
      const state = {
        internalValue: 123,
        get value(): number {
          return this.internalValue;
        },
        set value(value: number) {
          this.internalValue = value;
        },
      };
      const state$ = Derivable.from(state);
      const value$ = state$.get('value');
      expect(value$.value).toBe(123);
    });

    it('returns a Derivable for a read-write accessor returning a reference to other property', () => {
      const state = {
        internalCounter: { count: 0 },
        get counter(): { count: number } {
          return this.internalCounter;
        },
        set counter(counter: { count: number }) {
          this.internalCounter = counter;
        },
      };
      const state$ = Derivable.from(state);
      const internalCounter$ = state$.get('internalCounter');
      const counter$ = state$.get('counter');
      expect(counter$.value).toBe(internalCounter$.value);
    });

    it('returns a Derivable for an array index', () => {
      const state$ = Derivable.from([1, 2, 3]);
      const item$ = state$.get(0);
      expect(item$.value).toBe(1);
    });

    it('returns the same Derivable instance for the same property', () => {
      const state$ = Derivable.from({ count: 0 });
      const count$ = state$.get('count');
      expect(state$.get('count')).toBe(count$);
    });

    it('returns undefined for primitives', () => {
      const state$ = Derivable.from(123);
      expect(state$.get('toString')).toBe(undefined);
    });

    it('returns undefined for missing keys', () => {
      const state$ = Derivable.from({});
      expect(state$.get('foo').value).toBe(undefined);
    });

    it('reflects mutations for a writable property', () => {
      const state$ = Derivable.from({ count: 0 });
      const count$ = state$.get('count');
      count$.value = 10;
      expect(state$.value).toStrictEqual({ count: 10 });
      expect(count$.value).toBe(10);
    });

    it('reflects mutations for a read-only accessor', () => {
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

    it('reflects mutations for a read-only accessor returning an object', () => {
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

    it('reflects mutations for a read-write accessor', () => {
      const state = {
        internalCount: 0,
        get count(): number {
          return this.internalCount;
        },
        set count(count: number) {
          this.internalCount = count;
        },
      };
      const state$ = Derivable.from(state);
      const count$ = state$.get('count');
      count$.value++;
      expect(state$.value).toStrictEqual({ internalCount: 1, count: 1 });
      expect(count$.value).toBe(1);
    });

    it('reflects mutations for a read-write accessor returning an object', () => {
      const state = {
        internalCounter: { count: 0 },
        get counter(): { count: number } {
          return this.internalCounter;
        },
        set counter(counter: { count: number }) {
          this.internalCounter = counter;
        },
      };
      const state$ = Derivable.from(state);
      const internalCounter$ = state$.get('internalCounter');
      const counter$ = state$.get('counter');
      internalCounter$.value = { count: 1 };
      expect(state$.value).toStrictEqual({
        internalCounter: { count: 1 },
        counter: { count: 1 },
      });
      expect(internalCounter$.value).toStrictEqual({ count: 1 });
      expect(counter$.value).toStrictEqual({ count: 1 });
    });

    it('reflects mutations for an array', () => {
      const state$ = Derivable.from([1, 2, 3]);
      state$.get(0).value = 10;
      expect(state$.value).toStrictEqual([10, 2, 3]);
    });

    it('reflects mutations to read-only property it depends on', () => {
      const state = {
        internalCounter: { count: 0 },
        get counter(): { count: number } {
          return this.internalCounter;
        },
      };
      const state$ = Derivable.from(state);
      const internalCounter$ = state$.get('internalCounter');
      const counter$ = state$.get('counter');
      const count$ = internalCounter$.get('count');
      count$.value++;
      expect(internalCounter$.value).toStrictEqual({ count: 1 });
      expect(counter$.value).toBe(internalCounter$.value);
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

    it('ignores stale property mutations after property reassignment', () => {
      const state$ = Derivable.from({ nested: { value: 0 } });
      const nested$ = state$.get('nested');
      const value$ = nested$.get('value');
      nested$.value = { value: 1 };
      value$.value = 2;
      expect(state$.value).toStrictEqual({ nested: { value: 1 } });
    });

    it('ignores stale property mutations after owner is set to null', () => {
      const state$ = Derivable.from({ nested: { value: 0 } } as {
        nested: { value: number } | null;
      });
      const nested$ = state$.get('nested');
      const value$ = nested$.get('value');
      nested$.value = null;
      value$!.value = 2;
      expect(state$.value).toStrictEqual({ nested: null });
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

    it('notifies when a property is deleted', () => {
      const state$ = Derivable.from({ a: 0, b: 1 } as Record<string, number>);
      const subscriber = vi.fn();
      state$.subscribe(subscriber);
      state$.get('a').delete();
      expect(subscriber).toHaveBeenCalledOnce();
      expect(subscriber).toHaveBeenCalledWith({
        type: 'delete',
        source: expect.any(Signal),
        path: ['a'],
      });
    });
  });

  describe('scope()', () => {
    it('returns the same primitive value of the state', () => {
      const state$ = Derivable.from(123);
      const state = state$.scope((state) => state);
      expect(state).toBe(123);
    });

    it('returns the same primitive value for properties', () => {
      const state$ = Derivable.from({ value: 123 });
      const state = state$.scope((state) => state.value);
      expect(state).toBe(123);
    });

    it('returns a new primitive value when changed', () => {
      const state$ = Derivable.from({ count: 0 });
      const count = state$.scope((state) => ++state.count);
      expect(count).toBe(1);
    });

    it('returns the same object reference of the state', () => {
      const state$ = Derivable.from({ value: 123 });
      const state = state$.scope((state) => unwrap(state));
      expect(state).toBe(state$.value);
    });

    it('returns the same object reference for properties', () => {
      const state$ = Derivable.from({ nested: { value: 123 } });
      const state = state$.scope((state) => unwrap(state.nested));
      expect(state).toBe(state$.value.nested);
    });

    it('returns a new object when the object is modified', () => {
      const initialState = { count: 0 };
      const state$ = Derivable.from(initialState);
      const state = state$.scope((state) => {
        state.count++;
        return unwrap(state);
      });
      expect(state).not.toBe(initialState);
      expect(state).toStrictEqual({ count: 1 });
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

    it('returns object keys via proxy', () => {
      const state$ = Derivable.from({ a: 0, b: 1 });
      const keys = state$.scope((state) => Object.keys(state));
      expect(keys).toStrictEqual(['a', 'b']);
    });

    it('returns array keys via proxy', () => {
      const state$ = Derivable.from([] as number[]);
      state$.get(0).value = 0;
      state$.get(1).value = 2;
      const keys = state$.scope((state) => Object.keys(state));
      expect(keys).toStrictEqual(['0', '1']);
    });

    it('mutates an class instance via methods', () => {
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

    it('filters an array', () => {
      const state$ = Derivable.from({ items: [0, 1, 2, 3] });
      state$.scope((state) => {
        state.items = state.items.filter((n) => n % 2 === 0);
      });
      expect(state$.value).toStrictEqual({ items: [0, 2] });
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

    it('revokes the proxy after call', () => {
      const state$ = Derivable.from({});
      const state = state$.scope((state) => state);
      expect(() => Object.getPrototypeOf(state)).toThrow(
        "Cannot perform 'getPrototypeOf' on a proxy that has been revoked",
      );
    });

    it('revokes the nested proxy after call', () => {
      const state$ = Derivable.from({ nested: {} });
      const nested = state$.scope((state) => state.nested);
      expect(() => Object.getPrototypeOf(nested)).toThrow(
        "Cannot perform 'getPrototypeOf' on a proxy that has been revoked",
      );
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

    it('notifies on property change', () => {
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

describe('unwrap()', () => {
  it('returns the same value for primitives', () => {
    expect(unwrap(123)).toBe(123);
  });

  it('returns the same value for non-proxy objects', () => {
    const value = {};
    expect(unwrap(value)).toBe(value);
  });

  it.for([null, undefined])('returns the same value for %s', (value) => {
    expect(unwrap(value)).toBe(value);
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  Atom,
  Computed,
  type InvalidateEvent,
  type Signal,
} from '@/addons/signal/signal.js';

describe('Atom', () => {
  describe('set value()', () => {
    it('increments the version on update', () => {
      const atom = new Atom('a');

      expect(atom.value).toBe('a');
      expect(atom.version).toBe(0);

      atom.value = 'b';

      expect(atom.value).toBe('b');
      expect(atom.version).toBe(1);
    });
  });

  describe('invalidate()', () => {
    it('increments the version and notifies subscribers', () => {
      const atom = new Atom('a');
      const event: InvalidateEvent = {
        type: 'set',
        source: atom as Signal<unknown>,
        path: [],
        oldValue: 'b',
        newValue: 'a',
      };
      const subscriber = vi.fn();

      atom.subscribe(subscriber);
      atom.invalidate(event);

      expect(subscriber).toHaveBeenCalledOnce();
      expect(subscriber).toHaveBeenCalledWith(event);
      expect(atom.value).toBe('a');
      expect(atom.version).toBe(1);
    });
  });

  describe('map()', () => {
    it('creates a computed signal with the selector', () => {
      const atom = new Atom(10);
      const computed = atom.map((count) => count * 2);

      expect(computed).toBeInstanceOf(Computed);
      expect(computed.value).toBe(20);
      expect(computed['_dependencies']).toStrictEqual([atom]);
    });
  });

  describe('write()', () => {
    it('writes the value without events', () => {
      const atom = new Atom('a');
      const subscriber = vi.fn();

      atom.subscribe(subscriber);

      expect(atom.value).toBe('a');
      expect(atom.version).toBe(0);

      atom.write('b');

      expect(subscriber).not.toHaveBeenCalled();
      expect(atom.value).toBe('b');
      expect(atom.version).toBe(0);
    });
  });

  describe('subscribe()', () => {
    it('invokes the subscriber on update', () => {
      const atom = new Atom('a');
      const subscriber = vi.fn();

      atom.subscribe(subscriber);
      expect(subscriber).toHaveBeenCalledTimes(0);

      atom.value = 'b';
      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber).toHaveBeenLastCalledWith({
        type: 'set',
        source: atom,
        path: [],
        oldValue: 'a',
        newValue: 'b',
      });
    });

    it('does not invoke invalidated subscribers', () => {
      const atom = new Atom('a');
      const subscriber = vi.fn();

      atom.subscribe(subscriber)();
      expect(subscriber).not.toHaveBeenCalled();

      atom.value = 'b';
      expect(subscriber).not.toHaveBeenCalled();
    });
  });
});

describe('Computed', () => {
  describe('value', () => {
    it('computes a memoized value by dependent signals', () => {
      const first = new Atom(1);
      const second = new Atom(2);
      const computed = new Computed(
        (first, second) => ({
          first,
          second,
        }),
        [first, second],
      );

      expect(computed.value).toStrictEqual({ first: 1, second: 2 });
      expect(computed.value).toBe(computed.value);
      expect(computed.version).toBe(0);
    });
  });

  describe('version', () => {
    it('increments the version when the dependent signal changes', () => {
      const first = new Atom(1);
      const second = new Atom(2);
      const computed = new Computed(
        (first, second) => ({
          first,
          second,
        }),
        [first, second],
      );

      first.value++;
      expect(computed.value).toStrictEqual({ first: 2, second: 2 });
      expect(computed.version).toBe(1);

      second.value++;
      expect(computed.value).toStrictEqual({ first: 2, second: 3 });
      expect(computed.version).toBe(2);
    });
  });

  describe('subscribe()', () => {
    it('invokes the subscriber when any dependent signals have been updated', () => {
      const first = new Atom(1);
      const second = new Atom(2);
      const computed = new Computed(
        (first, second) => ({ first, second }),
        [first, second],
      );
      const subscriber = vi.fn();

      computed.subscribe(subscriber);

      first.value++;
      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber).toHaveBeenLastCalledWith({
        type: 'set',
        source: first,
        path: [],
        oldValue: 1,
        newValue: 2,
      });

      second.value++;
      expect(subscriber).toHaveBeenCalledTimes(2);
      expect(subscriber).toHaveBeenLastCalledWith({
        type: 'set',
        source: second,
        path: [],
        oldValue: 2,
        newValue: 3,
      });
    });

    it('does not invoke the invalidated subscriber', () => {
      const first = new Atom(1);
      const second = new Atom(2);
      const signal = new Computed(
        (first, second) => ({
          first,
          second,
        }),
        [first, second],
      );
      const subscriber = vi.fn();

      signal.subscribe(subscriber)();
      first.value++;
      second.value++;

      expect(subscriber).not.toHaveBeenCalled();
    });
  });
});

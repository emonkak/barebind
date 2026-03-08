import { describe, expect, it, vi } from 'vitest';

import { LRUMap } from '@/collections/lru-map.js';

describe('LRUMap', () => {
  describe('constructor()', () => {
    it('starts empty', () => {
      const map = new LRUMap<string, number>(3);
      expect(map.capacity).toBe(3);
      expect(map.size).toBe(0);
    });

    it('reflects the initial capacity passed to the constructor', () => {
      const map = new LRUMap<string, number>(5);
      expect(map.capacity).toBe(5);
    });
  });

  describe('[Symbol.iterator]()', () => {
    it('yields pairs in MRU order', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.get('a');
      expect(Array.from(map)).toStrictEqual([
        ['a', 1],
        ['c', 3],
        ['b', 2],
      ]);
    });
  });

  describe('clear()', () => {
    it('empties the map', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      map.set('b', 2);
      map.clear();
      expect(map.size).toBe(0);
    });

    it('allows new entries to be added after clearing', () => {
      const map = new LRUMap<string, number>(2);
      map.set('a', 1);
      map.set('b', 2);
      map.clear();
      map.set('c', 3);
      expect(map.size).toBe(1);
      expect(map.get('c')).toBe(3);
    });
  });

  describe('delete()', () => {
    it('returns the value of the deleted key', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 10);
      expect(map.delete('a')).toBe(10);
    });

    it('returns undefined when deleting a non-existent key', () => {
      const map = new LRUMap<string, number>(3);
      expect(map.delete('nonexistent')).toBeUndefined();
    });

    it('decreases size after deletion', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      map.set('b', 2);
      map.delete('a');
      expect(map.size).toBe(1);
    });

    it('does not affect size when deleting a non-existent key', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      map.delete('missing');
      expect(map.size).toBe(1);
    });
  });

  describe('entries()', () => {
    it('yields pairs in MRU order', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.get('a');
      expect(map.entries().toArray()).toStrictEqual([
        ['a', 1],
        ['c', 3],
        ['b', 2],
      ]);
    });
  });

  describe('get()', () => {
    it('returns the value for a known key', () => {
      const map = new LRUMap<string, number>(3);
      map.set('x', 10);
      expect(map.get('x')).toBe(10);
    });

    it('returns undefined for an unknown key', () => {
      const map = new LRUMap<string, number>(3);
      expect(map.get('missing')).toBeUndefined();
    });

    it('promotes the accessed entry to most recently used', () => {
      const map = new LRUMap<string, number>(2);
      map.set('a', 1);
      map.set('b', 2);
      map.get('a'); // "a" is now the most recently used; "b" is LRU
      map.set('c', 3); // "b" should be evicted, not "a"
      expect(map.has('a')).toBe(true);
      expect(map.has('b')).toBe(false);
      expect(map.has('c')).toBe(true);
    });
  });

  describe('getOrInsert()', () => {
    it('returns the default value and inserts it when the key does not exist', () => {
      const map = new LRUMap<string, number>(3);
      const result = map.getOrInsert('a', 42);
      expect(result).toBe(42);
      expect(map.get('a')).toBe(42);
    });

    it('returns the existing value without overwriting when the key already exists', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      const result = map.getOrInsert('a', 99);
      expect(result).toBe(1);
      expect(map.get('a')).toBe(1);
    });

    it('increases size when the key is new', () => {
      const map = new LRUMap<string, number>(3);
      map.getOrInsert('a', 1);
      expect(map.size).toBe(1);
    });

    it('does not increase size when the key already exists', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      map.getOrInsert('a', 99);
      expect(map.size).toBe(1);
    });

    it('promotes the key to most recently used on a hit', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(2, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.getOrInsert('a', 99); // "a" becomes MRU; "b" becomes LRU
      map.set('c', 3); // "b" should be evicted, not "a"
      expect(map.has('a')).toBe(true);
      expect(map.has('b')).toBe(false);
      expect(map.has('c')).toBe(true);
      expect(evictListener).toHaveBeenCalledTimes(1);
      expect(evictListener).toHaveBeenNthCalledWith(1, { key: 'b', value: 2 });
    });

    it('promotes the newly inserted key to most recently used on a miss', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(2, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      // Access "a" to make "b" the LRU
      map.get('a');
      // Insert "c" via getOrInsert; "b" should be evicted
      map.getOrInsert('c', 3);
      expect(map.has('a')).toBe(true);
      expect(map.has('b')).toBe(false);
      expect(map.has('c')).toBe(true);
      expect(evictListener).toHaveBeenCalledTimes(1);
      expect(evictListener).toHaveBeenNthCalledWith(1, { key: 'b', value: 2 });
    });

    it('evicts the LRU entry when capacity is exceeded on insert', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(2, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.getOrInsert('c', 3); // "a" is LRU and should be evicted
      expect(map.has('a')).toBe(false);
      expect(map.has('b')).toBe(true);
      expect(map.has('c')).toBe(true);
      expect(evictListener).toHaveBeenCalledTimes(1);
      expect(evictListener).toHaveBeenNthCalledWith(1, { key: 'a', value: 1 });
    });

    it('does not evict when the key already exists', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(2, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.getOrInsert('a', 99); // "a" already exists; it should not be evicted
      expect(map.has('a')).toBe(true);
      expect(map.has('b')).toBe(true);
      expect(map.size).toBe(2);
      expect(evictListener).not.toHaveBeenCalled();
    });
  });

  describe('getOrInsertComputed()', () => {
    it('calls the callback and inserts the computed value when the key does not exist', () => {
      const map = new LRUMap<string, number>(3);
      const callback = vi.fn((key: string) => key.length);
      const result = map.getOrInsertComputed('hello', callback);
      expect(result).toBe(5);
      expect(map.get('hello')).toBe(5);
      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith('hello');
    });

    it('does not call the callback and returns the existing value on a hit', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      const callback = vi.fn((key: string) => key.length);
      const result = map.getOrInsertComputed('a', callback);
      expect(result).toBe(1);
      expect(callback).not.toHaveBeenCalled();
    });

    it('passes the correct key to the callback', () => {
      const map = new LRUMap<string, string>(3);
      const callback = vi.fn((key: string) => key.toUpperCase());
      map.getOrInsertComputed('foo', callback);
      expect(callback).toHaveBeenCalledWith('foo');
    });

    it('calls the callback exactly once per miss', () => {
      const map = new LRUMap<number, number>(3);
      const callback = vi.fn((key: number) => key * key);
      map.getOrInsertComputed(4, callback);
      map.getOrInsertComputed(4, callback); // callback must NOT be called again
      expect(map.get(4)).toBe(16);
      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('has()', () => {
    it('returns true for a key that exists', () => {
      const map = new LRUMap<string, number>(3);
      map.set('x', 10);
      expect(map.has('x')).toBe(true);
    });

    it('returns false for a key that does not exist', () => {
      const map = new LRUMap<string, number>(3);
      expect(map.has('x')).toBe(false);
    });

    it('returns false after the key has been deleted', () => {
      const map = new LRUMap<string, number>(3);
      map.set('x', 10);
      map.delete('x');
      expect(map.has('x')).toBe(false);
    });
  });

  describe('keys()', () => {
    it('yields keys in MRU order', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.get('a');
      expect(map.keys().toArray()).toStrictEqual(['a', 'c', 'b']);
    });
  });

  describe('resize()', () => {
    it('does not evict any entries when increasing capacity', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(3, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.resize(10);
      expect(map.capacity).toBe(10);
      expect(map.size).toBe(3);
      expect(map.has('a')).toBe(true);
      expect(map.has('b')).toBe(true);
      expect(map.has('c')).toBe(true);
      expect(evictListener).not.toHaveBeenCalled();
    });

    it('allows new entries up to the new larger capacity', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(2, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.resize(4);
      expect(map.capacity).toBe(4);
      map.set('c', 3);
      map.set('d', 4);
      expect(map.size).toBe(4);
      expect(evictListener).not.toHaveBeenCalled();
    });

    it('preserves MRU order after enlarging', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(3, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.get('a');
      map.resize(5);
      expect(map.capacity).toBe(5);
      expect([...map.keys()]).toStrictEqual(['a', 'c', 'b']);
      expect(evictListener).not.toHaveBeenCalled();
    });

    it('evicts the correct number of LRU entries when shrinking', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(4, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.set('d', 4);
      // LRU order: a, b, c, d; "a" and "b" are the least recently used
      map.resize(2);
      expect(map.capacity).toBe(2);
      expect(map.size).toBe(2);
      expect(map.has('c')).toBe(true);
      expect(map.has('d')).toBe(true);
      expect(evictListener).toHaveBeenCalledTimes(2);
      expect(evictListener).toHaveBeenNthCalledWith(1, { key: 'a', value: 1 });
      expect(evictListener).toHaveBeenNthCalledWith(2, { key: 'b', value: 2 });
    });

    it('evicts LRU entries respecting access history', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(4, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.set('d', 4);
      map.get('a'); // LRU order: b, c, d, a
      map.resize(2);
      expect(map.has('b')).toBe(false);
      expect(map.has('c')).toBe(false);
      expect(map.has('d')).toBe(true);
      expect(map.has('a')).toBe(true);
      expect(evictListener).toHaveBeenCalledTimes(2);
      expect(evictListener).toHaveBeenNthCalledWith(1, { key: 'b', value: 2 });
      expect(evictListener).toHaveBeenNthCalledWith(2, { key: 'c', value: 3 });
    });

    it('preserves the MRU order of the surviving entries', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(4, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.set('d', 4);
      map.resize(2);
      expect([...map.keys()]).toStrictEqual(['d', 'c']);
      expect(evictListener).toHaveBeenCalledTimes(2);
      expect(evictListener).toHaveBeenNthCalledWith(1, { key: 'a', value: 1 });
      expect(evictListener).toHaveBeenNthCalledWith(2, { key: 'b', value: 2 });
    });

    it('shrinking to 0 removes all entries', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(3, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.resize(0);
      expect(map.capacity).toBe(0);
      expect(map.size).toBe(0);
      expect(evictListener).toHaveBeenCalledTimes(3);
      expect(evictListener).toHaveBeenNthCalledWith(1, { key: 'a', value: 1 });
      expect(evictListener).toHaveBeenNthCalledWith(2, { key: 'b', value: 2 });
      expect(evictListener).toHaveBeenNthCalledWith(3, { key: 'c', value: 3 });
    });

    it('does nothing when new capacity equals current size', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(3, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.resize(2);
      expect(map.size).toBe(2);
      expect(map.has('a')).toBe(true);
      expect(map.has('b')).toBe(true);
      expect(evictListener).not.toHaveBeenCalled();
    });

    it('does not evict any entries when capacity is unchanged', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(3, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.resize(3);
      expect(map.capacity).toBe(3);
      expect(map.size).toBe(3);
      expect([...map.keys()]).toStrictEqual(['c', 'b', 'a']);
      expect(evictListener).not.toHaveBeenCalled();
    });
  });

  describe('set()', () => {
    it('returns undefined when inserting a new key', () => {
      const map = new LRUMap<string, number>(3);
      expect(map.set('a', 1)).toBeUndefined();
    });

    it('returns the old value when updating an existing key', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      expect(map.set('a', 2)).toBe(1);
    });

    it('increases size when a new key is inserted', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      map.set('b', 2);
      expect(map.size).toBe(2);
    });

    it('does not increase size when an existing key is updated', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      map.set('a', 99);
      expect(map.size).toBe(1);
    });

    it('evicts the least recently used entry when capacity is exceeded', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(2, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3); // "a" should be evicted
      expect(map.has('a')).toBe(false);
      expect(map.has('b')).toBe(true);
      expect(map.has('c')).toBe(true);
      expect(evictListener).toHaveBeenCalledTimes(1);
      expect(evictListener).toHaveBeenNthCalledWith(1, { key: 'a', value: 1 });
    });

    it('does not evict when updating a key that is already present', () => {
      const evictListener = vi.fn();
      const map = new LRUMap<string, number>(2, evictListener);
      map.set('a', 1);
      map.set('b', 2);
      map.set('a', 99); // "a" is updated, not insert; it should not be evicted
      expect(map.has('a')).toBe(true);
      expect(map.has('b')).toBe(true);
      expect(map.size).toBe(2);
      expect(evictListener).not.toHaveBeenCalled();
    });
  });

  describe('values()', () => {
    it('yields values in MRU order', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.get('a');
      expect(map.values().toArray()).toStrictEqual([1, 3, 2]);
    });
  });
});

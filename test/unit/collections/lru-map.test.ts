import { describe, expect, it } from 'vitest';

import { LRUMap } from '@/collections/lru-map.js';

describe('LRUMap', () => {
  describe('constructor()', () => {
    it('starts empty', () => {
      const map = new LRUMap<string, number>(3);
      expect(map.size).toBe(0);
    });
  });

  describe('[Symbol.iterator]()', () => {
    it('yields pairs in most recently used order', () => {
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
    it('yields pairs in most recently used order', () => {
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
    it('yields keys in most recently used order', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.get('a');
      expect(map.keys().toArray()).toStrictEqual(['a', 'c', 'b']);
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
      const map = new LRUMap<string, number>(2);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3); // "a" should be evicted
      expect(map.has('a')).toBe(false);
      expect(map.has('b')).toBe(true);
      expect(map.has('c')).toBe(true);
    });

    it('does not evict when updating a key that is already present', () => {
      const map = new LRUMap<string, number>(2);
      map.set('a', 1);
      map.set('b', 2);
      map.set('a', 99); // "a" is updated, not insert; it should not be evicted
      expect(map.has('a')).toBe(true);
      expect(map.has('b')).toBe(true);
      expect(map.size).toBe(2);
    });
  });

  describe('values()', () => {
    it('yields values in most recently used order', () => {
      const map = new LRUMap<string, number>(3);
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.get('a');
      expect(map.values().toArray()).toStrictEqual([1, 3, 2]);
    });
  });
});

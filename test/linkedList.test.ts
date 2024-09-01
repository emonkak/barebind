import { describe, expect, it } from 'vitest';

import { LinkedList } from '../src/linkedList.js';

describe('LinkedList', () => {
  it('should create an empty list', () => {
    const list = new LinkedList();

    expect(list.isEmpty()).toBe(true);
    expect(list.front()).toBe(null);
    expect(list.back()).toBe(null);
    expect(Array.from(list)).toStrictEqual([]);
  });

  describe('.pushFront()', () => {
    it('should prepend a single value to the list', () => {
      const list = new LinkedList();

      list.pushFront('foo');

      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('foo');
      expect(Array.from(list)).toStrictEqual(['foo']);
    });

    it('should prepend multiple values to the list', () => {
      const list = new LinkedList();

      list.pushFront('foo');
      list.pushFront('bar');
      list.pushFront('baz');

      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('baz');
      expect(list.back()?.value).toBe('foo');
      expect(Array.from(list)).toStrictEqual(['baz', 'bar', 'foo']);
    });
  });

  describe('.pushBack()', () => {
    it('should append a single value to the list', () => {
      const list = new LinkedList();

      list.pushBack('foo');

      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('foo');
      expect(Array.from(list)).toStrictEqual(['foo']);
    });

    it('should append multiple values to the list', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      list.pushBack('bar');
      list.pushBack('baz');

      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['foo', 'bar', 'baz']);
    });
  });

  describe('.popFront()', () => {
    it('should remove nodes from the head', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      list.pushBack('bar');
      list.pushBack('baz');

      const foo = list.popFront();

      expect(foo?.value).toBe('foo');
      expect(foo?.next).toBe(null);
      expect(foo?.prev).toBe(null);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('bar');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['bar', 'baz']);

      const bar = list.popFront();

      expect(bar?.value).toBe('bar');
      expect(bar?.next).toBe(null);
      expect(bar?.prev).toBe(null);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('baz');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['baz']);

      const baz = list.popFront();

      expect(baz?.value).toBe('baz');
      expect(baz?.next).toBe(null);
      expect(baz?.prev).toBe(null);
      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
      expect(Array.from(list)).toStrictEqual([]);
    });

    it('should remove head nodes', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      list.pushBack('bar');
      list.pushBack('baz');

      expect(list.popFront()?.value).toBe('foo');
      expect(list.popFront()?.value).toBe('bar');
      expect(list.popFront()?.value).toBe('baz');

      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
      expect(Array.from(list)).toStrictEqual([]);
    });
  });

  describe('.popBack()', () => {
    it('should remove nodes from the tail', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      list.pushBack('bar');
      list.pushBack('baz');

      const baz = list.popBack();

      expect(baz?.value).toBe('baz');
      expect(baz?.next).toBe(null);
      expect(baz?.prev).toBe(null);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('bar');
      expect(Array.from(list)).toStrictEqual(['foo', 'bar']);

      const bar = list.popBack();

      expect(bar?.value).toBe('bar');
      expect(bar?.next).toBe(null);
      expect(bar?.prev).toBe(null);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('foo');
      expect(Array.from(list)).toStrictEqual(['foo']);

      const foo = list.popBack();

      expect(foo?.value).toBe('foo');
      expect(foo?.next).toBe(null);
      expect(foo?.prev).toBe(null);
      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
      expect(Array.from(list)).toStrictEqual([]);
    });

    it('should remove tail nodes', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      list.pushBack('bar');
      list.pushBack('baz');

      expect(list.popBack()?.value).toBe('baz');
      expect(list.popBack()?.value).toBe('bar');
      expect(list.popBack()?.value).toBe('foo');

      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
      expect(Array.from(list)).toStrictEqual([]);
    });
  });

  describe('.remove()', () => {
    it('should remove a middle node', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      const barRef = list.pushBack('bar');
      list.pushBack('baz');

      const bar = list.remove(barRef);

      expect(bar?.next).toBe(null);
      expect(bar?.prev).toBe(null);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['foo', 'baz']);
    });

    it('should remove the head node', () => {
      const list = new LinkedList();

      const fooRef = list.pushBack('foo');
      list.pushBack('bar');
      list.pushBack('baz');

      const foo = list.remove(fooRef);

      expect(foo?.next).toBe(null);
      expect(foo?.prev).toBe(null);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('bar');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['bar', 'baz']);
    });

    it('should remove the tail node', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      list.pushBack('bar');
      const bazRef = list.pushBack('baz');

      const baz = list.remove(bazRef);

      expect(baz?.next).toBe(null);
      expect(baz?.prev).toBe(null);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('bar');
      expect(Array.from(list)).toStrictEqual(['foo', 'bar']);
    });

    it('should not remove a node that has already been removed', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      const barRef = list.pushBack('bar');
      list.pushBack('baz');

      expect(list.remove(barRef)?.value).toBe('bar');
      expect(list.remove(barRef)).toBe(null);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['foo', 'baz']);
    });

    it('should not remove a node not contained in the list', () => {
      const list = new LinkedList();

      expect(list.remove({})).toBe(null);
    });
  });
});

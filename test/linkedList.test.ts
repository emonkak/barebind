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

      const foo = list.pushFront('foo');

      expect(foo).toStrictEqual({
        value: 'foo',
        prev: null,
        next: null,
        owner: expect.any(LinkedList),
      });
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(foo);
      expect(list.back()).toBe(foo);
      expect(Array.from(list)).toStrictEqual(['foo']);
    });

    it('should prepend multiple values to the list', () => {
      const list = new LinkedList();

      const foo = list.pushFront('foo');
      const bar = list.pushFront('bar');
      const baz = list.pushFront('baz');

      expect(foo).toStrictEqual({
        value: 'foo',
        prev: bar,
        next: null,
        owner: expect.any(LinkedList),
      });
      expect(bar).toStrictEqual({
        value: 'bar',
        prev: baz,
        next: foo,
        owner: expect.any(LinkedList),
      });
      expect(baz).toStrictEqual({
        value: 'baz',
        prev: null,
        next: bar,
        owner: expect.any(LinkedList),
      });
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(baz);
      expect(list.back()).toBe(foo);
      expect(Array.from(list)).toStrictEqual(['baz', 'bar', 'foo']);
    });
  });

  describe('.pushBack()', () => {
    it('should append a single value to the list', () => {
      const list = new LinkedList();

      const foo = list.pushBack('foo');

      expect(foo).toStrictEqual({
        value: 'foo',
        prev: null,
        next: null,
        owner: expect.any(LinkedList),
      });
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('foo');
      expect(Array.from(list)).toStrictEqual(['foo']);
    });

    it('should append multiple values to the list', () => {
      const list = new LinkedList();

      const foo = list.pushBack('foo');
      const bar = list.pushBack('bar');
      const baz = list.pushBack('baz');

      expect(foo).toStrictEqual({
        value: 'foo',
        prev: null,
        next: bar,
        owner: expect.any(LinkedList),
      });
      expect(bar).toStrictEqual({
        value: 'bar',
        prev: foo,
        next: baz,
        owner: expect.any(LinkedList),
      });
      expect(baz).toStrictEqual({
        value: 'baz',
        prev: bar,
        next: null,
        owner: expect.any(LinkedList),
      });
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(foo);
      expect(list.back()).toBe(baz);
      expect(Array.from(list)).toStrictEqual(['foo', 'bar', 'baz']);
    });
  });

  describe('.popFront()', () => {
    it('should remove nodes from head', () => {
      const list = new LinkedList();

      const foo = list.pushBack('foo');
      const bar = list.pushBack('bar');
      const baz = list.pushBack('baz');

      expect(list.popFront()).toBe(foo);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('bar');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['bar', 'baz']);

      expect(list.popFront()).toBe(bar);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('baz');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['baz']);

      expect(list.popFront()).toBe(baz);
      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
      expect(Array.from(list)).toStrictEqual([]);

      expect(list.popFront()).toBe(null);

      expect(foo).toStrictEqual({
        value: 'foo',
        prev: null,
        next: null,
        owner: null,
      });
      expect(bar).toStrictEqual({
        value: 'bar',
        prev: null,
        next: null,
        owner: null,
      });
      expect(baz).toStrictEqual({
        value: 'baz',
        prev: null,
        next: null,
        owner: null,
      });
    });
  });

  describe('.popBack()', () => {
    it('should remove nodes from tail', () => {
      const list = new LinkedList();

      const foo = list.pushBack('foo');
      const bar = list.pushBack('bar');
      const baz = list.pushBack('baz');

      expect(list.popBack()).toBe(baz);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('bar');
      expect(Array.from(list)).toStrictEqual(['foo', 'bar']);

      expect(list.popBack()).toBe(bar);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('foo');
      expect(Array.from(list)).toStrictEqual(['foo']);

      expect(list.popBack()).toBe(foo);
      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
      expect(Array.from(list)).toStrictEqual([]);

      expect(list.popBack()).toBe(null);

      expect(foo).toStrictEqual({
        value: 'foo',
        prev: null,
        next: null,
        owner: null,
      });
      expect(bar).toStrictEqual({
        value: 'bar',
        prev: null,
        next: null,
        owner: null,
      });
      expect(baz).toStrictEqual({
        value: 'baz',
        prev: null,
        next: null,
        owner: null,
      });
    });
  });

  describe('.remove()', () => {
    it('should remove the head node', () => {
      const list = new LinkedList();

      const foo = list.pushBack('foo');
      list.pushBack('bar');
      list.pushBack('baz');

      expect(list.remove(foo)).toBe(true);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('bar');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['bar', 'baz']);

      expect(foo).toStrictEqual({
        value: 'foo',
        prev: null,
        next: null,
        owner: null,
      });
    });

    it('should remove the tail node', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      list.pushBack('bar');
      const baz = list.pushBack('baz');

      expect(list.remove(baz)).toBe(true);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('bar');
      expect(Array.from(list)).toStrictEqual(['foo', 'bar']);

      expect(baz).toStrictEqual({
        value: 'baz',
        prev: null,
        next: null,
        owner: null,
      });
    });

    it('should remove a middle node', () => {
      const list = new LinkedList();

      list.pushFront('foo');
      const bar = list.pushFront('bar');
      list.pushFront('baz');

      expect(list.remove(bar)).toBe(true);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('baz');
      expect(list.back()?.value).toBe('foo');
      expect(Array.from(list)).toStrictEqual(['baz', 'foo']);

      expect(bar).toStrictEqual({
        value: 'bar',
        prev: null,
        next: null,
        owner: null,
      });
    });

    it('should return false if a node with specified ref already been removed', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      const bar = list.pushBack('bar');
      list.pushBack('baz');

      expect(list.remove(bar)).toBe(true);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['foo', 'baz']);

      expect(list.remove(bar)).toBe(false);

      expect(bar).toStrictEqual({
        value: 'bar',
        prev: null,
        next: null,
        owner: null,
      });
    });

    it('should return null if a node with specified ref does not exist', () => {
      const list1 = new LinkedList();
      const list2 = new LinkedList();

      const foo = list1.pushBack('foo');
      const bar = list1.pushBack('bar');
      const baz = list1.pushBack('baz');

      expect(list2.remove(foo)).toBe(false);
      expect(list2.remove(bar)).toBe(false);
      expect(list2.remove(baz)).toBe(false);
    });
  });
});

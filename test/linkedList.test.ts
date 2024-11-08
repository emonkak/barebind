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
    it('should remove nodes from head', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      list.pushBack('bar');
      list.pushBack('baz');

      expect(list.popFront()).toStrictEqual({
        value: 'foo',
        prev: null,
        next: null,
      });
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('bar');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['bar', 'baz']);

      expect(list.popFront()).toStrictEqual({
        value: 'bar',
        prev: null,
        next: null,
      });
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('baz');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['baz']);

      expect(list.popFront()).toStrictEqual({
        value: 'baz',
        prev: null,
        next: null,
      });
      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
      expect(Array.from(list)).toStrictEqual([]);

      expect(list.popFront()).toBe(null);
    });
  });

  describe('.popBack()', () => {
    it('should remove nodes from tail', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      list.pushBack('bar');
      list.pushBack('baz');

      expect(list.popBack()).toStrictEqual({
        value: 'baz',
        prev: null,
        next: null,
      });
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('bar');
      expect(Array.from(list)).toStrictEqual(['foo', 'bar']);

      expect(list.popBack()).toStrictEqual({
        value: 'bar',
        prev: null,
        next: null,
      });
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('foo');
      expect(Array.from(list)).toStrictEqual(['foo']);

      expect(list.popBack()).toStrictEqual({
        value: 'foo',
        prev: null,
        next: null,
      });
      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
      expect(Array.from(list)).toStrictEqual([]);

      expect(list.popBack()).toBe(null);
    });
  });

  describe('.remove()', () => {
    it('should remove the head node', () => {
      const list = new LinkedList();

      const foo = list.pushBack('foo');
      list.pushBack('bar');
      list.pushBack('baz');

      expect(list.remove(foo)).toStrictEqual({
        value: 'foo',
        prev: null,
        next: null,
      });
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('bar');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['bar', 'baz']);
    });

    it('should remove the tail node', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      list.pushBack('bar');
      const baz = list.pushBack('baz');

      expect(list.remove(baz)).toStrictEqual({
        value: 'baz',
        prev: null,
        next: null,
      });
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('bar');
      expect(Array.from(list)).toStrictEqual(['foo', 'bar']);
    });

    it('should remove a middle node', () => {
      const list = new LinkedList();

      list.pushFront('foo');
      const bar = list.pushFront('bar');
      list.pushFront('baz');

      expect(list.remove(bar)).toStrictEqual({
        value: 'bar',
        prev: null,
        next: null,
      });
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('baz');
      expect(list.back()?.value).toBe('foo');
      expect(Array.from(list)).toStrictEqual(['baz', 'foo']);
    });

    it('should return null if a node with specified ref already been removed', () => {
      const list = new LinkedList();

      list.pushBack('foo');
      const bar = list.pushBack('bar');
      list.pushBack('baz');

      expect(list.remove(bar)).toStrictEqual({
        value: 'bar',
        prev: null,
        next: null,
      });
      expect(list.isEmpty()).toBe(false);
      expect(list.front()?.value).toBe('foo');
      expect(list.back()?.value).toBe('baz');
      expect(Array.from(list)).toStrictEqual(['foo', 'baz']);

      expect(list.remove(bar)).toBe(null);
    });

    it('should return null if a node with specified ref does not exist', () => {
      const list = new LinkedList();

      expect(list.remove({})).toBe(null);
    });
  });
});

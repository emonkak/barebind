import { describe, expect, it } from 'vitest';

import { LinkedList } from '@/collections/linked-list.js';

describe('LinkedList', () => {
  describe('[Symbol.iterator]()', () => {
    it('yields nothing for an empty list', () => {
      const list = new LinkedList<number>();
      expect([...list]).toStrictEqual([]);
    });

    it('yields all values in insertion order', () => {
      const list = new LinkedList<string>();
      list.pushBack('a');
      list.pushBack('b');
      list.pushBack('c');
      expect([...list]).toStrictEqual(['a', 'b', 'c']);
    });
  });

  describe('clear()', () => {
    it('empties the list', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      list.pushBack(2);
      list.clear();
      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
    });

    it('invalidates nodes that were in the list before clear', () => {
      const list = new LinkedList<number>();
      const node = list.pushBack(1);
      list.clear();
      expect(list.remove(node)).toBe(false);
    });
  });

  describe('front() / back()', () => {
    it('returns null for an empty list', () => {
      const list = new LinkedList<number>();
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
    });

    it('returns the same node when list has one element', () => {
      const list = new LinkedList<number>();
      list.pushBack(42);
      expect(list.front()?.value).toBe(42);
      expect(list.back()?.value).toBe(42);
      expect(list.front()).toBe(list.back());
    });

    it('returns correct head and tail after multiple pushes', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      list.pushBack(2);
      list.pushBack(3);
      expect(list.front()?.value).toBe(1);
      expect(list.back()?.value).toBe(3);
    });
  });

  describe('isEmpty()', () => {
    it('returns true for a new list', () => {
      const list = new LinkedList<number>();
      expect(list.isEmpty()).toBe(true);
    });

    it('returns false after pushing an element', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      expect(list.isEmpty()).toBe(false);
    });

    it('returns true after all elements are removed', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      list.popBack();
      expect(list.isEmpty()).toBe(true);
    });
  });

  describe('popBack()', () => {
    it('returns null for an empty list', () => {
      const list = new LinkedList<number>();
      expect(list.popBack()).toBe(null);
    });

    it('removes and returns the last element', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      list.pushBack(2);
      const node = list.popBack();
      expect(node?.value).toBe(2);
      expect([...list]).toStrictEqual([1]);
    });

    it('clears the list when removing the only element', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      list.popBack();
      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
    });

    it('sets ownership to null on the removed node', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      const node = list.popBack();
      expect(node?.ownership).toBe(null);
    });

    it('updates tail pointer after pop', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      const a = list.pushBack(2);
      list.pushBack(3);
      list.popBack();
      expect(list.back()).toBe(a);
      expect(a.next).toBe(null);
    });
  });

  describe('popFront()', () => {
    it('returns null for an empty list', () => {
      const list = new LinkedList<number>();
      expect(list.popFront()).toBe(null);
    });

    it('removes and returns the first element', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      list.pushBack(2);
      const node = list.popFront();
      expect(node?.value).toBe(1);
      expect([...list]).toStrictEqual([2]);
    });

    it('clears the list when removing the only element', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      list.popFront();
      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
    });

    it('sets ownership to null on the removed node', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      const node = list.popFront();
      expect(node?.ownership).toBe(null);
    });

    it('updates head pointer after pop', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      const b = list.pushBack(2);
      list.pushBack(3);
      list.popFront();
      expect(list.front()).toBe(b);
      expect(b.prev).toBe(null);
    });
  });

  describe('pushBack()', () => {
    it('appends elements in order', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      list.pushBack(2);
      list.pushBack(3);
      expect([...list]).toStrictEqual([1, 2, 3]);
    });

    it('returns the inserted node', () => {
      const list = new LinkedList<number>();
      const node = list.pushBack(10);
      expect(node.value).toBe(10);
      expect(node.prev).toBe(null);
      expect(node.next).toBe(null);
    });

    it('sets prev/next pointers correctly', () => {
      const list = new LinkedList<number>();
      const a = list.pushBack(1);
      const b = list.pushBack(2);
      expect(a.next).toBe(b);
      expect(b.prev).toBe(a);
    });
  });

  describe('pushFront()', () => {
    it('prepends elements in order', () => {
      const list = new LinkedList<number>();
      list.pushFront(3);
      list.pushFront(2);
      list.pushFront(1);
      expect([...list]).toStrictEqual([1, 2, 3]);
    });

    it('returns the inserted node', () => {
      const list = new LinkedList<number>();
      const node = list.pushFront(10);
      expect(node.value).toBe(10);
      expect(node.prev).toBe(null);
      expect(node.next).toBe(null);
    });

    it('sets prev/next pointers correctly', () => {
      const list = new LinkedList<number>();
      const b = list.pushFront(2);
      const a = list.pushFront(1);
      expect(a.next).toBe(b);
      expect(b.prev).toBe(a);
    });
  });

  describe('remove()', () => {
    it('returns false for a node not belonging to the list', () => {
      const list1 = new LinkedList<number>();
      const list2 = new LinkedList<number>();
      list1.pushBack(1);
      const node = list2.pushBack(2);
      expect(list1.remove(node)).toBe(false);
    });

    it('returns false for an already-removed node', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      const node = list.popBack()!;
      expect(list.remove(node)).toBe(false);
    });

    it('removes a middle node', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      const middle = list.pushBack(2);
      list.pushBack(3);
      expect(list.remove(middle)).toBe(true);
      expect([...list]).toStrictEqual([1, 3]);
    });

    it('removes the head node', () => {
      const list = new LinkedList<number>();
      const head = list.pushBack(1);
      list.pushBack(2);
      list.remove(head);
      expect(list.front()?.value).toBe(2);
      expect(list.front()?.prev).toBe(null);
    });

    it('removes the tail node', () => {
      const list = new LinkedList<number>();
      list.pushBack(1);
      const tail = list.pushBack(2);
      list.remove(tail);
      expect(list.back()?.value).toBe(1);
      expect(list.back()?.next).toBe(null);
    });

    it('removes the only element and empties the list', () => {
      const list = new LinkedList<number>();
      const node = list.pushBack(1);
      list.remove(node);
      expect(list.isEmpty()).toBe(true);
    });

    it('sets ownership to null on the removed node', () => {
      const list = new LinkedList<number>();
      const node = list.pushBack(1);
      list.remove(node);
      expect(node.ownership).toBe(null);
    });
  });
});

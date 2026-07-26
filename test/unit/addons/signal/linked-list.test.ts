import { describe, expect, it } from 'vitest';
import { LinkedList } from '@/addons/signal/linked-list.js';

describe('LinkedList', () => {
  describe('[Symbol.iterator]()', () => {
    it('yields nothing for an empty list', () => {
      const list = new LinkedList<number>();

      expect([...list]).toStrictEqual([]);
    });

    it('yields all values in insertion order', () => {
      const list = new LinkedList<string>();

      list.append('a');
      list.append('b');
      list.append('c');

      expect([...list]).toStrictEqual(['a', 'b', 'c']);
    });

    it('does not yield deleted nodes', () => {
      const list = new LinkedList<number>();
      const node1 = list.append(1);

      list.append(2);
      list.delete(node1);

      expect([...list]).toStrictEqual([2]);
    });

    it('handles append and delete interleaved', () => {
      const list = new LinkedList<number>();
      const node1 = list.append(1);
      const node2 = list.append(2);
      const node3 = list.append(3);

      list.delete(node2);
      const node4 = list.append(4);
      list.delete(node1);

      expect([...list]).toStrictEqual([3, 4]);
      expect(node4.prev).toBe(node3);
      expect(node4.next).toBe(null);
    });
  });

  describe('append()', () => {
    it('adds an item to an empty list', () => {
      const list = new LinkedList<number>();
      const node = list.append(1);

      expect([...list]).toStrictEqual([1]);
      expect(node.value).toBe(1);
      expect(node.prev).toBe(null);
      expect(node.next).toBe(null);
      expect(node.owner).toBe(list);
    });

    it('links nodes correctly', () => {
      const list = new LinkedList<number>();
      const node1 = list.append(1);
      const node2 = list.append(2);
      const node3 = list.append(3);

      expect(node1.prev).toBe(null);
      expect(node1.next).toBe(node2);
      expect(node2.prev).toBe(node1);
      expect(node2.next).toBe(node3);
      expect(node3.prev).toBe(node2);
      expect(node3.next).toBe(null);
    });
  });

  describe('delete()', () => {
    it('removes the only node', () => {
      const list = new LinkedList<number>();
      const node = list.append(1);

      expect(list.delete(node)).toBe(true);
      expect([...list]).toStrictEqual([]);
      expect(node.owner).toBe(null);
    });

    it('removes the head node', () => {
      const list = new LinkedList<number>();
      const head = list.append(1);
      list.append(2);
      list.append(3);

      expect(list.delete(head)).toBe(true);
      expect([...list]).toStrictEqual([2, 3]);
      expect(head.owner).toBe(null);
    });

    it('removes a middle node', () => {
      const list = new LinkedList<number>();
      list.append(1);
      const middle = list.append(2);
      list.append(3);

      const result = list.delete(middle);

      expect(result).toBe(true);
      expect([...list]).toStrictEqual([1, 3]);
      expect(middle.owner).toBe(null);
    });

    it('removes the tail node', () => {
      const list = new LinkedList<number>();
      list.append(1);
      list.append(2);
      const tail = list.append(3);

      const result = list.delete(tail);

      expect(result).toBe(true);
      expect([...list]).toStrictEqual([1, 2]);
      expect(tail.owner).toBe(null);
    });

    it('restores links after deleting a middle node', () => {
      const list = new LinkedList<number>();
      const node1 = list.append(1);
      const node2 = list.append(2);
      const node3 = list.append(3);

      list.delete(node2);

      expect(node1.next).toBe(node3);
      expect(node3.prev).toBe(node1);
    });

    it('restores links after deleting the head node', () => {
      const list = new LinkedList<number>();
      const node1 = list.append(1);
      const node2 = list.append(2);

      list.delete(node1);

      expect(node2.prev).toBe(null);
    });

    it('restores links after deleting the tail node', () => {
      const list = new LinkedList<number>();
      const node1 = list.append(1);
      const node2 = list.append(2);

      list.delete(node2);

      expect(node1.next).toBe(null);
    });

    it('returns false for a node owned by a different list', () => {
      const list1 = new LinkedList<number>();
      const list2 = new LinkedList<number>();
      const node = list1.append(1);

      const result = list2.delete(node);

      expect(result).toBe(false);
      expect([...list1]).toStrictEqual([1]);
    });

    it('returns false on double delete', () => {
      const list = new LinkedList<number>();
      const node = list.append(1);

      list.delete(node);
      const result = list.delete(node);

      expect(result).toBe(false);
    });
  });
});

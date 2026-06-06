import { describe, expect, it } from 'vitest';
import { PriorityQueue } from '@/queue.js';

const ascending = (a: number, b: number) => a - b;
const descending = (a: number, b: number) => b - a;

describe('PriorityQueue', () => {
  describe('dequeue()', () => {
    it('returns undefined when the queue is empty', () => {
      const minQueue = new PriorityQueue(ascending);
      expect(minQueue.dequeue()).toBe(undefined);
    });

    it('removes and returns the minimum element', () => {
      const minQueue = new PriorityQueue(ascending);
      minQueue.enqueue(3);
      minQueue.enqueue(1);
      minQueue.enqueue(2);
      expect(minQueue.dequeue()).toBe(1);
    });

    it('yields elements in ascending order when drained', () => {
      const minQueue = new PriorityQueue(ascending);
      [4, 2, 7, 1, 9, 3].forEach((n) => {
        minQueue.enqueue(n);
      });
      const items = [];
      while (minQueue.peek() !== undefined) {
        items.push(minQueue.dequeue());
      }
      expect(items).toStrictEqual([1, 2, 3, 4, 7, 9]);
    });

    it('leaves the queue empty after all elements are removed', () => {
      const minQueue = new PriorityQueue(ascending);
      minQueue.enqueue(1);
      minQueue.enqueue(2);
      minQueue.dequeue();
      minQueue.dequeue();
      expect(minQueue.dequeue()).toBe(undefined);
    });

    it('maintains the heap invariant after repeated removals', () => {
      const minQueue = new PriorityQueue(ascending);
      [5, 3, 8, 1, 4, 2].forEach((n) => {
        minQueue.enqueue(n);
      });
      minQueue.dequeue();
      minQueue.dequeue();
      expect(minQueue.peek()).toBe(3);
    });
  });

  describe('enqueue()', () => {
    it('maintains the heap invariant across multiple insertions', () => {
      const minQueue = new PriorityQueue(ascending);
      [5, 3, 8, 1, 4].forEach((n) => {
        minQueue.enqueue(n);
      });
      expect(minQueue.peek()).toBe(1);
    });

    it('handles duplicate values without error', () => {
      const minQueue = new PriorityQueue(ascending);
      minQueue.enqueue(2);
      minQueue.enqueue(2);
      minQueue.enqueue(2);
      expect(minQueue.dequeue()).toBe(2);
      expect(minQueue.dequeue()).toBe(2);
      expect(minQueue.dequeue()).toBe(2);
    });

    it('respects a reverse comparator ordering', () => {
      const maxQueue = new PriorityQueue(descending);
      [3, 1, 4, 1, 5].forEach((n) => {
        maxQueue.enqueue(n);
      });
      expect(maxQueue.peek()).toBe(5);
    });
  });

  describe('peek()', () => {
    it('returns undefined when the queue is empty', () => {
      const minQueue = new PriorityQueue(ascending);
      expect(minQueue.peek()).toBe(undefined);
    });

    it('returns the minimum element without removing it', () => {
      const minQueue = new PriorityQueue(ascending);
      minQueue.enqueue(3);
      minQueue.enqueue(1);
      minQueue.enqueue(2);
      expect(minQueue.peek()).toBe(1);
    });

    it('reflects the new minimum after a smaller element is enqueued', () => {
      const minQueue = new PriorityQueue(ascending);
      minQueue.enqueue(5);
      expect(minQueue.peek()).toBe(5);
      minQueue.enqueue(2);
      expect(minQueue.peek()).toBe(2);
    });
  });
});

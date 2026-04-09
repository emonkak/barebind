import { beforeEach, describe, expect, it } from 'vitest';
import { PriorityQueue } from '@/queue.js';

const ascending = (a: number, b: number) => a - b;
const descending = (a: number, b: number) => b - a;

describe('PriorityQueue', () => {
  let minQueue: PriorityQueue<number>;

  beforeEach(() => {
    minQueue = new PriorityQueue(ascending);
  });

  describe('dequeue()', () => {
    it('returns undefined when the queue is empty', () => {
      expect(minQueue.dequeue()).toBe(undefined);
    });

    it('removes and returns the minimum element', () => {
      minQueue.enqueue(3);
      minQueue.enqueue(1);
      minQueue.enqueue(2);
      expect(minQueue.dequeue()).toBe(1);
    });

    it('yields elements in ascending order when drained', () => {
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
      minQueue.enqueue(1);
      minQueue.enqueue(2);
      minQueue.dequeue();
      minQueue.dequeue();
      expect(minQueue.dequeue()).toBe(undefined);
    });

    it('maintains the heap invariant after repeated removals', () => {
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
      [5, 3, 8, 1, 4].forEach((n) => {
        minQueue.enqueue(n);
      });
      expect(minQueue.peek()).toBe(1);
    });

    it('handles duplicate values without error', () => {
      minQueue.enqueue(2);
      minQueue.enqueue(2);
      minQueue.enqueue(2);
      expect(minQueue.dequeue()).toBe(2);
      expect(minQueue.dequeue()).toBe(2);
      expect(minQueue.dequeue()).toBe(2);
    });

    it('respects a custom comparator ordering', () => {
      const maxQueue = new PriorityQueue(descending);
      [3, 1, 4, 1, 5].forEach((n) => {
        maxQueue.enqueue(n);
      });
      expect(maxQueue.peek()).toBe(5);
    });
  });

  describe('peek()', () => {
    it('returns undefined when the queue is empty', () => {
      expect(minQueue.peek()).toBe(undefined);
    });

    it('returns the minimum element without removing it', () => {
      minQueue.enqueue(3);
      minQueue.enqueue(1);
      minQueue.enqueue(2);
      expect(minQueue.peek()).toBe(1);
    });

    it('reflects the new minimum after a smaller element is enqueued', () => {
      minQueue.enqueue(5);
      expect(minQueue.peek()).toBe(5);
      minQueue.enqueue(2);
      expect(minQueue.peek()).toBe(2);
    });
  });
});

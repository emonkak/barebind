import { beforeEach, describe, expect, it } from 'vitest';
import { Queue } from '@/queue.js';

describe('Queue', () => {
  let queue: Queue<number>;

  beforeEach(() => {
    queue = new Queue<number>();
  });

  describe('enqueue()', () => {
    it('adds a value to an empty queue', () => {
      queue.enqueue(1);
      expect(queue.peek()).toBe(1);
    });

    it('preserves insertion order for multiple values', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);
      expect(queue.peek()).toBe(1);
    });
  });

  describe('dequeue()', () => {
    it('returns undefined when the queue is empty', () => {
      expect(queue.dequeue()).toBeUndefined();
    });

    it('returns the front value', () => {
      queue.enqueue(1);
      expect(queue.dequeue()).toBe(1);
    });

    it('removes the front value', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.dequeue();
      expect(queue.peek()).toBe(2);
    });

    it('returns values in FIFO order', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);
      expect(queue.dequeue()).toBe(1);
      expect(queue.dequeue()).toBe(2);
      expect(queue.dequeue()).toBe(3);
    });

    it('returns undefined after all values are removed', () => {
      queue.enqueue(1);
      queue.dequeue();
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  describe('peek()', () => {
    it('returns undefined when the queue is empty', () => {
      expect(queue.peek()).toBeUndefined();
    });

    it('returns the front value without removing it', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      expect(queue.peek()).toBe(1);
      expect(queue.peek()).toBe(1);
    });
  });

  describe('[Symbol.iterator]()', () => {
    it('yields nothing for an empty queue', () => {
      expect([...queue]).toStrictEqual([]);
    });

    it('yields all values in FIFO order', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);
      expect([...queue]).toStrictEqual([1, 2, 3]);
    });

    it('does not consume the queue', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      [...queue];
      expect(queue.peek()).toBe(1);
    });

    it('reflects the current state after mutations', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.dequeue();
      expect([...queue]).toStrictEqual([2]);
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  type Effect,
  EffectQueue,
  getPriorityFromLanes,
  getSchedulingLanes,
  getStartNode,
  Lane,
  type Lanes,
  type Part,
  PartType,
  type UpdateOptions,
} from '@/core.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';

describe('EffectQueue', () => {
  describe('size', () => {
    it('is 0 for a new queue', () => {
      const queue = new EffectQueue();
      expect(queue.size).toBe(0);
    });

    it('increments by 1 for each push', () => {
      const queue = new EffectQueue();
      queue.push(createEffect(), 0);
      queue.push(createEffect(), 0);
      expect(queue.size).toBe(2);
    });

    it('increments by 1 for pushBefore', () => {
      const queue = new EffectQueue();
      queue.pushBefore(createEffect());
      expect(queue.size).toBe(1);
    });

    it('increments by 1 for pushAfter', () => {
      const queue = new EffectQueue();
      queue.pushAfter(createEffect());
      expect(queue.size).toBe(1);
    });

    it('resets to 0 after clear', () => {
      const queue = new EffectQueue();
      queue.push(createEffect(), 0);
      queue.clear();
      expect(queue.size).toBe(0);
    });

    it('resets to 0 after flush', () => {
      const queue = new EffectQueue();
      queue.push(createEffect(), 0);
      queue.flush();
      expect(queue.size).toBe(0);
    });
  });

  describe('flush()', () => {
    it('calls commit on a single effect', () => {
      const queue = new EffectQueue();
      const effect = createEffect();
      queue.push(effect, 0);
      queue.flush();
      expect(effect.commit).toHaveBeenCalledTimes(1);
    });

    it('does nothing when queue is empty', () => {
      const queue = new EffectQueue();
      expect(() => queue.flush()).not.toThrow();
    });

    it('commits effects in child-to-parent order (deeper level first)', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      const child = createEffect(() => order.push(1));
      const parent = createEffect(() => order.push(2));
      queue.push(child, 2);
      queue.push(parent, 1);
      queue.flush();
      expect(order).toStrictEqual([1, 2]);
    });

    it('commits effects in parent-to-child order when pushed ascending', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      const parent = createEffect(() => order.push(1));
      const child = createEffect(() => order.push(2));
      queue.push(parent, 1);
      queue.push(child, 2);
      queue.flush();
      expect(order).toStrictEqual([2, 1]);
    });

    it('commits pushBefore effects before push effects', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.push(
        createEffect(() => order.push(2)),
        0,
      );
      queue.pushBefore(createEffect(() => order.push(1)));
      queue.flush();
      expect(order).toStrictEqual([1, 2]);
    });

    it('commits pushAfter effects after push effects', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.push(
        createEffect(() => order.push(1)),
        0,
      );
      queue.pushAfter(createEffect(() => order.push(2)));
      queue.flush();
      expect(order).toStrictEqual([1, 2]);
    });

    it('commits effects in pushBefore, push, pushAfter order', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.pushBefore(createEffect(() => order.push(1)));
      queue.push(
        createEffect(() => order.push(2)),
        0,
      );
      queue.pushAfter(createEffect(() => order.push(3)));
      queue.flush();
      expect(order).toStrictEqual([1, 2, 3]);
    });

    it('empties the queue after flush', () => {
      const queue = new EffectQueue();
      queue.push(createEffect(), 0);
      queue.flush();
      const effect = createEffect();
      queue.push(effect, 0);
      queue.flush();
      expect(effect.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('push()', () => {
    it('groups effects at the same level together', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.push(
        createEffect(() => order.push(1)),
        1,
      );
      queue.push(
        createEffect(() => order.push(2)),
        1,
      );
      queue.push(
        createEffect(() => order.push(3)),
        1,
      );
      queue.flush();
      expect(order).toStrictEqual([1, 2, 3]);
    });

    it('moves to tail when level increases', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.push(
        createEffect(() => order.push(1)),
        1,
      );
      queue.push(
        createEffect(() => order.push(2)),
        2,
      );
      queue.push(
        createEffect(() => order.push(3)),
        1,
      );
      queue.flush();
      expect(order).toStrictEqual([2, 1, 3]);
    });

    it('handles alternating levels correctly', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.push(
        createEffect(() => order.push(1)),
        2,
      );
      queue.push(
        createEffect(() => order.push(2)),
        1,
      );
      queue.push(
        createEffect(() => order.push(3)),
        2,
      );
      queue.push(
        createEffect(() => order.push(4)),
        1,
      );
      queue.flush();
      expect(order).toStrictEqual([1, 3, 2, 4]);
    });
  });

  describe('clear()', () => {
    it('prevents previously pushed effects from being committed', () => {
      const queue = new EffectQueue();
      const effect = createEffect();
      queue.push(effect, 0);
      queue.clear();
      queue.flush();
      expect(effect.commit).not.toHaveBeenCalled();
    });

    it('clears effects from all three internal lists', () => {
      const queue = new EffectQueue();
      const before = createEffect();
      const middle = createEffect();
      const after = createEffect();
      queue.pushBefore(before);
      queue.push(middle, 0);
      queue.pushAfter(after);
      queue.clear();
      queue.flush();
      expect(before.commit).not.toHaveBeenCalled();
      expect(middle.commit).not.toHaveBeenCalled();
      expect(after.commit).not.toHaveBeenCalled();
    });

    it('allows the queue to be reused after clear', () => {
      const queue = new EffectQueue();
      queue.push(createEffect(), 0);
      queue.clear();
      const effect = createEffect();
      queue.push(effect, 0);
      queue.flush();
      expect(effect.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('pushBefore()', () => {
    it('commits multiple pushBefore effects in insertion order', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.pushBefore(createEffect(() => order.push(1)));
      queue.pushBefore(createEffect(() => order.push(2)));
      queue.flush();
      expect(order).toStrictEqual([1, 2]);
    });
  });

  describe('pushAfter()', () => {
    it('commits multiple pushAfter effects in insertion order', () => {
      const queue = new EffectQueue();
      const order: number[] = [];
      queue.pushAfter(createEffect(() => order.push(1)));
      queue.pushAfter(createEffect(() => order.push(2)));
      queue.flush();
      expect(order).toStrictEqual([1, 2]);
    });
  });
});

describe('getSchedulingLanes()', () => {
  it.each<[UpdateOptions, Lanes]>([
    [{}, Lane.NoLane],
    [{ flushSync: true }, Lane.SyncLane],
    [{ priority: 'user-blocking' }, Lane.UserBlockingLane],
    [{ priority: 'user-visible' }, Lane.UserVisibleLane],
    [{ priority: 'background' }, Lane.BackgroundLane],
    [
      {
        transition: true,
      },
      Lane.TransitionLane,
    ],
    [{ viewTransition: true }, Lane.ViewTransitionLane],
  ])('returns lanes for options', (options, lanes) => {
    expect(getSchedulingLanes(options)).toBe(lanes);
    expect(getPriorityFromLanes(lanes)).toBe(options.priority ?? null);
  });
});

describe('getStartNode()', () => {
  it.each<[Part]>([
    [
      {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      },
    ],
    [
      {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      },
    ],
    [
      {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      },
    ],
    [
      {
        type: PartType.Element,
        node: document.createElement('div'),
      },
    ],
    [
      {
        type: PartType.Event,
        node: document.createElement('div'),
        name: 'click',
      },
    ],
    [
      {
        type: PartType.Live,
        node: document.createElement('textarea'),
        name: 'value',
        defaultValue: '',
      },
    ],
    [
      {
        type: PartType.Property,
        node: document.createElement('textarea'),
        name: 'value',
        defaultValue: '',
      },
    ],
  ])('returns the node of the part', (part) => {
    expect(getStartNode(part)).toBe(part.node);
  });

  it('returns the child node if the part has a child node', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: document.createElement('div'),
      namespaceURI: HTML_NAMESPACE_URI,
    };

    expect(getStartNode(part)).toBe(part.anchorNode);
  });
});

function createEffect(callback: () => void = () => {}): Effect {
  return { commit: vi.fn(callback) };
}

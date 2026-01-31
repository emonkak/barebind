import { describe, expect, it, vi } from 'vitest';

import {
  DeferredValue,
  EffectEvent,
  ImperativeHandle,
  SyncEnternalStore,
  Transition,
} from '@/addons/hooks.js';
import type { Cleanup, RefCallback } from '@/internal.js';
import { LinkedList } from '@/linked-list.js';
import type { RenderSession } from '@/render-session.js';
import { waitForMicrotasks } from '../../test-helpers.js';
import { TestRenderer } from '../../test-renderer.js';

describe('DeferredValue()', () => {
  it('returns the value deferred until next rendering', async () => {
    const renderer = new TestRenderer(
      vi.fn(({ value }: { value: string }, session: RenderSession) => {
        return session.use(DeferredValue(value));
      }),
    );

    SESSION1: {
      renderer.render({ value: 'foo' });

      expect(renderer.callback).toHaveBeenCalledTimes(1);
      expect(renderer.callback).toHaveLastReturnedWith('foo');
    }

    await Promise.resolve();

    SESSION2: {
      renderer.render({ value: 'bar' });

      expect(renderer.callback).toHaveBeenCalledTimes(2);
      expect(renderer.callback).toHaveLastReturnedWith('foo');
    }

    await Promise.resolve();

    expect(renderer.callback).toHaveBeenCalledTimes(3);
    expect(renderer.callback).toHaveLastReturnedWith('bar');

    SESSION3: {
      renderer.render({ value: 'bar' });

      expect(renderer.callback).toHaveBeenCalledTimes(4);
      expect(renderer.callback).toHaveLastReturnedWith('bar');
    }
  });

  it('returns the initial value if it is given', async () => {
    const renderer = new TestRenderer(
      vi.fn(
        (
          { value, initialValue }: { value: string; initialValue: string },
          session: RenderSession,
        ) => {
          return session.use(DeferredValue(value, initialValue));
        },
      ),
    );

    SESSION1: {
      renderer.render({ value: 'bar', initialValue: 'foo' });

      expect(renderer.callback).toHaveBeenCalledTimes(1);
      expect(renderer.callback).toHaveReturnedWith('foo');
    }

    await Promise.resolve();

    expect(renderer.callback).toHaveBeenCalledTimes(2);
    expect(renderer.callback).toHaveReturnedWith('bar');

    SESSION2: {
      renderer.render({ value: 'bar', initialValue: 'foo' });

      expect(renderer.callback).toHaveBeenCalledTimes(3);
      expect(renderer.callback).toHaveReturnedWith('bar');
    }
  });
});

describe('EffectEvent()', () => {
  it('returns an effect Event function.', () => {
    const renderer = new TestRenderer(
      ({ callback }: { callback: () => void }, session) => {
        const onEffectEvent = session.use(EffectEvent(callback));
        session.useEffect(() => {
          onEffectEvent();
        });
      },
    );

    const callback1 = vi.fn();
    const callback2 = vi.fn();

    SESSION1: {
      renderer.render({ callback: callback1 });

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).not.toHaveBeenCalled();
    }

    SESSION1: {
      renderer.render({ callback: callback2 });

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
    }
  });
});

describe('ImperativeHandle()', () => {
  it('create a ref handle and set it to the object ref', () => {
    const renderer = new TestRenderer(
      ({ handle }: { handle: unknown }, session) => {
        const ref = session.useRef(null);
        session.use(ImperativeHandle(ref, () => handle, [handle]));
        return ref;
      },
    );

    const handle1 = {};
    const handle2 = {};

    SESSION1: {
      const ref = renderer.render({ handle: handle1 });

      expect(ref.current).toBe(handle1);
    }

    SESSION2: {
      const ref = renderer.render({ handle: handle2 });

      expect(ref.current).toBe(handle2);
    }
  });

  it('create a ref handle and call the function ref with it', () => {
    const renderer = new TestRenderer(
      (
        { ref, handle }: { ref: RefCallback<unknown>; handle: unknown },
        session,
      ) => {
        session.use(ImperativeHandle(ref, () => handle));
      },
    );

    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();
    const ref1 = vi.fn().mockReturnValue(cleanup1);
    const ref2 = vi.fn().mockReturnValue(cleanup2);
    const handle = {};

    SESSION1: {
      renderer.render({ ref: ref1, handle });

      expect(ref1).toHaveBeenCalledOnce();
      expect(ref1).toHaveBeenCalledWith(handle);
      expect(ref2).not.toHaveBeenCalled();
      expect(cleanup1).not.toHaveBeenCalled();
      expect(cleanup2).not.toHaveBeenCalled();
    }

    SESSION2: {
      renderer.render({ ref: ref2, handle });

      expect(ref1).toHaveBeenCalledOnce();
      expect(ref2).toHaveBeenCalledOnce();
      expect(ref2).toHaveBeenCalledWith(handle);
      expect(cleanup1).toHaveBeenCalledOnce();
      expect(cleanup2).not.toHaveBeenCalled();
    }
  });
});

describe('SyncExternalStore()', () => {
  it('forces the update if the snapshot has been changed when updating the snapshot', async () => {
    let count = 0;

    const unsubscribe = vi.fn();
    const subscribe = vi.fn().mockReturnValue(unsubscribe);
    const getSnapshot = () => count;

    const renderer = new TestRenderer(
      vi.fn((_props, session: RenderSession) => {
        const snapshot = session.use(SyncEnternalStore(subscribe, getSnapshot));

        session.useInsertionEffect(() => {
          count++;
        }, []);

        return snapshot;
      }),
    );

    SESSION1: {
      renderer.render({});

      expect(renderer.callback).toHaveBeenCalledTimes(1);
      expect(renderer.callback).toHaveLastReturnedWith(0);
      expect(subscribe).toHaveBeenCalledOnce();
      expect(unsubscribe).not.toHaveBeenCalled();
    }

    await Promise.resolve();

    expect(renderer.callback).toHaveBeenCalledTimes(2);
    expect(renderer.callback).toHaveLastReturnedWith(1);
    expect(subscribe).toHaveBeenCalledOnce();
    expect(unsubscribe).not.toHaveBeenCalled();

    SESSION2: {
      renderer.render({});

      expect(renderer.callback).toHaveBeenCalledTimes(3);
      expect(renderer.callback).toHaveLastReturnedWith(1);
      expect(subscribe).toHaveBeenCalledOnce();
      expect(unsubscribe).not.toHaveBeenCalled();
    }

    renderer.finalize();

    expect(subscribe).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('forces the update if the snapshot has been changed when subscribing the store', async () => {
    let count = 0;

    const subscribers = new LinkedList<() => void>();
    const subscribe = (subscriber: () => void) => {
      const node = subscribers.pushBack(subscriber);
      return () => {
        subscribers.remove(node);
      };
    };
    const getSnapshot = () => count;
    const notifySubscribers = () => {
      count++;
      for (const subscriber of subscribers) {
        subscriber();
      }
    };

    const renderer = new TestRenderer(
      vi.fn((_props, session: RenderSession) => {
        const snapshot = session.use(SyncEnternalStore(subscribe, getSnapshot));

        session.useEffect(notifySubscribers, []);

        return snapshot;
      }),
    );

    SESSION1: {
      renderer.render({});

      expect(renderer.callback).toHaveBeenCalledTimes(1);
      expect(renderer.callback).toHaveLastReturnedWith(0);
      expect(Array.from(subscribers)).toStrictEqual([expect.any(Function)]);
    }

    await Promise.resolve();

    expect(renderer.callback).toHaveBeenCalledTimes(2);
    expect(renderer.callback).toHaveLastReturnedWith(1);
    expect(Array.from(subscribers)).toStrictEqual([expect.any(Function)]);

    SESSION2: {
      renderer.render({});

      expect(renderer.callback).toHaveBeenCalledTimes(3);
      expect(renderer.callback).toHaveLastReturnedWith(1);
      expect(Array.from(subscribers)).toStrictEqual([expect.any(Function)]);
    }

    renderer.finalize();

    expect(renderer.callback).toHaveBeenCalledTimes(3);
    expect(Array.from(subscribers)).toStrictEqual([]);
  });

  it('should resubscribe the store if the subscribe function is changed', async () => {
    const renderer = new TestRenderer(
      (
        {
          subscribe,
          getSnapshot,
        }: {
          subscribe: (subscriber: () => void) => Cleanup | void;
          getSnapshot: () => string;
        },
        session,
      ) => {
        return session.use(SyncEnternalStore(subscribe, getSnapshot));
      },
    );

    const unsubscribe1 = vi.fn();
    const unsubscribe2 = vi.fn();
    const subscribe1 = vi.fn().mockReturnValue(unsubscribe1);
    const subscribe2 = vi.fn().mockReturnValue(unsubscribe2);
    const getSnapshot1 = () => 'foo';
    const getSnapshot2 = () => 'bar';

    SESSION1: {
      const snapshot = renderer.render({
        subscribe: subscribe1,
        getSnapshot: getSnapshot1,
      });

      expect(snapshot).toBe('foo');
      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(0);
      expect(unsubscribe1).toHaveBeenCalledTimes(0);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);
    }

    SESSION2: {
      const snapshot = renderer.render({
        subscribe: subscribe2,
        getSnapshot: getSnapshot1,
      });

      expect(snapshot).toBe('foo');
      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(1);
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);
    }

    SESSION3: {
      const snapshot = renderer.render({
        subscribe: subscribe2,
        getSnapshot: getSnapshot2,
      });

      expect(snapshot).toBe('bar');
      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(1);
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);
    }

    renderer.finalize();

    expect(subscribe1).toHaveBeenCalledTimes(1);
    expect(subscribe2).toHaveBeenCalledTimes(1);
    expect(unsubscribe1).toHaveBeenCalledTimes(1);
    expect(unsubscribe2).toHaveBeenCalledTimes(1);
  });
});

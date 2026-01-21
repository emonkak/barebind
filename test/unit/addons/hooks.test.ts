import { describe, expect, it, vi } from 'vitest';
import {
  DeferredValue,
  EffectEvent,
  ImperativeHandle,
  SyncEnternalStore,
} from '@/addons/hooks.js';
import { LinkedList } from '@/linked-list.js';
import type { RenderSession } from '@/render-session.js';
import { TestRenderer } from '../../test-helpers.js';

describe('DeferredValue()', () => {
  it('returns the value deferred until next rendering', async () => {
    const renderer = new TestRenderer();

    SESSION1: {
      const callback = vi.fn((session: RenderSession) => {
        return session.use(DeferredValue('foo'));
      });

      renderer.startRender(callback);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveReturnedWith('foo');
    }

    SESSION2: {
      const callback = vi.fn((session: RenderSession) => {
        return session.use(DeferredValue('bar'));
      });

      renderer.startRender(callback);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveReturnedWith('foo');
    }

    await Promise.resolve();

    SESSION2: {
      const callback = vi.fn((session: RenderSession) => {
        return session.use(DeferredValue('bar'));
      });

      renderer.startRender(callback);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveReturnedWith('bar');
    }
  });

  it('returns the initial value if it is given', async () => {
    const renderer = new TestRenderer();
    const callback = vi.fn((session: RenderSession) => {
      return session.use(DeferredValue('foo', 'bar'));
    });

    SESSION1: {
      renderer.startRender(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveReturnedWith('bar');
    }

    await Promise.resolve();

    SESSION2: {
      renderer.startRender(callback);

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveReturnedWith('foo');
    }
  });
});

describe('EffectEvent()', () => {
  it('returns an effect Event function.', () => {
    const renderer = new TestRenderer();

    const callback1 = vi.fn();
    const callback2 = vi.fn();

    SESSION1: {
      renderer.startRender((session) => {
        const onEffectEvent = session.use(EffectEvent(callback1));
        session.useEffect(() => {
          onEffectEvent();
        });
      });

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).not.toHaveBeenCalled();
    }

    SESSION1: {
      renderer.startRender((session) => {
        const onEffectEvent = session.use(EffectEvent(callback2));
        session.useEffect(() => {
          onEffectEvent();
        });
      });

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
    }
  });
});

describe('ImperativeHandle()', () => {
  it('create a ref handle and set it to the object ref', () => {
    const renderer = new TestRenderer();

    const handle1 = {};
    const handle2 = {};

    SESSION1: {
      const ref = renderer.startRender((session) => {
        const ref = session.useRef(null);
        session.use(ImperativeHandle(ref, () => handle1, [handle1]));
        return ref;
      });

      expect(ref.current).toBe(handle1);
    }

    SESSION2: {
      const ref = renderer.startRender((session) => {
        const ref = session.useRef(null);
        session.use(ImperativeHandle(ref, () => handle2, [handle2]));
        return ref;
      });

      expect(ref.current).toBe(handle2);
    }
  });

  it('create a ref handle and call the function ref with it', () => {
    const renderer = new TestRenderer();

    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();
    const ref1 = vi.fn().mockReturnValue(cleanup1);
    const ref2 = vi.fn().mockReturnValue(cleanup2);
    const handle = {};

    SESSION1: {
      renderer.startRender((session) => {
        session.use(ImperativeHandle(ref1, () => handle));
      });

      expect(ref1).toHaveBeenCalledOnce();
      expect(ref1).toHaveBeenCalledWith(handle);
      expect(ref2).not.toHaveBeenCalled();
      expect(cleanup1).not.toHaveBeenCalled();
      expect(cleanup2).not.toHaveBeenCalled();
    }

    SESSION2: {
      renderer.startRender((session) => {
        session.use(ImperativeHandle(ref2, () => handle));
      });

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
    const renderer = new TestRenderer();
    let count = 0;

    const callback = vi.fn((session: RenderSession) => {
      const snapshot = session.use(SyncEnternalStore(subscribe, getSnapshot));

      session.useInsertionEffect(() => {
        count++;
      }, []);

      return snapshot;
    });
    const unsubscribe = vi.fn();
    const subscribe = vi.fn().mockReturnValue(unsubscribe);
    const getSnapshot = () => count;

    SESSION1: {
      renderer.startRender(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveLastReturnedWith(0);
      expect(subscribe).toHaveBeenCalledOnce();
      expect(unsubscribe).not.toHaveBeenCalled();
    }

    await Promise.resolve();

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveLastReturnedWith(1);
    expect(subscribe).toHaveBeenCalledOnce();
    expect(unsubscribe).not.toHaveBeenCalled();

    SESSION2: {
      renderer.startRender(callback);

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveLastReturnedWith(1);
      expect(subscribe).toHaveBeenCalledOnce();
      expect(unsubscribe).not.toHaveBeenCalled();
    }

    renderer.finalizeHooks();

    expect(subscribe).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('forces the update if the snapshot has been changed when subscribing the store', async () => {
    const renderer = new TestRenderer();
    const subscribers = new LinkedList<() => void>();
    let count = 0;

    const callback = vi.fn((session: RenderSession) => {
      const snapshot = session.use(SyncEnternalStore(subscribe, getSnapshot));

      session.useEffect(notifySubscribers, []);

      return snapshot;
    });
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

    SESSION1: {
      renderer.startRender(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveLastReturnedWith(0);
      expect(Array.from(subscribers)).toStrictEqual([expect.any(Function)]);
    }

    await Promise.resolve();

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveLastReturnedWith(1);
    expect(Array.from(subscribers)).toStrictEqual([expect.any(Function)]);

    SESSION2: {
      renderer.startRender(callback);

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveLastReturnedWith(1);
      expect(Array.from(subscribers)).toStrictEqual([expect.any(Function)]);
    }

    renderer.finalizeHooks();

    expect(callback).toHaveBeenCalledTimes(3);
    expect(Array.from(subscribers)).toStrictEqual([]);
  });

  it('should resubscribe the store if the subscribe function is changed', async () => {
    const renderer = new TestRenderer();

    const unsubscribe1 = vi.fn();
    const unsubscribe2 = vi.fn();
    const subscribe1 = vi.fn().mockReturnValue(unsubscribe1);
    const subscribe2 = vi.fn().mockReturnValue(unsubscribe2);
    const getSnapshot1 = () => 'foo';
    const getSnapshot2 = () => 'bar';

    SESSION1: {
      const snapshot = renderer.startRender((session) => {
        return session.use(SyncEnternalStore(subscribe1, getSnapshot1));
      });

      expect(snapshot).toBe('foo');
      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(0);
      expect(unsubscribe1).toHaveBeenCalledTimes(0);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);
    }

    SESSION2: {
      const snapshot = renderer.startRender((session) => {
        return session.use(SyncEnternalStore(subscribe2, getSnapshot1));
      });

      expect(snapshot).toBe('foo');
      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(1);
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);
    }

    SESSION3: {
      const snapshot = renderer.startRender((session) => {
        return session.use(SyncEnternalStore(subscribe2, getSnapshot2));
      });

      expect(snapshot).toBe('bar');
      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(1);
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);
    }

    renderer.finalizeHooks();

    expect(subscribe1).toHaveBeenCalledTimes(1);
    expect(subscribe2).toHaveBeenCalledTimes(1);
    expect(unsubscribe1).toHaveBeenCalledTimes(1);
    expect(unsubscribe2).toHaveBeenCalledTimes(1);
  });
});

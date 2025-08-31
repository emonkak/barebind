import { describe, expect, it, vi } from 'vitest';

import { LinkedList } from '@/collections/linked-list.js';
import {
  DeferredValue,
  EventCallback,
  LocalAtom,
  LocalComputed,
  SyncEnternalStore,
} from '@/extras/hooks.js';
import { Atom, type Signal } from '@/extras/signal.js';
import type { RenderSession } from '@/render-session.js';
import { RenderHelper } from '../../test-helpers.js';

describe('DeferredValue()', () => {
  it('returns the value deferred until next rendering', async () => {
    const helper = new RenderHelper();

    SESSION1: {
      const callback = vi.fn((session: RenderSession) => {
        return session.use(DeferredValue('foo'));
      });

      helper.startRender(callback);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveReturnedWith('foo');
    }

    SESSION2: {
      const callback = vi.fn((session: RenderSession) => {
        return session.use(DeferredValue('bar'));
      });

      helper.startRender(callback);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveReturnedWith('foo');
    }

    await Promise.resolve();

    SESSION2: {
      const callback = vi.fn((session: RenderSession) => {
        return session.use(DeferredValue('bar'));
      });

      helper.startRender(callback);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveReturnedWith('bar');
    }
  });

  it('returns the initial value if it is given', async () => {
    const helper = new RenderHelper();
    const callback = vi.fn((session: RenderSession) => {
      return session.use(DeferredValue('foo', 'bar'));
    });

    SESSION1: {
      helper.startRender(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveReturnedWith('bar');
    }

    await Promise.resolve();

    SESSION2: {
      helper.startRender(callback);

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveReturnedWith('foo');
    }
  });
});

describe('LocalAtom()', () => {
  it('returns a custom hook that creates an atom signal with no subscription', async () => {
    const callback = (session: RenderSession) => {
      const signal = session.use(LocalAtom(100));

      session.useEffect(() => {
        signal.value++;
      });

      return signal;
    };
    const helper = new RenderHelper();

    let stableSignal: Signal<number>;

    SESSION1: {
      stableSignal = helper.startRender(callback);

      expect(stableSignal.value).toBe(101);
    }

    SESSION2: {
      const signal = helper.startRender(callback);

      expect(signal).toBe(stableSignal);
      expect(signal.value).toBe(102);
    }
  });
});

describe('LocalComputed()', () => {
  it('returns a custom hook that creates a computed signal with no subscription', async () => {
    const foo = new Atom(1);
    const bar = new Atom(2);
    const baz = new Atom(3);
    const callback = (session: RenderSession) => {
      const signal = session.use(
        LocalComputed((foo, bar, baz) => foo + bar + baz, [foo, bar, baz]),
      );

      session.useEffect(() => {
        foo.value++;
      });

      return signal;
    };
    const helper = new RenderHelper();

    let stableSignal: Signal<number>;

    SESSION1: {
      stableSignal = helper.startRender(callback);

      expect(stableSignal.value).toBe(7);
    }

    SESSION2: {
      const signal = helper.startRender(callback);

      expect(signal).toBe(stableSignal);
      expect(signal.value).toBe(8);
    }
  });
});

describe('useEventCallback()', () => {
  it('returns a stable callback', () => {
    const helper = new RenderHelper();

    const callback1 = vi.fn();
    const callback2 = vi.fn();
    let stableCallback: () => void;

    SESSION1: {
      stableCallback = helper.startRender((session) => {
        const callback = session.use(EventCallback(callback1));

        session.useEffect(() => {
          callback();
        });

        return callback;
      });

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).not.toHaveBeenCalled();
    }

    SESSION1: {
      const callback = helper.startRender((session) => {
        const callback = session.use(EventCallback(callback2));

        session.useEffect(() => {
          callback();
        });

        return callback;
      });

      expect(callback).toBe(stableCallback);
      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
    }
  });
});

describe('useSyncExternalStore()', () => {
  it('forces the update if the snapshot has been changed when updating the snapshot', async () => {
    const helper = new RenderHelper();
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
      helper.startRender(callback);

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
      helper.startRender(callback);

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveLastReturnedWith(1);
      expect(subscribe).toHaveBeenCalledOnce();
      expect(unsubscribe).not.toHaveBeenCalled();
    }

    helper.finalizeHooks();

    expect(subscribe).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('forces the update if the snapshot has been changed when subscribing the store', async () => {
    const helper = new RenderHelper();
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
      helper.startRender(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveLastReturnedWith(0);
      expect(Array.from(subscribers)).toStrictEqual([expect.any(Function)]);
    }

    await Promise.resolve();

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveLastReturnedWith(1);
    expect(Array.from(subscribers)).toStrictEqual([expect.any(Function)]);

    SESSION2: {
      helper.startRender(callback);

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveLastReturnedWith(1);
      expect(Array.from(subscribers)).toStrictEqual([expect.any(Function)]);
    }

    helper.finalizeHooks();

    expect(callback).toHaveBeenCalledTimes(3);
    expect(Array.from(subscribers)).toStrictEqual([]);
  });

  it('should resubscribe the store if the subscribe function is changed', async () => {
    const helper = new RenderHelper();

    const unsubscribe1 = vi.fn();
    const unsubscribe2 = vi.fn();
    const subscribe1 = vi.fn().mockReturnValue(unsubscribe1);
    const subscribe2 = vi.fn().mockReturnValue(unsubscribe2);
    const getSnapshot1 = () => 'foo';
    const getSnapshot2 = () => 'bar';

    SESSION1: {
      const snapshot = helper.startRender((session) => {
        return session.use(SyncEnternalStore(subscribe1, getSnapshot1));
      });

      expect(snapshot).toBe('foo');
      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(0);
      expect(unsubscribe1).toHaveBeenCalledTimes(0);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);
    }

    SESSION2: {
      const snapshot = helper.startRender((session) => {
        return session.use(SyncEnternalStore(subscribe2, getSnapshot1));
      });

      expect(snapshot).toBe('foo');
      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(1);
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);
    }

    SESSION3: {
      const snapshot = helper.startRender((session) => {
        return session.use(SyncEnternalStore(subscribe2, getSnapshot2));
      });

      expect(snapshot).toBe('bar');
      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(1);
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);
    }

    helper.finalizeHooks();

    expect(subscribe1).toHaveBeenCalledTimes(1);
    expect(subscribe2).toHaveBeenCalledTimes(1);
    expect(unsubscribe1).toHaveBeenCalledTimes(1);
    expect(unsubscribe2).toHaveBeenCalledTimes(1);
  });
});

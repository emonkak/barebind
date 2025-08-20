import { describe, expect, it, vi } from 'vitest';
import {
  DeferredValue,
  EffectEvent,
  LocalAtom,
  LocalComputed,
  SyncEnternalStore,
} from '@/extras/hooks.js';
import { Atom, type Signal } from '@/extras/signal.js';
import {
  createRenderSession,
  disposeRenderSession,
  flushRenderSession,
} from '../../session-utils.js';

describe('DeferredValue()', () => {
  it('returns the value deferred until next rendering', async () => {
    const session = createRenderSession();
    const value1 = 'foo';
    const value2 = 'bar';

    const scheduleUpdateSpy = vi.spyOn(session['_context'], 'scheduleUpdate');

    SESSION1: {
      expect(session.use(DeferredValue(value1))).toBe(value1);

      flushRenderSession(session);
    }

    expect(session.isUpdatePending()).toBe(false);
    expect(await session.waitForUpdate()).toBe(0);
    expect(scheduleUpdateSpy).not.toHaveBeenCalled();

    SESSION2: {
      expect(session.use(DeferredValue(value2))).toBe(value1);

      flushRenderSession(session);
    }

    expect(session.isUpdatePending()).toBe(true);
    expect(await session.waitForUpdate()).toBe(1);
    expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    expect(scheduleUpdateSpy).toHaveBeenCalledWith(session['_coroutine'], {
      priority: 'background',
    });

    SESSION3: {
      expect(session.use(DeferredValue(value2))).toBe(value2);

      flushRenderSession(session);
    }

    expect(session.isUpdatePending()).toBe(false);
    expect(await session.waitForUpdate()).toBe(0);
    expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
  });

  it('returns the initial value if it is given', () => {
    const session = createRenderSession();
    const value1 = 'foo';
    const value2 = 'bar';

    const scheduleUpdateSpy = vi.spyOn(session['_context'], 'scheduleUpdate');

    SESSION1: {
      expect(session.use(DeferredValue(value2, value1))).toBe(value1);

      flushRenderSession(session);
    }

    expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    expect(scheduleUpdateSpy).toHaveBeenCalledWith(session['_coroutine'], {
      priority: 'background',
    });

    SESSION2: {
      expect(session.use(DeferredValue(value2, value1))).toBe(value2);

      flushRenderSession(session);
    }

    expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
  });
});

describe('LocalAtom()', () => {
  it('returns a custom hook that creates an atom signal with no subscription', async () => {
    const session = createRenderSession();

    let initialSignal: Atom<number>;

    SESSION1: {
      initialSignal = session.use(LocalAtom(100));

      expect(initialSignal.value).toBe(100);

      session.useEffect(() => {
        initialSignal.value++;
      }, []);

      flushRenderSession(session);
    }

    await Promise.resolve();

    expect(await session.waitForUpdate()).toBe(0);

    SESSION2: {
      const signal = session.use(LocalAtom(100));

      expect(signal).toBe(initialSignal);
      expect(signal.value).toBe(101);

      session.useEffect(() => {
        signal.value++;
      }, []);

      flushRenderSession(session);
    }

    await Promise.resolve();

    expect(await session.waitForUpdate()).toBe(0);

    SESSION3: {
      const signal = session.use(LocalAtom(200));

      expect(signal).toBe(initialSignal);
      expect(signal.value).toBe(101);

      session.useEffect(() => {
        signal.value++;
      }, []);

      flushRenderSession(session);
    }
  });
});

describe('LocalComputed()', () => {
  it('returns a custom hook that creates a computed signal with no subscription', async () => {
    const session = createRenderSession();
    const foo = new Atom(1);
    const bar = new Atom(2);
    const baz = new Atom(3);

    let initialSignal: Signal<number>;

    SESSION1: {
      const signal = session.use(
        LocalComputed((foo, bar, baz) => foo + bar + baz, [foo, bar, baz]),
      );

      expect(signal.value).toBe(6);

      session.useEffect(() => {
        foo.value++;
      }, []);

      flushRenderSession(session);

      initialSignal = signal;
    }

    await Promise.resolve();

    expect(await session.waitForUpdate()).toBe(0);

    SESSION2: {
      const signal = session.use(
        LocalComputed((foo, bar, baz) => foo + bar + baz, [foo, bar, baz]),
      );

      expect(signal).toBe(initialSignal);
      expect(signal.value).toBe(7);

      session.useEffect(() => {
        foo.value++;
      }, []);

      flushRenderSession(session);
    }

    await Promise.resolve();

    expect(await session.waitForUpdate()).toBe(0);

    SESSION3: {
      const signal = session.use(
        LocalComputed((foo, bar) => foo + bar, [foo, bar]),
      );

      expect(signal).not.toBe(initialSignal);
      expect(signal.value).toBe(4);

      session.useEffect(() => {
        foo.value++;
      }, []);

      flushRenderSession(session);
    }
  });
});

describe('useEffectEvent()', () => {
  it('returns a stable callback', () => {
    const session = createRenderSession();

    const callback1 = vi.fn();
    const callback2 = vi.fn();
    let stableCallback: () => void;

    SESSION1: {
      stableCallback = session.use(EffectEvent(callback1));

      flushRenderSession(session);

      stableCallback();

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).not.toHaveBeenCalled();
    }

    SESSION2: {
      expect(session.use(EffectEvent(callback2))).toBe(stableCallback);

      flushRenderSession(session);

      stableCallback();

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
    }
  });
});

describe('useSyncExternalStore()', () => {
  it('forces the update if the snapshot has been changed when updating the snapshot', async () => {
    const session = createRenderSession();
    let count = 0;

    const unsubscribe = vi.fn();
    const subscribe = vi.fn().mockReturnValue(unsubscribe);
    const getSnapshot = () => count;

    SESSION1: {
      expect(session.use(SyncEnternalStore(subscribe, getSnapshot))).toBe(0);

      session.useInsertionEffect(() => {
        count++;
      }, []);

      flushRenderSession(session);
    }

    expect(session.isUpdatePending()).toBe(true);
    expect(await session.waitForUpdate()).toBe(1);
    expect(subscribe).toHaveBeenCalledOnce();
    expect(unsubscribe).not.toHaveBeenCalled();

    SESSION2: {
      expect(session.use(SyncEnternalStore(subscribe, getSnapshot))).toBe(1);

      session.useInsertionEffect(() => {
        count++;
      }, []);

      flushRenderSession(session);
    }

    expect(session.isUpdatePending()).toBe(false);
    expect(await session.waitForUpdate()).toBe(0);
    expect(subscribe).toHaveBeenCalledOnce();
    expect(unsubscribe).not.toHaveBeenCalled();

    disposeRenderSession(session);

    expect(subscribe).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('forces the update if the snapshot has been changed when subscribing the store', async () => {
    const session = createRenderSession();
    const subscribers = new Set<() => void>();
    let snapshot = 0;

    const subscribe = (subscriber: () => void) => {
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    };
    const getSnapshot = () => snapshot;
    const notifySubscribers = () => {
      snapshot++;
      for (const subscriber of subscribers) {
        subscriber();
      }
    };

    SESSION1: {
      expect(session.use(SyncEnternalStore(subscribe, getSnapshot))).toBe(0);

      session.useEffect(notifySubscribers, []);

      flushRenderSession(session);
    }

    expect(session.isUpdatePending()).toBe(true);
    expect(await session.waitForUpdate()).toBe(1);
    expect(subscribers.size).toBe(1);

    SESSION2: {
      expect(session.use(SyncEnternalStore(subscribe, getSnapshot))).toBe(1);

      session.useEffect(notifySubscribers, []);

      flushRenderSession(session);
    }

    expect(session.isUpdatePending()).toBe(false);
    expect(await session.waitForUpdate()).toBe(0);

    disposeRenderSession(session);

    expect(subscribers.size).toBe(0);
  });

  it('should resubscribe the store if the subscribe function is changed', async () => {
    const session = createRenderSession();

    const unsubscribe1 = vi.fn();
    const unsubscribe2 = vi.fn();
    const subscribe1 = vi.fn().mockReturnValue(unsubscribe1);
    const subscribe2 = vi.fn().mockReturnValue(unsubscribe2);
    const getSnapshot1 = () => 'foo';
    const getSnapshot2 = () => 'bar';

    SESSION1: {
      expect(session.use(SyncEnternalStore(subscribe1, getSnapshot1))).toBe(
        'foo',
      );

      flushRenderSession(session);
    }

    expect(session.isUpdatePending()).toBe(false);
    expect(await session.waitForUpdate()).toBe(0);
    expect(subscribe1).toHaveBeenCalledTimes(1);
    expect(subscribe2).toHaveBeenCalledTimes(0);
    expect(unsubscribe1).toHaveBeenCalledTimes(0);
    expect(unsubscribe2).toHaveBeenCalledTimes(0);

    SESSION2: {
      expect(session.use(SyncEnternalStore(subscribe2, getSnapshot1))).toBe(
        'foo',
      );

      flushRenderSession(session);
    }

    expect(session.isUpdatePending()).toBe(false);
    expect(await session.waitForUpdate()).toBe(0);
    expect(subscribe1).toHaveBeenCalledTimes(1);
    expect(subscribe2).toHaveBeenCalledTimes(1);
    expect(unsubscribe1).toHaveBeenCalledTimes(1);
    expect(unsubscribe2).toHaveBeenCalledTimes(0);

    SESSION3: {
      expect(session.use(SyncEnternalStore(subscribe2, getSnapshot2))).toBe(
        'bar',
      );

      flushRenderSession(session);
    }

    expect(session.isUpdatePending()).toBe(false);
    expect(await session.waitForUpdate()).toBe(0);
    expect(subscribe1).toHaveBeenCalledTimes(1);
    expect(subscribe2).toHaveBeenCalledTimes(1);
    expect(unsubscribe1).toHaveBeenCalledTimes(1);
    expect(unsubscribe2).toHaveBeenCalledTimes(0);

    disposeRenderSession(session);

    expect(subscribe1).toHaveBeenCalledTimes(1);
    expect(subscribe2).toHaveBeenCalledTimes(1);
    expect(unsubscribe1).toHaveBeenCalledTimes(1);
    expect(unsubscribe2).toHaveBeenCalledTimes(1);
  });
});

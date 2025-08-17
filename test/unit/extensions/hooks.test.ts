import { describe, expect, it, vi } from 'vitest';
import {
  DeferredValue,
  EffectEvent,
  SyncEnternalStore,
} from '@/extensions/hooks.js';
import {
  createSession,
  disposeSession,
  flushSession,
} from '../../session-utils.js';

describe('DeferredValue()', async () => {
  it('returns the value deferred until next rendering', async () => {
    const session = createSession();
    const value1 = 'foo';
    const value2 = 'bar';

    const scheduleUpdateSpy = vi.spyOn(session['_context'], 'scheduleUpdate');

    SESSION1: {
      expect(session.use(DeferredValue(value1))).toBe(value1);

      flushSession(session);
    }

    expect(session.isUpdatePending()).toBe(false);
    expect(await session.waitForUpdate()).toBe(0);
    expect(scheduleUpdateSpy).not.toHaveBeenCalled();

    SESSION2: {
      expect(session.use(DeferredValue(value2))).toBe(value1);

      flushSession(session);
    }

    expect(session.isUpdatePending()).toBe(true);
    expect(await session.waitForUpdate()).toBe(1);
    expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    expect(scheduleUpdateSpy).toHaveBeenCalledWith(session['_coroutine'], {
      priority: 'background',
    });

    SESSION3: {
      expect(session.use(DeferredValue(value2))).toBe(value2);

      flushSession(session);
    }

    expect(session.isUpdatePending()).toBe(false);
    expect(await session.waitForUpdate()).toBe(0);
    expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
  });

  it('returns the initial value if it is given', () => {
    const session = createSession();
    const value1 = 'foo';
    const value2 = 'bar';

    const scheduleUpdateSpy = vi.spyOn(session['_context'], 'scheduleUpdate');

    SESSION1: {
      expect(session.use(DeferredValue(value2, value1))).toBe(value1);

      flushSession(session);
    }

    expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    expect(scheduleUpdateSpy).toHaveBeenCalledWith(session['_coroutine'], {
      priority: 'background',
    });

    SESSION2: {
      expect(session.use(DeferredValue(value2, value1))).toBe(value2);

      flushSession(session);
    }

    expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
  });
});

describe('useEffectEvent()', () => {
  it('returns a stable callback', () => {
    const session = createSession();

    const callback1 = vi.fn();
    const callback2 = vi.fn();
    let stableCallback: () => void;

    SESSION1: {
      stableCallback = session.use(EffectEvent(callback1));

      flushSession(session);

      stableCallback();

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).not.toHaveBeenCalled();
    }

    SESSION2: {
      expect(session.use(EffectEvent(callback2))).toBe(stableCallback);

      flushSession(session);

      stableCallback();

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
    }
  });
});

describe('useSyncExternalStore()', () => {
  it('forces the update if the snapshot has been changed when updating the snapshot', async () => {
    const session = createSession();
    let count = 0;

    const unsubscribe = vi.fn();
    const subscribe = vi.fn().mockReturnValue(unsubscribe);
    const getSnapshot = () => count;

    SESSION1: {
      expect(session.use(SyncEnternalStore(subscribe, getSnapshot))).toBe(0);

      session.useInsertionEffect(() => {
        count++;
      }, []);

      flushSession(session);
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

      flushSession(session);
    }

    expect(session.isUpdatePending()).toBe(false);
    expect(await session.waitForUpdate()).toBe(0);
    expect(subscribe).toHaveBeenCalledOnce();
    expect(unsubscribe).not.toHaveBeenCalled();

    disposeSession(session);

    expect(subscribe).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('forces the update if the snapshot has been changed when subscribing the store', async () => {
    const session = createSession();
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

      flushSession(session);
    }

    expect(session.isUpdatePending()).toBe(true);
    expect(await session.waitForUpdate()).toBe(1);
    expect(subscribers.size).toBe(1);

    SESSION2: {
      expect(session.use(SyncEnternalStore(subscribe, getSnapshot))).toBe(1);

      session.useEffect(notifySubscribers, []);

      flushSession(session);
    }

    expect(session.isUpdatePending()).toBe(false);
    expect(await session.waitForUpdate()).toBe(0);

    disposeSession(session);

    expect(subscribers.size).toBe(0);
  });

  it('should resubscribe the store if the subscribe function is changed', async () => {
    const session = createSession();

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

      flushSession(session);
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

      flushSession(session);
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

      flushSession(session);
    }

    expect(session.isUpdatePending()).toBe(false);
    expect(await session.waitForUpdate()).toBe(0);
    expect(subscribe1).toHaveBeenCalledTimes(1);
    expect(subscribe2).toHaveBeenCalledTimes(1);
    expect(unsubscribe1).toHaveBeenCalledTimes(1);
    expect(unsubscribe2).toHaveBeenCalledTimes(0);

    disposeSession(session);

    expect(subscribe1).toHaveBeenCalledTimes(1);
    expect(subscribe2).toHaveBeenCalledTimes(1);
    expect(unsubscribe1).toHaveBeenCalledTimes(1);
    expect(unsubscribe2).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from 'vitest';

import { Resource, Suspend } from '@/addons/suspense.js';
import { TestRenderer } from '../../test-renderer.js';

describe('Resource', () => {
  it('creates a RawResource using the given fetch function', async () => {
    const renderer = new TestRenderer();
    const fetchFn = vi.fn(() => Promise.resolve('ok'));

    const suspend = renderer.startRender((session) => {
      return session.use(Resource(fetchFn));
    });

    expect(await suspend).toBe('ok');
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('returns the same resource instance across renders with same dependencies', async () => {
    const renderer = new TestRenderer();
    const fetchFn = vi.fn(() => Promise.resolve('ok'));

    const suspend1 = renderer.startRender((session) => {
      return session.use(Resource(fetchFn));
    });
    const suspend2 = renderer.startRender((session) => {
      return session.use(Resource(fetchFn));
    });

    expect(suspend1).toBe(suspend2);
    expect(await suspend1).toBe('ok');
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('recreates the suspend when dependencies change', async () => {
    const renderer = new TestRenderer();
    const fetchFn = vi
      .fn()
      .mockReturnValueOnce(Promise.resolve('foo'))
      .mockReturnValueOnce(Promise.resolve('bar'));

    const suspend1 = renderer.startRender((session) => {
      return session.use(Resource(fetchFn, ['foo']));
    });
    const suspend2 = renderer.startRender((session) => {
      return session.use(Resource(fetchFn, ['bar']));
    });

    expect(suspend1).not.toBe(suspend2);
    expect(await suspend1).toBe('foo');
    expect(await suspend2).toBe('bar');
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
});

describe('Suspend', () => {
  it('starts in pending state', () => {
    const controller = new AbortController();
    const promise = new Promise(() => {});
    const suspend = new Suspend(promise, controller);

    expect(suspend.status).toBe('pending');
    expect(suspend.value).toBe(undefined);
    expect(suspend.reason).toBe(undefined);
  });

  it('transitions to fulfilled when the promise resolves', async () => {
    const promise = Promise.resolve(42);
    const controller = new AbortController();
    const suspend = new Suspend(promise, controller);

    await promise;

    expect(suspend.status).toBe('fulfilled');
    expect(suspend.value).toBe(42);
    expect(suspend.reason).toBe(undefined);
  });

  it('transitions to rejected when the promise rejects', async () => {
    const error = new Error('fail');
    const promise = Promise.reject(error);
    const controller = new AbortController();
    const suspend = new Suspend(promise, controller);

    try {
      await promise;
    } catch {
      // intentionally ignored
    }

    expect(suspend.status).toBe('rejected');
    expect(suspend.reason).toBe(error);
  });

  it('becomes rejected when aborted while pending', () => {
    const promise = new Promise(() => {});
    const controller = new AbortController();
    const suspend = new Suspend(promise, controller);

    suspend.abort();

    expect(suspend.status).toBe('aborted');
    expect(suspend.reason).toBe(controller.signal.reason);
  });

  it('does not abort when already fulfilled', async () => {
    const promise = Promise.resolve('ok');
    const controller = new AbortController();
    const suspend = new Suspend(promise, controller);

    await promise;

    suspend.abort();

    expect(suspend.status).toBe('fulfilled');
    expect(suspend.value).toBe('ok');
  });

  describe('then()', () => {
    it('resolves like a Promise via then()', async () => {
      const promise = Promise.resolve(10);
      const controller = new AbortController();
      const suspend = new Suspend(promise, controller);

      expect(await suspend.then((x) => x)).toBe(10);
      expect(await suspend.then((x) => x * 2)).toBe(20);
    });

    it('rejects like a Promise via then()', async () => {
      const error = new Error('fail');
      const promise = Promise.reject(error);
      const controller = new AbortController();
      const suspend = new Suspend(promise, controller);

      await expect(
        suspend.then(
          () => {},
          (reason) => Promise.reject(reason),
        ),
      ).rejects.toBe(error);
    });

    it('rejects when aborted while pending', async () => {
      const promise = new Promise(() => {});
      const controller = new AbortController();
      const suspend = new Suspend(promise, controller);

      const resultPromise = suspend.then(
        () => {},
        (reason) => Promise.reject(reason),
      );

      suspend.abort();

      await expect(resultPromise).rejects.toBe(controller.signal.reason);
    });

    it('rejects when aborted', async () => {
      const promise = Promise.resolve();
      const controller = new AbortController();
      const suspend = new Suspend(promise, controller);

      suspend.abort();

      await expect(suspend).rejects.toBe(controller.signal.reason);
    });
  });

  describe('unwrap()', () => {
    it('throws the suspend itself when pending', () => {
      const promise = new Promise(() => {});
      const controller = new AbortController();
      const suspend = new Suspend(promise, controller);

      expect(() => suspend.unwrap()).toThrow(expect.exact(suspend) as any);
    });

    it('throws the rejection reason when rejected', async () => {
      const controller = new AbortController();
      const error = new Error('boom');
      const promise = Promise.reject(error);
      const suspend = new Suspend(promise, controller);

      try {
        await promise;
      } catch {
        // intentionally ignored
      }

      expect(() => suspend.unwrap()).toThrow(error);
    });

    it('returns the value when fulfilled', async () => {
      const controller = new AbortController();
      const promise = Promise.resolve('value');
      const suspend = new Suspend(promise, controller);

      await promise;

      expect(suspend.unwrap()).toBe('value');
    });
  });
});

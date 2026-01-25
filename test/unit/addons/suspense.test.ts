import { describe, expect, it, vi } from 'vitest';

import { RawResourceHandle, Resource } from '@/addons/suspense.js';
import { TestRenderer } from '../../test-renderer.js';

describe('Resource', () => {
  it('creates a RawResource using the given fetch function', async () => {
    const renderer = new TestRenderer();
    const fetchFn = vi.fn(() => Promise.resolve('ok'));

    const resource = renderer.startRender((session) => {
      return session.use(Resource(fetchFn));
    });

    expect(await resource).toBe('ok');
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('returns the same resource instance across renders with same dependencies', async () => {
    const renderer = new TestRenderer();
    const fetchFn = vi.fn(() => Promise.resolve('ok'));

    const resource1 = renderer.startRender((session) => {
      return session.use(Resource(fetchFn));
    });
    const resource2 = renderer.startRender((session) => {
      return session.use(Resource(fetchFn));
    });

    expect(resource1).toBe(resource2);
    expect(await resource1).toBe('ok');
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('recreates the resource when dependencies change', async () => {
    const renderer = new TestRenderer();
    const fetchFn = vi
      .fn()
      .mockReturnValueOnce(Promise.resolve('foo'))
      .mockReturnValueOnce(Promise.resolve('bar'));

    const resource1 = renderer.startRender((session) => {
      return session.use(Resource(fetchFn, ['foo']));
    });
    const resource2 = renderer.startRender((session) => {
      return session.use(Resource(fetchFn, ['bar']));
    });

    expect(resource1).not.toBe(resource2);
    expect(await resource1).toBe('foo');
    expect(await resource2).toBe('bar');
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
});

describe('RawResourceHandle', () => {
  it('starts in pending state', () => {
    const controller = new AbortController();
    const promise = new Promise(() => {});
    const resource = new RawResourceHandle(promise, controller);

    expect(resource.status).toBe('pending');
    expect(resource.value).toBe(undefined);
    expect(resource.reason).toBe(undefined);
  });

  it('transitions to fulfilled when the promise resolves', async () => {
    const promise = Promise.resolve(42);
    const controller = new AbortController();
    const resource = new RawResourceHandle(promise, controller);

    await promise;

    expect(resource.status).toBe('fulfilled');
    expect(resource.value).toBe(42);
    expect(resource.reason).toBe(undefined);
  });

  it('transitions to rejected when the promise rejects', async () => {
    const error = new Error('fail');
    const promise = Promise.reject(error);
    const controller = new AbortController();
    const resource = new RawResourceHandle(promise, controller);

    try {
      await promise;
    } catch {
      // intentionally ignored
    }

    expect(resource.status).toBe('rejected');
    expect(resource.reason).toBe(error);
  });

  it('becomes rejected when aborted while pending', () => {
    const promise = new Promise(() => {});
    const controller = new AbortController();
    const resource = new RawResourceHandle(promise, controller);

    resource.dispose();

    expect(resource.status).toBe('aborted');
    expect(resource.reason).toBe(controller.signal.reason);
  });

  it('does not abort when already fulfilled', async () => {
    const promise = Promise.resolve('ok');
    const controller = new AbortController();
    const resource = new RawResourceHandle(promise, controller);

    await promise;

    resource.dispose();

    expect(resource.status).toBe('fulfilled');
    expect(resource.value).toBe('ok');
  });

  describe('then()', () => {
    it('resolves like a Promise via then()', async () => {
      const promise = Promise.resolve(10);
      const controller = new AbortController();
      const resource = new RawResourceHandle(promise, controller);

      expect(await resource.then((x) => x)).toBe(10);
      expect(await resource.then((x) => x * 2)).toBe(20);
    });

    it('rejects like a Promise via then()', async () => {
      const error = new Error('fail');
      const promise = Promise.reject(error);
      const controller = new AbortController();
      const resource = new RawResourceHandle(promise, controller);

      await expect(
        resource.then(
          () => {},
          (reason) => Promise.reject(reason),
        ),
      ).rejects.toBe(error);
    });

    it('rejects when aborted while pending', async () => {
      const promise = new Promise(() => {});
      const controller = new AbortController();
      const resource = new RawResourceHandle(promise, controller);

      const resultPromise = resource.then(
        () => {},
        (reason) => Promise.reject(reason),
      );

      resource.dispose();

      await expect(resultPromise).rejects.toBe(controller.signal.reason);
    });

    it('rejects when aborted', async () => {
      const promise = Promise.resolve();
      const controller = new AbortController();
      const resource = new RawResourceHandle(promise, controller);

      resource.dispose();

      await expect(resource).rejects.toBe(controller.signal.reason);
    });
  });

  describe('unwrap()', () => {
    it('throws the resource itself when pending', () => {
      const promise = new Promise(() => {});
      const controller = new AbortController();
      const resource = new RawResourceHandle(promise, controller);

      expect(() => resource.unwrap()).toThrow(expect.exact(resource) as any);
    });

    it('throws the rejection reason when rejected', async () => {
      const controller = new AbortController();
      const error = new Error('boom');
      const promise = Promise.reject(error);
      const resource = new RawResourceHandle(promise, controller);

      try {
        await promise;
      } catch {
        // intentionally ignored
      }

      expect(() => resource.unwrap()).toThrow(error);
    });

    it('returns the value when fulfilled', async () => {
      const controller = new AbortController();
      const promise = Promise.resolve('value');
      const resource = new RawResourceHandle(promise, controller);

      await promise;

      expect(resource.unwrap()).toBe('value');
    });
  });
});

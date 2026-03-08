import { describe, expect, it, vi } from 'vitest';

import { Suspend } from '@/addons/suspense/suspend.js';

describe('Suspend', () => {
  describe('await()', () => {
    it('starts in pending state', () => {
      const controller = new AbortController();
      const promise = new Promise(() => {});
      const suspend = Suspend.await(promise, controller);

      expect(suspend.status).toBe('pending');
      expect(suspend.value).toBe(undefined);
      expect(suspend.reason).toBe(undefined);
    });

    it('transitions to fulfilled when the promise resolves', async () => {
      const promise = Promise.resolve('ok');
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      await promise;

      expect(suspend.status).toBe('fulfilled');
      expect(suspend.value).toBe('ok');
      expect(suspend.reason).toBe(undefined);
    });

    it('transitions to rejected when the promise rejects', async () => {
      const error = new Error('fail');
      const promise = Promise.reject(error);
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

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
      const suspend = Suspend.await(promise, controller);
      const error = new Error('abort');

      suspend.abort(error);

      expect(suspend.status).toBe('aborted');
      expect(suspend.reason).toBe(error);
      expect(controller.signal.aborted).toBe(true);
    });
  });

  describe('catch()', () => {
    it('should handle rejection and return the fallback value', async () => {
      const error = new Error('fail');
      const suspend = Suspend.await(
        Promise.reject(error),
        new AbortController(),
      );
      const result = await suspend.catch(() => 'fallback');

      expect(result).toBe('fallback');
    });
  });

  describe('finally', () => {
    it('should call the callback regardless of fulfillment', async () => {
      const suspend = Suspend.await(
        Promise.resolve('ok'),
        new AbortController(),
      );
      const callback = vi.fn();
      const result = await suspend.finally(callback);

      expect(callback).toHaveBeenCalledOnce();
      expect(result).toBe('ok');
    });
  });

  describe('then()', () => {
    it('resolves like a Promise via then()', async () => {
      const suspend = Suspend.await(Promise.resolve(10), new AbortController());

      expect(await suspend.then((x) => x)).toBe(10);
      expect(await suspend.then((x) => x * 2)).toBe(20);
    });

    it('rejects like a Promise via then()', async () => {
      const error = new Error('fail');
      const suspend = Suspend.await(
        Promise.reject(error),
        new AbortController(),
      );

      await expect(
        suspend.then(
          () => {},
          (reason) => Promise.reject(reason),
        ),
      ).rejects.toBe(error);
    });

    it('rejects when aborted while pending', async () => {
      const controller = new AbortController();
      const suspend = Suspend.await(new Promise(() => {}), controller);
      const derivedPromise = suspend.then(
        () => {},
        (reason) => Promise.reject(reason),
      );

      suspend.abort();

      await expect(derivedPromise).rejects.toBe(controller.signal.reason);
      expect(controller.signal.aborted).toBe(true);
    });

    it('rejects when aborted', async () => {
      const controller = new AbortController();
      const suspend = Suspend.await(Promise.resolve(), controller);

      suspend.abort();

      await expect(suspend).rejects.toBe(controller.signal.reason);
      expect(controller.signal.aborted).toBe(true);
    });
  });

  describe('unwrap()', () => {
    it('throws the suspend itself when pending', () => {
      const suspend = Suspend.await(
        new Promise(() => {}),
        new AbortController(),
      );

      expect(() => suspend.unwrap()).toThrow(expect.exact(suspend) as any);
    });

    it('throws the rejection reason when rejected', async () => {
      const error = new Error('fail');
      const promise = Promise.reject(error);
      const suspend = Suspend.await(promise, new AbortController());

      try {
        await promise;
      } catch {
        // intentionally ignored
      }

      expect(() => suspend.unwrap()).toThrow(error);
    });

    it('returns the value when fulfilled', async () => {
      const promise = Promise.resolve('ok');
      const suspend = Suspend.await(promise, new AbortController());

      await promise;

      expect(suspend.unwrap()).toBe('ok');
    });
  });

  describe('abort()', () => {
    it('does not affect when not pending', async () => {
      const promise = Promise.resolve('ok');
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      await promise;

      suspend.abort();

      expect(suspend.status).toBe('fulfilled');
      expect(suspend.value).toBe('ok');
      expect(controller.signal.aborted).toBe(true);
    });

    it('does not affect when transitioned to fulfilled after abort', async () => {
      const promise = Promise.resolve('ok');
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      suspend.abort();

      await expect(promise).resolves.toBe('ok');
      await expect(suspend).rejects.toThrow(controller.signal.reason);

      expect(suspend.status).toBe('aborted');
      expect(controller.signal.aborted).toBe(true);
    });

    it('does not affect when transitioned to rejected after abort', async () => {
      const error = new Error('fail');
      const promise = Promise.reject(error);
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      suspend.abort();

      await expect(promise).rejects.toThrow(error);
      await expect(suspend).rejects.toThrow(controller.signal.reason);

      expect(suspend.status).toBe('aborted');
      expect(controller.signal.aborted).toBe(true);
    });
  });
});

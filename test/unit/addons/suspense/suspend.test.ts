import { describe, expect, it } from 'vitest';

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
      const promise = Promise.resolve(42);
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      await promise;

      expect(suspend.status).toBe('fulfilled');
      expect(suspend.value).toBe(42);
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

      suspend.abort();

      expect(suspend.status).toBe('aborted');
      expect(suspend.reason).toBe(controller.signal.reason);
      expect(controller.signal.aborted).toBe(true);
    });

    it('does not abort when already fulfilled', async () => {
      const promise = Promise.resolve('ok');
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      await promise;

      suspend.abort();

      expect(suspend.status).toBe('fulfilled');
      expect(suspend.value).toBe('ok');
      expect(controller.signal.aborted).toBe(false);
    });
  });

  describe('then()', () => {
    it('resolves like a Promise via then()', async () => {
      const promise = Promise.resolve(10);
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      expect(await suspend.then((x) => x)).toBe(10);
      expect(await suspend.then((x) => x * 2)).toBe(20);
    });

    it('rejects like a Promise via then()', async () => {
      const error = new Error('fail');
      const promise = Promise.reject(error);
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

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
      const suspend = Suspend.await(promise, controller);

      const derivedPromise = suspend.then(
        () => {},
        (reason) => Promise.reject(reason),
      );

      suspend.abort();

      await expect(derivedPromise).rejects.toBe(controller.signal.reason);
      expect(controller.signal.aborted).toBe(true);
    });

    it('rejects when aborted', async () => {
      const promise = Promise.resolve();
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      suspend.abort();

      await expect(suspend).rejects.toBe(controller.signal.reason);
      expect(controller.signal.aborted).toBe(true);
    });
  });

  describe('unwrap()', () => {
    it('throws the suspend itself when pending', () => {
      const promise = new Promise(() => {});
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      expect(() => suspend.unwrap()).toThrow(expect.exact(suspend) as any);
    });

    it('throws the rejection reason when rejected', async () => {
      const controller = new AbortController();
      const error = new Error('boom');
      const promise = Promise.reject(error);
      const suspend = Suspend.await(promise, controller);

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
      const suspend = Suspend.await(promise, controller);

      await promise;

      expect(suspend.unwrap()).toBe('value');
    });
  });
});

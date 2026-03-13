import { describe, expect, it, vi } from 'vitest';

import { Suspend } from '@/addons/suspense/suspend.js';

describe('Suspend', () => {
  describe('await()', () => {
    it('starts in pending state by default', () => {
      const controller = new AbortController();
      const promise = new Promise(() => {});
      const suspend = Suspend.await(promise, controller);

      expect(suspend.status).toBe('pending');
      expect(suspend.value).toBe(undefined);
      expect(suspend.reason).toBe(undefined);
      expect(suspend.signal).toBe(controller.signal);
    });

    it('starts in aborted state when the signal was already aborted', () => {
      const controller = new AbortController();
      const promise = new Promise(() => {});

      controller.abort();

      const suspend = Suspend.await(promise, controller);

      expect(suspend.status).toBe('aborted');
      expect(suspend.reason).toBe(controller.signal.reason);
      expect(suspend.signal).toBe(controller.signal);
    });

    it('starts aborted if the signal is already aborted', () => {
      const controller = new AbortController();
      const promise = new Promise(() => {});
      const suspend = Suspend.await(promise, controller);

      expect(suspend.status).toBe('pending');
      expect(suspend.value).toBe(undefined);
      expect(suspend.reason).toBe(undefined);
      expect(suspend.signal).toBe(controller.signal);
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
      expect(suspend.value).toBe(undefined);
      expect(suspend.reason).toBe(error);
    });

    it('transitions to rejected when the signal aborts while pending', () => {
      const controller = new AbortController();
      const suspend = Suspend.await(new Promise(() => {}), controller);
      const error = new Error('abort');

      controller.abort(error);

      expect(suspend.status).toBe('aborted');
      expect(suspend.value).toBe(undefined);
      expect(suspend.reason).toBe(error);
    });

    it('does not transition to fulfilled after abort', async () => {
      const error = new Error('abort');
      const promise = Promise.resolve('ok');
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      controller.abort(error);

      await expect(promise).resolves.toBe('ok');

      expect(suspend.status).toBe('aborted');
      expect(suspend.reason).toBe(error);
    });

    it('does not transition to rejected after abort', async () => {
      const error = new Error('fail');
      const promise = Promise.reject(error);
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      controller.abort();

      await expect(promise).rejects.toThrow(error);

      expect(suspend.status).toBe('aborted');
      expect(suspend.reason).toBe(controller.signal.reason);
    });

    it('does not transition to aborted after fulfilled', async () => {
      const promise = Promise.resolve('ok');
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      await promise;

      suspend.abort();

      expect(suspend.status).toBe('fulfilled');
      expect(suspend.reason).toBe(undefined);
      expect(suspend.value).toBe('ok');
    });

    it('does not transition to aborted after rejected', async () => {
      const error = new Error('fail');
      const promise = Promise.reject(error);
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      try {
        await promise;
      } catch {
        // intentionally ignored
      }

      suspend.abort();

      expect(suspend.status).toBe('rejected');
      expect(suspend.reason).toBe(error);
      expect(suspend.value).toBe(undefined);
    });

    it('emits "fulfill" event on signal when the promise resolves', async () => {
      const listener = vi.fn();
      const promise = Promise.resolve('ok');
      const controller = new AbortController();

      controller.signal.addEventListener('fulfill', listener);
      Suspend.await(promise, controller);

      await promise;

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'ok' }),
      );
    });

    it('emits "reject" event on signal when the promise rejects', async () => {
      const listener = vi.fn();
      const error = new Error('fail');
      const promise = Promise.reject(error);
      const controller = new AbortController();

      controller.signal.addEventListener('reject', listener);
      Suspend.await(promise, controller);

      try {
        await promise;
      } catch {
        // intentionally ignored
      }

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ detail: error }),
      );
    });
  });

  describe('resolve()', () => {
    it('returns a Suspend with fulfilled sttus', () => {
      const suspend = Suspend.resolve('ok');

      expect(suspend.status).toBe('fulfilled');
      expect(suspend.value).toBe('ok');
      expect(suspend.reason).toBe(undefined);
    });
  });

  describe('reject()', () => {
    it('returns a Suspend with fulfilled sttus', () => {
      const error = new Error('fail');
      const suspend = Suspend.reject(error);

      expect(suspend.status).toBe('rejected');
      expect(suspend.value).toBe(undefined);
      expect(suspend.reason).toBe(error);
    });
  });

  describe('abort()', () => {
    it('aborts the signal when pending', () => {
      const error = new Error('abort');
      const controller = new AbortController();
      const suspend = Suspend.await(new Promise(() => {}), controller);

      suspend.abort(error);

      expect(controller.signal.aborted).toBe(true);
      expect(controller.signal.reason).toBe(error);
    });

    it('does not abort the signal when fulfilled', async () => {
      const promise = Promise.resolve('ok');
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      await promise;

      suspend.abort();

      expect(controller.signal.aborted).toBe(false);
      expect(controller.signal.reason).toBe(undefined);
    });

    it('does not abort the signal when rejected', async () => {
      const error = new Error('fail');
      const promise = Promise.reject(error);
      const controller = new AbortController();
      const suspend = Suspend.await(promise, controller);

      try {
        await promise;
      } catch {
        // intentionally ignored
      }

      suspend.abort();

      expect(controller.signal.aborted).toBe(false);
      expect(controller.signal.reason).toBe(undefined);
    });
  });

  describe('catch()', () => {
    it('should handle rejection and return the fallback value', async () => {
      const error = new Error('fail');
      const suspend = Suspend.reject(error);

      expect(await suspend.catch(() => 'fallback')).toBe('fallback');
    });
  });

  describe('finally()', () => {
    it('should call the callback regardless of fulfillment', async () => {
      const error = new Error();
      const suspend = Suspend.reject(error);
      const callback = vi.fn();

      await expect(suspend.finally(callback)).rejects.toBe(error);
      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('then()', () => {
    it('resolves with the value when the awaited promise fulfills', async () => {
      const suspend = Suspend.await(Promise.resolve(10));

      expect(await suspend).toBe(10);
      expect(await suspend.then((x) => x * 2)).toBe(20);
    });

    it('resolves with the value when already fulfilled', async () => {
      const suspend = Suspend.resolve(10);

      expect(await suspend).toBe(10);
      expect(await suspend.then((x) => x * 2)).toBe(20);
    });

    it('rejects with the reason when the awaited promise rejects', async () => {
      const error = new Error('fail');
      const suspend = Suspend.reject(error);

      await expect(suspend).rejects.toBe(error);
      await expect(
        suspend.then(
          () => {},
          (reason) => Promise.reject(reason),
        ),
      ).rejects.toBe(error);
    });

    it('rejects with the reason when already rejected', async () => {
      const error = new Error('fail');
      const suspend = Suspend.reject(error);

      await expect(suspend).rejects.toBe(error);
      await expect(
        suspend.then(
          () => {},
          (error) => Promise.reject(error),
        ),
      ).rejects.toBe(error);
    });

    it('rejects with the reason when aborted while pending', async () => {
      const error = new Error('abort');
      const controller = new AbortController();
      const suspend = Suspend.await(new Promise(() => {}), controller);

      controller.abort(error);

      await expect(suspend).rejects.toBe(error);
      await expect(
        suspend.then(
          () => {},
          (error) => Promise.reject(error),
        ),
      ).rejects.toBe(error);
    });
  });

  describe('toString()', () => {
    it('reflects the constructor name', () => {
      const suspend = Suspend.resolve('ok');

      expect(suspend.toString()).toBe('[object Suspend]');
    });
  });

  describe('unwrap()', () => {
    it('throws the suspend itself when pending', () => {
      const suspend = Suspend.await(new Promise(() => {}));

      expect(() => suspend.unwrap()).toThrow(expect.exact(suspend) as any);
    });

    it('throws the rejection reason when rejected', () => {
      const error = new Error('fail');
      const suspend = Suspend.reject(error);

      expect(() => suspend.unwrap()).toThrow(error);
    });

    it('returns the value when fulfilled', () => {
      const suspend = Suspend.resolve('ok');

      expect(suspend.unwrap()).toBe('ok');
    });
  });
});

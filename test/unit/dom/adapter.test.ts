import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMAdapter } from '@/dom/adapter.js';

describe('DOMAdapter', () => {
  let adapter: DOMAdapter;

  beforeEach(() => {
    adapter = new DOMAdapter();
  });

  describe('getIdentifier()', () => {
    it('returns an 8-character string starting with a lowercase letter', () => {
      const id = adapter.getIdentifier();
      expect(id).toMatch(/[a-z][0-9a-z_]*/);
    });

    it('returns consistent values for the same adapter instance', () => {
      expect(adapter.getIdentifier()).toBe(adapter.getIdentifier());
    });

    it('returns different values for different adapter instances', () => {
      expect(new DOMAdapter().getIdentifier()).not.toBe(
        adapter.getIdentifier(),
      );
    });
  });

  describe('getTaskPriority()', () => {
    it('returns "background" when there is no current event and readyState is "complete"', () => {
      vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
      vi.spyOn(window, 'event', 'get').mockReturnValue(undefined);
      expect(adapter.getTaskPriority()).toBe('background');
    });

    it.each([
      'loading',
      'interactive',
    ] as const)('returns "user-blocking" when readyState is "%s" and there is no current event', (readyState) => {
      vi.spyOn(document, 'readyState', 'get').mockReturnValue(readyState);
      vi.spyOn(window, 'event', 'get').mockReturnValue(undefined);
      expect(adapter.getTaskPriority()).toBe('user-blocking');
    });

    it.each([
      'drag',
      'dragenter',
      'dragleave',
      'dragover',
      'mouseenter',
      'mouseleave',
      'mousemove',
      'mouseout',
      'mouseover',
      'pointerenter',
      'pointerleave',
      'pointermove',
      'pointerout',
      'pointerover',
      'scroll',
      'touchmove',
      'wheel',
    ])('returns "user-visible" for a "%s" event', (type) => {
      vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
      vi.spyOn(window, 'event', 'get').mockReturnValue(new Event(type));
      expect(adapter.getTaskPriority()).toBe('user-visible');
    });

    it('returns "user-blocking" for a non-continuous event', () => {
      vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
      vi.spyOn(window, 'event', 'get').mockReturnValue(new Event('click'));
      expect(adapter.getTaskPriority()).toBe('user-blocking');
    });
  });

  describe('requestCallback()', () => {
    it.runIf(window.scheduler)(
      'uses scheduler.postTask when available',
      async () => {
        const callback = vi.fn();
        await adapter.requestCallback(callback);
        expect(callback).toHaveBeenCalledOnce();
      },
    );

    describe('fallback when scheduler.postTask is unavailable', () => {
      beforeEach(() => {
        vi.stubGlobal('scheduler', undefined);
      });

      it('resolves after executing the callback', async () => {
        const callback = vi.fn();
        await adapter.requestCallback(callback);
        expect(callback).toHaveBeenCalledOnce();
      });

      it.runIf(window.requestIdleCallback)(
        'uses requestIdleCallback for background priority',
        async () => {
          const callback = vi.fn();
          await adapter.requestCallback(callback, { priority: 'background' });
          expect(callback).toHaveBeenCalledOnce();
        },
      );

      it('uses setTimeout(1) for background priority when requestIdleCallback is unavailable', async () => {
        vi.stubGlobal('requestIdleCallback', undefined);
        const callback = vi.fn();
        await adapter.requestCallback(callback, { priority: 'background' });
        expect(callback).toHaveBeenCalledOnce();
      });

      it('uses MessageChannel for user-blocking priority', async () => {
        const callback = vi.fn();
        await adapter.requestCallback(callback, { priority: 'user-blocking' });
        expect(callback).toHaveBeenCalledOnce();
      });
    });
  });

  describe('requestCommit()', () => {
    it('resolves after executing the callback', async () => {
      const callback = vi.fn();
      await adapter.requestCommit(callback);
      expect(callback).toHaveBeenCalledOnce();
    });

    it('falls back to setTimeout when requestAnimationFrame never fires', async () => {
      const callback = vi.fn();
      vi.stubGlobal('requestAnimationFrame', (_cb: FrameRequestCallback) => 0);
      vi.stubGlobal('cancelAnimationFrame', (_id: number) => {});
      await adapter.requestCommit(callback);
      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('startViewTransition()', () => {
    it.runIf(document.startViewTransition)(
      'uses startViewTransition when available',
      async () => {
        const callback = vi.fn();
        await adapter.startViewTransition(callback);
        expect(callback).toHaveBeenCalledOnce();
      },
    );

    it('falls back to Promise.resolve when startViewTransition is unavailable', async () => {
      vi.spyOn(
        document as {
          startViewTransition: Document['startViewTransition'] | undefined;
        },
        'startViewTransition',
        'get',
      ).mockReturnValue(undefined);
      const callback = vi.fn();
      await adapter.startViewTransition(callback);
      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('yieldToMain()', () => {
    it.runIf(window.scheduler)(
      'uses scheduler.yield when available',
      async () => {
        await expect(adapter.yieldToMain()).resolves.toBe(undefined);
      },
    );

    it('falls back to setTimeout when scheduler.yield is unavailable', async () => {
      vi.stubGlobal('scheduler', undefined);
      await expect(adapter.yieldToMain()).resolves.toBe(undefined);
    });
  });
});

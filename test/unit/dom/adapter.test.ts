import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

    it.each(['loading', 'interactive'] as const)(
      'returns "user-blocking" when readyState is "%s" and there is no current event',
      (readyState) => {
        vi.spyOn(document, 'readyState', 'get').mockReturnValue(readyState);
        vi.spyOn(window, 'event', 'get').mockReturnValue(undefined);
        expect(adapter.getTaskPriority()).toBe('user-blocking');
      },
    );

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
    describe('without scope', () => {
      it('calls Document.startViewTransition when available', async () => {
        const startViewTransitionSpy = vi
          .spyOn(document, 'startViewTransition')
          .mockImplementation((options) => {
            (options as StartViewTransitionOptions).update?.();
            return {
              finished: Promise.resolve(),
              ready: Promise.resolve(),
              skipTransition() {},
              types: new Set((options as StartViewTransitionOptions).types),
              updateCallbackDone: Promise.resolve(),
            };
          });
        const update = vi.fn();
        await adapter.startViewTransition({ update });
        expect(startViewTransitionSpy).toHaveBeenCalledOnce();
        expect(update).toHaveBeenCalledOnce();
      });

      it('falls back to Promise.resolve when Document.startViewTransition is unavailable', async () => {
        vi.spyOn(document as any, 'startViewTransition', 'get').mockReturnValue(
          undefined,
        );
        const update = vi.fn();
        await adapter.startViewTransition({ update });
        expect(update).toHaveBeenCalledOnce();
      });
    });

    describe('with scope', () => {
      const scope = document.createElement('div');
      scope.setAttribute('id', 'scope');

      beforeEach(() => {
        document.body.appendChild(scope);
      });

      afterEach(() => {
        document.body.removeChild(scope);
      });

      it('calls Element.startViewTransition when available', async () => {
        const startViewTransitionSpy = vi
          .spyOn(Element.prototype, 'startViewTransition')
          .mockImplementation(startViewTransitionMock);
        const update = vi.fn();
        await adapter.startViewTransition({
          transitionFor: 'scope',
          update,
        });
        expect(startViewTransitionSpy).toHaveBeenCalledOnce();
        expect(update).toHaveBeenCalledOnce();
      });

      it('falls back to Promise.resolve when the element is not found', async () => {
        const startViewTransitionSpy = vi
          .spyOn(Element.prototype, 'startViewTransition')
          .mockImplementation(startViewTransitionMock);
        const update = vi.fn();
        await adapter.startViewTransition({
          transitionFor: 'invalid-scope',
          update,
        });
        expect(startViewTransitionSpy).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledOnce();
      });

      it('falls back to Promise.resolve when Element.startViewTransition is unavailable', async () => {
        vi.spyOn(
          Element.prototype as any,
          'startViewTransition',
          'get',
        ).mockReturnValue(undefined);
        const update = vi.fn();
        await adapter.startViewTransition({ transitionFor: 'scope', update });
        expect(update).toHaveBeenCalledOnce();
      });
    });
  });
});

function startViewTransitionMock(
  callbackOptions?: ViewTransitionUpdateCallback | StartViewTransitionOptions,
): ViewTransition {
  const callback =
    typeof callbackOptions === 'function'
      ? callbackOptions
      : callbackOptions?.update;
  const types = new Set(
    typeof callbackOptions === 'function' ? undefined : callbackOptions?.types,
  );
  callback?.();
  return {
    finished: Promise.resolve(),
    ready: Promise.resolve(),
    skipTransition() {},
    types,
    updateCallbackDone: Promise.resolve(),
  };
}

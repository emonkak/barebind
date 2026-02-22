import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  HistoryContext,
  type HistoryLocation,
  type HistoryNavigator,
} from '@/addons/router/history.js';
import { RelativeURL } from '@/addons/router/relative-url.js';
import { ScrollRestration } from '@/addons/router/scroll-restration.js';
import { createElement, waitForMicrotasks } from '../../../test-helpers.js';
import { TestRenderer } from '../../../test-renderer.js';

describe('ScrollRestration()', () => {
  const renderer = new TestRenderer(
    (
      {
        location,
        navigator,
      }: { location: HistoryLocation; navigator: HistoryNavigator },
      session,
    ) => {
      session.use(new HistoryContext(location, navigator));
      session.use(ScrollRestration());
    },
  );

  afterEach(() => {
    renderer.finalize();
    renderer.reset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.for([
    'push',
    'replace',
  ] as NavigationType[])('scrolls to the top when the navigation type is "%s"', (navigationType) => {
    const location: HistoryLocation = {
      url: new RelativeURL('/'),
      state: null,
      navigationType,
    };
    const navigator = createMockNavigator();

    const scrollToSpy = vi.spyOn(window, 'scrollTo');

    renderer.render({ location, navigator });

    expect(scrollToSpy).toHaveBeenCalled();
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
  });

  it.for([
    'reload',
    'traverse',
    null,
  ] as (NavigationType | null)[])('should not reset scroll if the navigation type is "%s"', (navigationType) => {
    const location: HistoryLocation = {
      url: new RelativeURL('/'),
      state: null,
      navigationType,
    };
    const navigator = createMockNavigator();

    const scrollToSpy = vi.spyOn(window, 'scrollTo');

    renderer.render({ location, navigator });

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('scrolls to the element indicating hash', () => {
    const location: HistoryLocation = {
      url: RelativeURL.fromString('#foo'),
      state: null,
      navigationType: 'push',
    };
    const navigator = createMockNavigator();
    const element = createElement('div', {
      id: 'foo',
    });

    const scrollIntoViewSpy = vi.spyOn(element, 'scrollIntoView');

    document.body.appendChild(element);

    renderer.render({ location, navigator });

    document.body.removeChild(element);

    expect(scrollIntoViewSpy).toHaveBeenCalled();
  });

  it('scrolls to the top if there is not the element indicating hash', () => {
    const location: HistoryLocation = {
      url: RelativeURL.fromString('#foo'),
      state: null,
      navigationType: 'push',
    };
    const navigator = createMockNavigator();

    const scrollToSpy = vi.spyOn(window, 'scrollTo');

    renderer.render({ location, navigator });

    expect(scrollToSpy).toHaveBeenCalled();
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
  });

  it.runIf(typeof navigation === 'object')(
    'registers an event listener for NavigateEvent',
    () => {
      const location: HistoryLocation = {
        url: new RelativeURL('/'),
        state: null,
        navigationType: 'push',
      };
      const navigator = createMockNavigator(1);

      const addEventListenerSpy = vi.spyOn(navigation!, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(
        navigation!,
        'removeEventListener',
      );

      renderer.render({ location, navigator });

      renderer.finalize();

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'navigate',
        expect.any(Function),
      );
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'navigate',
        expect.any(Function),
      );
    },
  );

  it.runIf(typeof navigation === 'object')(
    'intercepts navigation if the event is interceptable',
    async () => {
      const location: HistoryLocation = {
        url: new RelativeURL('/'),
        state: null,
        navigationType: 'push',
      };
      const navigator = createMockNavigator(1);

      const event = Object.assign(new Event('navigate'), {
        canIntercept: true,
        intercept: ({ handler }: NavigationInterceptOptions) => {
          handler?.();
        },
        scroll: vi.fn(),
      });

      renderer.render({ location, navigator });

      navigation!.dispatchEvent(event);

      // Wait for calling NavigateEvent.scroll()
      await waitForMicrotasks();

      expect(history.scrollRestoration).toBe('manual');
      expect(navigator.waitForTransition).toHaveBeenCalledOnce();
      expect(event.scroll).toHaveBeenCalledOnce();
    },
  );

  it.runIf(typeof navigation === 'object').each([
    [false, 1],
    [true, 0],
  ])(
    'not intercepts navigation if the event is not interceptable',
    async (canIntercept, pendingTransitions) => {
      const location: HistoryLocation = {
        url: new RelativeURL('/'),
        state: null,
        navigationType: 'push',
      };
      const navigator = createMockNavigator(pendingTransitions);
      const event = Object.assign(new Event('navigate'), {
        canIntercept,
        intercept: ({ handler }: NavigationInterceptOptions) => {
          handler?.();
        },
        scroll: vi.fn(),
      });

      renderer.render({ location, navigator });

      navigation!.dispatchEvent(event);

      // Wait for calling NavigateEvent.scroll()
      await waitForMicrotasks();

      expect(history.scrollRestoration).toBe('manual');
      expect(navigator.waitForTransition).not.toHaveBeenCalled();
      expect(event.scroll).not.toHaveBeenCalled();
    },
  );

  it('uses the built-in scroll restoration mechanism if Navigation API is not available', () => {
    const location: HistoryLocation = {
      url: new RelativeURL('/'),
      state: null,
      navigationType: 'push',
    };
    const navigator = createMockNavigator();

    vi.stubGlobal('navigation', undefined);

    renderer.render({ location, navigator });

    expect(history.scrollRestoration).toBe('auto');
  });
});

function createMockNavigator(pendingTransitions: number = 0): HistoryNavigator {
  return {
    navigate: vi.fn(),
    getCurrentURL: vi.fn(() => new RelativeURL('/')),
    isTransitionPending: vi.fn(() => pendingTransitions > 0),
    waitForTransition: vi.fn(() => Promise.resolve(pendingTransitions)),
  };
}

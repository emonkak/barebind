import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CurrentHistory,
  type HistoryLocation,
  type HistoryNavigator,
} from '@/addons/router/history.js';
import { RelativeURL } from '@/addons/router/relative-url.js';
import { ScrollRestration } from '@/addons/router/scroll-restration.js';
import { createElement, TestRenderer } from '../../../test-helpers.js';

describe('ScrollRestration()', () => {
  let helper!: TestRenderer;

  beforeEach(() => {
    helper = new TestRenderer();
  });

  afterEach(() => {
    helper.finalizeHooks();
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

    helper.startRender((session) => {
      session.setSharedContext(CurrentHistory, { location, navigator });
      session.use(ScrollRestration());
    });

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

    helper.startRender((session) => {
      session.setSharedContext(CurrentHistory, { location, navigator });
      session.use(ScrollRestration());
    });

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

    helper.startRender((session) => {
      session.setSharedContext(CurrentHistory, { location, navigator });
      session.use(ScrollRestration());
    });

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

    helper.startRender((session) => {
      session.setSharedContext(CurrentHistory, { location, navigator });
      session.use(ScrollRestration());
    });

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

      helper.startRender((session) => {
        session.setSharedContext(CurrentHistory, { location, navigator });
        session.use(ScrollRestration());
      });

      helper.finalizeHooks();

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

      helper.startRender((session) => {
        session.setSharedContext(CurrentHistory, { location, navigator });
        session.use(ScrollRestration());
      });

      navigation!.dispatchEvent(event);

      // Wait for calling NavigateEvent.scroll()
      await Promise.resolve();

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

      helper.startRender((session) => {
        session.setSharedContext(CurrentHistory, { location, navigator });
        session.use(ScrollRestration());
      });

      navigation!.dispatchEvent(event);

      // Wait for calling NavigateEvent.scroll()
      await Promise.resolve();

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

    helper.startRender((session) => {
      session.setSharedContext(CurrentHistory, { location, navigator });
      session.use(ScrollRestration());
    });

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

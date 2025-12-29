import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createHashClickHandler,
  HashHistory,
} from '@/addons/router/hash-history.js';
import {
  CurrentHistory,
  type HistoryNavigator,
} from '@/addons/router/history.js';
import { RelativeURL } from '@/addons/router/relative-url.js';
import type { RenderSession } from '@/render-session.js';
import { MockCoroutine } from '../../../mocks.js';
import { createElement, TestRenderer } from '../../../test-helpers.js';

describe('HashHistory()', () => {
  const originalURL = location.href;
  const originalState = history.state;
  let helper!: TestRenderer;

  beforeEach(() => {
    helper = new TestRenderer();
  });

  afterEach(() => {
    helper.finalizeHooks();
    history.replaceState(originalState, '', originalURL);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('HistoryNavigator', () => {
    it('gets the current URL', () => {
      const state = { key: 'foo' };

      history.replaceState(state, '', '#/articles/foo%2Fbar');

      const { location, navigator } = helper.startRender((session) => {
        return session.use(HashHistory());
      });

      expect(navigator.getCurrentURL().toString()).toBe('/articles/foo%2Fbar');
      expect(window.location.hash).toBe('#/articles/foo%2Fbar');
      expect(history.state).toStrictEqual(state);
      expect(location.url.toString()).toBe('/articles/foo%2Fbar');
      expect(location.state).toStrictEqual(state);
      expect(location.navigationType).toBe(null);
    });

    it('pushes a new location', () => {
      const callback = (session: RenderSession) => {
        return session.use(HashHistory({ viewTransition: true }));
      };

      const scheduleUpdateSpy = vi.spyOn(helper.runtime, 'scheduleUpdate');
      const pushStateSpy = vi.spyOn(history, 'pushState');
      const replaceStateSpy = vi.spyOn(history, 'replaceState');

      let stableNavigator: HistoryNavigator;

      SESSION1: {
        const { location, navigator } = helper.startRender(callback);

        expect(location.url.toString()).toBe('/');
        expect(location.state).toBe(originalState);
        expect(location.navigationType).toBe(null);

        stableNavigator = navigator;
      }

      stableNavigator.navigate('/articles/foo%2Fbar');

      expect(scheduleUpdateSpy).toHaveBeenLastCalledWith(
        expect.any(MockCoroutine),
        {
          immediate: true,
          viewTransition: true,
        },
      );

      SESSION2: {
        const { location, navigator } = helper.startRender(callback);

        expect(pushStateSpy).toHaveBeenCalledOnce();
        expect(replaceStateSpy).not.toHaveBeenCalled();
        expect(location.url.toString()).toBe('/articles/foo%2Fbar');
        expect(location.state).toBe(history.state);
        expect(location.navigationType).toBe('push');
        expect(navigator).toBe(stableNavigator);
      }

      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(3);
    });

    it('replaces with a new location', () => {
      const state = { key: 'foo' };
      const callback = (session: RenderSession) => {
        return session.use(HashHistory({ viewTransition: true }));
      };

      const scheduleUpdateSpy = vi.spyOn(helper.runtime, 'scheduleUpdate');
      const pushStateSpy = vi.spyOn(history, 'pushState');
      const replaceStateSpy = vi.spyOn(history, 'replaceState');

      let stableNavigator: HistoryNavigator;

      SESSION1: {
        const { location, navigator } = helper.startRender(callback);

        expect(location.url.toString()).toBe('/');
        expect(location.state).toBe(originalState);
        expect(location.navigationType).toBe(null);

        stableNavigator = navigator;
      }

      stableNavigator.navigate('/articles/foo%2Fbar', {
        replace: true,
        state,
      });

      expect(scheduleUpdateSpy).toHaveBeenLastCalledWith(
        expect.any(MockCoroutine),
        {
          immediate: true,
          viewTransition: true,
        },
      );

      SESSION2: {
        const { location, navigator } = helper.startRender(callback);

        expect(pushStateSpy).not.toHaveBeenCalled();
        expect(replaceStateSpy).toHaveBeenCalledOnce();
        expect(location.url.toString()).toBe('/articles/foo%2Fbar');
        expect(location.state).toBe(state);
        expect(location.navigationType).toBe('replace');
        expect(navigator).toBe(stableNavigator);
      }

      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(3);
    });

    it('waits for navigation transition', async () => {
      const { navigator } = helper.startRender((session) => {
        return session.use(HashHistory());
      });

      navigator.navigate('/articles/foo%2Fbar');

      expect(navigator.isTransitionPending()).toBe(true);

      expect(await navigator.waitForTransition()).toBe(1);

      expect(navigator.isTransitionPending()).toBe(false);

      expect(await navigator.waitForTransition()).toBe(0);
    });
  });

  it('registers the current history state', () => {
    const { hashHandle, currentHandle } = helper.startRender((session) => {
      const hashHandle = session.use(HashHistory());
      const currentHandle = session.use(CurrentHistory);
      return { hashHandle, currentHandle };
    });

    expect(currentHandle).toBe(hashHandle);
  });

  it('registers event listeners for "click", and "hashchange"', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    vi.stubGlobal('navigation', undefined);

    SESSION: {
      helper.startRender((session) => {
        session.use(HashHistory());
      });
    }

    helper.finalizeHooks();

    expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'hashchange',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledTimes(2);
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'hashchange',
      expect.any(Function),
    );
  });

  it.runIf(typeof navigation === 'object')(
    'registers event listeners for "click", and "navigate" if Navigation API is available',
    () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const addNavigationEventListenerSpy = vi.spyOn(
        navigation!,
        'addEventListener',
      );
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const removeNavigationEventListenerSpy = vi.spyOn(
        navigation!,
        'removeEventListener',
      );

      SESSION: {
        helper.startRender((session) => {
          session.use(HashHistory());
        });
      }

      helper.finalizeHooks();

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
      );
      expect(addNavigationEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(addNavigationEventListenerSpy).toHaveBeenCalledWith(
        'navigate',
        expect.any(Function),
      );
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
      );
      expect(removeNavigationEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(removeNavigationEventListenerSpy).toHaveBeenCalledWith(
        'navigate',
        expect.any(Function),
      );
    },
  );

  it('should update the state when the link is clicked', () => {
    const callback = (session: RenderSession) => {
      return session.use(HashHistory({ viewTransition: true }));
    };

    const scheduleUpdateSpy = vi.spyOn(helper.runtime, 'scheduleUpdate');

    SESSION1: {
      helper.startRender(callback);
    }

    const element = createElement('a', { href: '#/articles/foo%2Fbar' });
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    expect(scheduleUpdateSpy).toHaveBeenLastCalledWith(
      expect.any(MockCoroutine),
      {
        immediate: true,
        viewTransition: true,
      },
    );

    SESSION2: {
      const { location } = helper.startRender((session) => {
        return session.use(HashHistory({ viewTransition: true }));
      });
      expect(location.url.toString()).toBe('/articles/foo%2Fbar');
      expect(location.state).toBe(null);
      expect(location.navigationType).toBe('push');
    }

    expect(scheduleUpdateSpy).toHaveBeenCalledTimes(3);
  });

  it.runIf(typeof navigation === 'object')(
    'should update the location when NavigateEvent is received',
    () => {
      const callback = (session: RenderSession) => {
        return session.use(HashHistory({ viewTransition: true }));
      };

      const scheduleUpdateSpy = vi.spyOn(helper.runtime, 'scheduleUpdate');

      SESSION1: {
        helper.startRender(callback);
      }

      navigation!.dispatchEvent(
        Object.assign(new Event('navigate'), {
          hashChange: true,
          destination: {
            url: location.origin + '/#/articles/foo%2Fbar',
            getState() {
              return null;
            },
          },
          navigationType: 'push',
        } as NavigateEventInit),
      );

      expect(scheduleUpdateSpy).toHaveBeenLastCalledWith(
        expect.any(MockCoroutine),
        {
          immediate: true,
          viewTransition: true,
        },
      );

      SESSION2: {
        const { location } = helper.startRender((session) => {
          return session.use(HashHistory({ viewTransition: true }));
        });

        expect(location.url.toString()).toBe('/articles/foo%2Fbar');
        expect(location.state).toBe(null);
        expect(location.navigationType).toBe('push');
      }

      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(3);
    },
  );

  it('should update the location when HashChangeEvent is received', () => {
    const callback = (session: RenderSession) => {
      return session.use(HashHistory({ viewTransition: true }));
    };

    const scheduleUpdateSpy = vi.spyOn(helper.runtime, 'scheduleUpdate');

    vi.stubGlobal('navigation', undefined);

    SESSION1: {
      helper.startRender(callback);
    }

    dispatchEvent(
      new HashChangeEvent('hashchange', {
        newURL: location.origin + '/#/articles/foo%2Fbar',
        oldURL: '',
      }),
    );

    expect(scheduleUpdateSpy).toHaveBeenLastCalledWith(
      expect.any(MockCoroutine),
      {
        immediate: true,
        viewTransition: true,
      },
    );

    SESSION2: {
      const { location } = helper.startRender(callback);

      expect(location.url.toString()).toBe('/articles/foo%2Fbar');
      expect(location.state).toBe(null);
      expect(location.navigationType).toBe('traverse');
    }

    expect(scheduleUpdateSpy).toHaveBeenCalledTimes(3);
  });
});

describe('createHashClickHandler()', () => {
  it('should push a new location', () => {
    const container = createElement('div');
    const element = createElement('a', {
      href: '#/foo?bar=123#baz',
    });
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => new RelativeURL('/'));
    const navigate = vi.fn();
    const clickHandler = vi.fn(
      createHashClickHandler({ getCurrentURL, navigate }),
    );

    container.addEventListener('click', clickHandler);
    container.appendChild(element);
    element.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?bar=123',
        hash: '#baz',
      }),
      { replace: false },
    );
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('should replace the location if the element indicates the same location', () => {
    const container = createElement('div');
    const element = createElement('a', {
      href: '#/',
    });
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => new RelativeURL('/'));
    const navigate = vi.fn();
    const clickHandler = vi.fn(
      createHashClickHandler({ getCurrentURL, navigate }),
    );

    location.hash = '#/';
    container.appendChild(element);
    container.addEventListener('click', clickHandler);
    element.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/',
        search: '',
        hash: '',
      }),
      { replace: true },
    );
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('should replace the location if the element has "data-link-replace" attribute', () => {
    const container = createElement('div');
    const element = createElement('a', {
      href: '#?bar=123#baz',
      'data-link-replace': '',
      'data-link-no-scroll-reset': '',
    });
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => new RelativeURL('/foo'));
    const navigate = vi.fn();
    const clickHandler = vi.fn(
      createHashClickHandler({ getCurrentURL, navigate }),
    );

    container.appendChild(element);
    container.addEventListener('click', clickHandler);
    element.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?bar=123',
        hash: '#baz',
      }),
      { replace: true },
    );
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it.for([
    { altKey: true, bubbles: true },
    { ctrlKey: true, bubbles: true },
    { metaKey: true, bubbles: true },
    { shiftKey: true, bubbles: true },
    { button: 1, bubbles: true },
  ])('should ignore the event if any modifier keys or the button other than left button are pressed', (eventInit) => {
    const container = createElement('div');
    const element = createElement('a');
    const event = new MouseEvent('click', eventInit);

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => new RelativeURL('/'));
    const navigate = vi.fn();
    const clickHandler = vi.fn(
      createHashClickHandler({ getCurrentURL, navigate }),
    );

    container.appendChild(element);
    container.addEventListener('click', clickHandler);
    element.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('should ignore the event if its default action is prevented', () => {
    const container = createElement('div');
    const element = createElement('a');
    const event = new MouseEvent('click', { cancelable: true, bubbles: true });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => new RelativeURL('/'));
    const navigate = vi.fn();
    const clickHandler = vi.fn(
      createHashClickHandler({ getCurrentURL, navigate }),
    );

    event.preventDefault();
    container.appendChild(element);
    container.addEventListener('click', clickHandler);
    element.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([
    ['a', { href: '/foo', download: '' }],
    ['a', { href: '/foo', rel: 'external' }],
    ['a', { href: '/foo', target: '_blank' }],
    ['a', { href: '/foo' }],
    ['button', {}],
  ] as const)('should ignore the event if the target is not valid as a link', (tagName, attribues) => {
    const cancelWrapper = createElement('div');
    const container = createElement('div');
    const element = createElement(tagName, attribues);
    const event = new MouseEvent('click', {
      cancelable: true,
      bubbles: true,
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => new RelativeURL('/'));
    const navigate = vi.fn();
    const clickHandler = vi.fn(
      createHashClickHandler({ getCurrentURL, navigate }),
    );
    const cancelHandler = vi.fn((event: Event) => {
      event.preventDefault();
    });

    cancelWrapper.appendChild(container);
    cancelWrapper.addEventListener('click', cancelHandler);
    container.appendChild(element);
    container.addEventListener('click', clickHandler);
    element.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(cancelHandler).toHaveBeenCalledOnce();
    expect(cancelHandler).toHaveBeenCalledWith(event);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createHashClickHandler,
  HashHistory,
} from '@/extensions/router/hash-history.js';
import { CurrentHistory } from '@/extensions/router/history.js';
import { RelativeURL } from '@/extensions/router/url.js';
import type { RenderSession } from '@/render-session.js';
import {
  createSession,
  disposeSession,
  flushSession,
} from '../../../session-utils.js';
import { createElement } from '../../../test-utils.js';

describe('HashHistory', () => {
  const originalURL = location.href;
  const originalState = history.state;
  let session!: RenderSession;

  beforeEach(() => {
    session = createSession();
  });

  afterEach(() => {
    disposeSession(session);
    history.replaceState(originalState, '', originalURL);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('HistoryNavigator', () => {
    it('gets the current URL', () => {
      const state = { key: 'foo' };

      history.replaceState(state, '', '#/articles/foo%2Fbar');

      const [location, { getCurrentURL }] = session.use(HashHistory);

      flushSession(session);

      expect(getCurrentURL().toString()).toBe('/articles/foo%2Fbar');
      expect(window.location.hash).toBe('#/articles/foo%2Fbar');
      expect(history.state).toStrictEqual(state);
      expect(location.url.toString()).toBe('/articles/foo%2Fbar');
      expect(location.state).toStrictEqual(state);
      expect(location.navigationType).toBe(null);
    });

    it('pushes a new location', () => {
      const pushStateSpy = vi.spyOn(history, 'pushState');
      const replaceStateSpy = vi.spyOn(history, 'replaceState');

      const [location1, navigator] = session.use(HashHistory);

      flushSession(session);

      navigator.navigate('/articles/foo%2Fbar');

      const [location2] = session.use(HashHistory);

      flushSession(session);

      expect(pushStateSpy).toHaveBeenCalledOnce();
      expect(replaceStateSpy).not.toHaveBeenCalled();
      expect(location2).not.toBe(location1);
      expect(location2.url.toString()).toBe('/articles/foo%2Fbar');
      expect(location2.state).toBe(history.state);
      expect(location2.navigationType).toBe('push');
    });

    it('replaces with a new location', () => {
      const state = { key: 'foo' };

      const pushStateSpy = vi.spyOn(history, 'pushState');
      const replaceStateSpy = vi.spyOn(history, 'replaceState');

      const [location1, navigator] = session.use(HashHistory);

      flushSession(session);

      navigator.navigate('/articles/foo%2Fbar', {
        replace: true,
        state,
      });

      const [location2] = session.use(HashHistory);

      flushSession(session);

      expect(pushStateSpy).not.toHaveBeenCalled();
      expect(replaceStateSpy).toHaveBeenCalledOnce();
      expect(location2).not.toBe(location1);
      expect(location2.url.toString()).toBe('/articles/foo%2Fbar');
      expect(location2.state).toBe(state);
      expect(location2.navigationType).toBe('replace');
    });

    it('waits for navigation transition', async () => {
      const resumeSpy = vi.spyOn(session['_coroutine'], 'resume');

      const [_location, navigator] = session.use(HashHistory);

      flushSession(session);

      navigator.navigate('/articles/foo%2Fbar');

      expect(navigator.isTransitionPending()).toBe(true);
      expect(await navigator.waitForTransition()).toBe(1);
      expect(resumeSpy).toHaveBeenCalledOnce();

      expect(navigator.isTransitionPending()).toBe(false);
      expect(await navigator.waitForTransition()).toBe(0);
      expect(resumeSpy).toHaveBeenCalledOnce();
    });
  });

  it('registers the current history state', () => {
    const currentHistory = session.use(HashHistory);

    expect(session.use(CurrentHistory)).toBe(currentHistory);
  });

  it('registers event listeners for "click", and "hashchange"', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    vi.stubGlobal('navigation', undefined);

    session.setContextValue(CurrentHistory, [location, navigator]);
    session.use(HashHistory);

    flushSession(session);
    disposeSession(session);

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

      session.setContextValue(CurrentHistory, [location, navigator]);
      session.use(HashHistory);

      flushSession(session);
      disposeSession(session);

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
    const element = createElement('a', { href: '#/articles/foo%2Fbar' });

    const [location1] = session.use(HashHistory);

    flushSession(session);

    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    const [location2] = session.use(HashHistory);

    flushSession(session);

    expect(location2).not.toBe(location1);
    expect(location2.url.toString()).toBe('/articles/foo%2Fbar');
    expect(location2.state).toBe(null);
    expect(location2.navigationType).toBe('push');
  });

  it.runIf(typeof navigation === 'object')(
    'should update the location when NavigateEvent is received',
    () => {
      const [location1] = session.use(HashHistory);

      flushSession(session);

      navigation!.dispatchEvent(
        Object.assign(new Event('navigate'), {
          hashChange: true,
          destination: {
            url: location.origin + '/#/articles/foo%2Fbar',
            getState() {
              return null;
            },
          },
        } as NavigateEventInit),
      );

      const [location2] = session.use(HashHistory);

      flushSession(session);

      expect(location2).not.toBe(location1);
      expect(location2.url.toString()).toBe('/articles/foo%2Fbar');
    },
  );

  it('should update the location when HashChangeEvent is received', () => {
    const [location1] = session.use(HashHistory);

    vi.stubGlobal('navigation', undefined);

    flushSession(session);

    dispatchEvent(
      new HashChangeEvent('hashchange', {
        newURL: location.origin + '/#/articles/foo%2Fbar',
        oldURL: '',
      }),
    );

    const [location2] = session.use(HashHistory);

    flushSession(session);

    expect(location2).not.toBe(location1);
    expect(location2.url.toString()).toBe('/articles/foo%2Fbar');
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
  ])(
    'should ignore the event if any modifier keys or the button other than left button are pressed',
    (eventInit) => {
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
    },
  );

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
  ] as const)(
    'should ignore the event if the target is not valid as a link',
    (tagName, attribues) => {
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
    },
  );
});

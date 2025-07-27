import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Lanes } from '@/core.js';
import {
  createHashClickHandler,
  HashHistory,
} from '@/extensions/router/hash-history.js';
import { CurrentHistory } from '@/extensions/router/history.js';
import { RelativeURL } from '@/extensions/router/url.js';
import { RenderSession } from '@/render-session.js';
import { Runtime } from '@/runtime.js';
import { MockBackend, MockCoroutine } from '../../../mocks.js';
import {
  createElement,
  disposeSession,
  flushSession,
} from '../../../test-utils.js';

describe('HashHistory', () => {
  const originalUrl = location.href;
  const originalState = history.state;
  let session!: RenderSession;

  beforeEach(() => {
    session = new RenderSession(
      [],
      Lanes.AllLanes,
      new MockCoroutine(),
      new Runtime(new MockBackend()),
    );
  });

  afterEach(() => {
    disposeSession(session);
    history.replaceState(originalState, '', originalUrl);
    vi.restoreAllMocks();
  });

  it('gets the current history state', () => {
    const state = { key: 'foo' };

    history.replaceState(state, '', '#/articles/foo%2Fbar');

    const [location, { getCurrentURL }] = session.use(HashHistory);

    expect(getCurrentURL().toString()).toBe('/articles/foo%2Fbar');
    expect(window.location.hash).toBe('#/articles/foo%2Fbar');
    expect(window.history.state).toStrictEqual(state);
    expect(location.url.toString()).toBe('/articles/foo%2Fbar');
    expect(location.state).toStrictEqual(state);
    expect(location.navigationType).toBe(null);
  });

  it('registers the current history state', () => {
    const currentHistory = session.use(HashHistory);

    expect(session.use(CurrentHistory)).toBe(currentHistory);
  });

  it('adds event listeners', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

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

  it('pushes a hash with the new location', () => {
    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    const [location1, navigator] = session.use(HashHistory);

    flushSession(session);

    navigator.navigate(new RelativeURL('/articles/foo%2Fbar'));

    const [location2] = session.use(HashHistory);

    expect(pushStateSpy).toHaveBeenCalledOnce();
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(location2).not.toBe(location1);
    expect(location2.url.toString()).toBe('/articles/foo%2Fbar');
    expect(location2.state).toBe(history.state);
    expect(location2.navigationType).toBe('push');
  });

  it('should replace a hash with the new location', () => {
    const state = { key: 'foo' };

    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    const [location1, navigator] = session.use(HashHistory);

    flushSession(session);

    navigator.navigate(new RelativeURL('/articles/foo%2Fbar'), {
      replace: true,
      state,
    });

    const [location2] = session.use(HashHistory);

    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledOnce();
    expect(location2).not.toBe(location1);
    expect(location2.url.toString()).toBe('/articles/foo%2Fbar');
    expect(location2.state).toBe(state);
    expect(location2.navigationType).toBe('replace');
  });

  it('should update the state when the link is clicked', () => {
    const element = createElement('a', { href: '#/articles/foo%2Fbar' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    const [location1] = session.use(HashHistory);

    flushSession(session);

    document.body.appendChild(element);
    element.dispatchEvent(event);
    document.body.removeChild(element);

    const [location2] = session.use(HashHistory);

    expect(location2).not.toBe(location1);
    expect(location2.url.toString()).toBe('/articles/foo%2Fbar');
    expect(location2.state).toBe(null);
    expect(location2.navigationType).toBe('push');
  });

  it('should update the location when the hash has been changed', () => {
    const event = new HashChangeEvent('hashchange', {
      oldURL: location.href,
      newURL: getURLWithoutHash(location) + '#/articles/foo%2Fbar',
    });

    const [location1] = session.use(HashHistory);

    flushSession(session);

    dispatchEvent(event);

    const [location2] = session.use(HashHistory);

    expect(location2).not.toBe(location1);
    expect(location2.url.toString()).toBe('/articles/foo%2Fbar');
    expect(location2.state).toBe(null);
    expect(location2.navigationType).toBe('traverse');
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

  it.each([
    [{ altKey: true, bubbles: true }],
    [{ ctrlKey: true, bubbles: true }],
    [{ metaKey: true, bubbles: true }],
    [{ shiftKey: true, bubbles: true }],
    [{ button: 1, bubbles: true }],
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

function getURLWithoutHash(location: Location): string {
  return location.hash !== ''
    ? location.href.slice(0, -location.hash.length)
    : location.href;
}

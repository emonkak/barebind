import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ALL_LANES } from '@/hook.js';
import { RenderEngine } from '@/renderEngine.js';
import { BrowserRenderHost } from '@/renderHost/browser.js';
import { createHashClickHandler, HashLocation } from '@/router/hashLocation.js';
import { CurrentLocation } from '@/router/location.js';
import { RelativeURL } from '@/router/url.js';
import { UpdateEngine } from '@/updateEngine.js';
import { MockCoroutine } from '../../mocks.js';
import { cleanupHooks, createElement } from '../../testUtils.js';

describe('HashLocation', () => {
  const originalState = history.state;
  const originalUrl = location.href;
  let context!: RenderEngine;

  beforeEach(() => {
    context = new RenderEngine(
      [],
      ALL_LANES,
      new MockCoroutine(),
      new UpdateEngine(new BrowserRenderHost()),
    );
  });

  afterEach(() => {
    cleanupHooks(context['_hooks']);
    history.replaceState(originalState, '', originalUrl);
    vi.restoreAllMocks();
  });

  it('gets the current location', () => {
    const state = { key: 'foo' };

    history.replaceState(state, '', '#/articles/foo%2Fbar');

    const [locationState, { getCurrentURL }] = context.use(HashLocation);

    expect(getCurrentURL().toString()).toBe('/articles/foo%2Fbar');
    expect(location.hash).toBe('#/articles/foo%2Fbar');
    expect(history.state).toStrictEqual(state);
    expect(locationState.url.toString()).toBe('/articles/foo%2Fbar');
    expect(locationState.state).toStrictEqual(state);
    expect(locationState.navigationType).toBe('initial');
  });

  it('registers the current location', () => {
    const locationState = context.use(HashLocation);

    expect(context.use(CurrentLocation)).toBe(locationState);
  });

  it('adds event listeners', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    context.use(HashLocation);
    context.finalize();
    context.flush();

    cleanupHooks(context['_hooks']);

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

    const [locationState1, locationNavigator1] = context.use(HashLocation);

    context.finalize();
    context.flush();

    locationNavigator1.navigate(new RelativeURL('/articles/foo%2Fbar'));

    const [locationState2] = context.use(HashLocation);

    expect(pushStateSpy).toHaveBeenCalledOnce();
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(locationState2).not.toBe(locationState1);
    expect(locationState2.url.toString()).toBe('/articles/foo%2Fbar');
    expect(locationState2.state).toBe(history.state);
    expect(locationState2.navigationType).toBe('push');
  });

  it('should replace a hash with the new location', () => {
    const state = { key: 'foo' };

    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    const [locationState1, locationNavigator1] = context.use(HashLocation);

    context.finalize();
    context.flush();

    locationNavigator1.navigate(new RelativeURL('/articles/foo%2Fbar'), {
      replace: true,
      state,
    });

    const [locationState2] = context.use(HashLocation);

    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledOnce();
    expect(locationState2).not.toBe(locationState1);
    expect(locationState2.url.toString()).toBe('/articles/foo%2Fbar');
    expect(locationState2.state).toBe(state);
    expect(locationState2.navigationType).toBe('replace');
  });

  it('should update the state when the link is clicked', () => {
    const element = createElement('a', { href: '#/articles/foo%2Fbar' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    const [locationState1] = context.use(HashLocation);

    context.finalize();
    context.flush();

    document.body.appendChild(element);
    element.dispatchEvent(event);
    document.body.removeChild(element);

    const [locationState2] = context.use(HashLocation);

    expect(locationState2).not.toBe(locationState1);
    expect(locationState2.url.toString()).toBe('/articles/foo%2Fbar');
    expect(locationState2.state).toBe(null);
    expect(locationState2.navigationType).toBe('push');
  });

  it('should update the location when the hash has been changed', () => {
    const event = new HashChangeEvent('hashchange', {
      oldURL: location.href,
      newURL: getURLWithoutHash(location) + '#/articles/foo%2Fbar',
    });

    const [locationState1] = context.use(HashLocation);

    context.finalize();
    context.flush();

    dispatchEvent(event);

    const [locationState2] = context.use(HashLocation);

    expect(locationState2).not.toBe(locationState1);
    expect(locationState2.url.toString()).toBe('/articles/foo%2Fbar');
    expect(locationState2.state).toBe(null);
    expect(locationState2.navigationType).toBe('traverse');
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

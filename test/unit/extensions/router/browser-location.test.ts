import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserLocation,
  createFormSubmitHandler,
  createLinkClickHandler,
} from '@/extensions/router/browser-location.js';
import { CurrentLocation } from '@/extensions/router/location.js';
import { RelativeURL } from '@/extensions/router/url.js';
import { ALL_LANES } from '@/hook.js';
import { RenderSession } from '@/render-session.js';
import { Runtime } from '@/runtime.js';
import { MockCoroutine, MockRenderHost } from '../../../mocks.js';
import { cleanupHooks, createElement } from '../../../test-utils.js';

describe('BrowserLocation', () => {
  const originalUrl = location.href;
  const originalState = history.state;
  let session!: RenderSession;

  beforeEach(() => {
    session = new RenderSession(
      [],
      ALL_LANES,
      new MockCoroutine(),
      new Runtime(new MockRenderHost()),
    );
  });

  afterEach(() => {
    cleanupHooks(session['_hooks']);
    history.replaceState(originalState, '', originalUrl);
    vi.restoreAllMocks();
  });

  it('gets the current location', () => {
    const state = { key: 'foo' };

    history.replaceState(state, '', '/articles/123');

    const [locationState, { getCurrentURL }] = session.use(BrowserLocation);

    expect(getCurrentURL().toString()).toBe('/articles/123');
    expect(location.pathname).toBe('/articles/123');
    expect(history.state).toStrictEqual(state);
    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.state).toStrictEqual(state);
    expect(locationState.navigationType).toBe('initial');
  });

  it('registers the current location', () => {
    const currentLocation = session.use(BrowserLocation);

    expect(session.use(CurrentLocation)).toBe(currentLocation);
  });

  it('adds event listeners', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    session.use(BrowserLocation);
    session.finalize();
    session.flush();

    expect(addEventListenerSpy).toHaveBeenCalledTimes(3);
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'submit',
      expect.any(Function),
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'popstate',
      expect.any(Function),
    );

    cleanupHooks(session['_hooks']);

    expect(removeEventListenerSpy).toHaveBeenCalledTimes(3);
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'submit',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'popstate',
      expect.any(Function),
    );
  });

  it('pushes a history entry with the new location', () => {
    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    const [locationState1, locationNavigator1] = session.use(BrowserLocation);

    session.finalize();
    session.flush();

    locationNavigator1.navigate(new RelativeURL('/articles/456'));

    const [locationState2, locationNavigator2] = session.use(BrowserLocation);

    expect(pushStateSpy).toHaveBeenCalledOnce();
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(locationState2).not.toBe(locationState1);
    expect(locationState2.url.toString()).toBe('/articles/456');
    expect(locationState2.state).toBe(null);
    expect(locationState2.navigationType).toBe('push');
    expect(locationNavigator2).toBe(locationNavigator1);
  });

  it('replaces the history entry with the new location', () => {
    const state = { key: 'foo' };

    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    const [locationState1, locationNavigator1] = session.use(BrowserLocation);

    session.finalize();
    session.flush();

    locationNavigator1.navigate(new RelativeURL('/articles/123'), {
      replace: true,
      state,
    });

    const [locationState2, locationNavigator2] = session.use(BrowserLocation);

    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledOnce();
    expect(locationState2).not.toBe(locationState1);
    expect(locationState2.url.toString()).toBe('/articles/123');
    expect(locationState2.state).toBe(state);
    expect(locationState2.navigationType).toBe('replace');
    expect(locationNavigator2).toBe(locationNavigator1);
  });

  it('should update the state when the link is clicked', () => {
    const element = createElement('a', { href: '/articles/123' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    const [locationState1] = session.use(BrowserLocation);

    session.finalize();
    session.flush();

    document.body.appendChild(element);
    element.dispatchEvent(event);
    document.body.removeChild(element);

    const [locationState2] = session.use(BrowserLocation);

    expect(locationState2).not.toBe(locationState1);
    expect(locationState2.url.toString()).toBe('/articles/123');
    expect(locationState2.state).toBe(null);
  });

  it('should update the state when the form is submitted', () => {
    const element = createElement('form', {
      method: 'GET',
      action: '/articles/123',
    });
    const event = new MouseEvent('submit', { bubbles: true, cancelable: true });

    const [locationState1] = session.use(BrowserLocation);

    session.finalize();
    session.flush();

    document.body.appendChild(element);
    element.dispatchEvent(event);
    document.body.removeChild(element);

    const [locationState2] = session.use(BrowserLocation);

    expect(locationState2).not.toBe(locationState1);
    expect(locationState2.url.toString()).toBe('/articles/123');
    expect(locationState2.state).toBe(null);
  });

  it('should update the location when the history has been changed', () => {
    const state = { key: 'foo' };

    const [locationState1] = session.use(BrowserLocation);

    session.finalize();
    session.flush();

    history.replaceState(state, '', '/articles/123');
    dispatchEvent(new PopStateEvent('popstate', { state }));

    const [locationState2] = session.use(BrowserLocation);

    expect(locationState2).not.toBe(locationState1);
    expect(locationState2.url.toString()).toBe('/articles/123');
    expect(locationState2.state).toBe(state);
    expect(locationState2.navigationType).toBe('traverse');
  });

  it('should not update the location when only the hash has been changed', () => {
    const state = { key: 'foo' };

    const [locationState1] = session.use(BrowserLocation);

    session.finalize();
    session.flush();

    history.replaceState(state, '', '#foo');
    dispatchEvent(new PopStateEvent('popstate', { state }));

    const [locationState2] = session.use(BrowserLocation);

    expect(locationState1).toBe(locationState2);
  });
});

describe('createLinkClickHandler()', () => {
  it('should push a new URL', () => {
    const container = createElement('div');
    const element = createElement('a', {
      href: '/foo?bar=123#baz',
    });
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => RelativeURL.fromLocation(location));
    const navigate = vi.fn();
    const clickHandler = vi.fn(
      createLinkClickHandler({ getCurrentURL, navigate }),
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
      href: location.href,
    });
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => RelativeURL.fromLocation(location));
    const navigate = vi.fn();
    const clickHandler = vi.fn(
      createLinkClickHandler({ getCurrentURL, navigate }),
    );

    container.appendChild(element);
    container.addEventListener('click', clickHandler);
    element.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
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
      href: '/foo?bar=123#baz',
      'data-link-replace': '',
      'data-link-no-scroll-reset': '',
    });
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => RelativeURL.fromLocation(location));
    const navigate = vi.fn();
    const clickHandler = vi.fn(
      createLinkClickHandler({ getCurrentURL, navigate }),
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

  it('should ignore the event if the location differs only in the hash', () => {
    const container = createElement('div');
    const element = createElement('a', {
      href: '#foo?bar=123#baz',
    });
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => RelativeURL.fromLocation(location));
    const navigate = vi.fn();
    const clickHandler = vi.fn(
      createLinkClickHandler({ getCurrentURL, navigate }),
    );

    container.appendChild(element);
    container.addEventListener('click', clickHandler);
    element.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(clickHandler).toHaveBeenCalledOnce();
    expect(clickHandler).toHaveBeenCalledWith(event);
    expect(location.hash).toBe(element.hash);
    expect(event.defaultPrevented).toBe(false);
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
        .mockImplementation(() => RelativeURL.fromLocation(location));
      const navigate = vi.fn();
      const clickHandler = vi.fn(
        createLinkClickHandler({ getCurrentURL, navigate }),
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
      .mockImplementation(() => RelativeURL.fromLocation(location));
    const navigate = vi.fn();
    const clickHandler = vi.fn(
      createLinkClickHandler({ getCurrentURL, navigate }),
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
    ['a', { href: '#/foo' }],
    ['a', { href: '/foo', download: '' }],
    ['a', { href: '/foo', rel: 'external' }],
    ['a', { href: '/foo', target: '_blank' }],
    ['a', {}],
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
        .mockImplementation(() => RelativeURL.fromLocation(location));
      const navigate = vi.fn();
      const clickHandler = vi.fn(
        createLinkClickHandler({ getCurrentURL, navigate }),
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

describe('createFormSubmitHandler()', () => {
  it('should push a new location when the from is submitted', () => {
    const form = createElement(
      'form',
      {
        method: 'GET',
        action: '/foo?bar=123#baz',
      },
      createElement('input', { type: 'hidden', name: 'qux', value: '456' }),
    );
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => RelativeURL.fromLocation(location));
    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(
      createFormSubmitHandler({ getCurrentURL, navigate }),
    );

    form.addEventListener('submit', formSubmitHandler);
    form.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?qux=456',
        hash: '#baz',
      }),
      { replace: false },
    );
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should push a new location when the from is submitted by the button', () => {
    const form = createElement(
      'form',
      {
        method: 'POST',
        action: '/',
      },

      createElement('button', {
        type: 'submit',
        formmethod: 'GET',
        formaction: '/foo?bar=123#baz',
        name: 'qux',
        value: '456',
      }),
    );
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
      submitter: form.querySelector('button'),
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => RelativeURL.fromLocation(location));
    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(
      createFormSubmitHandler({ getCurrentURL, navigate }),
    );

    form.addEventListener('submit', formSubmitHandler);
    form.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?qux=456',
        hash: '#baz',
      }),
      { replace: false },
    );
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should replace a new location when the form is submitted', () => {
    const form = createElement(
      'form',
      {
        method: 'GET',
        action: '/foo?bar=123#baz',
        'data-link-replace': '',
        'data-link-no-scroll-reset': '',
      },
      createElement('input', {
        type: 'hidden',
        name: 'qux',
        value: '456',
      }),
    );
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => RelativeURL.fromLocation(location));
    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(
      createFormSubmitHandler({ getCurrentURL, navigate }),
    );

    form.addEventListener('submit', formSubmitHandler);
    form.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?qux=456',
        hash: '#baz',
      }),
      { replace: true },
    );
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should ignore the event if its default action is prevented', () => {
    const form = createElement('form', {
      method: 'GET',
      action: '/foo?bar=123#baz',
    });
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => RelativeURL.fromLocation(location));
    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(
      createFormSubmitHandler({ getCurrentURL, navigate }),
    );

    event.preventDefault();
    form.addEventListener('submit', formSubmitHandler);
    form.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should ignore the event if the form method is not "GET"', () => {
    const form = createElement('form', {
      method: 'POST',
      action: '/foo?bar=123#baz',
    });
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => RelativeURL.fromLocation(location));
    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(
      createFormSubmitHandler({ getCurrentURL, navigate }),
    );

    form.addEventListener('submit', formSubmitHandler);
    form.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
  });

  it('should ignore the event If the origin of the action is different from the current location', () => {
    const form = createElement('form', {
      method: 'GET',
      action: 'https://example.com',
    });
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const getCurrentURL = vi
      .fn()
      .mockImplementation(() => RelativeURL.fromLocation(location));
    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(
      createFormSubmitHandler({ getCurrentURL, navigate }),
    );

    form.addEventListener('submit', formSubmitHandler);
    form.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
  });
});

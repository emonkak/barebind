import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Lanes } from '@/core.js';
import {
  BrowserHistory,
  createFormSubmitHandler,
  createLinkClickHandler,
} from '@/extensions/router/browser-history.js';
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

describe('BrowserHistory', () => {
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

    history.replaceState(state, '', '/articles/123');

    const [location, { getCurrentURL }] = session.use(BrowserHistory);

    expect(getCurrentURL().toString()).toBe('/articles/123');
    expect(window.location.pathname).toBe('/articles/123');
    expect(window.history.state).toStrictEqual(state);
    expect(location.url.toString()).toBe('/articles/123');
    expect(location.state).toStrictEqual(state);
    expect(location.navigationType).toBe(null);
  });

  it('registers the current history state', () => {
    const currentHistory = session.use(BrowserHistory);

    expect(session.use(CurrentHistory)).toBe(currentHistory);
  });

  it('adds event listeners', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    session.use(BrowserHistory);

    flushSession(session);

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

    disposeSession(session);

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

    const [location1, navigator1] = session.use(BrowserHistory);

    flushSession(session);

    navigator1.navigate(new RelativeURL('/articles/456'));

    const [location2, navigator2] = session.use(BrowserHistory);

    expect(pushStateSpy).toHaveBeenCalledOnce();
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(location2).not.toBe(location1);
    expect(location2.url.toString()).toBe('/articles/456');
    expect(location2.state).toBe(null);
    expect(location2.navigationType).toBe('push');
    expect(navigator2).toBe(navigator1);
  });

  it('replaces the history entry with the new location', () => {
    const state = { key: 'foo' };

    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    const [location1, navigator1] = session.use(BrowserHistory);

    flushSession(session);

    navigator1.navigate(new RelativeURL('/articles/123'), {
      replace: true,
      state,
    });

    const [location2, navigator2] = session.use(BrowserHistory);

    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledOnce();
    expect(location2).not.toBe(location1);
    expect(location2.url.toString()).toBe('/articles/123');
    expect(location2.state).toBe(state);
    expect(location2.navigationType).toBe('replace');
    expect(navigator2).toBe(navigator1);
  });

  it('should update the state when the link is clicked', () => {
    const element = createElement('a', { href: '/articles/123' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    const [location1] = session.use(BrowserHistory);

    flushSession(session);

    document.body.appendChild(element);
    element.dispatchEvent(event);
    document.body.removeChild(element);

    const [location2] = session.use(BrowserHistory);

    expect(location2).not.toBe(location1);
    expect(location2.url.toString()).toBe('/articles/123');
    expect(location2.state).toBe(null);
  });

  it('should update the state when the form is submitted', () => {
    const element = createElement('form', {
      method: 'GET',
      action: '/articles/123',
    });
    const event = new MouseEvent('submit', { bubbles: true, cancelable: true });

    const [location1] = session.use(BrowserHistory);

    flushSession(session);

    document.body.appendChild(element);
    element.dispatchEvent(event);
    document.body.removeChild(element);

    const [location2] = session.use(BrowserHistory);

    expect(location2).not.toBe(location1);
    expect(location2.url.toString()).toBe('/articles/123');
    expect(location2.state).toBe(null);
  });

  it('should update the location when the history has been changed', () => {
    const state = { key: 'foo' };

    const [location1] = session.use(BrowserHistory);

    flushSession(session);

    history.replaceState(state, '', '/articles/123');
    dispatchEvent(new PopStateEvent('popstate', { state }));

    const [location2] = session.use(BrowserHistory);

    expect(location2).not.toBe(location1);
    expect(location2.url.toString()).toBe('/articles/123');
    expect(location2.state).toBe(state);
    expect(location2.navigationType).toBe('traverse');
  });

  it('should not update the location when only the hash has been changed', () => {
    const state = { key: 'foo' };

    const [location1] = session.use(BrowserHistory);

    flushSession(session);

    history.replaceState(state, '', '#foo');
    dispatchEvent(new PopStateEvent('popstate', { state }));

    const [location2] = session.use(BrowserHistory);

    expect(location1).toBe(location2);
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
      .mockImplementation(() => RelativeURL.fromURL(location));
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
      .mockImplementation(() => RelativeURL.fromURL(location));
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
      .mockImplementation(() => RelativeURL.fromURL(location));
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
      .mockImplementation(() => RelativeURL.fromURL(location));
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
        .mockImplementation(() => RelativeURL.fromURL(location));
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
      .mockImplementation(() => RelativeURL.fromURL(location));
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
        .mockImplementation(() => RelativeURL.fromURL(location));
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
      .mockImplementation(() => RelativeURL.fromURL(location));
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
      .mockImplementation(() => RelativeURL.fromURL(location));
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
      .mockImplementation(() => RelativeURL.fromURL(location));
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
      .mockImplementation(() => RelativeURL.fromURL(location));
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
      .mockImplementation(() => RelativeURL.fromURL(location));
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
      .mockImplementation(() => RelativeURL.fromURL(location));
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

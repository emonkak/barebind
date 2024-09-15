import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type EffectHook,
  type Hook,
  HookType,
  createUpdateQueue,
} from '../../src/baseTypes.js';
import { RenderContext } from '../../src/renderContext.js';
import { ClientRenderHost } from '../../src/renderHost.js';
import {
  browserLocation,
  createBrowserClickHandler,
  createBrowserSubmitHandler,
  createHashClickHandler,
  currentLocation,
  hashLocation,
  resetScrollPosition,
} from '../../src/router/location.js';
import { RelativeURL } from '../../src/router/url.js';
import { SyncUpdater } from '../../src/updaters/syncUpdater.js';
import { MockBlock } from '../mocks.js';

describe('browserLocation', () => {
  const originalState = history.state;
  const originalUrl = location.href;
  let queue = createUpdateQueue();
  let hooks: Hook[] = [];

  afterEach(() => {
    cleanHooks(hooks);
    queue = createUpdateQueue();
    hooks = [];
    history.replaceState(originalState, '', originalUrl);
    vi.restoreAllMocks();
  });

  it('should return the current location of the browser', () => {
    const context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
      queue,
      hooks,
    );
    const state = { key: 'foo' };

    history.replaceState(state, '', '/articles/123');

    const [locationState, { getCurrentURL }] = context.use(browserLocation);
    context.finalize();
    context.flushUpdate();

    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.url.toString()).toStrictEqual(
      getCurrentURL().toString(),
    );
    expect(locationState.state).toBe(history.state);
    expect(locationState.navigationType).toBe('initial');
  });

  it('should push the a location to the history', () => {
    let context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
      queue,
      hooks,
    );

    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    let [locationState, { navigate }] = context.use(browserLocation);
    context.finalize();
    context.flushUpdate();

    navigate(new RelativeURL('/articles/456'));

    context = context.clone();
    [locationState] = context.use(browserLocation);

    expect(pushStateSpy).toHaveBeenCalledOnce();
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(locationState.url.toString()).toBe('/articles/456');
    expect(locationState.state).toBe(null);
    expect(locationState.navigationType).toBe('push');
  });

  it('should replace the new location to the session', () => {
    let context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
      queue,
      hooks,
    );

    const state = { key: 'foo' };
    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    let [locationState, { navigate }] = context.use(browserLocation);
    context.finalize();
    context.flushUpdate();

    navigate(new RelativeURL('/articles/123'), { replace: true, state });

    context = context.clone();
    [locationState] = context.use(browserLocation);

    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledOnce();
    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.state).toBe(state);
    expect(locationState.navigationType).toBe('replace');
  });

  it('should update the state when "popstate" event is fired', () => {
    let context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
      queue,
      hooks,
    );

    const state = { key: 'foo' };
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    let [locationState] = context.use(browserLocation);
    context.finalize();
    context.flushUpdate();

    history.replaceState(state, '', '/articles/123');
    dispatchEvent(new PopStateEvent('popstate', { state: state }));

    context = context.clone();
    [locationState] = context.use(browserLocation);

    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.state).toBe(state);
    expect(locationState.navigationType).toBe('traverse');

    location.hash = '#foo';

    context = context.clone();
    [locationState] = context.use(browserLocation);

    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.state).toBe(state);
    expect(locationState.navigationType).toBe('traverse');

    cleanHooks(hooks);

    expect(addEventListenerSpy).toHaveBeenCalled();
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'popstate',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'popstate',
      expect.any(Function),
    );
  });

  it('should update the state when "click" event is fired', () => {
    const context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
      queue,
      hooks,
    );
    const element = createElement('a', { href: '/articles/123' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const [, locationActions] = context.use(browserLocation);
    context.finalize();
    context.flushUpdate();

    document.body.appendChild(element);
    element.dispatchEvent(event);
    document.body.removeChild(element);

    expect(location.pathname).toBe('/articles/123');
    expect(history.state).toBe(null);
    expect(locationActions.getCurrentURL().toString()).toBe('/articles/123');

    cleanHooks(hooks);

    expect(addEventListenerSpy).toHaveBeenCalled();
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
    );
  });

  it('should update the state when "submit" event is fired', () => {
    const context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
      queue,
      hooks,
    );
    const element = createElement('form', {
      method: 'GET',
      action: '/articles/123',
    });
    const event = new MouseEvent('submit', { bubbles: true, cancelable: true });

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const [, locationActions] = context.use(browserLocation);
    context.finalize();
    context.flushUpdate();

    document.body.appendChild(element);
    element.dispatchEvent(event);
    document.body.removeChild(element);

    expect(location.pathname).toBe('/articles/123');
    expect(history.state).toBe(null);
    expect(locationActions.getCurrentURL().toString()).toBe('/articles/123');

    cleanHooks(hooks);

    expect(addEventListenerSpy).toHaveBeenCalled();
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'submit',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'submit',
      expect.any(Function),
    );
  });

  it('should register the current location', () => {
    const context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
      queue,
      hooks,
    );

    const locationState = context.use(browserLocation);

    expect(context.use(currentLocation)).toBe(locationState);

    context.finalize();
    context.flushUpdate();
  });
});

describe('currentLocation', () => {
  it('should throw an error if the current location is not registered', () => {
    const context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
    );

    expect(() => context.use(currentLocation)).toThrow(
      'A context value for the current location does not exist,',
    );
  });
});

describe('hashLocation', () => {
  const originalState = history.state;
  const originalUrl = location.href;
  let hooks: Hook[] = [];
  let queue = createUpdateQueue();

  afterEach(() => {
    cleanHooks(hooks);
    hooks = [];
    queue = createUpdateQueue();
    history.replaceState(originalState, '', originalUrl);
    vi.restoreAllMocks();
  });

  it('should return the current location by the fragment identifier', () => {
    const context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
      queue,
      hooks,
    );
    const state = { key: 'foo' };

    history.replaceState(state, '', '#/articles/foo%2Fbar');

    const [locationState, { getCurrentURL }] = context.use(hashLocation);
    context.finalize();
    context.flushUpdate();

    expect(location.hash).toBe('#/articles/foo%2Fbar');
    expect(locationState.url.toString()).toBe('/articles/foo%2Fbar');
    expect(locationState.url.toString()).toBe(getCurrentURL().toString());
    expect(locationState.state).toStrictEqual(state);
    expect(locationState.navigationType).toBe('initial');
  });

  it('should push a new location to the fragment identifier', () => {
    let context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
      queue,
      hooks,
    );

    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    let [locationState, { navigate }] = context.use(hashLocation);
    context.finalize();
    context.flushUpdate();

    navigate(new RelativeURL('/articles/foo%2Fbar'));

    context = context.clone();
    [locationState] = context.use(hashLocation);

    expect(location.hash).toBe('#/articles/foo%2Fbar');
    expect(history.state).toBe(null);
    expect(pushStateSpy).toHaveBeenCalledOnce();
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(locationState.url.toString()).toBe('/articles/foo%2Fbar');
    expect(locationState.state).toBe(history.state);
    expect(locationState.navigationType).toBe('push');
  });

  it('should replace a new location to the fragment identifier', () => {
    let context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
      queue,
      hooks,
    );
    const state = { key: 'foo' };

    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    let [locationState, { navigate }] = context.use(hashLocation);
    context.finalize();
    context.flushUpdate();

    navigate(new RelativeURL('/articles/foo%2Fbar'), { replace: true, state });

    context = context.clone();
    [locationState] = context.use(hashLocation);

    expect(location.hash).toBe('#/articles/foo%2Fbar');
    expect(history.state).toStrictEqual(state);
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledOnce();
    expect(locationState.url.toString()).toBe('/articles/foo%2Fbar');
    expect(locationState.state).toBe(state);
    expect(locationState.navigationType).toBe('replace');
  });

  it('should register the current location', () => {
    const context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
      queue,
      hooks,
    );
    const locationState = context.use(hashLocation);

    expect(context.use(currentLocation)).toBe(locationState);
  });

  it('should update the state when "hashchange" event is fired', () => {
    let context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
      queue,
      hooks,
    );
    const event = new HashChangeEvent('hashchange', {
      oldURL: location.href,
      newURL: getHrefWithoutHash(location) + '#/articles/foo%2Fbar',
    });

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    let [locationState] = context.use(hashLocation);
    context.finalize();
    context.flushUpdate();
    dispatchEvent(event);

    context = context.clone();
    [locationState] = context.use(hashLocation);

    expect(locationState.url.toString()).toBe('/articles/foo%2Fbar');
    expect(locationState.navigationType).toBe('traverse');

    cleanHooks(hooks);

    expect(addEventListenerSpy).toHaveBeenCalled();
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'hashchange',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'hashchange',
      expect.any(Function),
    );
  });

  it('should update the state when "click" event is fired', () => {
    let context = new RenderContext(
      new ClientRenderHost(),
      new SyncUpdater(),
      new MockBlock(),
      queue,
      hooks,
    );
    const element = createElement('a', { href: '#/articles/foo%2Fbar' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    let [locationState] = context.use(hashLocation);
    context.finalize();
    context.flushUpdate();

    document.body.appendChild(element);
    element.dispatchEvent(event);
    document.body.removeChild(element);

    context = context.clone();
    [locationState] = context.use(hashLocation);

    expect(locationState.url.toString()).toBe('/articles/foo%2Fbar');
    expect(locationState.navigationType).toBe('push');

    cleanHooks(hooks);

    expect(addEventListenerSpy).toHaveBeenCalled();
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
    );
  });
});

describe('createBrowserClickHandler', () => {
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
    const linkClickHandler = vi.fn(
      createBrowserClickHandler({ getCurrentURL, navigate }),
    );

    container.addEventListener('click', linkClickHandler);
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
    expect(linkClickHandler).toHaveBeenCalledOnce();
    expect(linkClickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('should replace the URL with a new one if the element has "data-link-replace" attribute', () => {
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
    const linkClickHandler = vi.fn(
      createBrowserClickHandler({ getCurrentURL, navigate }),
    );

    container.appendChild(element);
    container.addEventListener('click', linkClickHandler);
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
    expect(linkClickHandler).toHaveBeenCalledOnce();
    expect(linkClickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('should replace the URL with the same one if it has not changed', () => {
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
    const linkClickHandler = vi.fn(
      createBrowserClickHandler({ getCurrentURL, navigate }),
    );

    container.appendChild(element);
    container.addEventListener('click', linkClickHandler);
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
    expect(linkClickHandler).toHaveBeenCalledOnce();
    expect(linkClickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('should ignore the event if the new URL only differs by hash', () => {
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
    const linkClickHandler = vi.fn(
      createBrowserClickHandler({ getCurrentURL, navigate }),
    );

    container.appendChild(element);
    container.addEventListener('click', linkClickHandler);
    element.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(linkClickHandler).toHaveBeenCalledOnce();
    expect(linkClickHandler).toHaveBeenCalledWith(event);
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
    'should ignore the event if any modifier keys or a button other than left button is pressed',
    (eventInit) => {
      const container = createElement('div');
      const element = createElement('a');
      const event = new MouseEvent('click', eventInit);

      const getCurrentURL = vi
        .fn()
        .mockImplementation(() => RelativeURL.fromLocation(location));
      const navigate = vi.fn();
      const linkClickHandler = vi.fn(
        createBrowserClickHandler({ getCurrentURL, navigate }),
      );

      container.appendChild(element);
      container.addEventListener('click', linkClickHandler);
      element.dispatchEvent(event);

      expect(navigate).not.toHaveBeenCalled();
      expect(linkClickHandler).toHaveBeenCalledOnce();
      expect(linkClickHandler).toHaveBeenCalledWith(event);
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
    const linkClickHandler = vi.fn(
      createBrowserClickHandler({ getCurrentURL, navigate }),
    );

    event.preventDefault();
    container.appendChild(element);
    container.addEventListener('click', linkClickHandler);
    element.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(linkClickHandler).toHaveBeenCalledOnce();
    expect(linkClickHandler).toHaveBeenCalledWith(event);
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
      const linkClickHandler = vi.fn(
        createBrowserClickHandler({ getCurrentURL, navigate }),
      );
      const cancelHandler = vi.fn((event: Event) => {
        event.preventDefault();
      });

      cancelWrapper.appendChild(container);
      cancelWrapper.addEventListener('click', cancelHandler);
      container.appendChild(element);
      container.addEventListener('click', linkClickHandler);
      element.dispatchEvent(event);

      expect(navigate).not.toHaveBeenCalled();
      expect(linkClickHandler).toHaveBeenCalledOnce();
      expect(linkClickHandler).toHaveBeenCalledWith(event);
      expect(cancelHandler).toHaveBeenCalledOnce();
      expect(cancelHandler).toHaveBeenCalledWith(event);
    },
  );
});

describe('createBrowserSubmitHandler', () => {
  it('should push a new location when the from is submitted', () => {
    const form = createElement(
      'form',
      {
        method: 'GET',
        action: '/foo?bar=123#baz',
      },
      [createElement('input', { type: 'hidden', name: 'qux', value: '456' })],
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
      createBrowserSubmitHandler({ getCurrentURL, navigate }),
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
      [
        createElement('button', {
          type: 'submit',
          formmethod: 'GET',
          formaction: '/foo?bar=123#baz',
          name: 'qux',
          value: '456',
        }),
      ],
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
      createBrowserSubmitHandler({ getCurrentURL, navigate }),
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
      [
        createElement('input', {
          type: 'hidden',
          name: 'qux',
          value: '456',
        }),
      ],
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
      createBrowserSubmitHandler({ getCurrentURL, navigate }),
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
      createBrowserSubmitHandler({ getCurrentURL, navigate }),
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
      createBrowserSubmitHandler({ getCurrentURL, navigate }),
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
      createBrowserSubmitHandler({ getCurrentURL, navigate }),
    );

    form.addEventListener('submit', formSubmitHandler);
    form.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('createHashClickHandler', () => {
  it('should push a new URL', () => {
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
    const linkClickHandler = vi.fn(
      createHashClickHandler({ getCurrentURL, navigate }),
    );

    container.addEventListener('click', linkClickHandler);
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
    expect(linkClickHandler).toHaveBeenCalledOnce();
    expect(linkClickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('should replace the URL with a new one if the element has "data-link-replace" attribute', () => {
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
    const linkClickHandler = vi.fn(
      createHashClickHandler({ getCurrentURL, navigate }),
    );

    container.appendChild(element);
    container.addEventListener('click', linkClickHandler);
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
    expect(linkClickHandler).toHaveBeenCalledOnce();
    expect(linkClickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('should replace the URL with the same one if it has not changed', () => {
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
    const linkClickHandler = vi.fn(
      createHashClickHandler({ getCurrentURL, navigate }),
    );

    location.hash = '#/';
    container.appendChild(element);
    container.addEventListener('click', linkClickHandler);
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
    expect(linkClickHandler).toHaveBeenCalledOnce();
    expect(linkClickHandler).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([
    [{ altKey: true, bubbles: true }],
    [{ ctrlKey: true, bubbles: true }],
    [{ metaKey: true, bubbles: true }],
    [{ shiftKey: true, bubbles: true }],
    [{ button: 1, bubbles: true }],
  ])(
    'should ignore the event if any modifier keys or a button other than left button is pressed',
    (eventInit) => {
      const container = createElement('div');
      const element = createElement('a');
      const event = new MouseEvent('click', eventInit);

      const getCurrentURL = vi
        .fn()
        .mockImplementation(() => new RelativeURL('/'));
      const navigate = vi.fn();
      const linkClickHandler = vi.fn(
        createHashClickHandler({ getCurrentURL, navigate }),
      );

      container.appendChild(element);
      container.addEventListener('click', linkClickHandler);
      element.dispatchEvent(event);

      expect(navigate).not.toHaveBeenCalled();
      expect(linkClickHandler).toHaveBeenCalledOnce();
      expect(linkClickHandler).toHaveBeenCalledWith(event);
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
    const linkClickHandler = vi.fn(
      createHashClickHandler({ getCurrentURL, navigate }),
    );

    event.preventDefault();
    container.appendChild(element);
    container.addEventListener('click', linkClickHandler);
    element.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(linkClickHandler).toHaveBeenCalledOnce();
    expect(linkClickHandler).toHaveBeenCalledWith(event);
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
      const linkClickHandler = vi.fn(
        createHashClickHandler({ getCurrentURL, navigate }),
      );
      const cancelHandler = vi.fn((event: Event) => {
        event.preventDefault();
      });

      cancelWrapper.appendChild(container);
      cancelWrapper.addEventListener('click', cancelHandler);
      container.appendChild(element);
      container.addEventListener('click', linkClickHandler);
      element.dispatchEvent(event);

      expect(navigate).not.toHaveBeenCalled();
      expect(linkClickHandler).toHaveBeenCalledOnce();
      expect(linkClickHandler).toHaveBeenCalledWith(event);
      expect(cancelHandler).toHaveBeenCalledOnce();
      expect(cancelHandler).toHaveBeenCalledWith(event);
    },
  );
});

describe('resetScrollPosition', () => {
  const originalScrollRestoration = history.scrollRestoration;

  afterEach(() => {
    vi.restoreAllMocks();
    history.scrollRestoration = originalScrollRestoration;
  });

  it.each([['push'], ['reload'], ['replace'], ['traverse']] as const)(
    'should scroll to the top',
    (navigationType) => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo');

      history.scrollRestoration = 'manual';

      resetScrollPosition({
        url: new RelativeURL('/foo'),
        state: null,
        navigationType,
      });

      expect(scrollToSpy).toHaveBeenCalled();
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    },
  );

  it.each([['push'], ['reload'], ['replace'], ['traverse']] as const)(
    'should scroll to the element indicating hash',
    (navigationType) => {
      const element = createElement('div', {
        id: 'bar',
      });
      const scrollToSpy = vi.spyOn(window, 'scrollTo');
      const scrollIntoViewSpy = vi.spyOn(element, 'scrollIntoView');

      history.scrollRestoration = 'manual';

      document.body.appendChild(element);
      resetScrollPosition({
        url: new RelativeURL('/foo', '', '#bar'),
        state: null,
        navigationType,
      });
      document.body.removeChild(element);

      expect(scrollToSpy).not.toHaveBeenCalled();
      expect(scrollIntoViewSpy).toHaveBeenCalledOnce();
    },
  );

  it.each([['push'], ['reload'], ['replace'], ['traverse']] as const)(
    'should scroll to the top if there is not the element indicating hash',
    (navigationType) => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo');

      history.scrollRestoration = 'manual';

      resetScrollPosition({
        url: new RelativeURL('/foo', '', '#bar'),
        state: null,
        navigationType,
      });

      expect(scrollToSpy).toHaveBeenCalled();
    },
  );

  it.each([['reload'], ['traverse']] as const)(
    'should do nothing if the navigation type is "reload" or "traverse" and `history.scrollrestoration` is "auto"',
    (navigationType) => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo');

      history.scrollRestoration = 'auto';

      resetScrollPosition({
        url: new RelativeURL('/foo'),
        state: null,
        navigationType,
      });

      expect(scrollToSpy).not.toHaveBeenCalled();
    },
  );

  it('should do nothing if the navigation type is "initial"', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo');

    resetScrollPosition({
      url: new RelativeURL('/foo'),
      state: null,
      navigationType: 'initial',
    });

    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});

function cleanHooks(hooks: Hook[]): void {
  for (let i = hooks.length - 1; i >= 0; i--) {
    const hook = hooks[i]!;
    if (isEffectHook(hook)) {
      hook.cleanup?.();
    }
  }
}

function createElement<const T extends keyof HTMLElementTagNameMap>(
  tagName: T,
  attribues: { [key: string]: string } = {},
  children: Node[] = [],
): HTMLElementTagNameMap[T] {
  const element = document.createElement(tagName);
  for (const key in attribues) {
    element.setAttribute(key, attribues[key]!);
  }
  for (const child of children) {
    element.appendChild(child);
  }
  return element;
}

function getHrefWithoutHash(location: Location): string {
  return location.hash !== ''
    ? location.href.slice(0, -location.hash.length)
    : location.href;
}

function isEffectHook(hook: Hook): hook is EffectHook {
  return (
    hook.type === HookType.InsertionEffect ||
    hook.type === HookType.LayoutEffect ||
    hook.type === HookType.PassiveEffect
  );
}

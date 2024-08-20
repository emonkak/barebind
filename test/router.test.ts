import { afterEach, describe, expect, it, vi } from 'vitest';

import { type Hook, HookType, createUpdateQueue } from '../src/baseTypes.js';
import { RenderContext } from '../src/renderContext.js';
import {
  LocationType,
  RelativeURL,
  Router,
  browserLocation,
  createBrowserClickHandler,
  createBrowserSubmitHandler,
  createHashClickHandler,
  currentLocation,
  hashLocation,
  integer,
  resetScrollPosition,
  route,
  wildcard,
} from '../src/router.js';
import { UpdateHost } from '../src/updateHost.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import { MockBlock } from './mocks.js';

describe('Router', () => {
  const basicRouter = new Router([
    route([''], () => 'index'),
    route(['articles'], null, [
      route([/^\d+$/], ([id]) => `showArticle(${id})`, [
        route(['edit'], ([id]) => `editArticle(${id})`),
      ]),
    ]),
    route(['categories'], () => 'indexCategories', [
      route([''], () => 'indexCategories'),
      route([integer], ([id]) => `showCategory(${id})`),
    ]),
    route(['tags'], () => 'indexTags'),
    route(['tags', wildcard], ([label]) => `showTag(${label})`),
  ]);

  describe('.match()', () => {
    it('should return the handler that matches the URL', () => {
      expect(basicRouter.match(new RelativeURL(''))).toBe('index');
      expect(basicRouter.match(new RelativeURL('/'))).toBe('index');
      expect(basicRouter.match(new RelativeURL('/articles/123'))).toBe(
        'showArticle(123)',
      );
      expect(basicRouter.match(new RelativeURL('/articles/123/edit'))).toBe(
        'editArticle(123)',
      );
      expect(basicRouter.match(new RelativeURL('/tags'))).toBe('indexTags');
      expect(basicRouter.match(new RelativeURL('/tags/'))).toBe('showTag()');
      expect(basicRouter.match(new RelativeURL('/tags/javascript'))).toBe(
        'showTag(javascript)',
      );
      expect(basicRouter.match(new RelativeURL('/categories'))).toBe(
        'indexCategories',
      );
      expect(basicRouter.match(new RelativeURL('/categories/'))).toBe(
        'indexCategories',
      );
      expect(basicRouter.match(new RelativeURL('/categories/123'))).toBe(
        'showCategory(123)',
      );
    });

    it('should return null if the route restricts a trailing slash', () => {
      expect(basicRouter.match(new RelativeURL('/articles/123/'))).toBe(null);
      expect(basicRouter.match(new RelativeURL('/articles/123/edit/'))).toBe(
        null,
      );
      expect(basicRouter.match(new RelativeURL('/tags/javascript/'))).toBe(
        null,
      );
    });

    it('should return null if there is no route matches the URL', () => {
      expect(basicRouter.match(new RelativeURL('/articles'))).toBe(null);
      expect(basicRouter.match(new RelativeURL('/articles/'))).toBe(null);
      expect(basicRouter.match(new RelativeURL('/categories/abc/'))).toBe(null);
      expect(basicRouter.match(new RelativeURL('/not_found'))).toBe(null);
    });

    it('should dispatch a handler with args, url and state', () => {
      const handler = vi.fn(
        ([articleId, commentId]) =>
          `showArticleComment(${articleId}, ${commentId})`,
      );
      const router = new Router([
        route(['articles', /^\d+$/, 'comments', integer], handler),
      ]);
      const url = new RelativeURL('/articles/123/comments/456');
      const state = {};

      expect(router.match(url, state)).toBe('showArticleComment(123, 456)');
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(['123', 456], url, state);
    });

    it('should match with a custom pattern function', () => {
      const pattern = vi.fn((id) => +id);
      const router = new Router([
        route(['articles', pattern], ([id]) => `showArticle(${id})`),
      ]);
      const url = new RelativeURL('/articles/123');
      const state = {};

      expect(router.match(url, state)).toBe('showArticle(123)');
      expect(pattern).toHaveBeenCalledOnce();
      expect(pattern).toHaveBeenCalledWith('123', url, state);
    });
  });
});

describe('RelativeURL', () => {
  describe('.from()', () => {
    it.each([
      [new RelativeURL('/foo', '?bar=123', '#baz')],
      [new URL('/foo?bar=123#baz', 'file:')],
      [
        {
          pathname: '/foo',
          search: '?bar=123',
          hash: '#baz',
        },
      ],
      ['/foo?bar=123#baz'],
    ])(
      'should construct a new RelativeURL from the url like value',
      (value) => {
        const url = RelativeURL.from(value);
        expect(url.pathname).toBe('/foo');
        expect(url.search).toBe('?bar=123');
        expect(url.searchParams.toString()).toBe('bar=123');
        expect(url.hash).toBe('#baz');
        expect(url.toString()).toBe('/foo?bar=123#baz');
        expect(url.toJSON()).toBe('/foo?bar=123#baz');
      },
    );
  });

  describe('.fromString()', () => {
    it('should construct a new RelativeURL from the String', () => {
      const url = RelativeURL.fromString('/foo?bar=123#baz');
      expect(url.pathname).toBe('/foo');
      expect(url.search).toBe('?bar=123');
      expect(url.searchParams.toString()).toBe('bar=123');
      expect(url.hash).toBe('#baz');
      expect(url.toString()).toBe('/foo?bar=123#baz');
      expect(url.toJSON()).toBe('/foo?bar=123#baz');
    });
  });

  describe('.fromURL()', () => {
    it('should construct a new RelativeURL from the URL', () => {
      const url = RelativeURL.fromURL(new URL('/foo?bar=123#baz', 'file:'));
      expect(url.pathname).toBe('/foo');
      expect(url.search).toBe('?bar=123');
      expect(url.searchParams.toString()).toBe('bar=123');
      expect(url.hash).toBe('#baz');
      expect(url.toString()).toBe('/foo?bar=123#baz');
      expect(url.toJSON()).toBe('/foo?bar=123#baz');
    });
  });

  describe('.fromLocation()', () => {
    it('should construct a new RelativeURL from the LocationLike', () => {
      const url = RelativeURL.fromLocation({
        pathname: '/foo',
        search: '?bar=123',
        hash: '#baz',
      });
      expect(url.pathname).toBe('/foo');
      expect(url.search).toBe('?bar=123');
      expect(url.searchParams.toString()).toBe('bar=123');
      expect(url.hash).toBe('#baz');
      expect(url.toString()).toBe('/foo?bar=123#baz');
      expect(url.toJSON()).toBe('/foo?bar=123#baz');
    });
  });
});

describe('browserLocation', () => {
  const originalState = history.state;
  const originalUrl = location.href;
  const hooks: Hook[] = [];

  afterEach(() => {
    cleanHooks(hooks);
    history.replaceState(originalState, '', originalUrl);
    vi.restoreAllMocks();
  });

  it('should return the current location of the browser', () => {
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const state = { key: 'foo' };

    history.replaceState(state, '', '/articles/123');

    const context = new RenderContext(host, updater, block, hooks, queue);
    const [locationState, { getCurrentURL }] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.url.toString()).toEqual(getCurrentURL().toString());
    expect(locationState.state).toStrictEqual(history.state);
    expect(locationState.type).toBe(LocationType.Load);
  });

  it('should push the a location to the history', () => {
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState, { navigate }] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    navigate(new RelativeURL('/articles/456'));

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState] = context.use(browserLocation);

    expect(pushStateSpy).toHaveBeenCalledOnce();
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(locationState.url.toString()).toBe('/articles/456');
    expect(locationState.state).toStrictEqual(null);
    expect(locationState.type).toBe(LocationType.Push);
  });

  it('should replace the new location to the session', () => {
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const state = { key: 'foo' };
    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState, { navigate }] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    navigate(new RelativeURL('/articles/123'), { replace: true, state });

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState] = context.use(browserLocation);

    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledOnce();
    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.state).toStrictEqual(state);
    expect(locationState.type).toBe(LocationType.Replace);
  });

  it('should update the state when "popstate" event is fired', () => {
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const state = { key: 'foo' };
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    history.replaceState(state, '', '/articles/123');
    dispatchEvent(new PopStateEvent('popstate', { state: state }));

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState] = context.use(browserLocation);

    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.state).toStrictEqual(state);
    expect(locationState.type).toBe(LocationType.Pop);

    location.hash = '#foo';

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState] = context.use(browserLocation);

    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.state).toStrictEqual(state);
    expect(locationState.type).toBe(LocationType.Pop);

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
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const context = new RenderContext(host, updater, block, hooks, queue);
    const [, locationActions] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    const element = createElement('a', { href: '/articles/123' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

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
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const context = new RenderContext(host, updater, block, hooks, queue);
    const [, locationActions] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    const element = createElement('form', {
      method: 'GET',
      action: '/articles/123',
    });
    const event = new MouseEvent('submit', { bubbles: true, cancelable: true });

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
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const context = new RenderContext(host, updater, block, hooks, queue);
    const locationState = context.use(browserLocation);

    expect(context.use(currentLocation)).toStrictEqual(locationState);

    context.finalize();
    updater.flushUpdate(queue, host);
  });
});

describe('currentLocation', () => {
  it('should throw an error if the current location is not registered', () => {
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const hooks: Hook[] = [];
    const queue = createUpdateQueue();

    const context = new RenderContext(host, updater, block, hooks, queue);

    expect(() => context.use(currentLocation)).toThrow(
      'A context value for the current location does not exist,',
    );
  });
});

describe('hashLocation', () => {
  const originalState = history.state;
  const originalUrl = location.href;
  const hooks: Hook[] = [];

  afterEach(() => {
    cleanHooks(hooks);
    history.replaceState(originalState, '', originalUrl);
    vi.restoreAllMocks();
  });

  it('should return the current location by the fragment identifier', () => {
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const state = { key: 'foo' };

    history.replaceState(state, '', '#/articles/123');

    const context = new RenderContext(host, updater, block, hooks, queue);
    const [locationState, { getCurrentURL }] = context.use(hashLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    expect(location.hash).toBe('#/articles/123');
    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.url.toString()).toBe(getCurrentURL().toString());
    expect(locationState.state).toStrictEqual(state);
    expect(locationState.type).toBe(LocationType.Load);
  });

  it('should push a new location to the fragment identifier', () => {
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState, { navigate }] = context.use(hashLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    navigate(new RelativeURL('/articles/456'));

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState] = context.use(hashLocation);

    expect(location.hash).toBe('#/articles/456');
    expect(history.state).toBe(null);
    expect(pushStateSpy).toHaveBeenCalledOnce();
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(locationState.url.toString()).toBe('/articles/456');
    expect(locationState.state).toStrictEqual(history.state);
    expect(locationState.type).toBe(LocationType.Push);
  });

  it('should replace a new location to the fragment identifier', () => {
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const state = { key: 'foo' };
    const pushStateSpy = vi.spyOn(history, 'pushState');
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState, { navigate }] = context.use(hashLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    navigate(new RelativeURL('/articles/123'), { replace: true, state });

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState] = context.use(hashLocation);

    expect(location.hash).toBe('#/articles/123');
    expect(history.state).toStrictEqual(state);
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledOnce();
    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.state).toStrictEqual(history.state);
    expect(locationState.type).toBe(LocationType.Replace);
  });

  it('should register the current location', () => {
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const context = new RenderContext(host, updater, block, hooks, queue);
    const locationState = context.use(hashLocation);

    expect(context.use(currentLocation)).toStrictEqual(locationState);
  });

  it('should update the state when "hashchange" event is fired', () => {
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState] = context.use(hashLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    const event = new HashChangeEvent('hashchange', {
      oldURL: location.href,
      newURL: getHrefWithoutHash(location) + '#/articles/123',
    });
    dispatchEvent(event);

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState] = context.use(hashLocation);

    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.type).toBe(LocationType.Pop);

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
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState] = context.use(hashLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    const element = createElement('a', { href: '#/articles/123' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.body.appendChild(element);
    element.dispatchEvent(event);
    document.body.removeChild(element);

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState] = context.use(hashLocation);

    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.type).toBe(LocationType.Push);

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
      .mockImplementation(() => RelativeURL.fromLocation(location));
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
      href: '#/foo?bar=123#baz',
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
      .mockImplementation(() => RelativeURL.fromLocation(location));
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
        .mockImplementation(() => RelativeURL.fromLocation(location));
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
      .mockImplementation(() => RelativeURL.fromLocation(location));
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
        .mockImplementation(() => RelativeURL.fromLocation(location));
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

  it.each([[LocationType.Pop, LocationType.Push, LocationType.Replace]])(
    'should scroll to the top',
    (type) => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo');

      history.scrollRestoration = 'manual';

      resetScrollPosition({
        url: new RelativeURL('/foo'),
        state: null,
        type,
      });

      expect(scrollToSpy).toHaveBeenCalled();
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    },
  );

  it.each([[LocationType.Pop, LocationType.Push, LocationType.Replace]])(
    'should scroll to the element indicating hash',
    (type) => {
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
        type,
      });
      document.body.removeChild(element);

      expect(scrollToSpy).not.toHaveBeenCalled();
      expect(scrollIntoViewSpy).toHaveBeenCalledOnce();
    },
  );

  it.each([[LocationType.Pop, LocationType.Push, LocationType.Replace]])(
    'should scroll to the top if there is not the element indicating hash',
    (type) => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo');

      history.scrollRestoration = 'manual';

      resetScrollPosition({
        url: new RelativeURL('/foo', '', '#bar'),
        state: null,
        type,
      });

      expect(scrollToSpy).toHaveBeenCalled();
    },
  );

  it.each([[LocationType.Load, LocationType.Pop]])(
    'should do nothing if the navigate type is `Load` or `Pop`',
    (type) => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo');

      history.scrollRestoration = 'auto';

      resetScrollPosition({
        url: new RelativeURL('/foo'),
        state: null,
        type,
      });

      expect(scrollToSpy).not.toHaveBeenCalled();
    },
  );
});

function cleanHooks(hooks: Hook[]): void {
  for (let i = 0, l = hooks.length; i < l; i++) {
    const hook = hooks[i]!;
    if (
      hook.type === HookType.PassiveEffect ||
      hook.type === HookType.LayoutEffect
    ) {
      hook.cleanup?.();
    }
  }
  hooks.length = 0;
}

function createElement<const T extends keyof HTMLElementTagNameMap>(
  tagName: T,
  attribues: { [key: string]: string } = {},
  children: Element[] = [],
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

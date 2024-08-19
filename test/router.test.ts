import { afterEach, describe, expect, it, vi } from 'vitest';

import { type Hook, HookType, createUpdateQueue } from '../src/baseTypes.js';
import { RenderContext } from '../src/renderContext.js';
import {
  NavigateReason,
  RelativeURL,
  Router,
  browserLocation,
  createFormSubmitHandler,
  createLinkClickHandler,
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
    const [locationState] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    expect(location.pathname).toBe('/articles/123');
    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.state).toStrictEqual(history.state);
    expect(locationState.scrollReset).toBe(false);
    expect(locationState.reason).toBe(NavigateReason.Load);
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

    expect(location.pathname).toBe('/articles/456');
    expect(history.state).toBe(null);
    expect(pushStateSpy).toHaveBeenCalledOnce();
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(locationState.url.toString()).toBe('/articles/456');
    expect(locationState.state).toStrictEqual(history.state);
    expect(locationState.scrollReset).toBe(true);
    expect(locationState.reason).toBe(NavigateReason.Push);
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

    expect(location.pathname).toBe('/articles/123');
    expect(history.state).toStrictEqual(state);
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledOnce();
    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.state).toStrictEqual(history.state);
    expect(locationState.scrollReset).toBe(true);
    expect(locationState.reason).toBe(NavigateReason.Replace);
  });

  it('should update the state when the "popstate" event is tiggered', () => {
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const state = { key: 'foo' };
    const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    history.replaceState(state, '', '/articles/123');
    dispatchEvent(new PopStateEvent('popstate', { state: state }));

    expect(requestUpdateSpy).toHaveBeenCalledOnce();

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState] = context.use(browserLocation);

    expect(location.pathname).toBe('/articles/123');
    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.state).toStrictEqual(state);
    expect(locationState.scrollReset).toBe(false);
    expect(locationState.reason).toBe(NavigateReason.Pop);

    cleanHooks(hooks);

    expect(addEventListenerSpy).toHaveBeenCalledOnce();
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'popstate',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledOnce();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'popstate',
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
    const [locationState] = context.use(hashLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    expect(location.hash).toBe('#/articles/123');
    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.state).toStrictEqual(state);
    expect(locationState.scrollReset).toBe(false);
    expect(locationState.reason).toBe(NavigateReason.Load);
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
    expect(locationState.scrollReset).toBe(true);
    expect(locationState.reason).toBe(NavigateReason.Push);
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
    expect(locationState.scrollReset).toBe(true);
    expect(locationState.reason).toBe(NavigateReason.Replace);
  });

  it('should update the state when the "hashchange" event is tiggered', () => {
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const state = { key: 'foo' };
    const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState] = context.use(hashLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    history.replaceState(state, '', '#/articles/123');
    dispatchEvent(
      new HashChangeEvent('hashchange', {
        oldURL: '#',
        newURL: '#/articles/123',
      }),
    );

    expect(requestUpdateSpy).toHaveBeenCalledOnce();

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState] = context.use(hashLocation);

    expect(location.hash).toBe('#/articles/123');
    expect(locationState.url.toString()).toBe('/articles/123');
    expect(locationState.state).toStrictEqual(state);
    expect(locationState.scrollReset).toBe(false);
    expect(locationState.reason).toBe(NavigateReason.Pop);

    cleanHooks(hooks);

    expect(addEventListenerSpy).toHaveBeenCalledOnce();
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'hashchange',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledOnce();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'hashchange',
      expect.any(Function),
    );
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
});

describe('createFormSubmitHandler', () => {
  it('should push a new location when the from is submitted', () => {
    const form = document.createElement('form');
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(createFormSubmitHandler({ navigate }));

    form.addEventListener('submit', formSubmitHandler);
    form.setAttribute('method', 'GET');
    form.setAttribute('action', '/foo?bar=123#baz');
    form.innerHTML = `
      <input type="hidden" name="qux" value="456">
    `;
    form.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?qux=456',
        hash: '#baz',
      }),
      { replace: false, scrollReset: true },
    );
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should push a new location when the from is submitted by the button', () => {
    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(createFormSubmitHandler({ navigate }));

    const form = document.createElement('form');
    form.addEventListener('submit', formSubmitHandler);
    form.setAttribute('method', 'POST');
    form.setAttribute('action', '/');
    form.innerHTML = `
      <button type="submit" formmethod="get" formaction="/foo?bar#baz" name="qux" value="123"></button>
    `;

    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
      submitter: form.querySelector('button'),
    });
    form.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?qux=123',
        hash: '#baz',
      }),
      { replace: false, scrollReset: true },
    );
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should replace a new location when the form is submitted', () => {
    const form = document.createElement('form');
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(createFormSubmitHandler({ navigate }));

    form.addEventListener('submit', formSubmitHandler);
    form.setAttribute('method', 'GET');
    form.setAttribute('action', '/foo?bar=123#baz');
    form.setAttribute('data-link-replace', '');
    form.setAttribute('data-link-no-scroll-reset', '');
    form.innerHTML = `
      <input type="hidden" name="qux" value="456">
    `;
    form.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?qux=456',
        hash: '#baz',
      }),
      { replace: true, scrollReset: false },
    );
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should ignore the event if its default action is prevented', () => {
    const form = document.createElement('form');
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(createFormSubmitHandler({ navigate }));

    event.preventDefault();
    form.addEventListener('submit', formSubmitHandler);
    form.setAttribute('method', 'GET');
    form.setAttribute('action', '/foo?bar#baz');
    form.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should ignore the event if the form method is not "GET"', () => {
    const form = document.createElement('form');
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(createFormSubmitHandler({ navigate }));

    form.addEventListener('submit', formSubmitHandler);
    form.setAttribute('method', 'POST');
    form.setAttribute('action', '/foo?bar#baz');
    form.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
  });

  it('should ignore the event If the origin of the action is different from the current location', () => {
    const form = document.createElement('form');
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const formSubmitHandler = vi.fn(createFormSubmitHandler({ navigate }));

    form.addEventListener('submit', formSubmitHandler);
    form.setAttribute('method', 'GET');
    form.setAttribute('action', 'https://example.com');
    form.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(formSubmitHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('createLinkClickHandler', () => {
  it('should push a new location when the link is clicked', () => {
    const container = document.createElement('div');
    const element = document.createElement('a');
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const navigate = vi.fn();
    const linkClickHandler = vi.fn(createLinkClickHandler({ navigate }));

    container.addEventListener('click', linkClickHandler);
    container.appendChild(element);
    element.setAttribute('href', '/foo?bar=123#baz');
    element.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?bar=123',
        hash: '#baz',
      }),
      { replace: false, scrollReset: true },
    );
    expect(linkClickHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should replace a new location when the link is clicked', () => {
    const container = document.createElement('div');
    const element = document.createElement('a');
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    const navigate = vi.fn();
    const linkClickHandler = vi.fn(createLinkClickHandler({ navigate }));

    container.appendChild(element);
    container.addEventListener('click', linkClickHandler);
    element.setAttribute('href', '/foo?bar=123#baz');
    element.setAttribute('data-link-replace', '');
    element.setAttribute('data-link-no-scroll-reset', '');
    element.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/foo',
        search: '?bar=123',
        hash: '#baz',
      }),
      { replace: true, scrollReset: false },
    );
    expect(linkClickHandler).toHaveBeenCalledOnce();
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
      const container = document.createElement('div');
      const element = document.createElement('a');
      const event = new MouseEvent('click', eventInit);

      const navigate = vi.fn();
      const linkClickHandler = vi.fn(createLinkClickHandler({ navigate }));

      container.appendChild(element);
      container.addEventListener('click', linkClickHandler);
      element.dispatchEvent(event);

      expect(navigate).not.toHaveBeenCalled();
      expect(linkClickHandler).toHaveBeenCalledOnce();
      expect(event.defaultPrevented).toBe(false);
    },
  );

  it('should ignore the event if its default action is prevented', () => {
    const container = document.createElement('div');
    const element = document.createElement('a');
    const event = new MouseEvent('click', { cancelable: true, bubbles: true });

    const navigate = vi.fn();
    const linkClickHandler = vi.fn(createLinkClickHandler({ navigate }));

    event.preventDefault();
    container.appendChild(element);
    container.addEventListener('click', linkClickHandler);
    element.setAttribute('href', '/foo');
    element.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(linkClickHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('should ignore the event if the target is not valid as a link', () => {
    const container = document.createElement('div');
    const element = document.createElement('button');
    const event = new MouseEvent('click', {
      cancelable: true,
      bubbles: true,
    });

    const navigate = vi.fn();
    const linkClickHandler = vi.fn(createLinkClickHandler({ navigate }));

    container.appendChild(element);
    container.addEventListener('click', linkClickHandler);
    element.dispatchEvent(event);

    expect(navigate).not.toHaveBeenCalled();
    expect(linkClickHandler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('resetScrollPosition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should scroll to the top', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo');

    resetScrollPosition({
      url: new RelativeURL('/foo'),
      state: null,
      scrollReset: true,
      reason: NavigateReason.Load,
    });

    expect(scrollToSpy).toHaveBeenCalled();
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
  });

  it('should scroll to the top if there is not the element indicating hash', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo');

    resetScrollPosition({
      url: new RelativeURL('/foo', '', '#bar'),
      state: null,
      scrollReset: true,
      reason: NavigateReason.Load,
    });

    expect(scrollToSpy).toHaveBeenCalled();
  });

  it('should scroll to the element indicating hash', () => {
    const element = document.createElement('div');
    const scrollToSpy = vi.spyOn(window, 'scrollTo');
    const scrollIntoViewSpy = vi.spyOn(element, 'scrollIntoView');

    element.setAttribute('id', 'bar');
    document.body.appendChild(element);

    resetScrollPosition({
      url: new RelativeURL('/foo', '', '#bar'),
      state: null,
      scrollReset: true,
      reason: NavigateReason.Load,
    });

    document.body.removeChild(element);

    expect(scrollToSpy).not.toHaveBeenCalled();
    expect(scrollIntoViewSpy).toHaveBeenCalledOnce();
  });

  it('should do nothing if scroll reset is disabled', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo');

    resetScrollPosition({
      url: new RelativeURL('/foo'),
      state: null,
      scrollReset: false,
      reason: NavigateReason.Load,
    });

    expect(scrollToSpy).not.toHaveBeenCalled();
  });
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

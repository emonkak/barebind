import { afterEach, describe, expect, it, vi } from 'vitest';

import { type Hook, HookType, createUpdateQueue } from '../src/baseTypes.js';
import { RenderContext } from '../src/renderContext.js';
import {
  RelativeURL,
  Router,
  browserLocation,
  currentLocation,
  hashLocation,
  integer,
  navigateHandler,
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

  describe('.dispatch()', () => {
    it('should dispatch the handler that matches the URL', () => {
      expect(basicRouter.dispatch(new RelativeURL(''))).toBe('index');
      expect(basicRouter.dispatch(new RelativeURL('/'))).toBe('index');
      expect(basicRouter.dispatch(new RelativeURL('/articles/123'))).toBe(
        'showArticle(123)',
      );
      expect(basicRouter.dispatch(new RelativeURL('/articles/123/edit'))).toBe(
        'editArticle(123)',
      );
      expect(basicRouter.dispatch(new RelativeURL('/tags'))).toBe('indexTags');
      expect(basicRouter.dispatch(new RelativeURL('/tags/'))).toBe('showTag()');
      expect(basicRouter.dispatch(new RelativeURL('/tags/javascript'))).toBe(
        'showTag(javascript)',
      );
      expect(basicRouter.dispatch(new RelativeURL('/categories'))).toBe(
        'indexCategories',
      );
      expect(basicRouter.dispatch(new RelativeURL('/categories/'))).toBe(
        'indexCategories',
      );
      expect(basicRouter.dispatch(new RelativeURL('/categories/123'))).toBe(
        'showCategory(123)',
      );
    });

    it('should return null if the route restricts a trailing slash', () => {
      expect(basicRouter.dispatch(new RelativeURL('/articles/123/'))).toBe(
        null,
      );
      expect(basicRouter.dispatch(new RelativeURL('/articles/123/edit/'))).toBe(
        null,
      );
      expect(basicRouter.dispatch(new RelativeURL('/tags/javascript/'))).toBe(
        null,
      );
    });

    it('should return null if there is no route matches the URL', () => {
      expect(basicRouter.dispatch(new RelativeURL('/articles'))).toBe(null);
      expect(basicRouter.dispatch(new RelativeURL('/articles/'))).toBe(null);
      expect(basicRouter.dispatch(new RelativeURL('/categories/abc/'))).toBe(
        null,
      );
      expect(basicRouter.dispatch(new RelativeURL('/not_found'))).toBe(null);
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

      expect(router.dispatch(url, state)).toBe('showArticleComment(123, 456)');
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

      expect(router.dispatch(url, state)).toBe('showArticle(123)');
      expect(pattern).toHaveBeenCalledOnce();
      expect(pattern).toHaveBeenCalledWith('123', url, state);
    });
  });
});

describe('RelativeURL', () => {
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

  describe('.fromURL()', () => {
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

  afterEach(() => {
    history.replaceState(originalState, '', originalUrl);
    vi.restoreAllMocks();
  });

  it('should return a state represents the current location of the browser', () => {
    const hooks: Hook[] = [];
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

    expect(window.location.pathname).toBe('/articles/123');
    expect(locationState.url.pathname).toBe('/articles/123');
    expect(locationState.state).toStrictEqual(history.state);
  });

  it('should push the new location to the session history by push action', () => {
    const hooks: Hook[] = [];
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const state = { key: 'foo' };
    const pushStateSpy = vi.spyOn(history, 'pushState');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState, historyActions] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    historyActions.push(new RelativeURL('/articles/123'));
    expect(window.location.pathname).toBe('/articles/123');
    expect(history.state).toBe(null);
    expect(pushStateSpy).toHaveBeenCalledTimes(1);

    historyActions.push(new RelativeURL('/articles/456'), state);
    expect(window.location.pathname).toBe('/articles/456');
    expect(history.state).toStrictEqual(state);
    expect(pushStateSpy).toHaveBeenCalledTimes(2);

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState, historyActions] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    expect(locationState.url.pathname).toBe('/articles/456');
    expect(locationState.state).toStrictEqual(history.state);
  });

  it('should push the new location to the session history by replace action', () => {
    const hooks: Hook[] = [];
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const state = { key: 'foo' };
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState, historyActions] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    historyActions.replace(new RelativeURL('/articles/123'));
    expect(window.location.pathname).toBe('/articles/123');
    expect(history.state).toBe(null);
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);

    historyActions.replace(new RelativeURL('/articles/456'), state);
    expect(window.location.pathname).toBe('/articles/456');
    expect(history.state).toStrictEqual(state);
    expect(replaceStateSpy).toHaveBeenCalledTimes(2);

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState, historyActions] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    expect(locationState.url.pathname).toBe('/articles/456');
    expect(locationState.state).toStrictEqual(history.state);
  });

  it('should update the state when the "popstate" event is tiggered', () => {
    const hooks: Hook[] = [];
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const state = { key: 'foo' };
    const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    history.replaceState(state, '', '/articles/123');
    dispatchEvent(new PopStateEvent('popstate', { state: state }));

    expect(requestUpdateSpy).toHaveBeenCalledOnce();

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState] = context.use(browserLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    expect(window.location.pathname).toBe('/articles/123');
    expect(locationState.url.pathname).toBe('/articles/123');
    expect(locationState.state).toStrictEqual(state);

    cleanHooks(hooks);
    dispatchEvent(new PopStateEvent('popstate', { state: state }));

    expect(requestUpdateSpy).toHaveBeenCalledOnce();
  });

  it('should register the current location', () => {
    const hooks: Hook[] = [];
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const context = new RenderContext(host, updater, block, hooks, queue);
    const [locationState, historyActions] = context.use(browserLocation);

    expect(context.use(currentLocation)).toStrictEqual([
      locationState,
      historyActions,
    ]);

    context.finalize();
    updater.flushUpdate(queue, host);
  });
});

describe('currentLocation', () => {
  it('should throw an error if the current location registered as a context value does not exisit', () => {
    const hooks: Hook[] = [];
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
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

  afterEach(() => {
    history.replaceState(originalState, '', originalUrl);
    vi.restoreAllMocks();
  });

  it('should return a state represents the current location of the browser', () => {
    const hooks: Hook[] = [];
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

    expect(window.location.hash).toBe('#/articles/123');
    expect(locationState.url.pathname).toBe('/articles/123');
  });

  it('should push the new location to the session history by push action', () => {
    const hooks: Hook[] = [];
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const state = { key: 'foo' };
    const pushStateSpy = vi.spyOn(history, 'pushState');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState, historyActions] = context.use(hashLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    historyActions.push(new RelativeURL('/articles/123'));
    expect(window.location.hash).toBe('#/articles/123');
    expect(history.state).toBe(null);
    expect(pushStateSpy).toHaveBeenCalledTimes(1);

    historyActions.push(new RelativeURL('/articles/456'), state);
    expect(window.location.hash).toBe('#/articles/456');
    expect(history.state).toStrictEqual(state);
    expect(pushStateSpy).toHaveBeenCalledTimes(2);

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState, historyActions] = context.use(hashLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    expect(locationState.url.pathname).toBe('/articles/456');
    expect(locationState.state).toStrictEqual(history.state);
  });

  it('should push the new location to the session history by replace action', () => {
    const hooks: Hook[] = [];
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const state = { key: 'foo' };
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    let context = new RenderContext(host, updater, block, hooks, queue);
    let [locationState, historyActions] = context.use(hashLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    historyActions.replace(new RelativeURL('/articles/123'));
    expect(window.location.hash).toBe('#/articles/123');
    expect(history.state).toBe(null);
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);

    historyActions.replace(new RelativeURL('/articles/456'), state);
    expect(window.location.hash).toBe('#/articles/456');
    expect(history.state).toStrictEqual(state);
    expect(replaceStateSpy).toHaveBeenCalledTimes(2);

    context = new RenderContext(host, updater, block, hooks, queue);
    [locationState, historyActions] = context.use(hashLocation);
    context.finalize();
    updater.flushUpdate(queue, host);

    expect(locationState.url.pathname).toBe('/articles/456');
    expect(locationState.state).toStrictEqual(history.state);
  });

  it('should update the state when the "hashchange" event is tiggered', () => {
    const hooks: Hook[] = [];
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const state = { key: 'foo' };
    const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

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
    context.finalize();
    updater.flushUpdate(queue, host);

    expect(window.location.hash).toBe('#/articles/123');
    expect(locationState.url.pathname).toBe('/articles/123');
    expect(locationState.state).toStrictEqual(state);

    cleanHooks(hooks);
    dispatchEvent(
      new HashChangeEvent('hashchange', {
        oldURL: '#/articles/123',
        newURL: '#/articles/456',
      }),
    );

    expect(requestUpdateSpy).toHaveBeenCalledOnce();
  });

  it('should register the current location', () => {
    const hooks: Hook[] = [];
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const context = new RenderContext(host, updater, block, hooks, queue);
    const [locationState, historyActions] = context.use(hashLocation);

    expect(context.use(currentLocation)).toStrictEqual([
      locationState,
      historyActions,
    ]);

    context.finalize();
    updater.flushUpdate(queue, host);
  });
});

describe('navigateHandler', () => {
  const originalState = history.state;
  const originalUrl = location.href;

  afterEach(() => {
    history.replaceState(originalState, '', originalUrl);
    vi.restoreAllMocks();
  });

  it('should push the href attribute as a URL', () => {
    const hooks: Hook[] = [];
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const context = new RenderContext(host, updater, block, hooks, queue);
    const [, historyActions] = context.use(browserLocation);
    const handleNavigate = context.use(navigateHandler());

    const pushSpy = vi.spyOn(historyActions, 'push');
    const replaceSpy = vi.spyOn(historyActions, 'replace');
    const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/foo');
    anchor.addEventListener('click', handleNavigate);
    anchor.click();

    expect(pushSpy).toHaveBeenCalledOnce();
    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/foo' }),
      undefined,
    );
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(requestUpdateSpy).toHaveBeenCalledOnce();
  });

  it('should replace the href attribute as a URL', () => {
    const hooks: Hook[] = [];
    const host = new UpdateHost();
    const updater = new SyncUpdater();
    const block = new MockBlock();
    const queue = createUpdateQueue();

    const context = new RenderContext(host, updater, block, hooks, queue);
    const state = {};
    const [, historyActions] = context.use(browserLocation);
    const handleNavigate = context.use(
      navigateHandler({ mode: 'replace', state, urlAttribute: 'data-to' }),
    );

    const pushSpy = vi.spyOn(historyActions, 'push');
    const replaceSpy = vi.spyOn(historyActions, 'replace');
    const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

    const anchor = document.createElement('a');
    anchor.setAttribute('data-to', '/foo');
    anchor.addEventListener('click', handleNavigate);
    anchor.click();

    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledOnce();
    expect(replaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/foo' }),
      state,
    );
    expect(requestUpdateSpy).toHaveBeenCalledOnce();
  });
});

describe('integer()', () => {
  it('should convert the given string to a integer number', () => {
    expect(integer('123')).toBe(123);
    expect(integer('123.4')).toBe(null);
    expect(integer('123a')).toBe(null);
    expect(integer('-123')).toBe(-123);
    expect(integer('-123.4')).toBe(null);
    expect(integer('-123a')).toBe(null);
    expect(integer('010')).toBe(null);
    expect(integer('0b10')).toBe(null);
    expect(integer('0o10')).toBe(null);
    expect(integer('0x10')).toBe(null);
    expect(integer('1_000')).toBe(null);
    expect(integer('1e100')).toBe(null);
    expect(integer('abc')).toBe(null);
    expect(integer('')).toBe(null);
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
}

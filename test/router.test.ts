import { afterEach, describe, expect, it, vi } from 'vitest';

import { RenderContext } from '../src/renderContext.js';
import { RenderState } from '../src/renderState.js';
import {
  Router,
  browserLocation,
  integer,
  route,
  wildcard,
} from '../src/router.js';
import { type Hook, HookType } from '../src/types.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import { MockUpdateBlock } from './mocks.js';

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
      expect(basicRouter.dispatch({ pathname: '' } as URL)).toBe('index');
      expect(basicRouter.dispatch(localUrl('/'))).toBe('index');
      expect(basicRouter.dispatch(localUrl('/articles/123'))).toBe(
        'showArticle(123)',
      );
      expect(basicRouter.dispatch(localUrl('/articles/123/edit'))).toBe(
        'editArticle(123)',
      );
      expect(basicRouter.dispatch(localUrl('/tags'))).toBe('indexTags');
      expect(basicRouter.dispatch(localUrl('/tags/'))).toBe('showTag()');
      expect(basicRouter.dispatch(localUrl('/tags/javascript'))).toBe(
        'showTag(javascript)',
      );
      expect(basicRouter.dispatch(localUrl('/categories'))).toBe(
        'indexCategories',
      );
      expect(basicRouter.dispatch(localUrl('/categories/'))).toBe(
        'indexCategories',
      );
      expect(basicRouter.dispatch(localUrl('/categories/123'))).toBe(
        'showCategory(123)',
      );
    });

    it('should return null if the route restricts a trailing slash', () => {
      expect(basicRouter.dispatch(localUrl('/articles/123/'))).toBe(null);
      expect(basicRouter.dispatch(localUrl('/articles/123/edit/'))).toBe(null);
      expect(basicRouter.dispatch(localUrl('/tags/javascript/'))).toBe(null);
    });

    it('should return null if there is no route matches the URL', () => {
      expect(basicRouter.dispatch(localUrl('/articles'))).toBe(null);
      expect(basicRouter.dispatch(localUrl('/articles/'))).toBe(null);
      expect(basicRouter.dispatch(localUrl('/categories/abc/'))).toBe(null);
      expect(basicRouter.dispatch(localUrl('/not_found'))).toBe(null);
    });

    it('should dispatch a handler with args, url and state', () => {
      const handler = vi.fn(
        ([articleId, commentId]) =>
          `showArticleComment(${articleId}, ${commentId})`,
      );
      const router = new Router([
        route(['articles', /^\d+$/, 'comments', integer], handler),
      ]);
      const url = localUrl('/articles/123/comments/456');
      const historyState = {};

      expect(router.dispatch(url, historyState)).toBe(
        'showArticleComment(123, 456)',
      );
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(['123', 456], url, historyState);
    });

    it('should match with a custom pattern function', () => {
      const pattern = vi.fn((id) => +id);
      const router = new Router([
        route(['articles', pattern], ([id]) => `showArticle(${id})`),
      ]);
      const url = localUrl('/articles/123');
      const historyState = {};

      expect(router.dispatch(url, historyState)).toBe('showArticle(123)');
      expect(pattern).toHaveBeenCalledOnce();
      expect(pattern).toHaveBeenCalledWith('123', url, historyState);
    });
  });
});

describe('browserLocation', () => {
  const originalState = history.state;
  const originalUrl = location.href;

  afterEach(() => {
    history.replaceState(originalState, '', originalUrl);
  });

  it('should return a state represents the current location of the browser window', () => {
    const hooks: Hook[] = [];
    const block = new MockUpdateBlock();
    const state = new RenderState();
    const updater = new SyncUpdater(state);

    let context = new RenderContext(hooks, block, state, updater);
    const historyState1 = { first: true };
    const historyState2 = { second: true };
    const historyState3 = { third: true };
    const requstUpdateSpy = vi.spyOn(block, 'requestUpdate');

    updateLocation('/articles/123', historyState1);
    expect(context.use(browserLocation)).toStrictEqual({
      url: expect.objectContaining({
        pathname: '/articles/123',
      }),
      state: historyState1,
    });
    context.finalize();
    updater.flush();

    expect(requstUpdateSpy).not.toHaveBeenCalled();

    updateLocation('/articles/456', historyState2);
    context = new RenderContext(hooks, block, state, updater);
    expect(context.use(browserLocation)).toStrictEqual({
      url: expect.objectContaining({
        pathname: '/articles/456',
      }),
      state: historyState2,
    });
    context.finalize();

    expect(updater.isPending()).toBe(false);
    expect(updater.isScheduled()).toBe(false);
    expect(requstUpdateSpy).toHaveBeenCalledOnce();

    cleanHooks(hooks);
    updateLocation('/articles/789', historyState3);

    expect(requstUpdateSpy).toHaveBeenCalledOnce();
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
    if (hook.type === HookType.Effect) {
      hook.cleanup?.();
    }
  }
}

function localUrl(path: string): URL {
  return new URL(path, location.origin);
}

function updateLocation(url: string, state: unknown) {
  // "popstate" event will not be emitted unless called by user action.
  // Therefore, we have to emit it ourselves.
  history.replaceState(state, '', url);
  dispatchEvent(new PopStateEvent('popstate', { state }));
}

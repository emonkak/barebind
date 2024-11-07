import { describe, expect, it, vi } from 'vitest';

import {
  Router,
  integer,
  regexp,
  route,
  wildcard,
} from '../../src/router/router.js';
import { RelativeURL } from '../../src/router/url.js';

describe('Router', () => {
  const basicRouter = new Router([
    route([''], () => 'index'),
    route(['articles'], null, [
      route([regexp(/^\d+$/)], ([id]) => `showArticle(${id})`, [
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
  const state = {};

  describe('.handle()', () => {
    it('should return the handler that matches the URL', () => {
      expect(basicRouter.handle(new RelativeURL(''), state)).toBe('index');
      expect(basicRouter.handle(new RelativeURL('/'), state)).toBe('index');
      expect(basicRouter.handle(new RelativeURL('/articles/123'), state)).toBe(
        'showArticle(123)',
      );
      expect(
        basicRouter.handle(new RelativeURL('/articles/123/edit'), state),
      ).toBe('editArticle(123)');
      expect(basicRouter.handle(new RelativeURL('/tags'), state)).toBe(
        'indexTags',
      );
      expect(basicRouter.handle(new RelativeURL('/tags/'), state)).toBe(
        'showTag()',
      );
      expect(
        basicRouter.handle(new RelativeURL('/tags/javascript'), state),
      ).toBe('showTag(javascript)');
      expect(
        basicRouter.handle(new RelativeURL('/tags/GNU%2FLinux'), state),
      ).toBe('showTag(GNU/Linux)');
      expect(basicRouter.handle(new RelativeURL('/categories'), state)).toBe(
        'indexCategories',
      );
      expect(basicRouter.handle(new RelativeURL('/categories/'), state)).toBe(
        'indexCategories',
      );
      expect(
        basicRouter.handle(new RelativeURL('/categories/123'), state),
      ).toBe('showCategory(123)');
    });

    it('should return null if the route restricts a trailing slash', () => {
      expect(basicRouter.handle(new RelativeURL('/articles/123/'), state)).toBe(
        null,
      );
      expect(
        basicRouter.handle(new RelativeURL('/articles/123/edit/'), state),
      ).toBe(null);
      expect(
        basicRouter.handle(new RelativeURL('/tags/javascript/'), state),
      ).toBe(null);
    });

    it('should return null if there is no route matches the URL', () => {
      expect(basicRouter.handle(new RelativeURL('/articles'), state)).toBe(
        null,
      );
      expect(basicRouter.handle(new RelativeURL('/articles/'), state)).toBe(
        null,
      );
      expect(
        basicRouter.handle(new RelativeURL('/categories/abc/'), state),
      ).toBe(null);
      expect(basicRouter.handle(new RelativeURL('/not_found'), state)).toBe(
        null,
      );
    });

    it('should dispatch a handler with args, url and state', () => {
      const handler = vi.fn(
        ([articleId, commentId]) =>
          `showArticleComment(${articleId}, ${commentId})`,
      );
      const router = new Router([
        route(['articles', regexp(/^\d+$/), 'comments', integer], handler),
      ]);
      const url = new RelativeURL('/articles/123/comments/456');

      expect(router.handle(url, state)).toBe('showArticleComment(123, 456)');
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(['123', 456], url, state);
    });

    it('should match with a custom matcher', () => {
      const matcher = vi.fn((id) => +id);
      const router = new Router([
        route(['articles', matcher], ([id]) => `showArticle(${id})`),
      ]);
      const url = new RelativeURL('/articles/123');

      expect(router.handle(url, state)).toBe('showArticle(123)');
      expect(matcher).toHaveBeenCalledOnce();
      expect(matcher).toHaveBeenCalledWith('123', url);
    });
  });
});

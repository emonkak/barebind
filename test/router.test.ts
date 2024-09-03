import { describe, expect, it, vi } from 'vitest';

import { RelativeURL } from '../src/location.js';
import { Router, integer, regexp, route, wildcard } from '../src/router.js';

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
      expect(basicRouter.match(new RelativeURL('/tags/GNU%2FLinux'))).toBe(
        'showTag(GNU/Linux)',
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
        route(['articles', regexp(/^\d+$/), 'comments', integer], handler),
      ]);
      const url = new RelativeURL('/articles/123/comments/456');
      const state = {};

      expect(router.match(url, state)).toBe('showArticleComment(123, 456)');
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(['123', 456], url, state);
    });

    it('should match with a custom matcher', () => {
      const matcher = vi.fn((id) => +id);
      const router = new Router([
        route(['articles', matcher], ([id]) => `showArticle(${id})`),
      ]);
      const url = new RelativeURL('/articles/123');
      const state = {};

      expect(router.match(url, state)).toBe('showArticle(123)');
      expect(matcher).toHaveBeenCalledOnce();
      expect(matcher).toHaveBeenCalledWith('123', url, state);
    });
  });
});

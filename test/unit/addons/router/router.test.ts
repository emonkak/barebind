import { describe, expect, it, vi } from 'vitest';

import { RelativeURL } from '@/addons/router/relative-url.js';
import {
  integer,
  Router,
  regexp,
  route,
  wildcard,
} from '@/addons/router/router.js';

describe('Router', () => {
  const appRouter = new Router([
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
  const context = {};

  describe('match()', () => {
    it('invokes the resolver that matches the URL', () => {
      expect(appRouter.match(new RelativeURL(''), context)).toBe('index');
      expect(appRouter.match(new RelativeURL('/'), context)).toBe('index');
      expect(appRouter.match(new RelativeURL('/articles/123'), context)).toBe(
        'showArticle(123)',
      );
      expect(
        appRouter.match(new RelativeURL('/articles/123/edit'), context),
      ).toBe('editArticle(123)');
      expect(appRouter.match(new RelativeURL('/tags'), context)).toBe(
        'indexTags',
      );
      expect(appRouter.match(new RelativeURL('/tags/'), context)).toBe(
        'showTag()',
      );
      expect(
        appRouter.match(new RelativeURL('/tags/javascript'), context),
      ).toBe('showTag(javascript)');
      expect(
        appRouter.match(new RelativeURL('/tags/GNU%2FLinux'), context),
      ).toBe('showTag(GNU/Linux)');
      expect(appRouter.match(new RelativeURL('/categories'), context)).toBe(
        'indexCategories',
      );
      expect(appRouter.match(new RelativeURL('/categories/'), context)).toBe(
        'indexCategories',
      );
      expect(appRouter.match(new RelativeURL('/categories/123'), context)).toBe(
        'showCategory(123)',
      );
    });

    it('returns null if the route restricts a trailing slash', () => {
      expect(appRouter.match(new RelativeURL('/articles/123/'), context)).toBe(
        null,
      );
      expect(
        appRouter.match(new RelativeURL('/articles/123/edit/'), context),
      ).toBe(null);
      expect(
        appRouter.match(new RelativeURL('/tags/javascript/'), context),
      ).toBe(null);
    });

    it('returns null if there is no route matches the URL', () => {
      expect(appRouter.match(new RelativeURL('/articles'), context)).toBe(null);
      expect(appRouter.match(new RelativeURL('/articles/'), context)).toBe(
        null,
      );
      expect(
        appRouter.match(new RelativeURL('/categories/abc/'), context),
      ).toBe(null);
      expect(appRouter.match(new RelativeURL('/not_found'), context)).toBe(
        null,
      );
    });

    it('invokes the resolver with captures, url and context', () => {
      const resolver = vi.fn(
        ([articleId, commentId]) =>
          `showArticleComment(${articleId}, ${commentId})`,
      );
      const router = new Router([
        route(['articles', regexp(/^\d+$/), 'comments', integer], resolver),
      ]);
      const url = new RelativeURL('/articles/123/comments/456');

      expect(router.match(url, context)).toBe('showArticleComment(123, 456)');
      expect(resolver).toHaveBeenCalledOnce();
      expect(resolver).toHaveBeenCalledWith(['123', 456], url, context);
    });

    it('should match with a custom matcher', () => {
      const matcher = vi.fn((id) => +id);
      const router = new Router([
        route(['articles', matcher], ([id]) => `showArticle(${id})`),
      ]);
      const url = new RelativeURL('/articles/123');

      expect(router.match(url, context)).toBe('showArticle(123)');
      expect(matcher).toHaveBeenCalledOnce();
      expect(matcher).toHaveBeenCalledWith('123', url);
    });
  });
});

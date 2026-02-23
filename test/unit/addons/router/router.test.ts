import { describe, expect, it, vi } from 'vitest';

import { RelativeURL } from '@/addons/router/relative-url.js';
import {
  decoded,
  encoded,
  integer,
  Router,
  regexp,
  route,
} from '@/addons/router/router.js';

describe('Router', () => {
  const router = new Router([
    route([''], () => '/'),
    route(['articles'], null, [
      route([regexp(/^\d+$/)], ([match]) => `/articles/${match[0]}`, [
        route(['edit'], ([id]) => `/articles/${id}/edit`),
      ]),
      route([encoded], ([title]) => `/articles/${title}`),
    ]),
    route(['categories'], () => '/categories', [
      route([''], () => '/categories/'),
      route([integer], ([id]) => `/categories/${id}`),
    ]),
    route(['tags'], () => '/tags'),
    route(['tags', decoded], ([label]) => `/tags/${label}`),
  ]);

  describe('match()', () => {
    it('invokes the resolver that matches the URL', () => {
      expect(router.match(new RelativeURL(''))).toBe('/');
      expect(router.match(new RelativeURL('/'))).toBe('/');
      expect(router.match(new RelativeURL('/articles/123'))).toBe(
        '/articles/123',
      );
      expect(router.match(new RelativeURL('/articles/GNU%2FLinux'))).toBe(
        '/articles/GNU%2FLinux',
      );
      expect(router.match(new RelativeURL('/articles/123/edit'))).toBe(
        '/articles/123/edit',
      );
      expect(router.match(new RelativeURL('/tags'))).toBe('/tags');
      expect(router.match(new RelativeURL('/tags/'))).toBe('/tags/');
      expect(router.match(new RelativeURL('/tags/javascript'))).toBe(
        '/tags/javascript',
      );
      expect(router.match(new RelativeURL('/tags/GNU%2FLinux'))).toBe(
        '/tags/GNU/Linux',
      );
      expect(router.match(new RelativeURL('/categories'))).toBe('/categories');
      expect(router.match(new RelativeURL('/categories/'))).toBe(
        '/categories/',
      );
      expect(router.match(new RelativeURL('/categories/123'))).toBe(
        '/categories/123',
      );
    });

    it('returns null if the route restricts a trailing slash', () => {
      expect(router.match(new RelativeURL('/articles/123/'))).toBe(null);
      expect(router.match(new RelativeURL('/articles/123/edit/'))).toBe(null);
      expect(router.match(new RelativeURL('/tags/javascript/'))).toBe(null);
    });

    it('returns null if there is no route matches the URL', () => {
      expect(router.match(new RelativeURL('/articles'))).toBe(null);
      expect(router.match(new RelativeURL('/categories/abc/'))).toBe(null);
      expect(router.match(new RelativeURL('/not_found'))).toBe(null);
    });

    it('invokes the resolver with args', () => {
      const router = new Router([
        route(
          ['articles', regexp(/^\d+$/), 'comments', integer],
          (captures, url, ...args) => ({
            captures,
            url,
            args,
          }),
        ),
      ]);
      const url = new RelativeURL('/articles/123/comments/456');

      expect(router.match(url, 'foo', 'bar')).toStrictEqual({
        captures: [expect.arrayContaining(['123']), 456],
        url,
        args: ['foo', 'bar'],
      });
    });

    it('matches with a custom matcher', () => {
      const matcher = vi.fn((id) => +id);
      const router = new Router([
        route(['articles', matcher], (captures) => ({ captures })),
      ]);
      const url = new RelativeURL('/articles/123');

      expect(router.match(url)).toStrictEqual({ captures: [123] });
      expect(matcher).toHaveBeenCalledOnce();
      expect(matcher).toHaveBeenCalledWith('123', url);
    });

    it('matches with a nested router', () => {
      const parentRouter = new Router([route(['prefix'], null, [router])]);
      const url = new RelativeURL('/prefix/articles/123');

      expect(parentRouter.match(url)).toBe('/articles/123');
    });
  });
});

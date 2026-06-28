import { describe, expect, it } from 'vitest';
import { decoded, integer } from '@/addons/router/matchers.js';
import { type noMatch, Router, route } from '@/addons/router/router.js';

describe('Router', () => {
  describe('match()', () => {
    it('returns null for empty routes', () => {
      const router = new Router<unknown>([]);
      expect(router.match('/anything')).toBe(undefined);
    });

    it('matches root path', () => {
      const router = new Router<string>([route([''], () => 'root')]);
      expect(router.match('/')).toBe('root');
      expect(router.match('')).toBe('root');
    });

    it('matches exact string patterns', () => {
      const router = new Router<string>([route(['users'], () => 'users')]);
      expect(router.match('/users')).toBe('users');
      expect(router.match('/users/')).toBe(undefined);
    });

    it('matches routes with two or more string patterns', () => {
      const router = new Router<string>([route(['a', 'b', 'c'], () => 'abc')]);
      expect(router.match('/a')).toBe(undefined);
      expect(router.match('/a/b')).toBe(undefined);
      expect(router.match('/a/b/c')).toBe('abc');
      expect(router.match('/a/b/c/d')).toBe(undefined);
    });

    it('returns null when no route matches', () => {
      const router = new Router<string>([route(['foo'], () => 'foo')]);
      expect(router.match('/bar')).toBe(undefined);
      expect(router.match('/foo/bar')).toBe(undefined);
    });

    it('captures integer parameters', () => {
      const router = new Router<string>([
        route(['items', integer], ([id]) => `item:${id}`),
      ]);
      expect(router.match('/items/42')).toBe('item:42');
      expect(router.match('/items/abc')).toBe(undefined);
    });

    it('captures decoded parameters', () => {
      const router = new Router<string>([
        route(['users', decoded], ([name]) => `user:${name}`),
      ]);
      expect(router.match('/users/%E3%81%82')).toBe('user:あ');
    });

    it('captures multiple parameters', () => {
      const router = new Router<string>([
        route(['posts', integer, decoded], ([id, slug]) => `${id}-${slug}`),
      ]);
      expect(router.match('/posts/42/hello-world')).toBe('42-hello-world');
    });

    it('matches nested child routes', () => {
      const router = new Router<string>([
        route(['top'], null, [route([integer], ([page]) => `top:${page}`)]),
      ]);
      expect(router.match('/top')).toBe(undefined);
      expect(router.match('/top/1')).toBe('top:1');
      expect(router.match('/top/2')).toBe('top:2');
    });

    it('matches sibling routes in order', () => {
      const router = new Router<string>([
        route(['a'], () => 'first'),
        route(['b'], () => 'second'),
      ]);
      expect(router.match('/a')).toBe('first');
      expect(router.match('/b')).toBe('second');
    });

    it('skips non-matching routes and tries the next', () => {
      const router = new Router<string>([
        route(['a', integer], () => 'a-int'),
        route(['a', 'b'], () => 'a-b'),
      ]);
      expect(router.match('/a/b')).toBe('a-b');
      expect(router.match('/a/42')).toBe('a-int');
    });

    it('resolver receives captured parameters and url', () => {
      const router = new Router<string>([
        route(['items', integer], (captures, url) => `${captures[0]}:${url}`),
      ]);
      expect(router.match('/items/7')).toBe('7:/items/7');
    });

    it('handles resolver returning null via nullable resolver', () => {
      const router = new Router<string | null>([route(['null'], null)]);
      expect(router.match('/null')).toBe(undefined);
    });

    it('matches deeply nested routes', () => {
      const router = new Router<string>([
        route(['a'], null, [route(['b'], null, [route(['c'], () => 'deep')])]),
      ]);
      expect(router.match('/a/b/c')).toBe('deep');
      expect(router.match('/a/b')).toBe(undefined);
      expect(router.match('/a')).toBe(undefined);
    });

    it('passes url to matchers', () => {
      const captureUrl: (
        component: string,
        url: string,
      ) => string | typeof noMatch = (_component, url) => url;
      const router = new Router<string>([route([captureUrl], ([u]) => u)]);
      expect(router.match('/foo')).toBe('/foo');
    });

    it('matches nothing when path is longer than route patterns without children', () => {
      const router = new Router<string>([route(['a'], () => 'a')]);
      expect(router.match('/a/b/c')).toBe(undefined);
    });
  });
});

describe('route()', () => {
  it('creates a route with patterns and resolver', () => {
    const r = route(['a', 'b'], () => 'ok');
    expect(r.patterns).toEqual(['a', 'b']);
    expect(r.resolver).toBeInstanceOf(Function);
    expect(r.childRoutes).toEqual([]);
  });

  it('creates a route with two or more patterns including matchers', () => {
    const r = route(['posts', integer, decoded], () => 'ok');
    expect(r.patterns).toEqual(['posts', integer, decoded]);
    expect(r.resolver).toBeInstanceOf(Function);
    expect(r.childRoutes).toEqual([]);
  });

  it('creates a route with child routes', () => {
    const child = route(['c'], () => 'child');
    const r = route(['a'], null, [child]);
    expect(r.patterns).toEqual(['a']);
    expect(r.resolver).toBe(null);
    expect(r.childRoutes).toEqual([child]);
  });

  it('defaults childRoutes to empty array', () => {
    const r = route(['x'], () => 'y');
    expect(r.childRoutes).toEqual([]);
  });
});

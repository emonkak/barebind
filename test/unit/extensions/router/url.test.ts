import { describe, expect, it } from 'vitest';

import { RelativeURL } from '@/extensions/router/url.js';

describe('RelativeURL', () => {
  describe('.from()', () => {
    it.each([
      [new RelativeURL('/foo', '?bar=/123/', '#baz')],
      [new URL('/foo?bar=/123/#baz', 'file:')],
      [
        {
          pathname: '/foo',
          search: '?bar=/123/',
          hash: '#baz',
        },
      ],
      ['/foo?bar=/123/#baz'],
    ])('constructs a new relative URL from the url like value', (value) => {
      const url = RelativeURL.from(value);

      expect(url.pathname).toBe('/foo');
      expect(url.search).toBe('?bar=/123/');
      expect(url.searchParams.toString()).toBe('bar=%2F123%2F');
      expect(url.hash).toBe('#baz');
      expect(url.toString()).toBe('/foo?bar=/123/#baz');
      expect(url.toJSON()).toBe('/foo?bar=/123/#baz');
      expect(url.toURL('file:').toString()).toBe('file:///foo?bar=/123/#baz');
    });
  });

  describe('.fromString()', () => {
    it('constructs a new relative URL from the String', () => {
      const url = RelativeURL.fromString('/foo?bar=/123/#baz');

      expect(url.pathname).toBe('/foo');
      expect(url.search).toBe('?bar=/123/');
      expect(url.searchParams.toString()).toBe('bar=%2F123%2F');
      expect(url.hash).toBe('#baz');
      expect(url.toString()).toBe('/foo?bar=/123/#baz');
      expect(url.toJSON()).toBe('/foo?bar=/123/#baz');
      expect(url.toURL('file:').toString()).toBe('file:///foo?bar=/123/#baz');
    });

    it.each([
      ['/foo'],
      [new RelativeURL('/foo')],
      [new URL('/foo', 'file://')],
    ])(
      'constructs a new relative URL from the String with base URL',
      (base) => {
        const url = RelativeURL.fromString('?bar=/123/#baz', base);

        expect(url.pathname).toBe('/foo');
        expect(url.search).toBe('?bar=/123/');
        expect(url.searchParams.toString()).toBe('bar=%2F123%2F');
        expect(url.hash).toBe('#baz');
        expect(url.toString()).toBe('/foo?bar=/123/#baz');
        expect(url.toJSON()).toBe('/foo?bar=/123/#baz');
        expect(url.toURL('file:').toString()).toBe('file:///foo?bar=/123/#baz');
      },
    );
  });

  describe('.fromURL()', () => {
    it('constructs a new RelativeURL from the object like Location', () => {
      const url = RelativeURL.fromURL({
        pathname: '/foo',
        search: '?bar=/123/',
        hash: '#baz',
      });

      expect(url.pathname).toBe('/foo');
      expect(url.search).toBe('?bar=/123/');
      expect(url.searchParams.toString()).toBe('bar=%2F123%2F');
      expect(url.hash).toBe('#baz');
      expect(url.toString()).toBe('/foo?bar=/123/#baz');
      expect(url.toJSON()).toBe('/foo?bar=/123/#baz');
    });

    it.each([[new URL('/', 'file:'), new URL('/foo?bar=/123/#baz', 'file:')]])(
      'constructs a new RelativeURL from the URL',
      (inputUrl) => {
        const url = RelativeURL.fromURL(inputUrl);

        expect(url.pathname).toBe(inputUrl.pathname);
        expect(url.search).toBe(inputUrl.search);
        expect(url.searchParams.toString()).toBe(
          inputUrl.searchParams.toString(),
        );
        expect(url.hash).toBe(inputUrl.hash);
        expect(url.toString()).toBe(
          inputUrl.toString().slice(inputUrl.protocol.length + 2),
        );
        expect(url.toJSON()).toBe(
          inputUrl.toString().slice(inputUrl.protocol.length + 2),
        );
        expect(url.toURL('file:').toString()).toBe(inputUrl.toString());
      },
    );
  });
});

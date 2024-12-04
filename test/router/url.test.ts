import { describe, expect, it } from 'vitest';

import { RelativeURL } from '../../src/router/url.js';

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
        expect(url.toURL('file:').toString()).toBe('file:///foo?bar=123#baz');
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
      expect(url.toURL('file:').toString()).toBe('file:///foo?bar=123#baz');
    });

    it.each([
      ['/foo'],
      [new RelativeURL('/foo')],
      [new URL('/foo', 'file://')],
    ])(
      'should construct a new RelativeURL from the String with base URL',
      (base) => {
        const url = RelativeURL.fromString('?bar=123#baz', base);
        expect(url.pathname).toBe('/foo');
        expect(url.search).toBe('?bar=123');
        expect(url.searchParams.toString()).toBe('bar=123');
        expect(url.hash).toBe('#baz');
        expect(url.toString()).toBe('/foo?bar=123#baz');
        expect(url.toJSON()).toBe('/foo?bar=123#baz');
        expect(url.toURL('file:').toString()).toBe('file:///foo?bar=123#baz');
      },
    );
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
      expect(url.toURL('file:').toString()).toBe('file:///foo?bar=123#baz');
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

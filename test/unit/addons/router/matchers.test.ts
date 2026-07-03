import { describe, expect, it } from 'vitest';
import {
  choice,
  decoded,
  encoded,
  integer,
  keyword,
  regexp,
  select,
} from '@/addons/router/matchers.js';

describe('decoded()', () => {
  it('decodes URI components', () => {
    expect(decoded('hello')).toBe('hello');
    expect(decoded('%20')).toBe(' ');
    expect(decoded('%2F')).toBe('/');
    expect(decoded('%E3%81%82')).toBe('あ');
  });
});

describe('encoded()', () => {
  it('returns the component as-is', () => {
    expect(encoded('hello')).toBe('hello');
    expect(encoded('%20')).toBe('%20');
    expect(encoded('')).toBe('');
  });
});

describe('integer()', () => {
  it('parses valid integers', () => {
    expect(integer('0')).toBe(0);
    expect(integer('1')).toBe(1);
    expect(integer('42')).toBe(42);
    expect(integer('100')).toBe(100);
  });

  it('returns undefined for invalid integers', () => {
    expect(integer('')).toBe(undefined);
    expect(integer('abc')).toBe(undefined);
    expect(integer('12a')).toBe(undefined);
    expect(integer('3.14')).toBe(undefined);
    expect(integer('01')).toBe(undefined);
  });
});

describe('keyword()', () => {
  it('matches the exact keyword', () => {
    const matchFoo = keyword('foo');
    expect(matchFoo('foo', '')).toBe('foo');
    expect(matchFoo('bar', '')).toBe(undefined);
  });
});

describe('regexp()', () => {
  it('matches against the component', () => {
    const matchId = regexp(/^([a-z0-9]+)$/);
    const result = matchId('abc123', '');
    expect(result).not.toBe(undefined);
    expect([...(result as RegExpMatchArray)]).toStrictEqual([
      'abc123',
      'abc123',
    ]);
  });

  it('returns noMatch on failure', () => {
    const matchDigits = regexp(/^\d+$/);
    expect(matchDigits('abc', '')).toBe(undefined);
  });
});

describe('choice()', () => {
  it('returns the first matching result', () => {
    const m = choice(integer, decoded);
    expect(m('42', '')).toBe(42);
    expect(m('hello', '')).toBe('hello');
  });

  it('returns noMatch when none match', () => {
    const m = choice(integer, keyword('foo'));
    expect(m('bar', '')).toBe(undefined);
  });
});

describe('select()', () => {
  it('transforms the matched value', () => {
    const m = select(integer, (n) => n * 2);
    expect(m('21', '')).toBe(42);
  });

  it('returns noMatch when the inner matcher fails', () => {
    const m = select(integer, (n) => n * 2);
    expect(m('abc', '')).toBe(undefined);
  });
});

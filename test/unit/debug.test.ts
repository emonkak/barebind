import { describe, expect, it } from 'vitest';
import { Directive, Primitive, Scope } from '@/core.js';
import {
  formatOwnerStack,
  formatValue,
  getOwnerStack,
  MAX_ARRAY_LENGTH,
  MAX_STRING_LENGTH,
} from '@/debug.js';
import { MockCoroutine } from '../mocks.js';

describe('formatOwnerStack()', () => {
  it('formats the owner stack as a tree', () => {
    const grandParent = new MockCoroutine('GrandParent');
    const parent = new MockCoroutine('Parent', Scope.Child(grandParent));
    const child = new MockCoroutine('Child', Scope.Child(parent));

    expect(formatOwnerStack(getOwnerStack(child))).toBe(`GrandParent
\`- Parent
   \`- Child <- ERROR occurred here!`);
  });
});

describe('formatValue()', () => {
  describe('string', () => {
    it('returns a JSON-quoted string', () => {
      expect(formatValue('hello')).toBe('"hello"');
    });

    it('escapes special characters', () => {
      expect(formatValue('a"b')).toBe('"a\\"b"');
    });

    it('returns the quoted string when length equals MAX_STRING_LENGTH', () => {
      const s = 'a'.repeat(MAX_STRING_LENGTH);
      expect(formatValue(s)).toBe(JSON.stringify(s));
    });

    it("returns 'String' when length exceeds MAX_STRING_LENGTH", () => {
      expect(formatValue('a'.repeat(MAX_STRING_LENGTH + 1))).toBe('String');
    });
  });

  describe('number', () => {
    it('formats integers', () => {
      expect(formatValue(42)).toBe('42');
    });

    it('formats floats', () => {
      expect(formatValue(3.14)).toBe('3.14');
    });

    it('formats NaN', () => {
      expect(formatValue(NaN)).toBe('NaN');
    });

    it('formats Infinity', () => {
      expect(formatValue(Infinity)).toBe('Infinity');
    });

    it("formats -0 as '-0'", () => {
      expect(formatValue(-0)).toBe('-0');
    });

    it("formats 0 as '0'", () => {
      expect(formatValue(0)).toBe('0');
    });
  });

  describe('undefined', () => {
    it("returns 'undefined'", () => {
      expect(formatValue(undefined)).toBe('undefined');
    });
  });

  describe('boolean', () => {
    it('formats true', () => {
      expect(formatValue(true)).toBe('true');
    });

    it('formats false', () => {
      expect(formatValue(false)).toBe('false');
    });
  });

  describe('function', () => {
    it('returns Function(name) for named functions', () => {
      function myFn() {}
      expect(formatValue(myFn)).toBe('Function(myFn)');
    });

    it('returns constructor name for anonymous functions', () => {
      expect(formatValue((() => {}) as any)).toBe('Function');
    });
  });

  describe('null', () => {
    it("returns 'null'", () => {
      expect(formatValue(null)).toBe('null');
    });
  });

  describe('Array', () => {
    it('formats an empty array', () => {
      expect(formatValue([])).toBe('[]');
    });

    it('formats a flat array', () => {
      expect(formatValue([1, 2, 3])).toBe('[1, 2, 3]');
    });

    it('formats nested arrays within depth limit', () => {
      expect(formatValue([[1, 2]])).toBe('[[1, 2]]');
    });

    it('truncates arrays longer than MAX_ARRAY_LENGTH', () => {
      const arr = Array.from({ length: MAX_ARRAY_LENGTH + 1 }, (_, i) => i);
      const result = formatValue(arr);
      expect(result).toContain(', ...');
      expect(result.split(',').length - 1).toBeLessThanOrEqual(
        MAX_ARRAY_LENGTH + 1,
      );
    });

    it("does not append '...' for arrays of exactly MAX_ARRAY_LENGTH", () => {
      const arr = Array.from({ length: MAX_ARRAY_LENGTH }, (_, i) => i);
      expect(formatValue(arr)).not.toContain('...');
    });

    it("returns '[...]' for a non-empty array beyond MAX_OBJECT_DEPTH", () => {
      expect(formatValue([[[[1]]]])).toBe('[[[[...]]]]');
    });

    it("returns '[]' for an empty array beyond MAX_OBJECT_DEPTH", () => {
      expect(formatValue([[[[]]]])).toBe('[[[[]]]]');
    });
  });

  describe('Directive', () => {
    it('formats a directive', () => {
      expect(formatValue(new Directive(Primitive, 1))).toBe(
        'Directive(Symbol(Directive.Primitive), 1)',
      );
    });
  });

  describe('plain object', () => {
    it('formats an empty object', () => {
      expect(formatValue({})).toBe('{}');
    });

    it('formats an object with properties', () => {
      expect(formatValue({ a: 1, b: 2 })).toBe('{ a: 1, b: 2 }');
    });

    it('quotes keys that require it', () => {
      expect(formatValue({ 'my-key': 1 })).toBe('{ "my-key": 1 }');
    });

    it('does not quote valid identifier keys', () => {
      expect(formatValue({ $a_1: 1 })).toBe('{ $a_1: 1 }');
    });

    it("returns '{...}' for a non-empty object beyond MAX_OBJECT_DEPTH", () => {
      expect(formatValue({ a: { b: { c: { d: 1 } } } })).toBe(
        '{ a: { b: { c: {...} } } }',
      );
    });

    it("returns '{}' for an empty object beyond MAX_OBJECT_DEPTH", () => {
      expect(formatValue({ a: { b: { c: {} } } })).toBe(
        '{ a: { b: { c: {} } } }',
      );
    });
  });

  describe('null-prototype objects', () => {
    it('formats a null-prototype object', () => {
      const obj = Object.create(null, {
        x: {
          value: 1,
          enumerable: true,
        },
      });
      expect(formatValue(obj)).toBe('{ x: 1 }');
    });
  });

  describe('class instances', () => {
    it('returns the constructor name', () => {
      class Foo {}
      expect(formatValue(new Foo())).toBe('Foo');
    });
  });

  describe('circular references', () => {
    it("returns '[Circular]' for a self-referencing object", () => {
      const obj: any = {};
      obj.self = obj;
      expect(formatValue(obj)).toBe('{ self: [Circular] }');
    });

    it("returns '[Circular]' for a self-referencing array", () => {
      const xs: unknown[] = [];
      xs.push(xs);
      expect(formatValue(xs)).toBe('[[Circular]]');
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  $debug,
  type Debuggable,
  debugValue,
  markUsedValue,
} from '@/debug/value.js';

describe('debugValue()', () => {
  const x = {};
  const circlerValue = { x: {} };
  circlerValue.x = circlerValue;

  it.each([
    [null, 'null'],
    [undefined, 'undefined'],
    [0, '0'],
    [-0, '-0'],
    [NaN, 'NaN'],
    [Infinity, 'Infinity'],
    [true, 'true'],
    [new Date(), 'Date'],
    [new Map(), 'Map'],
    [new Set(), 'Set'],
    [new (class Foo {})(), 'Foo'],
    [
      {
        [$debug]: (format) => `MyDebuggable(${format('foo')})`,
      } as Debuggable,
      'MyDebuggable("foo")',
    ],
    [function foo() {}, 'Function(foo)'],
    [() => {}, 'Function'],
    [[], '[]'],
    [[x, x], '[{}, {}]'],
    [
      [1, [2], { $qux: 3, 'foo-bar': 4 }],
      '[1, [2], { $qux: 3, "foo-bar": 4 }]',
    ],
    [{}, '{}'],
    [{ __proto__: null, foo: 1 }, '{ foo: 1 }'],
    [
      { foo: 1, bar: [2], baz: { $qux: 3, 'foo-bar': 4 } },
      '{ foo: 1, bar: [2], baz: { $qux: 3, "foo-bar": 4 } }',
    ],
    [{ foo: { bar: { baz: {} } } }, '{ foo: { bar: { baz: {} } } }'],
    [{ foo: { bar: { baz: [] } } }, '{ foo: { bar: { baz: [] } } }'],
    [
      { foo: { bar: { baz: { qux: 123 } } } },
      '{ foo: { bar: { baz: {...} } } }',
    ],
    [{ foo: { bar: { baz: [123] } } }, '{ foo: { bar: { baz: [...] } } }'],
    [circlerValue, '{ x: [Circular] }'],
  ])(
    'returns a string representation of the value',
    (value, expectedString) => {
      expect(debugValue(value)).toBe(expectedString);
    },
  );
});

describe('markUsedValue()', () => {
  it('returns a marker of the value', () => {
    expect(markUsedValue('foo')).toBe('[["foo" IS USED IN HERE!]]');
  });
});

import { describe, expect, it } from 'vitest';

import { $debug, type Debuggable, formatValue, nameOf } from '@/debug/value.js';

describe('formatValue()', () => {
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
    [{ foo: { bar: {} } }, '{ foo: { bar: {} } }'],
    [{ foo: { bar: [] } }, '{ foo: { bar: [] } }'],
    [{ foo: { bar: { baz: 123 } } }, '{ foo: { bar: {...} } }'],
    [{ foo: { bar: [123] } }, '{ foo: { bar: [...] } }'],
    ['abracadabra'.repeat(16), 'String'],
    [circlerValue, '{ x: [Circular] }'],
  ])(
    'returns the string representation of the value',
    (value, expectedString) => {
      expect(formatValue(value)).toBe(expectedString);
    },
  );
});

describe('nameOf()', () => {
  it.each([
    [{}, 'Object'],
    [{ __proto__: null }, 'Object'],
    [new Date(), 'Date'],
    [new (class Foo {})(), 'Foo'],
    [() => {}, 'Function'],
    [function foo() {}, 'foo'],
  ])('returns the name of the value', (value, expectedString) => {
    expect(nameOf(value)).toBe(expectedString);
  });
});

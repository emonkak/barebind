import { expect } from 'vitest';

declare module 'vitest' {
  interface AsymmetricMatchersContaining {
    exact: (expected: unknown) => unknown;
  }
}

expect.extend({
  exact: function (received: unknown, expected: unknown) {
    const { printReceived, printExpected } = this.utils;
    return {
      message: () =>
        `expected ${printExpected(expected)} ${this.isNot ? 'not ' : ''}to be ${printReceived(received)} // Object.is equality`,
      pass: Object.is(received, expected),
    };
  },
});

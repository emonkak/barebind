import { describe, expectTypeOf, it } from 'vitest';

import { Reactive } from '@/addons/reactive.js';

describe('Reactive', () => {
  describe('get()', () => {
    it('returns a nullable reactive if the key is generic', () => {
      expectTypeOf(
        Reactive.from({ foo: 123 } as Record<string, number>).get('foo'),
      ).toEqualTypeOf<Reactive<number | undefined>>();
      expectTypeOf(Reactive.from([123]).get(0)).toEqualTypeOf<
        Reactive<number | undefined>
      >();
      expectTypeOf(Reactive.from([123]).get('length')).toEqualTypeOf<
        Reactive<number>
      >();
    });

    it('returns undefined if the key is invalid', () => {
      expectTypeOf(Reactive.from(null).get('foo')).toEqualTypeOf<null>();
    });

    it('returns an unknown reactive if the key is not defined', () => {
      expectTypeOf(Reactive.from({}).get('foo')).toEqualTypeOf<
        Reactive<unknown>
      >();
    });

    it('returns a read-only reactive if the key is read-only', () => {
      expectTypeOf(
        Reactive.from({ foo: 124 } as Readonly<{ foo: number }>).get('foo'),
      ).toEqualTypeOf<Readonly<Reactive<number>>>();
    });

    it('returns a mutable reactive if the value is read-only array', () => {
      expectTypeOf(
        Reactive.from([] as ReadonlyArray<number>).get(0),
      ).toEqualTypeOf<Reactive<number | undefined>>();
    });
  });
});

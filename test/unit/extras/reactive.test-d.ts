import { describe, expectTypeOf, it } from 'vitest';

import { Reactive } from '@/extras/reactive.js';

describe('Reactive', () => {
  describe('get()', () => {
    it('returns a nullable reactive if the key is a generic property key', () => {
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
  });
});

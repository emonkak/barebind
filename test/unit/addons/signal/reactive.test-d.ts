import { describe, expectTypeOf, it } from 'vitest';
import { Reactive } from '@/addons/signal/reactive.js';

describe('Reactive', () => {
  describe('get()', () => {
    it('returns a nullable reactive for string indexes', () => {
      expectTypeOf(
        Reactive.from({ foo: 123 } as Record<string, number>).get('foo'),
      ).toEqualTypeOf<Reactive<number | undefined>>();
    });

    it('returns a nullable reactive for array indexes', () => {
      expectTypeOf(Reactive.from([123]).get(0)).toEqualTypeOf<
        Reactive<number | undefined>
      >();
    });

    it('returns a reactive for array length', () => {
      expectTypeOf(Reactive.from([123]).get('length')).toEqualTypeOf<
        Reactive<number>
      >();
    });

    it('returns a optional reactive for nullable values', () => {
      expectTypeOf(
        Reactive.from<{ value: number } | null>({ value: 123 }).get('value'),
      ).toEqualTypeOf<Reactive<number> | undefined>();
    });

    it('returns an unknown reactive for undefined keys', () => {
      expectTypeOf(Reactive.from({}).get('noKey')).toEqualTypeOf<
        Reactive<unknown>
      >();
    });

    it('returns an undefined when the value is primitive', () => {
      expectTypeOf(Reactive.from(null).get('noKey')).toEqualTypeOf<undefined>();
    });
  });
});

import { describe, expectTypeOf, it } from 'vitest';
import { Derivable } from '@/addons/signal/derivable.js';

describe('Derivable', () => {
  describe('get()', () => {
    it('returns a nullable derivable for string indexes', () => {
      expectTypeOf(
        Derivable.from({ foo: 123 } as Record<string, number>).get('foo'),
      ).toEqualTypeOf<Derivable<number | undefined>>();
    });

    it('returns a nullable derivable for array indexes', () => {
      expectTypeOf(Derivable.from([123]).get(0)).toEqualTypeOf<
        Derivable<number | undefined>
      >();
    });

    it('returns a derivable for array length', () => {
      expectTypeOf(Derivable.from([123]).get('length')).toEqualTypeOf<
        Derivable<number>
      >();
    });

    it('returns a optional derivable for nullable values', () => {
      expectTypeOf(
        Derivable.from<{ value: number } | null>({ value: 123 }).get('value'),
      ).toEqualTypeOf<Derivable<number> | undefined>();
    });

    it('returns a never derivable for undefined keys', () => {
      expectTypeOf(Derivable.from({}).get('noKey')).toEqualTypeOf<
        Derivable<never>
      >();
    });

    it('returns an undefined when the value is primitive', () => {
      expectTypeOf(
        Derivable.from(null).get('noKey'),
      ).toEqualTypeOf<undefined>();
    });
  });
});

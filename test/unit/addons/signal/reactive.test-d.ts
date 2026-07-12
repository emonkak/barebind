import { describe, expectTypeOf, it } from 'vitest';
import { Reactive } from '@/addons/signal/reactive.js';

describe('Reactive', () => {
  describe('set()', () => {
    it('accepts a typed value for a known key', () => {
      expectTypeOf(
        Reactive.from({ count: 0 }).set<'count'>,
      ).parameters.toEqualTypeOf<['count', number]>();
    });

    it('denies a value for a generic key', () => {
      expectTypeOf(Reactive.from({}).set).parameters.toExtend<
        [PropertyKey, never]
      >();
    });

    it('denies a value for a readonly property', () => {
      expectTypeOf(
        Reactive.from({ foo: 124 } as Readonly<{ foo: number }>).set<'foo'>,
      ).parameters.toEqualTypeOf<['foo', never]>();
    });
  });

  describe('get()', () => {
    it('returns a nullable reactive for a generic index signature', () => {
      expectTypeOf(
        Reactive.from({ foo: 123 } as Record<string, number>).get('foo'),
      ).toEqualTypeOf<Reactive<number | undefined>>();
    });

    it('returns a nullable reactive for an array index', () => {
      expectTypeOf(Reactive.from([123]).get(0)).toEqualTypeOf<
        Reactive<number | undefined>
      >();
    });

    it('returns a reactive for an explicit array property', () => {
      expectTypeOf(Reactive.from([123]).get('length')).toEqualTypeOf<
        Reactive<number>
      >();
    });

    it('returns undefined when the value is null', () => {
      expectTypeOf(Reactive.from(null).get('foo')).toEqualTypeOf<undefined>();
    });

    it('returns an unknown reactive for an undefined key', () => {
      expectTypeOf(Reactive.from({}).get('foo')).toEqualTypeOf<
        Reactive<unknown>
      >();
    });

    it('returns a read-only reactive for a readonly property', () => {
      expectTypeOf(
        Reactive.from({ foo: 124 } as Readonly<{ foo: number }>).get('foo'),
      ).toEqualTypeOf<Readonly<Reactive<number>>>();
    });

    it('returns a mutable reactive for a readonly array index', () => {
      expectTypeOf(
        Reactive.from([] as ReadonlyArray<number>).get(0),
      ).toEqualTypeOf<Reactive<number | undefined>>();
    });
  });
});

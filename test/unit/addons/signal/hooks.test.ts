import { describe, expect, it } from 'vitest';
import { LocalAtom, LocalComputed } from '@/addons/signal/hooks.js';
import { Atom, type Signal } from '@/addons/signal/signal.js';
import { TestRenderer } from '../../../test-renderer.js';

describe('LocalAtom()', () => {
  it('returns a custom hook that creates an atom signal with no subscription', async () => {
    const renderer = new TestRenderer((_props, session) => {
      const signal = session.use(LocalAtom(100));

      session.useEffect(() => {
        signal.value++;
      });

      return signal;
    });

    let signal1: Signal<number>;
    let signal2: Signal<number>;

    SESSION1: {
      signal1 = renderer.render({});
      expect(signal1.value).toBe(101);
    }

    SESSION2: {
      signal2 = renderer.render({});
      expect(signal2).toBe(signal1);
      expect(signal2.value).toBe(102);
    }
  });
});

describe('LocalComputed()', () => {
  it('returns a custom hook that creates a computed signal with no subscription', async () => {
    const foo = new Atom(1);
    const bar = new Atom(2);
    const baz = new Atom(3);
    const renderer = new TestRenderer((_props, session) => {
      const signal = session.use(
        LocalComputed((foo, bar, baz) => foo + bar + baz, [foo, bar, baz]),
      );

      session.useEffect(() => {
        foo.value++;
      });

      return signal;
    });

    let signal1: Signal<number>;
    let signal2: Signal<number>;

    SESSION1: {
      signal1 = renderer.render({});

      expect(signal1.value).toBe(7);
    }

    SESSION2: {
      signal2 = renderer.render({});

      expect(signal2).toBe(signal1);
      expect(signal2.value).toBe(8);
    }
  });
});

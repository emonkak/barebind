import { describe, expect, it, vi } from 'vitest';

import {
  Atom,
  Computed,
  LocalAtom,
  LocalComputed,
  type Signal,
  type SignalBinding,
  SignalDirective,
} from '@/addons/signal.js';
import {
  $toDirective,
  Lanes,
  PartType,
  type RenderContext,
} from '@/internal.js';
import type { RenderSession } from '@/render-session.js';
import {
  createRuntime,
  TestRenderer,
  TestUpdater,
} from '../../test-helpers.js';

describe('SignalDirective', () => {
  describe('resolveBinding()', () => {
    it('constructs a new SignalBinding', () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const runtime = createRuntime();
      const binding = SignalDirective.instance.resolveBinding(
        signal,
        part,
        runtime,
      );

      expect(binding.type).toBe(SignalDirective.instance);
      expect(binding.value).toBe(signal);
      expect(binding.part).toBe(part);
    });
  });
});

describe('SignalBinding', () => {
  describe('shouldUpdate()', () => {
    it('returns true if the subscribed value does not exist', () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const runtime = createRuntime();
      const binding = SignalDirective.instance.resolveBinding(
        signal,
        part,
        runtime,
      );

      expect(binding.shouldUpdate(signal)).toBe(true);
    });

    it('returns true if the signal is different from the new one', () => {
      const signal1 = new Atom('foo');
      const signal2 = new Atom('bar');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const updater = new TestUpdater();
      const binding = SignalDirective.instance.resolveBinding(
        signal1,
        part,
        updater.runtime,
      );

      updater.startUpdate((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate(signal1)).toBe(false);
      expect(binding.shouldUpdate(signal2)).toBe(true);
    });
  });

  describe('attach()', () => {
    it('schedule an update when the signal value has been changed', async () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const updater = new TestUpdater();
      const binding = SignalDirective.instance.resolveBinding(
        signal,
        part,
        updater.runtime,
      ) as SignalBinding<string>;

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.nodeValue).toBe(signal.value);
      }

      signal.value = 'bar';

      expect(binding.pendingLanes).toBe(
        Lanes.DefaultLane | Lanes.UserBlockingLane,
      );

      await Promise.resolve(); // wait dirty checking
      await Promise.resolve(); // wait scheduling

      expect(binding.pendingLanes).toBe(Lanes.NoLanes);
      expect(part.node.nodeValue).toBe(signal.value);
    });

    it('schedule an update when the signal itself has been changed', async () => {
      const signal1 = new Atom('foo');
      const signal2 = new Atom('bar');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const updater = new TestUpdater();
      const binding = SignalDirective.instance.resolveBinding(
        signal1,
        part,
        updater.runtime,
      ) as SignalBinding<string>;

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.nodeValue).toBe(signal1.value);
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = signal2;
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.nodeValue).toBe(signal2.value);
      }

      signal1.value = 'baz';
      signal2.value = 'qux';

      await Promise.resolve(); // wait dirty checking
      await Promise.resolve(); // wait scheduling

      expect(part.node.nodeValue).toBe('qux');
    });
  });

  describe('detach()', () => {
    it('unsubscribes the signal', async () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const updater = new TestUpdater();
      const binding = SignalDirective.instance.resolveBinding(
        signal,
        part,
        updater.runtime,
      ) as SignalBinding<string>;

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.nodeValue).toBe(signal.value);
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(part.node.nodeValue).toBe('');
      }

      signal.value = 'bar';

      await Promise.resolve(); // wait dirty checking
      await Promise.resolve(); // wait scheduling

      expect(part.node.nodeValue).toBe('');
    });
  });
});

describe('Signal', () => {
  describe('[$customHook]()', async () => {
    it('request an update if the signal value has been changed', async () => {
      const signal = new Atom('foo');
      const renderer = new TestRenderer();
      const callback = vi.fn((session: RenderContext) => {
        const value = session.use(signal);

        session.useEffect(() => {
          signal.value = 'bar';
          signal.value = 'baz';
        }, []);

        return value;
      });

      SESSION1: {
        renderer.startRender(callback);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveLastReturnedWith('foo');
      }

      await Promise.resolve(); // wait dirty checking
      await Promise.resolve(); // wait scheduling

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveLastReturnedWith('baz');

      signal.value = 'qux';

      await Promise.resolve(); // wait dirty checking
      await Promise.resolve(); // wait scheduling

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveLastReturnedWith('qux');

      renderer.finalizeHooks();

      signal.value = 'quux';

      expect(callback).toHaveBeenCalledTimes(3);
    });
  });

  describe('[$toDirective]()', () => {
    it('returns a DirectiveElement with the signal', () => {
      const signal = new Atom('foo');
      const directive = signal[$toDirective]();

      expect(directive.type).toBe(SignalDirective.instance);
      expect(directive.value).toBe(signal);
      expect(directive.layout).toBe(undefined);
    });
  });

  describe('map()', () => {
    it('returns a computed signal that depend on itself', () => {
      const signal = new Atom(100);
      const computedSignal = signal.map((count) => count * 2);

      expect(computedSignal).toBeInstanceOf(Computed);
      expect(computedSignal.value).toBe(200);
      expect(
        (computedSignal as Computed<number>)['_dependencies'],
      ).toStrictEqual([signal]);
    });
  });

  describe('valueOf()', () => {
    it('returns the signal value', () => {
      const value = 'foo';
      const signal = new Atom(value);

      expect(signal.valueOf()).toBe(value);
    });
  });
});

describe('Atom', () => {
  describe('value', () => {
    it('increments the version on update', () => {
      const signal = new Atom('foo');

      expect(signal.value).toBe('foo');
      expect(signal.version).toBe(0);

      signal.value = 'bar';

      expect(signal.value).toBe('bar');
      expect(signal.version).toBe(1);
    });
  });

  describe('subscribe()', () => {
    it('invokes the subscriber on update', () => {
      const signal = new Atom('foo');
      const subscriber = vi.fn();

      signal.subscribe(subscriber);
      expect(subscriber).toHaveBeenCalledTimes(0);

      signal.value = 'bar';
      expect(subscriber).toHaveBeenCalledTimes(1);

      signal.value = 'baz';
      expect(subscriber).toHaveBeenCalledTimes(2);
    });

    it('does not invoke the invalidated subscriber', () => {
      const signal = new Atom('foo');
      const subscriber = vi.fn();

      signal.subscribe(subscriber)();
      expect(subscriber).not.toHaveBeenCalled();

      signal.value = 'bar';
      expect(subscriber).not.toHaveBeenCalled();

      signal.value = 'baz';
      expect(subscriber).not.toHaveBeenCalled();
    });
  });

  describe('touch()', () => {
    it('increments the version and notify subscribers', () => {
      const signal = new Atom('foo');
      const subscriber = vi.fn();

      signal.subscribe(subscriber);
      signal.touch();

      expect(subscriber).toHaveBeenCalledOnce();
      expect(signal.value).toBe('foo');
      expect(signal.version).toBe(1);
    });
  });

  describe('write()', () => {
    it('updates the value without notifications', () => {
      const signal = new Atom('foo');
      const subscriber = vi.fn();

      signal.subscribe(subscriber);

      expect(signal.value).toBe('foo');
      expect(signal.version).toBe(0);

      signal.write('bar');

      expect(subscriber).not.toHaveBeenCalled();
      expect(signal.value).toBe('bar');
      expect(signal.version).toBe(0);
    });
  });
});

describe('Computed', () => {
  describe('value', () => {
    it('computes a memoized value by dependent signals', () => {
      const foo = new Atom(1);
      const bar = new Atom(2);
      const baz = new Atom(3);

      const signal = new Computed(
        (foo, bar, baz) => ({
          foo,
          bar,
          baz,
        }),
        [foo, bar, baz],
      );

      expect(signal.value).toStrictEqual({ foo: 1, bar: 2, baz: 3 });
      expect(signal.value).toBe(signal.value);
      expect(signal.version).toBe(0);
    });
  });

  describe('version', () => {
    it('increments the version when any dependent signals have been updated', () => {
      const foo = new Atom(1);
      const bar = new Atom(2);
      const baz = new Atom(3);

      const signal = new Computed(
        (foo, bar, baz) => ({
          foo,
          bar,
          baz,
        }),
        [foo, bar, baz],
      );

      foo.value = 10;
      expect(signal.value).toStrictEqual({ foo: 10, bar: 2, baz: 3 });
      expect(signal.version).toBe(1);

      bar.value = 20;
      expect(signal.value).toStrictEqual({ foo: 10, bar: 20, baz: 3 });
      expect(signal.version).toBe(2);

      baz.value = 30;
      expect(signal.value).toStrictEqual({ foo: 10, bar: 20, baz: 30 });
      expect(signal.version).toBe(3);
    });
  });

  describe('subscribe()', () => {
    it('invokes the subscriber when any dependent signals have been updated', () => {
      const foo = new Atom(1);
      const bar = new Atom(2);
      const baz = new Atom(3);
      const subscriber = vi.fn();

      const signal = new Computed(
        (foo, bar, baz) => foo + bar + baz,
        [foo, bar, baz],
      );

      signal.subscribe(subscriber);
      expect(subscriber).toHaveBeenCalledTimes(0);

      foo.value++;
      expect(subscriber).toHaveBeenCalledTimes(1);

      bar.value++;
      expect(subscriber).toHaveBeenCalledTimes(2);

      baz.value++;
      expect(subscriber).toHaveBeenCalledTimes(3);

      foo.value = foo.value;
      expect(subscriber).toHaveBeenCalledTimes(4);
    });

    it('does not invoke the invalidated subscriber', () => {
      const foo = new Atom(1);
      const bar = new Atom(2);
      const baz = new Atom(3);
      const subscriber = vi.fn();

      const signal = new Computed(
        (foo, bar, baz) => ({
          foo,
          bar,
          baz,
        }),
        [foo, bar, baz],
      );

      signal.subscribe(subscriber)();

      foo.value++;
      bar.value++;
      baz.value++;

      expect(subscriber).not.toHaveBeenCalled();
    });
  });
});

describe('LocalAtom()', () => {
  it('returns a custom hook that creates an atom signal with no subscription', async () => {
    const callback = (session: RenderSession) => {
      const signal = session.use(LocalAtom(100));

      session.useEffect(() => {
        signal.value++;
      });

      return signal;
    };
    const renderer = new TestRenderer();

    let stableSignal: Signal<number>;

    SESSION1: {
      stableSignal = renderer.startRender(callback);

      expect(stableSignal.value).toBe(101);
    }

    SESSION2: {
      const signal = renderer.startRender(callback);

      expect(signal).toBe(stableSignal);
      expect(signal.value).toBe(102);
    }
  });
});

describe('LocalComputed()', () => {
  it('returns a custom hook that creates a computed signal with no subscription', async () => {
    const foo = new Atom(1);
    const bar = new Atom(2);
    const baz = new Atom(3);
    const callback = (session: RenderSession) => {
      const signal = session.use(
        LocalComputed((foo, bar, baz) => foo + bar + baz, [foo, bar, baz]),
      );

      session.useEffect(() => {
        foo.value++;
      });

      return signal;
    };
    const renderer = new TestRenderer();

    let stableSignal: Signal<number>;

    SESSION1: {
      stableSignal = renderer.startRender(callback);

      expect(stableSignal.value).toBe(7);
    }

    SESSION2: {
      const signal = renderer.startRender(callback);

      expect(signal).toBe(stableSignal);
      expect(signal.value).toBe(8);
    }
  });
});

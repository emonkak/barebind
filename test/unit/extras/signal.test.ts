import { describe, expect, it, vi } from 'vitest';
import {
  Atom,
  Computed,
  type SignalBinding,
  SignalDirective,
} from '@/extras/signal.js';
import { createHydrationTree } from '@/hydration.js';
import { $toDirective, HydrationError, Lanes, PartType } from '@/internal.js';
import { Runtime } from '@/runtime.js';
import { MockBackend } from '../../mocks.js';
import {
  createSession,
  disposeSession,
  flushSession,
  waitForUpdate,
} from '../../session-utils.js';
import { createElement } from '../../test-utils.js';

describe('SignalDirective', () => {
  describe('name', () => {
    it('is a string that represents the directive itself', () => {
      expect(SignalDirective.name, 'SignalDirective');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new SignalBinding', () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const runtime = Runtime.create(new MockBackend());
      const binding = SignalDirective.resolveBinding(signal, part, runtime);

      expect(binding.type).toBe(SignalDirective);
      expect(binding.value).toBe(signal);
      expect(binding.part).toBe(part);
    });
  });
});

describe('SiganlBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the subscribed value does not exist', () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const runtime = Runtime.create(new MockBackend());
      const binding = SignalDirective.resolveBinding(signal, part, runtime);

      expect(binding.shouldBind(signal)).toBe(true);
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
      const runtime = Runtime.create(new MockBackend());
      const binding = SignalDirective.resolveBinding(signal1, part, runtime);

      binding.connect(runtime);
      binding.commit(runtime);

      expect(binding.shouldBind(signal1)).toBe(false);
      expect(binding.shouldBind(signal2)).toBe(true);
    });
  });

  describe('hydrate()', () => {
    it('hydrates the tree by the signal value', async () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const runtime = Runtime.create(new MockBackend());
      const binding = SignalDirective.resolveBinding(
        signal,
        part,
        runtime,
      ) as SignalBinding<string>;
      const container = createElement('div', {}, part.node);
      const tree = createHydrationTree(container);

      binding.hydrate(tree, runtime);
      binding.commit(runtime);

      expect(container.innerHTML).toBe(signal.value);

      signal.value = 'bar';

      expect(await waitForUpdate(runtime)).toBe(1);

      expect(container.innerHTML).toBe(signal.value);
    });

    it('should throw the error if the binding has already been initialized', async () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const runtime = Runtime.create(new MockBackend());
      const binding = SignalDirective.resolveBinding(signal, part, runtime);
      const container = createElement('div', {}, part.node);
      const tree = createHydrationTree(container);

      binding.connect(runtime);
      binding.commit(runtime);

      expect(() => {
        binding.hydrate(tree, runtime);
      }).toThrow(HydrationError);
    });
  });

  describe('connect()', () => {
    it('schedule an update when the signal value has been changed', async () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const runtime = Runtime.create(new MockBackend());
      const binding = SignalDirective.resolveBinding(
        signal,
        part,
        runtime,
      ) as SignalBinding<string>;

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.nodeValue).toBe(signal.value);

      signal.value = 'bar';

      expect(binding.pendingLanes).toBe(Lanes.UserBlockingLane);
      expect(await waitForUpdate(runtime)).toBe(1);

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
      const runtime = Runtime.create(new MockBackend());
      const binding = SignalDirective.resolveBinding(
        signal1,
        part,
        runtime,
      ) as SignalBinding<string>;

      binding.connect(runtime);
      binding.commit(runtime);

      binding.bind(signal2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.nodeValue).toBe(signal2.value);

      signal1.value = 'baz';
      signal2.value = 'qux';

      expect(binding.pendingLanes).toBe(Lanes.UserBlockingLane);
      expect(await waitForUpdate(runtime)).toBe(1);

      expect(binding.pendingLanes).toBe(Lanes.NoLanes);
      expect(part.node.nodeValue).toBe(signal2.value);
    });
  });

  describe('disconnect()', () => {
    it('unsubscribes the signal', async () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      };
      const runtime = Runtime.create(new MockBackend());
      const binding = SignalDirective.resolveBinding(
        signal,
        part,
        runtime,
      ) as SignalBinding<string>;

      binding.connect(runtime);
      binding.commit(runtime);

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(await waitForUpdate(runtime)).toBe(0);
      expect(part.node.nodeValue).toBe('');

      signal.value = 'bar';

      expect(await waitForUpdate(runtime)).toBe(0);
      expect(part.node.nodeValue).toBe('');
    });
  });
});

describe('Signal', () => {
  describe('[$customHook]()', () => {
    it('request an update if the signal value has been changed', async () => {
      const session = createSession();
      const signal = new Atom('foo');

      SESSION1: {
        expect(session.use(signal)).toBe('foo');

        session.useEffect(() => {
          signal.value = 'bar';
          signal.value = 'baz';
        });

        flushSession(session);
      }

      await Promise.resolve();

      expect(await session.waitForUpdate()).toBe(1);

      SESSION2: {
        expect(session.use(signal)).toBe('baz');

        session.useEffect(() => {
          signal.value = 'baz';
        });

        flushSession(session);
      }

      await Promise.resolve();

      expect(await session.waitForUpdate()).toBe(0);

      disposeSession(session);

      signal.value = 'baz';

      expect(await session.waitForUpdate()).toBe(0);
    });
  });

  describe('[$toDirective]()', () => {
    it('returns a DirectiveElement with the signal', () => {
      const signal = new Atom('foo');
      const directive = signal[$toDirective]();

      expect(directive.type).toBe(SignalDirective);
      expect(directive.value).toBe(signal);
      expect(directive.slotType).toBe(undefined);
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
  describe('version', () => {
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

import { describe, expect, it, vi } from 'vitest';

import { $toDirectiveElement } from '@/directive.js';
import {
  Atom,
  Computed,
  Lazy,
  SignalBinding,
  SignalDirective,
} from '@/extensions/signal.js';
import { ALL_LANES } from '@/hook.js';
import { HydrationError, HydrationTree } from '@/hydration.js';
import { PartType } from '@/part.js';
import { RenderSession } from '@/render-session.js';
import { Runtime } from '@/runtime.js';
import { MockCoroutine, MockRenderHost } from '../../mocks.js';
import { cleanupHooks, createElement } from '../../test-utils.js';

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
      const runtime = new Runtime(new MockRenderHost());
      const binding = SignalDirective.resolveBinding(signal, part, runtime);

      expect(binding.directive).toBe(SignalDirective);
      expect(binding.value).toBe(signal);
      expect(binding.part).toBe(part);
    });
  });
});

describe('Signal', () => {
  describe('[$toDirectiveElement]()', () => {
    it('returns a DirectiveElement with the signal', () => {
      const signal = new Atom('foo');
      const element = signal[$toDirectiveElement]();

      expect(element.directive).toBe(SignalDirective);
      expect(element.value).toBe(signal);
      expect(element.slotType).toBe(undefined);
    });
  });

  describe('onCustomHook()', () => {
    it('subscribes the signal and return its value', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
      );
      const signal = new Atom('foo');
      const value = session.use(signal);

      const forceUpdateSpy = vi.spyOn(session, 'forceUpdate');

      expect(value).toBe(signal.value);
      expect(forceUpdateSpy).not.toHaveBeenCalled();

      session.finalize();
      session.flush();
      signal.value = 'bar';

      expect(forceUpdateSpy).toHaveBeenCalledOnce();

      cleanupHooks(session['_hooks']);
      signal.value = 'baz';

      expect(forceUpdateSpy).toHaveBeenCalledOnce();
    });
  });

  describe('toJSON()', () => {
    it('returns the signal value', () => {
      const value = 'foo';
      const signal = new Atom(value);

      expect(signal.toJSON()).toBe(value);
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
  it('returns 0 as the initial version', () => {
    const value = 'foo';
    const signal = new Atom('foo');

    expect(signal.value).toBe(value);
    expect(signal.version).toBe(0);
  });

  it('increments the version on update', () => {
    const value1 = 'foo';
    const value2 = 'bar';
    const signal = new Atom(value1);

    signal.value = value2;

    expect(signal.value).toBe(value2);
    expect(signal.version).toBe(1);
  });

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

  describe('notifySubscribers()', () => {
    it('increments the version', () => {
      const value = 'foo';
      const signal = new Atom(value);

      signal.notifySubscribers();

      expect(signal.value).toBe(value);
      expect(signal.version).toBe(1);
    });
  });

  describe('setUntrackedValue()', () => {
    it('sets the new value without notifications', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const signal = new Atom(value1);
      const subscriber = vi.fn();

      signal.subscribe(subscriber);
      signal.setUntrackedValue(value2);

      expect(signal.value).toBe(value2);
      expect(subscriber).not.toHaveBeenCalled();
    });
  });
});

describe('Computed', () => {
  it('computes a memoized value by dependent signals', () => {
    const foo = new Atom(1);
    const bar = new Atom(2);
    const baz = new Atom(3);

    const signal = new Computed(
      (foo, bar, baz) => ({
        foo: foo.value,
        bar: bar.value,
        baz: baz.value,
      }),
      [foo, bar, baz],
    );

    expect(signal.value).toStrictEqual({ foo: 1, bar: 2, baz: 3 });
    expect(signal.value).toBe(signal.value);
    expect(signal.version).toBe(0);
  });

  it('increments the version when any dependent signals have been updated', () => {
    const foo = new Atom(1);
    const bar = new Atom(2);
    const baz = new Atom(3);

    const signal = new Computed(
      (foo, bar, baz) => ({
        foo: foo.value,
        bar: bar.value,
        baz: baz.value,
      }),
      [foo, bar, baz],
    );
    let oldValue: typeof signal.value;

    oldValue = signal.value;
    foo.value = 10;
    expect(signal.value).toStrictEqual({ foo: 10, bar: 2, baz: 3 });
    expect(signal.value).not.toBe(oldValue);
    expect(signal.version).toBe(1);

    oldValue = signal.value;
    bar.value = 20;
    expect(signal.value).toStrictEqual({ foo: 10, bar: 20, baz: 3 });
    expect(signal.value).not.toBe(oldValue);
    expect(signal.version).toBe(2);

    oldValue = signal.value;
    baz.value = 30;
    expect(signal.value).toStrictEqual({ foo: 10, bar: 20, baz: 30 });
    expect(signal.value).not.toBe(oldValue);
    expect(signal.version).toBe(3);
  });

  it('invokes the subscriber when any dependent signals have been updated', () => {
    const foo = new Atom(1);
    const bar = new Atom(2);
    const baz = new Atom(3);
    const subscriber = vi.fn();

    const signal = new Computed(
      (foo, bar, baz) => ({
        foo: foo.value,
        bar: bar.value,
        baz: baz.value,
      }),
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
  });

  it('does not invoke the invalidated subscriber', () => {
    const foo = new Atom(1);
    const bar = new Atom(2);
    const baz = new Atom(3);
    const subscriber = vi.fn();

    const signal = new Computed(
      (foo, bar, baz) => ({
        foo: foo.value,
        bar: bar.value,
        baz: baz.value,
      }),

      [foo, bar, baz],
    );

    signal.subscribe(subscriber)();
    expect(subscriber).not.toHaveBeenCalled();

    foo.value++;
    expect(subscriber).not.toHaveBeenCalled();

    bar.value++;
    expect(subscriber).not.toHaveBeenCalled();

    baz.value++;
    expect(subscriber).not.toHaveBeenCalled();
  });
});

describe('Lazy', () => {
  it('returns the value of the delayed generated signal', () => {
    const signal = new Atom(1);
    const lazySignal = new Lazy(() => signal.map((n) => n * 2));

    expect(lazySignal.version).toBe(-1);

    expect(lazySignal.value).toBe(2);
    expect(lazySignal.version).toBe(0);

    signal.value++;

    expect(lazySignal.value).toBe(4);
    expect(lazySignal.version).toBe(1);

    signal.value++;

    expect(lazySignal.value).toBe(6);
    expect(lazySignal.version).toBe(2);
  });

  it('invokes the subscriber on update', () => {
    const signal = new Atom(1);
    const lazySignal = new Lazy(() => signal.map((n) => n * 2));
    const subscriber = vi.fn();

    lazySignal.subscribe(subscriber);
    expect(subscriber).toHaveBeenCalledTimes(0);

    signal.value++;
    expect(subscriber).toHaveBeenCalledTimes(1);

    signal.value++;
    expect(subscriber).toHaveBeenCalledTimes(2);

    signal.value++;
    expect(subscriber).toHaveBeenCalledTimes(3);
  });

  it('does not invoke the invalidated subscriber', () => {
    const signal = new Atom(1);
    const lazySignal = new Lazy(() => signal.map((n) => n * 2));
    const subscriber = vi.fn();

    lazySignal.subscribe(subscriber)();
    expect(subscriber).not.toHaveBeenCalled();

    signal.value++;
    expect(subscriber).not.toHaveBeenCalled();

    signal.value++;
    expect(subscriber).not.toHaveBeenCalled();

    signal.value++;
    expect(subscriber).not.toHaveBeenCalled();
  });
});

describe('Projected', () => {
  it('projects the signal value by the selector function', () => {
    const signal = new Atom(1);
    const projectedSignal = signal.map((n) => n * 2);

    expect(projectedSignal.value).toBe(2);
    expect(projectedSignal.version).toBe(0);

    signal.value++;

    expect(projectedSignal.value).toBe(4);
    expect(projectedSignal.version).toBe(1);

    signal.value++;

    expect(projectedSignal.value).toBe(6);
    expect(projectedSignal.version).toBe(2);
  });

  it('invokes the subscriber on update', () => {
    const signal = new Atom(1);
    const projectedSignal = signal.map((n) => n * 2);
    const subscriber = vi.fn();

    projectedSignal.subscribe(subscriber);
    expect(subscriber).toHaveBeenCalledTimes(0);

    signal.value++;
    expect(subscriber).toHaveBeenCalledTimes(1);

    signal.value++;
    expect(subscriber).toHaveBeenCalledTimes(2);

    signal.value++;
    expect(subscriber).toHaveBeenCalledTimes(3);
  });

  it('does not invoke the invalidated subscriber', () => {
    const signal = new Atom(1);
    const projectedSignal = signal.map((n) => n * 2);
    const subscriber = vi.fn();

    projectedSignal.subscribe(subscriber)();
    expect(subscriber).not.toHaveBeenCalled();

    signal.value++;
    expect(subscriber).not.toHaveBeenCalled();

    signal.value++;
    expect(subscriber).not.toHaveBeenCalled();

    signal.value++;
    expect(subscriber).not.toHaveBeenCalled();
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
      } as const;
      const binding = new SignalBinding(signal, part);

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
      } as const;
      const binding = new SignalBinding(signal1, part);
      const runtime = new Runtime(new MockRenderHost());

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
      } as const;
      const binding = new SignalBinding(signal, part);
      const hydrationRoot = createElement('div', {}, part.node);
      const hydrationTree = new HydrationTree(hydrationRoot);
      const runtime = new Runtime(new MockRenderHost());

      binding.hydrate(hydrationTree, runtime);
      binding.commit(runtime);

      expect(hydrationRoot.innerHTML).toBe(signal.value);

      signal.value = 'bar';

      expect(await runtime.waitForUpdate(binding)).toBe(1);

      expect(hydrationRoot.innerHTML).toBe(signal.value);
    });

    it('should throw the error if the binding has already been initialized', async () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      } as const;
      const binding = new SignalBinding(signal, part);
      const hydrationRoot = createElement('div', {}, part.node);
      const hydrationTree = new HydrationTree(hydrationRoot);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(() => {
        binding.hydrate(hydrationTree, runtime);
      }).toThrow(HydrationError);
    });
  });

  describe('connect()', () => {
    it('subscribes the signal', async () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      } as const;
      const binding = new SignalBinding(signal, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.nodeValue).toBe(signal.value);

      signal.value = 'bar';

      expect(await runtime.waitForUpdate(binding)).toBe(1);

      expect(part.node.nodeValue).toBe(signal.value);
    });

    it('subscribes the signal again if the signal has been changed', async () => {
      const signal1 = new Atom('foo');
      const signal2 = new Atom('bar');
      const part = {
        type: PartType.Text,
        node: document.createTextNode(''),
        precedingText: '',
        followingText: '',
      } as const;
      const binding = new SignalBinding(signal1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      binding.bind(signal2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.nodeValue).toBe(signal2.value);

      signal1.value = 'baz';
      signal2.value = 'qux';

      expect(await runtime.waitForUpdate(binding)).toBe(1);

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
      } as const;
      const binding = new SignalBinding(signal, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(await runtime.waitForUpdate(binding)).toBe(0);
      expect(part.node.nodeValue).toBe('');

      signal.value = 'bar';

      expect(await runtime.waitForUpdate(binding)).toBe(0);
      expect(part.node.nodeValue).toBe('');
    });
  });
});

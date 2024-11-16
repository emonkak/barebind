import { describe, expect, it, vi } from 'vitest';

import {
  type EffectHook,
  type Hook,
  HookType,
  PartType,
  UpdateContext,
  directiveTag,
} from '../../src/baseTypes.js';
import { SignalBinding, atom, computed } from '../../src/directives/signal.js';
import { RenderContext } from '../../src/renderContext.js';
import { SyncUpdater } from '../../src/updaters/syncUpdater.js';
import {
  MockBlock,
  MockRenderHost,
  TextBinding,
  TextDirective,
} from '.././mocks.js';

describe('Signal', () => {
  describe('.toJSON()', () => {
    it('should return the value', () => {
      const signal = atom('foo');

      expect('foo').toBe(signal.toJSON());
    });
  });

  describe('.value', () => {
    it('should increment the version on update', () => {
      const signal = atom('foo');

      signal.value = 'bar';
      expect(signal.value).toBe('bar');
      expect(signal.version).toBe(1);
    });
  });

  describe('.valueOf()', () => {
    it('should return the value of the signal', () => {
      const signal = atom('foo');

      expect('foo').toBe(signal.valueOf());
    });
  });

  describe('[Symbol.toStringTag]', () => {
    it('should return a string represented itself', () => {
      expect(atom('foo')[Symbol.toStringTag]).toBe('Signal("foo")');
    });
  });

  describe('[directiveTag]()', () => {
    it('should create a new SignalBinding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = atom(new TextDirective('foo'));
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = value[directiveTag](part, context);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe(value);
      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(binding.binding.value).toBe(value.value);
      expect(context.isPending()).toBe(false);
    });
  });

  describe('[usableTag]()', () => {
    it('should subscribe the signal and return a signal value', () => {
      const context = new RenderContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const signal = atom('foo');
      const requstUpdateSpy = vi.spyOn(context.block, 'requestUpdate');

      expect(context.use(signal)).toBe('foo');
      context.finalize();
      context.updater.flushUpdate(context.queue, context.host);

      expect(requstUpdateSpy).not.toHaveBeenCalled();

      signal.value = 'bar';
      expect(requstUpdateSpy).toHaveBeenCalledOnce();

      cleanHooks(context.hooks);
      signal.value = 'baz';
      expect(requstUpdateSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('Atom', () => {
  describe('.value', () => {
    it('should get 0 of the initial version on initalize', () => {
      const signal = atom('foo');

      expect(signal.value).toBe('foo');
      expect(signal.version).toBe(0);
    });

    it('should increment the version on update', () => {
      const signal = atom('foo');

      signal.value = 'bar';
      expect(signal.value).toBe('bar');
      expect(signal.version).toBe(1);
    });
  });

  describe('.notifyUpdate()', () => {
    it('should increment the version', () => {
      const signal = atom(1);

      signal.notifyUpdate();

      expect(1).toBe(signal.value);
      expect(1).toBe(signal.version);
    });
  });

  describe('.setUntrackedValue()', () => {
    it('should set the new value without invoking the callback', () => {
      const signal = atom('foo');
      const callback = vi.fn();

      signal.subscribe(callback);
      signal.setUntrackedValue('bar');

      expect(signal.value).toBe('bar');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      const signal = atom('foo');
      const callback = vi.fn();

      signal.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(0);

      signal.value = 'bar';
      expect(callback).toHaveBeenCalledTimes(1);

      signal.value = 'baz';
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should not invoke the unsubscribed callback', () => {
      const signal = atom('foo');
      const callback = vi.fn();

      signal.subscribe(callback)();
      expect(callback).not.toHaveBeenCalled();

      signal.value = 'bar';
      expect(callback).not.toHaveBeenCalled();

      signal.value = 'baz';
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('Computed', () => {
  describe('.value', () => {
    it('should produce a memoized value by dependent signals', () => {
      const foo = atom(1);
      const bar = atom(2);
      const baz = atom(3);

      const signal = computed(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      expect(signal.value).toStrictEqual({ foo: 1, bar: 2, baz: 3 });
      expect(signal.value).toBe(signal.value);
      expect(signal.version).toBe(0);
    });

    it('should increment the version when any dependent signal has been updated', () => {
      const foo = atom(1);
      const bar = atom(2);
      const baz = atom(3);

      const signal = computed(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      foo.value = 10;
      expect(signal.value).toStrictEqual({ foo: 10, bar: 2, baz: 3 });
      expect(signal.version).toBe(1);

      let oldValue = signal.value;

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
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      const foo = atom(1);
      const bar = atom(2);
      const baz = atom(3);
      const callback = vi.fn();

      const signal = computed(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      signal.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(0);

      foo.value++;
      expect(callback).toHaveBeenCalledTimes(1);

      bar.value++;
      expect(callback).toHaveBeenCalledTimes(2);

      baz.value++;
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should not invoke the unsubscribed callback', () => {
      const foo = atom(1);
      const bar = atom(2);
      const baz = atom(3);
      const callback = vi.fn();

      const signal = computed(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      signal.subscribe(callback)();
      expect(callback).not.toHaveBeenCalled();

      foo.value++;
      expect(callback).not.toHaveBeenCalled();

      bar.value++;
      expect(callback).not.toHaveBeenCalled();

      baz.value++;
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('Projected', () => {
  describe('.value', () => {
    it('should apply the function to each values', () => {
      const signal = atom(1);
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
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      const signal = atom(1);
      const projectedSignal = signal.map((n) => n * 2);
      const callback = vi.fn();

      projectedSignal.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(0);

      signal.value++;
      expect(callback).toHaveBeenCalledTimes(1);

      signal.value++;
      expect(callback).toHaveBeenCalledTimes(2);

      signal.value++;
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should not invoke the unsubscribed callback', () => {
      const signal = atom(1);
      const projectedSignal = signal.map((n) => n * 2);
      const callback = vi.fn();

      projectedSignal.subscribe(callback)();
      expect(callback).not.toHaveBeenCalled();

      signal.value++;
      expect(callback).not.toHaveBeenCalled();

      signal.value++;
      expect(callback).not.toHaveBeenCalled();

      signal.value++;
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('SignalBinding', () => {
  describe('.connect()', () => {
    it('should subscribe the signal', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = atom('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new SignalBinding(value, part, context);

      const connectSpy = vi.spyOn(binding.binding, 'connect');
      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(context);

      expect(binding.binding.value).toBe('foo');
      expect(connectSpy).toHaveBeenCalled();
      expect(bindSpy).not.toHaveBeenCalled();

      value.value = 'bar';

      expect(binding.binding.value).toBe('bar');
      expect(connectSpy).toHaveBeenCalled();
      expect(bindSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.bind()', () => {
    it('should update the the value binding with current signal value', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = atom('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new SignalBinding(value, part, context);

      const unsubscribeSpy = vi.fn();
      const subscribe = vi
        .spyOn(value, 'subscribe')
        .mockReturnValue(unsubscribeSpy);
      const connectSpy = vi.spyOn(binding.binding, 'connect');
      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(context);
      value.setUntrackedValue('bar');
      binding.bind(value, context);

      expect(binding.binding.value).toBe('bar');
      expect(connectSpy).toHaveBeenCalled();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unsubscribeSpy).not.toHaveBeenCalled();
      expect(subscribe).toHaveBeenCalledOnce();
    });

    it('should unsubscribe the previous subscription if signal changes', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = atom('foo');
      const value2 = atom('bar');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new SignalBinding(value1, part, context);

      const unsubscribe1Spy = vi.fn();
      const unsubscribe2Spy = vi.fn();
      const subscribe1Spy = vi
        .spyOn(value1, 'subscribe')
        .mockReturnValue(unsubscribe1Spy);
      const subscribe2Spy = vi
        .spyOn(value2, 'subscribe')
        .mockReturnValue(unsubscribe1Spy);
      const connectSpy = vi.spyOn(binding.binding, 'connect');
      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(context);
      binding.bind(value2, context);

      expect(binding.binding.value).toBe('bar');
      expect(connectSpy).toHaveBeenCalled();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unsubscribe1Spy).toHaveBeenCalledOnce();
      expect(unsubscribe2Spy).not.toHaveBeenCalled();
      expect(subscribe1Spy).toHaveBeenCalledOnce();
      expect(subscribe2Spy).toHaveBeenCalledOnce();
    });

    it('should throw the error if the value is not a signal', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = atom('foo');
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const binding = new SignalBinding(value, part, context);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'The value must be a instance of Signal directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind the value binding and unsubscribe the signal', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = atom('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new SignalBinding(value, part, context);

      const unsubscribeSpy = vi.fn();
      const subscribeSpy = vi
        .spyOn(value, 'subscribe')
        .mockReturnValue(unsubscribeSpy);
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);

      expect(unbindSpy).not.toHaveBeenCalled();
      expect(unsubscribeSpy).not.toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalledOnce();

      binding.unbind(context);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unsubscribeSpy).toHaveBeenCalledOnce();
      expect(subscribeSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the value binding and unsubscribe the signal', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = atom('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new SignalBinding(value, part, context);

      const unsubscribeSpy = vi.fn();
      const subscribeSpy = vi
        .spyOn(value, 'subscribe')
        .mockReturnValue(unsubscribeSpy);
      const disconnectSpy = vi.spyOn(binding.binding, 'disconnect');

      binding.connect(context);

      expect(unsubscribeSpy).not.toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).not.toHaveBeenCalled();

      binding.disconnect(context);

      expect(unsubscribeSpy).toHaveBeenCalledOnce();
      expect(subscribeSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
    });
  });
});

function cleanHooks(hooks: Hook[]): void {
  for (let i = hooks.length - 1; i >= 0; i--) {
    const hook = hooks[i]!;
    if (isEffectHook(hook)) {
      hook.cleanup?.();
    }
  }
}

function isEffectHook(hook: Hook): hook is EffectHook {
  return (
    hook.type === HookType.InsertionEffect ||
    hook.type === HookType.LayoutEffect ||
    hook.type === HookType.PassiveEffect
  );
}

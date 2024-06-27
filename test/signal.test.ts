import { describe, expect, it, vi } from 'vitest';

import { NodeBinding, directiveTag } from '../src/binding.js';
import { RenderingContext, usableTag } from '../src/renderingContext.js';
import { RenderingEngine } from '../src/renderingEngine.js';
import {
  AtomSignal,
  ComputedSignal,
  ProjectedSignal,
  ScannedSignal,
  SignalBinding,
} from '../src/signal.js';
import { type Hook, PartType } from '../src/types.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import { MockBlock } from './mocks.js';

describe('SignalBinding', () => {
  describe('.constructor', () => {
    it('should construct a new SignalBinding', () => {
      const signal = new AtomSignal('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new RenderingEngine());
      const binding = new SignalBinding(signal, part, updater);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe(signal);
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(binding.binding.value).toBe('foo');
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.connect()', () => {
    it('should subscribe the signal', () => {
      const signal = new AtomSignal('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new RenderingEngine());
      const binding = new SignalBinding(signal, part, updater);

      const connectSpy = vi.spyOn(binding.binding, 'connect');
      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(updater);

      expect(binding.binding.value).toBe('foo');
      expect(connectSpy).toHaveBeenCalled();
      expect(bindSpy).not.toHaveBeenCalled();

      signal.value = 'bar';

      expect(binding.binding.value).toBe('bar');
      expect(connectSpy).toHaveBeenCalled();
      expect(bindSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.bind()', () => {
    it('should update the the value binding with current signal value', () => {
      const signal = new AtomSignal('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new RenderingEngine());
      const binding = new SignalBinding(signal, part, updater);

      const unsubscribeSpy = vi.fn();
      const subscribe = vi
        .spyOn(signal, 'subscribe')
        .mockReturnValue(unsubscribeSpy);
      const connectSpy = vi.spyOn(binding.binding, 'connect');
      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(updater);
      signal.setUntrackedValue('bar');
      binding.bind(signal, updater);

      expect(binding.binding.value).toBe('bar');
      expect(connectSpy).toHaveBeenCalled();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unsubscribeSpy).not.toHaveBeenCalled();
      expect(subscribe).toHaveBeenCalledOnce();
    });

    it('should unsubscribe the previous subscription if signal changes', () => {
      const signal1 = new AtomSignal('foo');
      const signal2 = new AtomSignal('bar');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new RenderingEngine());
      const binding = new SignalBinding(signal1, part, updater);

      const unsubscribe1Spy = vi.fn();
      const unsubscribe2Spy = vi.fn();
      const subscribe1Spy = vi
        .spyOn(signal1, 'subscribe')
        .mockReturnValue(unsubscribe1Spy);
      const subscribe2Spy = vi
        .spyOn(signal2, 'subscribe')
        .mockReturnValue(unsubscribe1Spy);
      const connectSpy = vi.spyOn(binding.binding, 'connect');
      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(updater);
      binding.bind(signal2, updater);

      expect(binding.binding.value).toBe('bar');
      expect(connectSpy).toHaveBeenCalled();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unsubscribe1Spy).toHaveBeenCalledOnce();
      expect(unsubscribe2Spy).not.toHaveBeenCalled();
      expect(subscribe1Spy).toHaveBeenCalledOnce();
      expect(subscribe2Spy).toHaveBeenCalledOnce();
    });

    it('should throw the error if the value is not a signal', () => {
      expect(() => {
        const updater = new SyncUpdater(new RenderingEngine());
        const binding = new SignalBinding(
          new AtomSignal('foo'),
          {
            type: PartType.Attribute,
            node: document.createElement('div'),
            name: 'class',
          },
          updater,
        );
        binding.bind(null as any, updater);
      }).toThrow('A value must be a instance of "Signal",');
    });
  });

  describe('.unbind()', () => {
    it('should unbind the value binding and unsubscribe the signal', () => {
      const signal = new AtomSignal('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new RenderingEngine());
      const binding = new SignalBinding(signal, part, updater);

      const unsubscribeSpy = vi.fn();
      const subscribeSpy = vi
        .spyOn(signal, 'subscribe')
        .mockReturnValue(unsubscribeSpy);
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(updater);

      expect(unbindSpy).not.toHaveBeenCalled();
      expect(unsubscribeSpy).not.toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalledOnce();

      binding.unbind(updater);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unsubscribeSpy).toHaveBeenCalledOnce();
      expect(subscribeSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the value binding and unsubscribe the signal', () => {
      const signal = new AtomSignal('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new RenderingEngine());
      const binding = new SignalBinding(signal, part, updater);

      const unsubscribeSpy = vi.fn();
      const subscribeSpy = vi
        .spyOn(signal, 'subscribe')
        .mockReturnValue(unsubscribeSpy);
      const disconnectSpy = vi.spyOn(binding.binding, 'disconnect');

      binding.connect(updater);

      expect(unsubscribeSpy).not.toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).not.toHaveBeenCalled();

      binding.disconnect();

      expect(unsubscribeSpy).toHaveBeenCalledOnce();
      expect(subscribeSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('AtomSignal', () => {
  describe('.constructor()', () => {
    it('should get 0 of the initial version on initalize', () => {
      const signal = new AtomSignal('foo');

      expect(signal.value).toBe('foo');
      expect(signal.version).toBe(0);
    });

    it('should increment the version on update', () => {
      const signal = new AtomSignal('foo');

      signal.value = 'bar';
      expect(signal.value).toBe('bar');
      expect(signal.version).toBe(1);
    });
  });

  describe('.forceUpdate()', () => {
    it('should increment the version', () => {
      const signal = new AtomSignal(1);

      signal.forceUpdate();

      expect(1).toBe(signal.value);
      expect(1).toBe(signal.version);
    });
  });

  describe('.map()', () => {
    it('should create a new signal by applying the function to each values', () => {
      const signal = new AtomSignal(1);
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

  describe('.scan()', () => {
    it('should create a new signal by applying the accumulator to each values', () => {
      const signal = new AtomSignal(1);
      const scannedSignal = signal.scan((result, n) => result + n, 0);

      expect(scannedSignal.value).toBe(1);
      expect(scannedSignal.version).toBe(0);

      signal.value++;

      expect(scannedSignal.value).toBe(3);
      expect(scannedSignal.version).toBe(1);

      signal.value++;

      expect(scannedSignal.value).toBe(6);
      expect(scannedSignal.version).toBe(2);
    });
  });

  describe('.setUntrackedValue()', () => {
    it('should set the new value without invoking the callback', () => {
      const signal = new AtomSignal('foo');
      const callback = vi.fn();

      signal.subscribe(callback);
      signal.setUntrackedValue('bar');

      expect(signal.value).toBe('bar');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      const signal = new AtomSignal('foo');
      const callback = vi.fn();

      signal.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(0);

      signal.value = 'bar';
      expect(callback).toHaveBeenCalledTimes(1);

      signal.value = 'baz';
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should not invoke the unsubscribed callback', () => {
      const signal = new AtomSignal('foo');
      const callback = vi.fn();

      signal.subscribe(callback)();
      expect(callback).not.toHaveBeenCalled();

      signal.value = 'bar';
      expect(callback).not.toHaveBeenCalled();

      signal.value = 'baz';
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('.toJSON()', () => {
    it('should return the value', () => {
      const signal = new AtomSignal('foo');

      expect('foo').toBe(signal.toJSON());
    });
  });

  describe('.value', () => {
    it('should increment the version on update', () => {
      const signal = new AtomSignal('foo');

      signal.value = 'bar';
      expect(signal.value).toBe('bar');
      expect(signal.version).toBe(1);
    });
  });

  describe('.valueOf()', () => {
    it('should return the value', () => {
      const signal = new AtomSignal('foo');

      expect('foo').toBe(signal.valueOf());
    });
  });

  describe('[directiveTag]()', () => {
    it('should construct a new SignalBinding', () => {
      const signal = new AtomSignal('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new RenderingEngine());
      const binding = signal[directiveTag](part, updater);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe(signal);
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(binding.binding.value).toBe('foo');
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('[usableTag]()', () => {
    it('should should subscribe the signal and return a signal value', () => {
      const signal = new AtomSignal('foo');
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);
      const context = new RenderingContext(hooks, block, engine, updater);

      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
      const value = signal[usableTag](context);

      updater.flush();

      expect(value).toBe('foo');
      expect(requestUpdateSpy).not.toHaveBeenCalled();

      signal.value = 'bar';

      updater.flush();

      expect(requestUpdateSpy).toHaveBeenCalled();
    });
  });
});

describe('ComputedSignal', () => {
  describe('.value', () => {
    it('should return a memoized value', () => {
      const foo = new AtomSignal(1);
      const bar = new AtomSignal(2);
      const baz = new AtomSignal(3);

      const signal = new ComputedSignal(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      expect(signal.value).toEqual({ foo: 1, bar: 2, baz: 3 });
      expect(signal.value).toBe(signal.value);
      expect(signal.version).toBe(0);
    });

    it('should increment the version when any dependent signal has been updated', () => {
      const foo = new AtomSignal(1);
      const bar = new AtomSignal(2);
      const baz = new AtomSignal(3);

      const signal = new ComputedSignal(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      foo.value = 10;
      expect(signal.value).toEqual({ foo: 10, bar: 2, baz: 3 });
      expect(signal.version).toBe(1);

      let oldValue = signal.value;

      bar.value = 20;
      expect(signal.value).toEqual({ foo: 10, bar: 20, baz: 3 });
      expect(signal.value).not.toBe(oldValue);
      expect(signal.version).toBe(2);

      oldValue = signal.value;

      baz.value = 30;
      expect(signal.value).toEqual({ foo: 10, bar: 20, baz: 30 });
      expect(signal.value).not.toBe(oldValue);
      expect(signal.version).toBe(3);
    });
  });

  describe('.compose()', () => {
    it('should return a memoized value', () => {
      const foo = new AtomSignal(1);
      const bar = new AtomSignal(2);
      const baz = new AtomSignal(3);

      const signal = ComputedSignal.compose(
        (foo, bar, baz) => ({ foo, bar, baz }),
        [foo, bar, baz],
      );

      expect(signal.value).toEqual({ foo: 1, bar: 2, baz: 3 });
      expect(signal.value).toBe(signal.value);
      expect(signal.version).toBe(0);
    });
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      const foo = new AtomSignal(1);
      const bar = new AtomSignal(2);
      const baz = new AtomSignal(3);
      const callback = vi.fn();

      const signal = new ComputedSignal(
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
      const foo = new AtomSignal(1);
      const bar = new AtomSignal(2);
      const baz = new AtomSignal(3);
      const callback = vi.fn();

      const signal = new ComputedSignal(
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

describe('ProjectedSignal', () => {
  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      const signal = new AtomSignal(1);
      const projectedSignal = new ProjectedSignal(signal, (n) => n * 2);
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
      const signal = new AtomSignal(1);
      const projectedSignal = new ProjectedSignal(signal, (n) => n * 2);
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

describe('ScannedSignal', () => {
  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      const signal = new AtomSignal(1);
      const scannedSignal = new ScannedSignal(
        signal,
        (result, n) => result + n,
        0,
      );
      const callback = vi.fn();

      scannedSignal.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(0);

      signal.value++;
      expect(callback).toHaveBeenCalledTimes(1);

      signal.value++;
      expect(callback).toHaveBeenCalledTimes(2);

      signal.value++;
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should not invoke the unsubscribed callback', () => {
      const signal = new AtomSignal(1);
      const scannedSignal = new ScannedSignal(
        signal,
        (result, n) => result + n,
        0,
      );
      const callback = vi.fn();

      scannedSignal.subscribe(callback)();
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

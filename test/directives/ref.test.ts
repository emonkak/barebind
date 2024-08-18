import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext, directiveTag } from '../../src/baseTypes.js';
import { RefBinding, ref } from '../../src/directives/ref.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockUpdateHost } from '../mocks.js';

describe('ref()', () => {
  it('should construct a new Ref directive', () => {
    const refCallback = () => {};
    const value = ref(refCallback);

    expect(value.ref).toBe(refCallback);
  });
});

describe('Ref', () => {
  describe('[directiveTag]()', () => {
    it('should return a new RefBinding', () => {
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = ref(() => {});
      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part does not indicate "ref" attribute', () => {
      const part = {
        type: PartType.Attribute,
        name: 'data-ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = ref(() => {});

      expect(() => value[directiveTag](part, context)).toThrow(
        'Ref directive must be used in a "ref" attribute,',
      );
    });
  });
});

describe('RefBinding', () => {
  describe('.connect()', () => {
    it('should invoke the ref callback with the element', () => {
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const refCallback = vi.fn();
      const value = ref(refCallback);
      const binding = new RefBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(refCallback).toHaveBeenCalledOnce();
      expect(refCallback).toHaveBeenCalledWith(part.node);
    });

    it('should assign the element to the ref object', () => {
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const refObject = { current: null };
      const value = ref(refObject);
      const binding = new RefBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(refObject.current).toBe(part.node);
    });

    it('should do nothing if the update is already scheduled', () => {
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const refObject = { current: null };
      const value = ref(refObject);
      const binding = new RefBinding(value, part);

      const enqueueLayoutEffectSpy = vi.spyOn(context, 'enqueueLayoutEffect');

      binding.connect(context);
      binding.connect(context);

      expect(enqueueLayoutEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueLayoutEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should invoke the new ref callback with the element and invoke a old one with null', () => {
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const refCallback1 = vi.fn();
      const refCallback2 = vi.fn();
      const value1 = ref(refCallback1);
      const value2 = ref(refCallback2);
      const binding = new RefBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(refCallback1).toHaveBeenCalledTimes(2);
      expect(refCallback1).toHaveBeenCalledWith(null);
      expect(refCallback2).toHaveBeenCalledOnce();
      expect(refCallback2).toHaveBeenCalledWith(part.node);
    });

    it('should assign the element to the new ref object and unassign the element from the old one', () => {
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const refObject1 = { current: null };
      const refObject2 = { current: null };
      const value1 = ref(refObject1);
      const value2 = ref(refObject2);
      const binding = new RefBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(refObject1.current).toBe(null);
      expect(refObject2.current).toBe(part.node);
    });

    it('should skip an update if the new ref is the same as the old one', () => {
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const refObject = { current: null };
      const value1 = ref(refObject);
      const value2 = ref(refObject);
      const binding = new RefBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(context.isPending()).toBe(false);
    });

    it('should throw an error if the new value is not Ref directive', () => {
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = ref(() => {});
      const binding = new RefBinding(value, part);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'A value must be a instance of Ref directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should invoke the old ref callback with null', () => {
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const refCallback = vi.fn();
      const value = ref(refCallback);
      const binding = new RefBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(refCallback).toHaveBeenCalledTimes(2);
      expect(refCallback).toHaveBeenCalledWith(null);
    });

    it('should unassign the element from the old ref object', () => {
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const refObject = { current: null };
      const value = ref(refObject);
      const binding = new RefBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(refObject.current).toBe(null);
    });

    it('should do nothing if there is no memoized ref', () => {
      const value = ref(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      binding.unbind(context);

      expect(context.isPending()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should invoke the ref callback with null', () => {
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const refCallback = vi.fn();
      const value = ref(refCallback);
      const binding = new RefBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.disconnect();

      expect(refCallback).toHaveBeenCalledTimes(2);
      expect(refCallback).toHaveBeenNthCalledWith(1, part.node);
      expect(refCallback).toHaveBeenNthCalledWith(2, null);
    });

    it('should invoke the ref object with null', () => {
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const refObject = { current: null };
      const value = ref(refObject);
      const binding = new RefBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(refObject.current).toBe(part.node);

      binding.disconnect();

      expect(refObject.current).toBe(null);
    });

    it('should cancel the pending effect', () => {
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const refCallback = vi.fn();
      const value = ref(refCallback);
      const binding = new RefBinding(value, part);

      binding.connect(context);
      binding.disconnect();
      context.flushUpdate();

      expect(refCallback).toHaveBeenCalledOnce();
      expect(refCallback).toHaveBeenCalledWith(null);
    });
  });
});

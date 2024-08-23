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
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = ref(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part does not indicate "ref" attribute', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.Attribute,
        name: 'data-ref',
        node: document.createElement('div'),
      } as const;
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
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const refCallback = vi.fn();
      const value = ref(refCallback);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(refCallback).toHaveBeenCalledOnce();
      expect(refCallback).toHaveBeenCalledWith(part.node);
    });

    it('should assign the element to the ref object', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const refObject = { current: null };
      const value = ref(refObject);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(refObject.current).toBe(part.node);
    });

    it('should do nothing if the update is already scheduled', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const refObject = { current: null };
      const value = ref(refObject);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);

      const enqueueLayoutEffectSpy = vi.spyOn(context, 'enqueueLayoutEffect');

      binding.connect(context);
      binding.connect(context);

      expect(enqueueLayoutEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueLayoutEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should invoke a ref callback with the element and then invoke a cleanup function', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const cleanup = vi.fn();
      const refCallback1 = vi.fn().mockReturnValue(cleanup);
      const refCallback2 = vi.fn();
      const value1 = ref(refCallback1);
      const value2 = ref(refCallback2);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(cleanup).toHaveBeenCalledOnce();
      expect(refCallback1).toHaveBeenCalledOnce();
      expect(refCallback1).toHaveBeenCalledWith(part.node);
      expect(refCallback2).toHaveBeenCalledOnce();
      expect(refCallback2).toHaveBeenCalledWith(part.node);
    });

    it('should assgin an element to the ref object', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const refObject1 = { current: null };
      const refObject2 = { current: null };
      const value1 = ref(refObject1);
      const value2 = ref(refObject2);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
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
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const refObject = { current: null };
      const value1 = ref(refObject);
      const value2 = ref(refObject);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(context.isPending()).toBe(false);
    });

    it('should throw an error if the new value is not Ref directive', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = ref(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'A value must be a instance of Ref directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should invoke a cleanup function', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const cleanup = vi.fn();
      const refCallback = vi.fn().mockReturnValue(cleanup);
      const value = ref(refCallback);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(cleanup).toHaveBeenCalledOnce();
      expect(refCallback).toHaveBeenCalledOnce();
      expect(refCallback).toHaveBeenCalledWith(part.node);
    });

    it('should unassign an element from the ref object', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const refObject = { current: null };
      const value = ref(refObject);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(refObject.current).toBe(null);
    });

    it('should do nothing if there is no memoized ref', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = ref(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);

      binding.unbind(context);

      expect(context.isPending()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should invoke a cleanup function', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const cleanup = vi.fn();
      const refCallback = vi.fn().mockReturnValue(cleanup);
      const value = ref(refCallback);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.disconnect(context);

      expect(cleanup).toHaveBeenCalledOnce();
      expect(refCallback).toHaveBeenCalled();
      expect(refCallback).toHaveBeenCalledWith(part.node);
    });

    it('should assign null to the ref object', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const refObject = { current: null };
      const value = ref(refObject);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(refObject.current).toBe(part.node);

      binding.disconnect(context);

      expect(refObject.current).toBe(null);
    });

    it('should cancel the pending effect', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const cleanup = vi.fn();
      const refCallback = vi.fn().mockReturnValue(cleanup);
      const value = ref(refCallback);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);

      binding.connect(context);
      binding.disconnect(context);
      context.flushUpdate();

      expect(cleanup).not.toHaveBeenCalled();
      expect(refCallback).not.toHaveBeenCalled();
    });
  });
});

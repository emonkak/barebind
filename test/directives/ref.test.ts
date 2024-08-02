import { describe, expect, it, vi } from 'vitest';

import { RefBinding, ref } from '../../src/directives/ref.js';
import { PartType, directiveTag } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost } from '../mocks.js';

describe('ref()', () => {
  it('should construct a new Ref directive', () => {
    const refFunction = () => {};
    const value = ref(refFunction);

    expect(value.ref).toBe(refFunction);
  });
});

describe('Ref', () => {
  describe('[directiveTag]()', () => {
    it('should return a new RefBinding', () => {
      const value = ref(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part does not indicate "ref" attribute', () => {
      const value = ref(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'data-ref',
        node: document.createElement('div'),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };

      expect(() => value[directiveTag](part, context)).toThrow(
        'Ref directive must be used in a "ref" attribute,',
      );
    });
  });
});

describe('RefBinding', () => {
  describe('.connect()', () => {
    it('should call a RefCallback with the element', () => {
      const refFunction = vi.fn();
      const value = ref(refFunction);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };

      binding.connect(context);
      updater.flushUpdate(host);

      expect(refFunction).toHaveBeenCalledOnce();
      expect(refFunction).toHaveBeenCalledWith(part.node);
    });

    it('should assign the element to a RefObject', () => {
      const refObject = { current: null };
      const value = ref(refObject);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };

      binding.connect(context);
      updater.flushUpdate(host);

      expect(refObject.current).toBe(part.node);
    });

    it('should do nothing if the update is already scheduled', () => {
      const refObject = { current: null };
      const value = ref(refObject);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };
      const enqueueLayoutEffectSpy = vi.spyOn(updater, 'enqueueLayoutEffect');

      binding.connect(context);
      binding.connect(context);

      expect(enqueueLayoutEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueLayoutEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should call a new RefCallback with the element and call a old RefCallback with null', () => {
      const refFunction1 = vi.fn();
      const refFunction2 = vi.fn();
      const value1 = ref(refFunction1);
      const value2 = ref(refFunction2);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value1, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value2, context);
      updater.flushUpdate(host);

      expect(binding.value).toBe(value2);
      expect(refFunction1).toHaveBeenCalledTimes(2);
      expect(refFunction1).toHaveBeenCalledWith(null);
      expect(refFunction2).toHaveBeenCalledOnce();
      expect(refFunction2).toHaveBeenCalledWith(part.node);
    });

    it('should assign the element to a new RefObject and unassign the element from a old RefObject', () => {
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
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value2, context);
      updater.flushUpdate(host);

      expect(binding.value).toBe(value2);
      expect(refObject1.current).toBe(null);
      expect(refObject2.current).toBe(part.node);
    });

    it('should skip an update if a ref is the same as the previous one', () => {
      const refObject = { current: null };
      const value1 = ref(refObject);
      const value2 = ref(refObject);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value1, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should call the current RefCallback with null if the new ref is null', () => {
      const refFunction = vi.fn();
      const value1 = ref(refFunction);
      const value2 = ref(null);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value1, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value2, context);
      updater.flushUpdate(host);

      expect(binding.value).toBe(value2);
      expect(refFunction).toHaveBeenCalledTimes(2);
      expect(refFunction).toHaveBeenCalledWith(null);
    });

    it('should unassign the element from the current RefObject if the new ref is null', () => {
      const refObject = { current: null };
      const value1 = ref(refObject);
      const value2 = ref(null);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value1, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(value2, context);
      updater.flushUpdate(host);

      expect(binding.value).toBe(value2);
      expect(refObject.current).toBe(null);
    });

    it('should throw an error if the new value is not Ref directive', () => {
      const value = ref(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'A value must be a instance of Ref directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should call a old RefCallback with null', () => {
      const refFunction = vi.fn();
      const value = ref(refFunction);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };

      binding.connect(context);
      updater.flushUpdate(host);

      binding.unbind(context);
      updater.flushUpdate(host);

      expect(refFunction).toHaveBeenCalledTimes(2);
      expect(refFunction).toHaveBeenCalledWith(null);
    });

    it('should unassign the element from a old RefObject', () => {
      const refObject = { current: null };
      const value = ref(refObject);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };

      binding.connect(context);
      updater.flushUpdate(host);

      binding.unbind(context);
      updater.flushUpdate(host);

      expect(refObject.current).toBe(null);
    });

    it('should do nothing if there is no ref', () => {
      const value = ref(null);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = { host, updater, block: null };

      binding.unbind(context);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const value = ref(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(value, part);

      binding.disconnect();
    });
  });
});

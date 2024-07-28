import { describe, expect, it, vi } from 'vitest';

import { RefBinding, ref } from '../../src/directives/ref.js';
import { PartType, directiveTag } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockRenderHost } from '../mocks.js';

describe('ref()', () => {
  it('should construct a new Ref', () => {
    const refFunction = () => {};
    const directive = ref(refFunction);

    expect(directive.ref).toBe(refFunction);
  });
});

describe('Ref', () => {
  describe('[directiveTag]()', () => {
    it('should return a new instance of RefBinding', () => {
      const directive = ref(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const updater = new SyncUpdater(new MockRenderHost());
      const binding = directive[directiveTag](part, updater);

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part does not indicate "ref" attribute', () => {
      const directive = ref(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'data-ref',
        node: document.createElement('div'),
      } as const;
      const updater = new SyncUpdater(new MockRenderHost());

      expect(() => directive[directiveTag](part, updater)).toThrow(
        'Ref directive must be used in a "ref" attribute,',
      );
    });
  });
});

describe('RefBinding', () => {
  describe('.connect()', () => {
    it('should call a RefCallback with the element', () => {
      const refFunction = vi.fn();
      const directive = ref(refFunction);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      expect(refFunction).toHaveBeenCalledOnce();
      expect(refFunction).toHaveBeenCalledWith(part.node);
    });

    it('should assign the element to a RefObject', () => {
      const refObject = { current: null };
      const directive = ref(refObject);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      expect(refObject.current).toBe(part.node);
    });

    it('should do nothing if the update is already scheduled', () => {
      const refObject = { current: null };
      const directive = ref(refObject);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderHost());
      const enqueueLayoutEffectSpy = vi.spyOn(updater, 'enqueueLayoutEffect');

      binding.connect(updater);
      binding.connect(updater);

      expect(enqueueLayoutEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueLayoutEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should call a new RefCallback with the element and call a old RefCallback with null', () => {
      const refFunction1 = vi.fn();
      const refFunction2 = vi.fn();
      const directive1 = ref(refFunction1);
      const directive2 = ref(refFunction2);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.value).toBe(directive2);
      expect(refFunction1).toHaveBeenCalledTimes(2);
      expect(refFunction1).toHaveBeenCalledWith(null);
      expect(refFunction2).toHaveBeenCalledOnce();
      expect(refFunction2).toHaveBeenCalledWith(part.node);
    });

    it('should assign the element to a new RefObject and unassign the element from a old RefObject', () => {
      const refObject1 = { current: null };
      const refObject2 = { current: null };
      const directive1 = ref(refObject1);
      const directive2 = ref(refObject2);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.value).toBe(directive2);
      expect(refObject1.current).toBe(null);
      expect(refObject2.current).toBe(part.node);
    });

    it('should skip an update if a ref is the same as the previous one', () => {
      const refObject = { current: null };
      const directive1 = ref(refObject);
      const directive2 = ref(refObject);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);

      expect(binding.value).toBe(directive1);
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should call the current RefCallback with null if the new ref is null', () => {
      const refFunction = vi.fn();
      const directive1 = ref(refFunction);
      const directive2 = ref(null);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.value).toBe(directive2);
      expect(refFunction).toHaveBeenCalledTimes(2);
      expect(refFunction).toHaveBeenCalledWith(null);
    });

    it('should unassign the element from the current RefObject if the new ref is null', () => {
      const refObject = { current: null };
      const directive1 = ref(refObject);
      const directive2 = ref(null);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.value).toBe(directive2);
      expect(refObject.current).toBe(null);
    });

    it('should throw an error if the new value is not Ref directive', () => {
      const directive = ref(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderHost());

      expect(() => {
        binding.bind(null as any, updater);
      }).toThrow(
        'A value must be a instance of Ref directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should call a old RefCallback with null', () => {
      const refFunction = vi.fn();
      const directive = ref(refFunction);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      expect(refFunction).toHaveBeenCalledTimes(2);
      expect(refFunction).toHaveBeenCalledWith(null);
    });

    it('should unassign the element from a old RefObject', () => {
      const refObject = { current: null };
      const directive = ref(refObject);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      expect(refObject.current).toBe(null);
    });

    it('should do nothing if there is no ref', () => {
      const directive = ref(null);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderHost());

      binding.unbind(updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const directive = ref(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);

      binding.disconnect();
    });
  });
});

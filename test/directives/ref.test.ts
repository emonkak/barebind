import { describe, expect, it, vi } from 'vitest';

import { directiveTag } from '../../src/binding.js';
import { RefBinding, ref as refDirective } from '../../src/directives/ref.js';
import { PartType } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockRenderingEngine } from '../mocks.js';

describe('ref()', () => {
  it('should construct a new RefDirective', () => {
    const ref = () => {};
    const directive = refDirective(ref);

    expect(directive.ref).toBe(ref);
  });
});

describe('RefDirective', () => {
  describe('[directiveTag]()', () => {
    it('should return a new instance of RefBinding', () => {
      const directive = refDirective(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      };
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = directive[directiveTag](part, updater);

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part does not indicate "ref" attribute', () => {
      const directive = refDirective(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'data-ref',
        node: document.createElement('div'),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());

      expect(() => directive[directiveTag](part, updater)).toThrow(
        'RefDirective must be used in "ref" attribute',
      );
    });
  });
});

describe('RefBinding', () => {
  describe('.connect()', () => {
    it('should call a RefCallback with the element', () => {
      const ref = vi.fn();
      const directive = refDirective(ref);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      expect(ref).toHaveBeenCalledOnce();
      expect(ref).toHaveBeenCalledWith(part.node);
    });

    it('should assign the element to a RefObject', () => {
      const ref = { current: null };
      const directive = refDirective(ref);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      expect(ref.current).toBe(part.node);
    });

    it('should do nothing if the update is already scheduled', () => {
      const ref = { current: null };
      const directive = refDirective(ref);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());
      const enqueuePassiveEffectSpy = vi.spyOn(updater, 'enqueuePassiveEffect');

      binding.connect(updater);
      binding.connect(updater);

      expect(enqueuePassiveEffectSpy).toHaveBeenCalledOnce();
      expect(enqueuePassiveEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should call a new RefCallback with the element and call a old RefCallback with null', () => {
      const ref1 = vi.fn();
      const ref2 = vi.fn();
      const directive1 = refDirective(ref1);
      const directive2 = refDirective(ref2);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.value).toBe(directive2);
      expect(ref1).toHaveBeenCalledTimes(2);
      expect(ref1).toHaveBeenCalledWith(null);
      expect(ref2).toHaveBeenCalledOnce();
      expect(ref2).toHaveBeenCalledWith(part.node);
    });

    it('should assign the element to a new RefObject and unassign the element from a old RefObject', () => {
      const ref1 = { current: null };
      const ref2 = { current: null };
      const directive1 = refDirective(ref1);
      const directive2 = refDirective(ref2);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.value).toBe(directive2);
      expect(ref1.current).toBe(null);
      expect(ref2.current).toBe(part.node);
    });

    it('should skip an update if a ref is the same as the previous one', () => {
      const ref = { current: null };
      const directive1 = refDirective(ref);
      const directive2 = refDirective(ref);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);

      expect(binding.value).toBe(directive1);
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should call the current RefCallback with null if the new ref is null', () => {
      const ref = vi.fn();
      const directive1 = refDirective(ref);
      const directive2 = refDirective(null);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.value).toBe(directive2);
      expect(ref).toHaveBeenCalledTimes(2);
      expect(ref).toHaveBeenCalledWith(null);
    });

    it('should unassign the element from the current RefObject if the new ref is null', () => {
      const ref = { current: null };
      const directive1 = refDirective(ref);
      const directive2 = refDirective(null);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.value).toBe(directive2);
      expect(ref.current).toBe(null);
    });

    it('should throw an error if the new value is not RefDirective', () => {
      const directive = refDirective(() => {});
      const part = {
        type: PartType.Attribute,
        name: 'style',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      expect(() => {
        binding.bind(null as any, updater);
      }).toThrow(
        'A value must be a instance of "RefDirective", but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should call a old RefCallback with null', () => {
      const ref = vi.fn();
      const directive = refDirective(ref);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      expect(ref).toHaveBeenCalledTimes(2);
      expect(ref).toHaveBeenCalledWith(null);
    });

    it('should unassign the element from a old RefObject', () => {
      const ref = { current: null };
      const directive = refDirective(ref);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      expect(ref.current).toBe(null);
    });

    it('should do nothing if there is no ref', () => {
      const directive = refDirective(null);
      const part = {
        type: PartType.Attribute,
        name: 'ref',
        node: document.createElement('div'),
      } as const;
      const binding = new RefBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.unbind(updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const directive = refDirective(() => {});
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

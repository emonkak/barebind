import { describe, expect, it, vi } from 'vitest';

import { PartType } from '../../src/part.js';
import { RefBinding, RefPrimitive } from '../../src/primitive/ref.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import { MockRenderHost } from '../mocks.js';

describe('RefPrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(RefPrimitive.name, 'RefPrimitive');
    });
  });

  describe('ensureValue()', () => {
    it('asserts the value is a ref, null or undefined', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      } as const;
      const ensureValue: (typeof RefPrimitive)['ensureValue'] =
        RefPrimitive.ensureValue;

      expect(() => {
        ensureValue(() => {}, part);
        ensureValue({ current: null }, part);
        ensureValue(null, part);
        ensureValue(undefined, part);
      }).not.toThrow();
    });

    it('throws the error if the value is not valid', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      } as const;
      const ensureValue: (typeof RefPrimitive)['ensureValue'] =
        RefPrimitive.ensureValue;

      expect(() => {
        ensureValue({}, part);
      }).toThrow(
        'The value of RefPrimitive must be function, object, null or undefined,',
      );
    });
  });

  describe('resolveBinding()', () => {
    it.each([':REF', ':ref'])(
      'constructs a new RefBinding',
      (attributeName) => {
        const ref = { current: null };
        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: attributeName,
        } as const;
        const context = new UpdateEngine(new MockRenderHost());
        const binding = RefPrimitive.resolveBinding(ref, part, context);

        expect(binding.directive).toBe(RefPrimitive);
        expect(binding.value).toBe(ref);
        expect(binding.part).toBe(part);
      },
    );

    it('should throw the error if the part is not a ":ref" attribute part', () => {
      const ref = { current: null };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const context = new UpdateEngine(new MockRenderHost());

      expect(() => RefPrimitive.resolveBinding(ref, part, context)).toThrow(
        'RefPrimitive must be used in ":ref" attribute part,',
      );
    });
  });
});

describe('RefBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed value does not exist', () => {
      const ref = { current: null };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      } as const;
      const binding = new RefBinding(ref, part);

      expect(binding.shouldBind(ref)).toBe(true);
    });

    it('return true if the ref is different from the committed one', () => {
      const ref1 = { current: null };
      const ref2 = () => {};
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      } as const;
      const binding = new RefBinding(ref1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      expect(binding.shouldBind(ref1)).toBe(false);
      expect(binding.shouldBind(ref2)).toBe(true);
    });
  });

  describe('commit()', () => {
    it('sets the element of the part as current value', () => {
      const ref1 = { current: null };
      const ref2 = { current: null };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      } as const;
      const binding = new RefBinding(ref1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      expect(ref1.current).toBe(part.node);
      expect(ref2.current).toBe(null);

      binding.bind(ref2);
      binding.connect(context);
      binding.commit();

      expect(ref1.current).toBe(null);
      expect(ref2.current).toBe(part.node);

      binding.bind(null);
      binding.connect(context);
      binding.commit();

      expect(ref1.current).toBe(null);
      expect(ref2.current).toBe(null);
    });

    it('invokes the callback with the element as an argument', () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();
      const ref1 = vi.fn(() => cleanup1);
      const ref2 = vi.fn(() => cleanup2);
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      } as const;
      const binding = new RefBinding(ref1, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      binding.bind(ref2);
      binding.connect(context);
      binding.commit();

      binding.bind(null);
      binding.connect(context);
      binding.commit();

      expect(cleanup1).toHaveBeenCalledOnce();
      expect(cleanup2).toHaveBeenCalledOnce();
      expect(ref1).toHaveBeenCalledOnce();
      expect(ref1).toHaveBeenCalledWith(part.node);
      expect(ref2).toHaveBeenCalledOnce();
      expect(ref2).toHaveBeenCalledWith(part.node);
    });
  });

  describe('rollback()', () => {
    it('should do nothing if the committed value does not exist', () => {
      const ref = vi.fn();
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      } as const;
      const binding = new RefBinding(ref, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.disconnect(context);
      binding.rollback();

      expect(ref).not.toHaveBeenCalled();
    });

    it('sets null as the current value', () => {
      const ref = { current: null };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      } as const;
      const binding = new RefBinding(ref, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      expect(ref.current).toBe(part.node);

      binding.disconnect(context);
      binding.rollback();

      expect(ref.current).toBe(null);
    });

    it('invokes the cleanup function returned by the callback', () => {
      const cleanup = vi.fn();
      const ref = vi.fn(() => cleanup);
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      } as const;
      const binding = new RefBinding(ref, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit();

      binding.disconnect(context);
      binding.rollback();

      expect(cleanup).toHaveBeenCalledOnce();
      expect(ref).toHaveBeenCalledOnce();
      expect(ref).toHaveBeenCalledWith(part.node);
    });
  });
});

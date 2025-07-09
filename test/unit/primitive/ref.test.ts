import { describe, expect, it, vi } from 'vitest';

import { PartType } from '@/part.js';
import { RefBinding, RefPrimitive } from '@/primitive/ref.js';
import { Runtime } from '@/runtime.js';
import { MockRenderHost } from '../../mocks.js';

describe('RefPrimitive', () => {
  describe('displayName', () => {
    it('is a string that represents the primitive itself', () => {
      expect(RefPrimitive.displayName, 'RefPrimitive');
    });
  });

  describe('ensureValue()', () => {
    it('asserts the value is a ref, null or undefined', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      };
      const ensureValue: NonNullable<typeof RefPrimitive.ensureValue> =
        RefPrimitive.ensureValue!;

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
      };
      const ensureValue: NonNullable<typeof RefPrimitive.ensureValue> =
        RefPrimitive.ensureValue!;

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
        };
        const runtime = new Runtime(new MockRenderHost());
        const binding = RefPrimitive.resolveBinding(ref, part, runtime);

        expect(binding.type).toBe(RefPrimitive);
        expect(binding.value).toBe(ref);
        expect(binding.part).toBe(part);
      },
    );

    it('should throw the error if the part is not a ":ref" attribute part', () => {
      const ref = { current: null };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const runtime = new Runtime(new MockRenderHost());

      expect(() => RefPrimitive.resolveBinding(ref, part, runtime)).toThrow(
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
      };
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
      };
      const binding = new RefBinding(ref1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

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
      };
      const binding = new RefBinding(ref1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(ref1.current).toBe(part.node);
      expect(ref2.current).toBe(null);

      binding.bind(ref2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(ref1.current).toBe(null);
      expect(ref2.current).toBe(part.node);

      binding.bind(null);
      binding.connect(runtime);
      binding.commit(runtime);

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
      };
      const binding = new RefBinding(ref1, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      binding.connect(runtime);
      binding.commit(runtime);

      binding.bind(ref2);
      binding.connect(runtime);
      binding.commit(runtime);

      binding.bind(null);
      binding.connect(runtime);
      binding.commit(runtime);

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
      };
      const binding = new RefBinding(ref, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(ref).not.toHaveBeenCalled();
    });

    it('sets null as the current value', () => {
      const ref = { current: null };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      };
      const binding = new RefBinding(ref, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(ref.current).toBe(part.node);

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(ref.current).toBe(null);
    });

    it('invokes the cleanup function returned by the callback', () => {
      const cleanup = vi.fn();
      const ref = vi.fn(() => cleanup);
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      };
      const binding = new RefBinding(ref, part);
      const runtime = new Runtime(new MockRenderHost());

      binding.connect(runtime);
      binding.commit(runtime);

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(cleanup).toHaveBeenCalledOnce();
      expect(ref).toHaveBeenCalledOnce();
      expect(ref).toHaveBeenCalledWith(part.node);
    });
  });
});

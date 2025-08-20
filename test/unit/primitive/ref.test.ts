import { describe, expect, it, vi } from 'vitest';

import { PartType } from '@/internal.js';
import { RefBinding, RefPrimitive } from '@/primitive/ref.js';
import { createUpdateSession } from '../../session-utils.js';

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
      };
      const ensureValue: NonNullable<typeof RefPrimitive.ensureValue> =
        RefPrimitive.ensureValue!;

      expect(() => {
        ensureValue.call(RefPrimitive, () => {}, part);
        ensureValue.call(RefPrimitive, { current: null }, part);
        ensureValue.call(RefPrimitive, null, part);
        ensureValue.call(RefPrimitive, undefined, part);
      }).not.toThrow();
    });

    it('throws an error if the value is not valid', () => {
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
        'The value of RefPrimitive must be a function, object, null or undefined,',
      );
    });
  });

  describe('resolveBinding()', () => {
    it.for([':REF', ':ref'])('constructs a new RefBinding', (attributeName) => {
      const ref = { current: null };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: attributeName,
      };
      const session = createUpdateSession();
      const binding = RefPrimitive.resolveBinding(ref, part, session);

      expect(binding.type).toBe(RefPrimitive);
      expect(binding.value).toBe(ref);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not a ":ref" attribute part', () => {
      const ref = { current: null };
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const session = createUpdateSession();

      expect(() => RefPrimitive.resolveBinding(ref, part, session)).toThrow(
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
      const session = createUpdateSession();

      SESSION: {
        binding.connect(session);
        binding.commit(session);

        expect(binding.shouldBind(ref1)).toBe(false);
        expect(binding.shouldBind(ref2)).toBe(true);
      }
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
      const session = createUpdateSession();

      SESSION1: {
        binding.connect(session);
        binding.commit(session);

        expect(ref1.current).toBe(part.node);
        expect(ref2.current).toBe(null);
      }

      SESSION2: {
        binding.bind(ref2);
        binding.connect(session);
        binding.commit(session);

        expect(ref1.current).toBe(null);
        expect(ref2.current).toBe(part.node);
      }

      SESSION3: {
        binding.bind(null);
        binding.connect(session);
        binding.commit(session);

        expect(ref1.current).toBe(null);
        expect(ref2.current).toBe(null);
      }
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
      const session = createUpdateSession();

      SESSION1: {
        binding.connect(session);
        binding.commit(session);

        expect(cleanup1).not.toHaveBeenCalled();
        expect(cleanup2).not.toHaveBeenCalled();
        expect(ref1).toHaveBeenCalledOnce();
        expect(ref1).toHaveBeenCalledWith(part.node);
        expect(ref2).not.toHaveBeenCalled();
      }

      SESSION2: {
        binding.connect(session);
        binding.commit(session);

        expect(cleanup1).not.toHaveBeenCalled();
        expect(cleanup2).not.toHaveBeenCalled();
        expect(ref1).toHaveBeenCalledOnce();
        expect(ref2).not.toHaveBeenCalled();
      }

      SESSION3: {
        binding.bind(ref2);
        binding.connect(session);
        binding.commit(session);

        expect(cleanup1).toHaveBeenCalledOnce();
        expect(cleanup2).not.toHaveBeenCalled();
        expect(ref1).toHaveBeenCalledOnce();
        expect(ref2).toHaveBeenCalledOnce();
        expect(ref2).toHaveBeenCalledWith(part.node);
      }

      SESSION4: {
        binding.bind(null);
        binding.connect(session);
        binding.commit(session);

        expect(cleanup1).toHaveBeenCalledOnce();
        expect(cleanup2).toHaveBeenCalledOnce();
        expect(ref1).toHaveBeenCalledOnce();
        expect(ref2).toHaveBeenCalledOnce();
      }
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
      const session = createUpdateSession();

      SESSION: {
        binding.disconnect(session);
        binding.rollback(session);

        expect(ref).not.toHaveBeenCalled();
      }
    });

    it('sets null as the current value', () => {
      const ref = { current: null };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      };
      const binding = new RefBinding(ref, part);
      const session = createUpdateSession();

      SESSION1: {
        binding.connect(session);
        binding.commit(session);

        expect(ref.current).toBe(part.node);
      }

      SESSION2: {
        binding.disconnect(session);
        binding.rollback(session);

        expect(ref.current).toBe(null);
      }
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
      const session = createUpdateSession();

      SESSION1: {
        binding.connect(session);
        binding.commit(session);

        expect(cleanup).not.toHaveBeenCalled();
        expect(ref).toHaveBeenCalledOnce();
        expect(ref).toHaveBeenCalledWith(part.node);
      }

      SESSION2: {
        binding.disconnect(session);
        binding.rollback(session);

        expect(cleanup).toHaveBeenCalledOnce();
        expect(ref).toHaveBeenCalledOnce();
      }
    });
  });
});

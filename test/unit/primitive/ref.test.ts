import { describe, expect, it, vi } from 'vitest';

import { PartType } from '@/internal.js';
import { RefBinding, RefPrimitive } from '@/primitive/ref.js';
import { createRuntime, TestUpdater } from '../../test-helpers.js';

describe('RefPrimitive', () => {
  describe('ensureValue()', () => {
    it('asserts the value is a ref, null or undefined', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      };

      expect(() => {
        RefPrimitive.ensureValue!.call(RefPrimitive, () => {}, part);
        RefPrimitive.ensureValue!.call(RefPrimitive, { current: null }, part);
        RefPrimitive.ensureValue!.call(RefPrimitive, null, part);
      }).not.toThrow();
    });

    it('throws an error if the value is not valid', () => {
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      };

      expect(() => {
        RefPrimitive.ensureValue!.call(RefPrimitive, {}, part);
      }).toThrow(
        'The value of RefPrimitive must be a function, object or null.',
      );
    });
  });

  describe('resolveBinding()', () => {
    it.for([
      ':REF',
      ':ref',
    ])('constructs a new RefBinding with "%s" attribute', (attributeName) => {
      const ref = { current: null };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: attributeName,
      };
      const runtime = createRuntime();
      const binding = RefPrimitive.resolveBinding(ref, part, runtime);

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
      const runtime = createRuntime();

      expect(() => RefPrimitive.resolveBinding(ref, part, runtime)).toThrow(
        'RefPrimitive must be used in AttributePart.',
      );
    });
  });
});

describe('RefBinding', () => {
  describe('shouldUpdate()', () => {
    it('returns true if the committed value does not exist', () => {
      const ref = { current: null };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: ':ref',
      };
      const binding = new RefBinding(ref, part);

      expect(binding.shouldUpdate(ref)).toBe(true);
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
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(binding.shouldUpdate(ref1)).toBe(false);
        expect(binding.shouldUpdate(ref2)).toBe(true);
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
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(ref1.current).toBe(part.node);
        expect(ref2.current).toBe(null);
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = ref2;
          binding.attach(session);
          binding.commit();
        });

        expect(ref1.current).toBe(null);
        expect(ref2.current).toBe(part.node);
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
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(cleanup1).not.toHaveBeenCalled();
        expect(cleanup2).not.toHaveBeenCalled();
        expect(ref1).toHaveBeenCalledOnce();
        expect(ref1).toHaveBeenCalledWith(part.node);
        expect(ref2).not.toHaveBeenCalled();
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(cleanup1).not.toHaveBeenCalled();
        expect(cleanup2).not.toHaveBeenCalled();
        expect(ref1).toHaveBeenCalledOnce();
        expect(ref2).not.toHaveBeenCalled();
      }

      SESSION3: {
        updater.startUpdate((session) => {
          binding.value = ref2;
          binding.attach(session);
          binding.commit();
        });

        expect(cleanup1).toHaveBeenCalledOnce();
        expect(cleanup2).not.toHaveBeenCalled();
        expect(ref1).toHaveBeenCalledOnce();
        expect(ref2).toHaveBeenCalledOnce();
        expect(ref2).toHaveBeenCalledWith(part.node);
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
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

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
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(ref.current).toBe(part.node);
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

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
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(cleanup).not.toHaveBeenCalled();
        expect(ref).toHaveBeenCalledOnce();
        expect(ref).toHaveBeenCalledWith(part.node);
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(cleanup).toHaveBeenCalledOnce();
        expect(ref).toHaveBeenCalledOnce();
      }
    });
  });
});

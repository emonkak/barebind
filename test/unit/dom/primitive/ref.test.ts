import { describe, expect, it, vi } from 'vitest';
import { createAttributePart } from '@/dom/part.js';
import { DOMRef, DOMRefBinding } from '@/dom/primitive/ref.js';
import { createTestRuntime } from '../../../adapter.js';
import { SessionLauncher } from '../../../session-launcher.js';

describe('DOMRef', () => {
  describe('ensureValue()', () => {
    it('asserts the value is a ref', () => {
      const part = createAttributePart(document.createElement('div'), ':ref');

      expect(() => {
        DOMRef.ensureValue(() => {}, part);
        DOMRef.ensureValue({ current: null }, part);
        DOMRef.ensureValue(null, part);
        DOMRef.ensureValue(undefined, part);
      }).not.toThrow();
    });

    it('throws an error if the value is not a ref', () => {
      const part = createAttributePart(document.createElement('div'), ':ref');

      expect(() => {
        DOMRef.ensureValue({}, part);
      }).toThrow('Ref values must be function, object, null or undefined.');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new binding with DOMRef type', () => {
      const ref = { current: null };
      const part = createAttributePart(document.createElement('div'), ':ref');
      const runtime = createTestRuntime();
      const binding = DOMRef.resolveBinding(ref, part, runtime);

      expect(binding.type).toBe(DOMRef);
      expect(binding.value).toBe(ref);
      expect(binding.part).toBe(part);
    });
  });
});

describe('DOMRefBinding', () => {
  const launcher = new SessionLauncher(createTestRuntime());

  describe('shouldUpdate()', () => {
    it('returns true there is no current ref', () => {
      const ref = { current: null };
      const part = createAttributePart(document.createElement('div'), ':ref');
      const binding = new DOMRefBinding(ref, part);

      expect(binding.shouldUpdate(ref)).toBe(true);
    });

    it('return true when the ref differs from the current one', () => {
      const ref = { current: null };
      const part = createAttributePart(document.createElement('div'), ':ref');
      const binding = new DOMRefBinding(ref, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate(ref)).toBe(false);
      expect(binding.shouldUpdate({ current: null })).toBe(true);
      expect(binding.shouldUpdate(() => {})).toBe(true);
      expect(binding.shouldUpdate(null)).toBe(true);
      expect(binding.shouldUpdate(undefined)).toBe(true);
    });
  });

  describe('commit()', () => {
    it('sets elements as the current value of RefObject', () => {
      const ref = { current: null };
      const part = createAttributePart(document.createElement('div'), ':ref');
      const binding = new DOMRefBinding(ref, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(ref.current).toBe(part.node);
    });

    it('calls ref functions with the element', () => {
      const ref = vi.fn();
      const part = createAttributePart(document.createElement('div'), ':ref');
      const binding = new DOMRefBinding(ref, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(ref).toHaveBeenCalledOnce();
      expect(ref).toHaveBeenCalledWith(part.node);
    });

    it('calls cleanup functions when the current ref is updated', () => {
      const cleanup = vi.fn();
      const ref = vi.fn().mockReturnValue(cleanup);
      const part = createAttributePart(document.createElement('div'), ':ref');
      const binding = new DOMRefBinding(ref, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.value = null;
        binding.attach(session);
        binding.commit();
      });

      expect(ref).toHaveBeenCalledOnce();
      expect(ref).toHaveBeenCalledWith(part.node);
      expect(cleanup).toHaveBeenCalledOnce();
    });
  });

  describe('rollback()', () => {
    it('does nothing when there is no current value', () => {
      const ref = vi.fn();
      const part = createAttributePart(document.createElement('div'), ':ref');
      const binding = new DOMRefBinding(ref, part);

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(ref).not.toHaveBeenCalled();
    });

    it('sets null as the current value of RefObject', () => {
      const ref = { current: null };
      const part = createAttributePart(document.createElement('div'), ':ref');
      const binding = new DOMRefBinding(ref, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(ref.current).toBe(null);
    });

    it('calls cleanup functions when it exists', () => {
      const cleanup = vi.fn();
      const ref = vi.fn().mockReturnValue(cleanup);
      const part = createAttributePart(document.createElement('div'), ':ref');
      const binding = new DOMRefBinding(ref, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(ref).toHaveBeenCalledOnce();
      expect(ref).toHaveBeenCalledWith(part.node);
      expect(cleanup).toHaveBeenCalledOnce();
    });
  });
});

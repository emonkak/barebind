import { describe, expect, it, vi } from 'vitest';
import { createPropertyPart } from '@/dom/part.js';
import { DOMProperty, DOMPropertyBinding } from '@/dom/primitive/property.js';
import { createTestRuntime } from '../../../adapter.js';
import { SessionLauncher } from '../../../session-launcher.js';

describe('DOMProperty', () => {
  describe('resolveBinding()', () => {
    it('constructs a new binding with DOMProperty type', () => {
      const value = 'a';
      const part = createPropertyPart(document.createElement('input'), 'value');
      const runtime = createTestRuntime();
      const binding = DOMProperty.resolveBinding(value, part, runtime);

      expect(binding.type).toBe(DOMProperty);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });
  });
});

describe('DOMPropertyBinding', () => {
  const launcher = new SessionLauncher(createTestRuntime());

  describe('shouldUpdate()', () => {
    it('returns true when there is no current value', () => {
      const part = createPropertyPart(document.createElement('input'), 'value');
      const binding = new DOMPropertyBinding('a', part);

      expect(binding.shouldUpdate('a')).toBe(true);
      expect(binding.shouldUpdate('b')).toBe(true);
    });

    it('returns true when the value is different from the current one', () => {
      const part = createPropertyPart(document.createElement('input'), 'value');
      const binding = new DOMPropertyBinding('a', part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate('a')).toBe(false);
      expect(binding.shouldUpdate('b')).toBe(true);
    });
  });

  describe('commit()', () => {
    it('sets the property to the value', () => {
      const part = createPropertyPart(document.createElement('input'), 'value');
      const binding = new DOMPropertyBinding('a', part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.value).toBe('a');
    });
  });

  describe('rollback()', () => {
    it('resets the property to its initial value', () => {
      const part = createPropertyPart(document.createElement('input'), 'value');
      const binding = new DOMPropertyBinding('a', part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(part.node.innerHTML).toBe('');
    });

    it('does nothing when the current value does not exist', () => {
      const part = createPropertyPart(document.createElement('input'), 'value');
      const binding = new DOMPropertyBinding('a', part);
      const setValueSpy = vi.spyOn(part.node, 'value', 'set');

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(setValueSpy).not.toHaveBeenCalled();
    });
  });
});

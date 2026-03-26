import { describe, expect, it, vi } from 'vitest';
import { createLivePart } from '@/dom/part.js';
import { DOMLive, DOMLiveBinding } from '@/dom/primitive/live.js';
import { createTestRuntime } from '../../../adapter.js';
import { createElement } from '../../../helpers.js';
import { SessionLauncher } from '../../../session-launcher.js';

describe('DOMLive', () => {
  describe('resolveBinding()', () => {
    it('constructs a new binding with DOMLive type', () => {
      const value = 'foo';
      const part = createLivePart(document.createElement('input'), 'value');
      const runtime = createTestRuntime();
      const binding = DOMLive.resolveBinding(value, part, runtime);

      expect(binding.type).toBe(DOMLive);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });
  });
});

describe('DOMLiveBinding', () => {
  const launcher = new SessionLauncher(createTestRuntime());

  describe('shouldUpdate()', () => {
    it('returns always true', () => {
      const part = createLivePart(document.createElement('textarea'), 'value');
      const binding = new DOMLiveBinding('a', part);

      expect(binding.shouldUpdate('a')).toBe(true);
      expect(binding.shouldUpdate('b')).toBe(true);
    });
  });

  describe('commit()', () => {
    it('sets the property when the value differs from the current one', () => {
      const part = createLivePart(
        createElement('input', { value: 'a' }),
        'value',
      );
      const binding = new DOMLiveBinding('b', part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.value).toBe('b');
    });

    it('does nothing when the value is the same as the current one', () => {
      const part = createLivePart(
        createElement('input', { value: 'a' }),
        'value',
      );
      const binding = new DOMLiveBinding('a', part);
      const setValueSpy = vi.spyOn(part.node, 'value', 'set');

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(setValueSpy).not.toHaveBeenCalled();
    });
  });

  describe('rollback()', () => {
    it('resets the property to its initial value', () => {
      const part = createLivePart(document.createElement('input'), 'value');
      const binding = new DOMLiveBinding('a', part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(part.node.value).toBe('');
    });
  });
});

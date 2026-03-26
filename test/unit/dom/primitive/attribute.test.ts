import { describe, expect, it, vi } from 'vitest';
import { createAttributePart } from '@/dom/part.js';
import {
  DOMAttribute,
  DOMAttributeBinding,
} from '@/dom/primitive/attribute.js';
import { createTestRuntime } from '../../../adapter.js';
import { SessionLauncher } from '../../../session-launcher.js';

describe('DOMAttribute', () => {
  describe('resolveBinding()', () => {
    it('returns a new binding with DOMAttribute type', () => {
      const value = 'foo';
      const part = createAttributePart(document.createElement('div'), 'class');
      const runtime = createTestRuntime();
      const binding = DOMAttribute.resolveBinding(value, part, runtime);

      expect(binding.type).toBe(DOMAttribute);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });
  });
});

describe('DOMAttributeBinding', () => {
  const launcher = new SessionLauncher(createTestRuntime());

  describe('shouldUpdate', () => {
    it('returns true when the current value does not exist', () => {
      const binding = new DOMAttributeBinding(
        'a',
        createAttributePart(document.createElement('div'), 'class'),
      );

      expect(binding.shouldUpdate('a')).toBe(true);
    });

    it('returns true when the value differs from the current one', () => {
      const binding = new DOMAttributeBinding(
        'a',
        createAttributePart(document.createElement('div'), 'class'),
      );

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate('a')).toBe(false);
      expect(binding.shouldUpdate('b')).toBe(true);
    });
  });

  describe('commit()', () => {
    it.for([
      null,
      undefined,
    ])('removes attributes when the pending value is "%s"', (nullish) => {
      const part = createAttributePart(document.createElement('div'), 'class');
      const binding = new DOMAttributeBinding<unknown>('a', part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.getAttribute(part.name)).toBe('a');

      launcher.launchSession((session) => {
        binding.value = nullish;
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.getAttribute(part.name)).toBe(null);
    });

    it.each([
      ['foo', 'foo'],
      [123, '123'],
      [
        {
          toString() {
            return 'foo';
          },
        },
        'foo',
      ],
    ])('updates attributes with string representations of values', (value, expectedValue) => {
      const part = createAttributePart(document.createElement('div'), 'class');
      const binding = new DOMAttributeBinding(value, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.getAttribute(part.name)).toBe(expectedValue);
    });

    it.each([
      [true, ''],
      [false, null],
    ])('toggles attributes according to boolean values', (value, expectedValue) => {
      const part = createAttributePart(document.createElement('div'), 'class');
      const binding = new DOMAttributeBinding(value, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.getAttribute(part.name)).toBe(expectedValue);
    });
  });

  describe('rollback()', () => {
    it('removes attributes when the current value exists', () => {
      const part = createAttributePart(document.createElement('div'), 'class');
      const binding = new DOMAttributeBinding('a', part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(part.node.getAttribute(part.name)).toBe(null);
    });

    it('does nothing when there is no current value', () => {
      const part = createAttributePart(document.createElement('div'), 'class');
      const binding = new DOMAttributeBinding('a', part);
      const removeAttributeSpy = vi.spyOn(part.node, 'removeAttribute');

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(removeAttributeSpy).not.toHaveBeenCalled();
    });
  });
});

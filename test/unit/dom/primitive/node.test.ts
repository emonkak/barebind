import { describe, expect, it, vi } from 'vitest';
import { createTextPart } from '@/dom/part.js';
import { DOMNode, DOMNodeBinding } from '@/dom/primitive/node.js';
import { createTestRuntime } from '../../../adapter.js';
import { SessionLauncher } from '../../../session-launcher.js';

describe('DOMNode', () => {
  describe('resolveBinding()', () => {
    it('constructs a new binding with DOMNode type', () => {
      const value = 'foo';
      const part = createTextPart(document.createTextNode(''));
      const runtime = createTestRuntime();
      const binding = DOMNode.resolveBinding(value, part, runtime);

      expect(binding.type).toBe(DOMNode);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });
  });
});

describe('DOMNodeBinding', () => {
  const launcher = new SessionLauncher(createTestRuntime());

  describe('shouldUpdate()', () => {
    it('returns true when there is no current value', () => {
      const part = createTextPart(document.createTextNode(''));
      const binding = new DOMNodeBinding('a', part);

      expect(binding.shouldUpdate('a')).toBe(true);
      expect(binding.shouldUpdate('b')).toBe(true);
    });

    it('returns true when the value differs from current one', () => {
      const part = createTextPart(document.createTextNode(''));
      const binding = new DOMNodeBinding('a', part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate('a')).toBe(false);
      expect(binding.shouldUpdate('b')).toBe(true);
    });
  });

  describe('commit()', () => {
    it('updates node values with the pending value', () => {
      const part = createTextPart(document.createTextNode(''));
      const binding = new DOMNodeBinding('a', part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.nodeValue).toBe('a');
    });

    it('updates node values with the string representation of the object', () => {
      const part = createTextPart(document.createTextNode(''));
      const binding = new DOMNodeBinding(true, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.nodeValue).toBe('true');
    });

    it.for([
      null,
      undefined,
    ])('empties node values when the pending value is %s', (nullish) => {
      const part = createTextPart(document.createTextNode('a'));
      const binding = new DOMNodeBinding(nullish, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node.nodeValue).toBe('');
    });
  });

  describe('rollback()', () => {
    it('empties node values when the current value exists', () => {
      const part = createTextPart(document.createTextNode(''));
      const binding = new DOMNodeBinding('a', part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(part.node.data).toBe('');
    });

    it('does nothing when there is no current value', () => {
      const part = createTextPart(document.createTextNode(''));
      const binding = new DOMNodeBinding('a', part);
      const setNodeValueSpy = vi.spyOn(part.node, 'nodeValue', 'set');

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(setNodeValueSpy).not.toHaveBeenCalled();
    });
  });
});

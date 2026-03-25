import { describe, expect, it, vi } from 'vitest';
import { createTextPart } from '@/dom.js';
import { NodeBinding, NodeType } from '@/primitive/node.js';
import { createRuntime } from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('NodeType', () => {
  describe('resolveBinding()', () => {
    it('constructs a new NodeBinding', () => {
      const value = 'foo';
      const part = createTextPart(document.createTextNode(''));
      const runtime = createRuntime();
      const binding = NodeType.resolveBinding(value, part, runtime);

      expect(binding).toBeInstanceOf(NodeBinding);
      expect(binding.type).toBe(NodeType);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });
  });
});

describe('NodeBinding', () => {
  describe('shouldUpdate()', () => {
    it('returns true when there is no current value', () => {
      const value = '<div>foo</div>';
      const part = createTextPart(document.createTextNode(''));
      const binding = new NodeBinding(value, part);

      expect(binding.shouldUpdate(value)).toBe(true);
    });

    it('returns true when the value is different from the current one', () => {
      const part = createTextPart(document.createTextNode(''));
      const binding = new NodeBinding('foo', part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(binding.shouldUpdate('foo')).toBe(false);
        expect(binding.shouldUpdate('bar')).toBe(true);
      }
    });
  });

  describe('commit()', () => {
    it('updates nodes with the pending value', () => {
      const part = createTextPart(document.createTextNode(''));
      const binding = new NodeBinding<string | null>('foo', part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.data).toBe('foo');
      }
    });

    it('updates nodes with the string representation of the object', () => {
      const part = createTextPart(document.createTextNode(''));
      const binding = new NodeBinding(true, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.nodeValue).toBe('true');
      }
    });

    it('empties node values when the pending value is null', () => {
      const part = createTextPart(document.createTextNode('foo'));
      const binding = new NodeBinding(null, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.nodeValue).toBe('');
      }
    });
  });

  describe('rollback()', () => {
    it('empties node values when the current value is exists', () => {
      const part = createTextPart(document.createTextNode(''));
      const binding = new NodeBinding('foo', part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(part.node.data).toBe('');
      }
    });

    it('does nothing when there is no current value', () => {
      const value = 'foo';
      const part = createTextPart(document.createTextNode(''));
      const binding = new NodeBinding(value, part);
      const updater = new TestUpdater();

      const setNodeValueSpy = vi.spyOn(part.node, 'nodeValue', 'set');

      SESSION: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(setNodeValueSpy).not.toHaveBeenCalled();
      }
    });
  });
});

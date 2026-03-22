import { describe, expect, it, vi } from 'vitest';

import { createChildNodePart, HTML_NAMESPACE_URI } from '@/part.js';
import { CommentBinding, CommentType } from '@/primitive/comment.js';
import { createRuntime } from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('CommentType', () => {
  describe('resolveBinding()', () => {
    it('constructs a new CommentBinding', () => {
      const value = 'foo';
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const runtime = createRuntime();
      const binding = CommentType.resolveBinding(value, part, runtime);

      expect(binding).toBeInstanceOf(CommentBinding);
      expect(binding.type).toBe(CommentType);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });
  });
});

describe('CommentBinding', () => {
  describe('shouldUpdate()', () => {
    it('returns true if the committed value does not exist', () => {
      const value = '<div>foo</div>';
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new CommentBinding(value, part);

      expect(binding.shouldUpdate(value)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new CommentBinding(value1, part);
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(binding.shouldUpdate(value1)).toBe(false);
        expect(binding.shouldUpdate(value2)).toBe(true);
      }
    });
  });

  describe('commit()', () => {
    it('sets the string as a node value', () => {
      const value1 = 'foo';
      const value2 = null;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new CommentBinding<string | null>(value1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.nodeValue).toBe(value1);
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = value2;
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.nodeValue).toBe('');
      }
    });

    it('sets the string representation of the value as a node value', () => {
      const value1 = 123;
      const value2 = null;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new CommentBinding<number | null>(value1, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.nodeValue).toBe(value1.toString());
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.value = value2;
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.nodeValue).toBe('');
      }
    });
  });

  describe('rollback()', () => {
    it('sets null as a node value if the committed value exists', () => {
      const value = 'foo';
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new CommentBinding(value, part);
      const updater = new TestUpdater();

      SESSION1: {
        updater.startUpdate((session) => {
          binding.attach(session);
          binding.commit();
        });

        expect(part.node.nodeValue).toBe(value);
      }

      SESSION2: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });

        expect(part.node.nodeValue).toBe('');
      }
    });

    it('should do nothing if the committed value does not exist', () => {
      const value = 'foo';
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const binding = new CommentBinding(value, part);
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

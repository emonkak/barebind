import { describe, expect, it, vi } from 'vitest';

import { PartType } from '@/internal.js';
import { CommentBinding, CommentPrimitive } from '@/primitive/comment.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { createUpdateSession } from '../../session-utils.js';

describe('CommentPrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(CommentPrimitive.name, 'CommentPrimitive');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new CommentBinding', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const session = createUpdateSession();
      const binding = CommentPrimitive.resolveBinding(value, part, session);

      expect(binding.type).toBe(CommentPrimitive);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not a child node part', () => {
      const value = '<div>foo</div>';
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const session = createUpdateSession();

      expect(() =>
        CommentPrimitive.resolveBinding(value, part, session),
      ).toThrow('CommentPrimitive must be used in a child node,');
    });
  });
});

describe('CommentBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed value does not exist', () => {
      const value = '<div>foo</div>';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new CommentBinding(value, part);

      expect(binding.shouldBind(value)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new CommentBinding(value1, part);
      const session = createUpdateSession();

      SESSION: {
        binding.connect(session);
        binding.commit(session);

        expect(binding.shouldBind(value1)).toBe(false);
        expect(binding.shouldBind(value2)).toBe(true);
      }
    });
  });

  describe('commit()', () => {
    it('sets the string as a node value', () => {
      const value1 = 'foo';
      const value2 = null;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new CommentBinding<string | null>(value1, part);
      const session = createUpdateSession();

      SESSION1: {
        binding.connect(session);
        binding.commit(session);

        expect(part.node.nodeValue).toBe(value1);
      }

      SESSION2: {
        binding.bind(value2);
        binding.connect(session);
        binding.commit(session);

        expect(part.node.nodeValue).toBe('');
      }
    });

    it('sets the string representation of the value as a node value', () => {
      const value1 = 123;
      const value2 = null;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new CommentBinding<number | null>(value1, part);
      const session = createUpdateSession();

      SESSION1: {
        binding.connect(session);
        binding.commit(session);

        expect(part.node.nodeValue).toBe(value1.toString());
      }

      SESSION2: {
        binding.bind(value2);
        binding.connect(session);
        binding.commit(session);

        expect(part.node.nodeValue).toBe('');
      }
    });
  });

  describe('rollback()', () => {
    it('sets null as a node value if the committed value exists', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new CommentBinding(value, part);
      const session = createUpdateSession();

      SESSION1: {
        binding.connect(session);
        binding.commit(session);

        expect(part.node.nodeValue).toBe(value);
      }

      SESSION2: {
        binding.disconnect(session);
        binding.rollback(session);

        expect(part.node.nodeValue).toBe('');
      }
    });

    it('should do nothing if the committed value does not exist', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new CommentBinding(value, part);
      const session = createUpdateSession();

      const setNodeValueSpy = vi.spyOn(part.node, 'nodeValue', 'set');

      SESSION: {
        binding.disconnect(session);
        binding.rollback(session);

        expect(setNodeValueSpy).not.toHaveBeenCalled();
      }
    });
  });
});

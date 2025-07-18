import { describe, expect, it, vi } from 'vitest';

import { PartType } from '@/core.js';
import { NodeBinding, NodePrimitive } from '@/primitive/node.js';
import { Runtime } from '@/runtime.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBackend } from '../../mocks.js';

describe('NodePrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(NodePrimitive.name, 'NodePrimitive');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new NodeBinding', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockBackend());
      const binding = NodePrimitive.resolveBinding(value, part, runtime);

      expect(binding.type).toBe(NodePrimitive);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not a child node part', () => {
      const value = '<div>foo</div>';
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const runtime = new Runtime(new MockBackend());

      expect(() => NodePrimitive.resolveBinding(value, part, runtime)).toThrow(
        'NodePrimitive must be used in a child node,',
      );
    });
  });
});

describe('NodeBinding', () => {
  describe('shouldBind()', () => {
    it('returns true if the committed value does not exist', () => {
      const value = '<div>foo</div>';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new NodeBinding(value, part);

      expect(binding.shouldBind(value)).toBe(true);
    });

    it('returns true if the committed value is different from the new one', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new NodeBinding(value1, part);
      const runtime = new Runtime(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(binding.shouldBind(value1)).toBe(false);
      expect(binding.shouldBind(value2)).toBe(true);
    });
  });

  describe('commit()', () => {
    it('sets the string as a node value', () => {
      const value1 = 'foo';
      const value2 = null;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new NodeBinding<string | null>(value1, part);
      const runtime = new Runtime(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.nodeValue).toBe(value1);

      binding.bind(value2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.nodeValue).toBe('');
    });

    it('sets the string representation of the value as a node value', () => {
      const value1 = 123;
      const value2 = null;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new NodeBinding<number | null>(value1, part);
      const runtime = new Runtime(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.nodeValue).toBe(value1.toString());

      binding.bind(value2);
      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.nodeValue).toBe('');
    });
  });

  describe('rollback()', () => {
    it('sets null as a node value if the committed value exists', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new NodeBinding(value, part);
      const runtime = new Runtime(new MockBackend());

      binding.connect(runtime);
      binding.commit(runtime);

      expect(part.node.nodeValue).toBe(value);

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(part.node.nodeValue).toBe('');
    });

    it('should do nothing if the committed value does not exist', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const binding = new NodeBinding(value, part);
      const runtime = new Runtime(new MockBackend());

      const setNodeValueSpy = vi.spyOn(part.node, 'nodeValue', 'set');

      binding.disconnect(runtime);
      binding.rollback(runtime);

      expect(setNodeValueSpy).not.toHaveBeenCalled();
    });
  });
});

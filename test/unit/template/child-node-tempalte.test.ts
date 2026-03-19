import { describe, expect, it } from 'vitest';
import { PART_TYPE_CHILD_NODE, SLOT_STATUS_ATTACHED } from '@/core.js';
import { createTreeWalker, HydrationError } from '@/hydration.js';
import { createChildNodePart, HTML_NAMESPACE_URI } from '@/part.js';
import { ChildNodeTemplate } from '@/template/child-node.js';
import { MockSlot, MockTemplate } from '../../mocks.js';
import { createElement } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

describe('ChildNodeTemplate', () => {
  describe('arity', () => {
    it('is the number of values', () => {
      const template = new ChildNodeTemplate();

      expect(template.arity).toBe(1);
    });
  });

  describe('equals()', () => {
    it('returns true if the value is instance of ChildNodeTemplate', () => {
      const template = new ChildNodeTemplate();

      expect(template.equals(template)).toBe(true);
      expect(template.equals(new MockTemplate())).toBe(false);
    });
  });

  describe('hydrate()', () => {
    it('hydrates a tree containing a comment node', () => {
      const template = new ChildNodeTemplate();
      const values = ['foo'] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement('div', {}, document.createComment(''));
      const targetTree = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(values, part, targetTree, session);
      });

      expect(childNodes).toStrictEqual([expect.exact(container.firstChild)]);
      expect(slots).toStrictEqual([expect.any(MockSlot)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: values[0],
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.exact(container.firstChild),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
          status: SLOT_STATUS_ATTACHED,
        }),
      ]);
    });

    it('should throw the error if there is a tree mismatch', () => {
      const template = new ChildNodeTemplate();
      const values = ['foo'] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement('div', {});
      const targetTree = createTreeWalker(container);
      const updater = new TestUpdater();

      expect(() => {
        updater.startUpdate((session) => {
          template.hydrate(values, part, targetTree, session);
        });
      }).toThrow(HydrationError);
    });
  });

  describe('render()', () => {
    it('renders a template containing a child node part', () => {
      const template = new ChildNodeTemplate();
      const values = ['foo'] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(values, part, session);
      });

      expect(childNodes).toStrictEqual([expect.any(Comment)]);
      expect(slots).toStrictEqual([expect.any(MockSlot)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: values[0],
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
          status: SLOT_STATUS_ATTACHED,
        }),
      ]);
    });
  });
});

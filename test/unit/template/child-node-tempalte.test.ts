import { describe, expect, it } from 'vitest';
import { createHydrationTree } from '@/hydration.js';
import { HydrationError, PartType } from '@/internal.js';
import { ChildNodeTemplate } from '@/template/child-node.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockSlot, MockTemplate } from '../../mocks.js';
import { createUpdateSession } from '../../session-utils.js';
import { createElement } from '../../test-utils.js';

describe('ChildNodeTemplate', () => {
  describe('arity', () => {
    it('is the number of binds', () => {
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
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement('div', {}, document.createComment(''));
      const target = createHydrationTree(container);
      const session = createUpdateSession();
      const template = new ChildNodeTemplate();
      const { childNodes, slots } = template.hydrate(
        binds,
        part,
        target,
        session,
      );

      expect(childNodes).toStrictEqual([expect.exact(container.firstChild)]);
      expect(slots).toStrictEqual([expect.any(MockSlot)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.ChildNode,
            node: expect.exact(container.firstChild),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          },
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });

    it('should throw the error if there is a tree mismatch', () => {
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement('div', {});
      const tree = createHydrationTree(container);
      const session = createUpdateSession();
      const template = new ChildNodeTemplate();

      expect(() => {
        template.hydrate(binds, part, tree, session);
      }).toThrow(HydrationError);
    });
  });

  describe('render()', () => {
    it('renders a template containing a child node part', () => {
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const session = createUpdateSession();
      const template = new ChildNodeTemplate();
      const { childNodes, slots } = template.render(binds, part, session);

      expect(childNodes).toStrictEqual([expect.any(Comment)]);
      expect(slots).toStrictEqual([expect.any(MockSlot)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.ChildNode,
            node: expect.any(Comment),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          },
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });
  });
});

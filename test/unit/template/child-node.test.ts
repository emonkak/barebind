import { describe, expect, it } from 'vitest';
import {
  createChildNodePart,
  createTreeWalker,
  DOM_PART_TYPE_CHILD_NODE,
  HTML_NAMESPACE_URI,
} from '@/dom.js';
import { HydrationError } from '@/error.js';
import { ChildNodeTemplate } from '@/template/child-node.js';
import { MockTemplate } from '../../mocks.js';
import { createElement } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

describe('ChildNodeTemplate', () => {
  describe('arity', () => {
    it('is the number of expressions', () => {
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
      const exprs = ['foo'] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement('div', {}, document.createComment(''));
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(exprs, part, hydrationTarget, session);
      });

      expect(childNodes).toStrictEqual([expect.exact(container.firstChild)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: DOM_PART_TYPE_CHILD_NODE,
            node: expect.exact(container.firstChild),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
        }),
      ]);
    });

    it('should throw the error if there is a tree mismatch', () => {
      const template = new ChildNodeTemplate();
      const exprs = ['foo'] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement('div', {});
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      expect(() => {
        updater.startUpdate((session) => {
          template.hydrate(exprs, part, hydrationTarget, session);
        });
      }).toThrow(HydrationError);
    });
  });

  describe('render()', () => {
    it('renders a template containing a child node part', () => {
      const template = new ChildNodeTemplate();
      const exprs = ['foo'] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(exprs, part, session);
      });

      expect(childNodes).toStrictEqual([expect.any(Comment)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: DOM_PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
        }),
      ]);
    });
  });
});

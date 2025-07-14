import { describe, expect, it } from 'vitest';

import { HydrationError, HydrationTree } from '@/hydration.js';
import { PartType } from '@/part.js';
import { Runtime } from '@/runtime.js';
import { ChildNodeTemplate } from '@/template/child-node-template.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockHostEnvironment, MockSlot, MockTemplate } from '../../mocks.js';
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
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const hydrationRoot = createElement(
        'div',
        {},
        document.createComment(''),
      );
      const hydrationTree = new HydrationTree(hydrationRoot);
      const runtime = new Runtime(new MockHostEnvironment());
      const template = new ChildNodeTemplate();
      const { childNodes, slots } = template.hydrate(
        binds,
        part,
        hydrationTree,
        runtime,
      );

      expect(childNodes).toStrictEqual([
        expect.exact(hydrationRoot.firstChild),
      ]);
      expect(slots).toStrictEqual([expect.any(MockSlot)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.ChildNode,
            node: expect.exact(hydrationRoot.firstChild),
            childNode: null,
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
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const hydrationRoot = createElement('div', {});
      const hydrationTree = new HydrationTree(hydrationRoot);
      const runtime = new Runtime(new MockHostEnvironment());
      const template = new ChildNodeTemplate();

      expect(() => {
        template.hydrate(binds, part, hydrationTree, runtime);
      }).toThrow(HydrationError);
    });
  });

  describe('render()', () => {
    it('renders a template containing a child node part', () => {
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockHostEnvironment());
      const template = new ChildNodeTemplate();
      const { childNodes, slots } = template.render(binds, part, runtime);

      expect(childNodes).toStrictEqual([expect.any(Comment)]);
      expect(slots).toStrictEqual([expect.any(MockSlot)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.ChildNode,
            node: expect.any(Comment),
            childNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          },
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });
  });
});

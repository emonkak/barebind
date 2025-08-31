import { describe, expect, it } from 'vitest';

import { createHydrationTarget, HydrationError, PartType } from '@/internal.js';
import { ChildNodeTemplate } from '@/template/child-node.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockSlot, MockTemplate } from '../../mocks.js';
import { createElement, UpdateHelper } from '../../test-helpers.js';

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
      const template = new ChildNodeTemplate();
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement('div', {}, document.createComment(''));
      const target = createHydrationTarget(container);
      const helper = new UpdateHelper();

      const { childNodes, slots } = helper.startUpdate((session) => {
        return template.hydrate(binds, part, target, session);
      });

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
      const template = new ChildNodeTemplate();
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement('div', {});
      const target = createHydrationTarget(container);
      const helper = new UpdateHelper();

      expect(() => {
        helper.startUpdate((session) => {
          template.hydrate(binds, part, target, session);
        });
      }).toThrow(HydrationError);
    });
  });

  describe('render()', () => {
    it('renders a template containing a child node part', () => {
      const template = new ChildNodeTemplate();
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const helper = new UpdateHelper();

      const { childNodes, slots } = helper.startUpdate((session) => {
        return template.render(binds, part, session);
      });

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

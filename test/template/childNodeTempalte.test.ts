import { describe, expect, it } from 'vitest';

import { HydrationError, HydrationTree } from '../../src/hydration.js';
import { PartType } from '../../src/part.js';
import { ChildNodeTemplate } from '../../src/template/childNodeTemplate.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import { MockRenderHost } from '../mocks.js';
import { createElement } from '../testUtils.js';

describe('ChildNodeTemplate', () => {
  describe('name', () => {
    it('is a string that represents the template itself', () => {
      expect(ChildNodeTemplate.name, 'ChildNodeTemplate');
    });
  });

  describe('hydrate()', () => {
    it('hydrates a valid tree containing a comment node', () => {
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const hydrationRoot = createElement(
        'div',
        {},
        document.createComment(''),
      );
      const hydrationTree = new HydrationTree(hydrationRoot);
      const context = new UpdateEngine(new MockRenderHost());
      const { childNodes, slots } = ChildNodeTemplate.hydrate(
        binds,
        part,
        hydrationTree,
        context,
      );

      expect(childNodes).toStrictEqual([
        expect.exact(hydrationRoot.firstChild),
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.ChildNode,
            node: expect.exact(hydrationRoot.firstChild),
            childNode: null,
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
      } as const;
      const hydrationRoot = createElement('div', {});
      const hydrationTree = new HydrationTree(hydrationRoot);
      const context = new UpdateEngine(new MockRenderHost());

      expect(() => {
        ChildNodeTemplate.hydrate(binds, part, hydrationTree, context);
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
      } as const;
      const context = new UpdateEngine(new MockRenderHost());
      const { childNodes, slots } = ChildNodeTemplate.render(
        binds,
        part,
        context,
      );

      expect(childNodes).toStrictEqual([expect.any(Comment)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.ChildNode,
            node: expect.any(Comment),
            childNode: null,
          },
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new TemplateBinding', () => {
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const context = new UpdateEngine(new MockRenderHost());
      const binding = ChildNodeTemplate.resolveBinding(binds, part, context);

      expect(binding.directive).toBe(ChildNodeTemplate);
      expect(binding.value).toBe(binds);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not child part', () => {
      const binds = ['foo'] as const;
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const context = new UpdateEngine(new MockRenderHost());

      expect(() =>
        ChildNodeTemplate.resolveBinding(binds, part, context),
      ).toThrow('ChildNodeTemplate must be used in a child node part,');
    });
  });
});

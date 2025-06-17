import { describe, expect, it } from 'vitest';

import { HydrationTree } from '../../src/hydration.js';
import { PartType } from '../../src/part.js';
import { EmptyTemplate } from '../../src/template/emptyTemplate.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import { MockRenderHost } from '../mocks.js';

describe('EmptyTemplate', () => {
  describe('name', () => {
    it('is a string that represents the template itself', () => {
      expect(EmptyTemplate.name, 'EmptyTemplate');
    });
  });

  describe('hydrate()', () => {
    it('hydrates an empty tree', () => {
      const binds = [] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const hydrationTree = new HydrationTree(document.createElement('div'));
      const context = new UpdateEngine(new MockRenderHost());
      const { childNodes, slots } = EmptyTemplate.hydrate(
        binds,
        part,
        hydrationTree,
        context,
      );

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });

  describe('render()', () => {
    it('renders an empty template', () => {
      const binds = [] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const context = new UpdateEngine(new MockRenderHost());
      const { childNodes, slots } = EmptyTemplate.render(binds, part, context);

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new TemplateBinding', () => {
      const binds = [] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const context = new UpdateEngine(new MockRenderHost());
      const binding = EmptyTemplate.resolveBinding(binds, part, context);

      expect(binding.directive).toBe(EmptyTemplate);
      expect(binding.value).toBe(binds);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not child part', () => {
      const binds = [] as const;
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const context = new UpdateEngine(new MockRenderHost());

      expect(() => EmptyTemplate.resolveBinding(binds, part, context)).toThrow(
        'EmptyTemplate must be used in a child node part,',
      );
    });
  });
});

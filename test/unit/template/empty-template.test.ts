import { describe, expect, it } from 'vitest';

import { HydrationTree } from '@/hydration.js';
import { PartType } from '@/part.js';
import { Runtime } from '@/runtime.js';
import { EmptyTemplate } from '@/template/empty-template.js';
import { MockRenderHost } from '../../mocks.js';

describe('EmptyTemplate', () => {
  describe('displayName', () => {
    it('is a string that represents the template itself', () => {
      expect(EmptyTemplate.displayName, 'EmptyTemplate');
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
      const runtime = new Runtime(new MockRenderHost());
      const { childNodes, slots } = EmptyTemplate.hydrate(
        binds,
        part,
        hydrationTree,
        runtime,
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
      const runtime = new Runtime(new MockRenderHost());
      const { childNodes, slots } = EmptyTemplate.render(binds, part, runtime);

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
      const runtime = new Runtime(new MockRenderHost());
      const binding = EmptyTemplate.resolveBinding(binds, part, runtime);

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
      const runtime = new Runtime(new MockRenderHost());

      expect(() => EmptyTemplate.resolveBinding(binds, part, runtime)).toThrow(
        'EmptyTemplate must be used in a child node part,',
      );
    });
  });
});

import { describe, expect, it } from 'vitest';

import { HydrationError, HydrationTree } from '@/hydration.js';
import { PartType } from '@/part.js';
import { Runtime } from '@/runtime.js';
import { TextTemplate } from '@/template/text-template.js';
import { MockRenderHost } from '../../mocks.js';
import { createElement } from '../../test-utils.js';

describe('TextTemplate', () => {
  describe('name', () => {
    it('is a string that represents the template itself', () => {
      const template = new TextTemplate('', '');
      expect(template.name, 'TextTemplate');
    });
  });

  describe('hydrate()', () => {
    it('hydrates a valid tree containing a text part', () => {
      const template = new TextTemplate('(', ')');
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const hydrationRoot = createElement('div', {}, 'foo');
      const hydrationTree = new HydrationTree(hydrationRoot);
      const runtime = new Runtime(new MockRenderHost());
      const { childNodes, slots } = template.hydrate(
        binds,
        part,
        hydrationTree,
        runtime,
      );

      expect(childNodes).toStrictEqual([
        expect.exact(hydrationRoot.firstChild),
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.Text,
            node: expect.exact(hydrationRoot.firstChild),
            precedingText: '(',
            followingText: ')',
          },
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });

    it('should throw the error if there is a tree mismatch', () => {
      const template = new TextTemplate('(', ')');
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const hydrationRoot = createElement('div', {});
      const hydrationTree = new HydrationTree(hydrationRoot);
      const runtime = new Runtime(new MockRenderHost());

      expect(() => {
        template.hydrate(binds, part, hydrationTree, runtime);
      }).toThrow(HydrationError);
    });
  });

  describe('render()', () => {
    it('renders a template containing a text part', () => {
      const template = new TextTemplate('(', ')');
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const runtime = new Runtime(new MockRenderHost());
      const { childNodes, slots } = template.render(binds, part, runtime);

      expect(childNodes).toStrictEqual([expect.any(Text)]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.Text,
            node: expect.any(Text),
            precedingText: '(',
            followingText: ')',
          },
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new TemplateBinding', () => {
      const template = new TextTemplate('(', ')');
      const binds = ['foo'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const runtime = new Runtime(new MockRenderHost());
      const binding = template.resolveBinding(binds, part, runtime);

      expect(binding.directive).toBe(template);
      expect(binding.value).toBe(binds);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not child part', () => {
      const template = new TextTemplate('(', ')');
      const binds = ['foo'] as const;
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const runtime = new Runtime(new MockRenderHost());

      expect(() => template.resolveBinding(binds, part, runtime)).toThrow(
        'TextTemplate must be used in a child node part,',
      );
    });
  });
});

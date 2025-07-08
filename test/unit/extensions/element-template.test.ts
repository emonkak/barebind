import { describe, expect, it } from 'vitest';
import { ElementTemplate } from '@/extensions/element.js';
import { HydrationTree } from '@/hydration.js';
import { PartType } from '@/part.js';
import { Runtime } from '@/runtime.js';
import { MockRenderHost } from '../../mocks.js';
import { createElement, serializeNode } from '../../test-utils.js';

describe('ElementTemplate', () => {
  describe('displayName', () => {
    it('is a string that represents the template itself', () => {
      const template = new ElementTemplate('div');

      expect(template.displayName, 'ElementTemplate');
    });
  });

  describe('equals()', () => {
    it('returns true if the tag name is the same', () => {
      const template = new ElementTemplate('div');

      expect(template.equals(template)).toBe(true);
      expect(template.equals(new ElementTemplate('div'))).toBe(true);
      expect(template.equals(new ElementTemplate('span'))).toBe(false);
    });
  });

  describe('hydrate()', () => {
    it('hydrates an element', () => {
      const binds = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const hydrationRoot = createElement(
        'div',
        {},
        createElement('div', { class: 'foo' }, document.createComment('bar')),
      );
      const hydrationTree = new HydrationTree(hydrationRoot);
      const runtime = new Runtime(new MockRenderHost());
      const template = new ElementTemplate('div');
      const { childNodes, slots } = template.hydrate(
        binds,
        part,
        hydrationTree,
        runtime,
      );

      expect(childNodes).toStrictEqual([hydrationRoot.firstChild]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.Element,
            node: expect.exact(hydrationRoot.firstChild),
          },
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          value: binds[1],
          part: {
            type: PartType.ChildNode,
            node: expect.exact(hydrationRoot.firstChild!.firstChild),
            childNode: null,
          },
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });
  });

  describe('render()', () => {
    it('renders an element', () => {
      const binds = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const runtime = new Runtime(new MockRenderHost());
      const template = new ElementTemplate('div');
      const { childNodes, slots } = template.render(binds, part, runtime);

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<div><!----></div>',
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.Element,
            node: expect.any(Element),
          },
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          value: binds[1],
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
      const binds = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const runtime = new Runtime(new MockRenderHost());
      const template = new ElementTemplate('div');
      const binding = template.resolveBinding(binds, part, runtime);

      expect(binding.directive).toBe(template);
      expect(binding.value).toBe(binds);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not child part', () => {
      const binds = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const template = new ElementTemplate('div');
      const runtime = new Runtime(new MockRenderHost());

      expect(() => template.resolveBinding(binds, part, runtime)).toThrow(
        'ElementTemplate must be used in a child node part,',
      );
    });
  });
});

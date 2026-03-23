import { describe, expect, it } from 'vitest';
import { PART_TYPE_CHILD_NODE, PART_TYPE_ELEMENT } from '@/core.js';
import {
  createChildNodePart,
  createTreeWalker,
  HTML_NAMESPACE_URI,
  SVG_NAMESPACE_URI,
} from '@/dom.js';
import { ElementTemplate } from '@/template/element.js';
import { createElement, serializeNode } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

describe('ElementTemplate', () => {
  describe('arity', () => {
    it('returns the number of expressions', () => {
      const template = new ElementTemplate('div');

      expect(template.arity).toBe(2);
    });
  });

  describe('equals()', () => {
    it('returns true if the name is the same', () => {
      const template = new ElementTemplate('div');

      expect(template.equals(template)).toBe(true);
      expect(template.equals(new ElementTemplate('div'))).toBe(true);
      expect(template.equals(new ElementTemplate('span'))).toBe(false);
    });
  });

  describe('hydrate()', () => {
    it('hydrates a tree containing a element', () => {
      const template = new ElementTemplate('div');
      const expressions = [{ class: 'foo' }, 'bar'] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement(
        'div',
        {},
        createElement('div', { class: 'foo' }, document.createComment('bar')),
      );
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(expressions, part, hydrationTarget, session);
      });

      expect(childNodes).toStrictEqual([container.firstChild]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.exact(container.firstChild),
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.exact(container.firstChild!.firstChild),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
        }),
      ]);
    });
  });

  describe('render()', () => {
    it('renders an HTML element', () => {
      const template = new ElementTemplate('div');
      const expressions = [{ class: 'foo' }, 'bar'] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(expressions, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<div><!----></div>',
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.any(window.Element),
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
        }),
      ]);
      expect((slots[0]!.part.node as Element).namespaceURI).toBe(
        HTML_NAMESPACE_URI,
      );
    });

    it('renders an SVG element', () => {
      const template = new ElementTemplate('svg');
      const expressions = [{ class: 'foo' }, 'bar'] as const;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(expressions, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<svg><!----></svg>',
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.any(window.Element),
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: SVG_NAMESPACE_URI,
          },
        }),
      ]);
      expect((slots[0]!.part.node as Element).namespaceURI).toBe(
        SVG_NAMESPACE_URI,
      );
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  SLOT_STATUS_ATTACHED,
} from '@/core.js';
import { createTreeWalker } from '@/hydration.js';
import { ElementTemplate } from '@/template/element.js';
import { HTML_NAMESPACE_URI, SVG_NAMESPACE_URI } from '@/template/template.js';
import { createElement, serializeNode } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

describe('ElementTemplate', () => {
  describe('arity', () => {
    it('returns the number of values', () => {
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
      const values = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PART_TYPE_CHILD_NODE,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      } as const;
      const container = createElement(
        'div',
        {},
        createElement('div', { class: 'foo' }, document.createComment('bar')),
      );
      const targetTree = createTreeWalker(container);
      const updater = new TestUpdater();

      const { children, slots } = updater.startUpdate((session) => {
        return template.hydrate(values, part, targetTree, session);
      });

      expect(children).toStrictEqual([container.firstChild]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: values[0],
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.exact(container.firstChild),
          },
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          value: values[1],
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.exact(container.firstChild!.firstChild),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          },
          status: SLOT_STATUS_ATTACHED,
        }),
      ]);
    });
  });

  describe('render()', () => {
    it('renders an HTML element', () => {
      const template = new ElementTemplate('div');
      const values = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PART_TYPE_CHILD_NODE,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      } as const;
      const updater = new TestUpdater();

      const { children, slots } = updater.startUpdate((session) => {
        return template.render(values, part, session);
      });

      expect(children.map(serializeNode)).toStrictEqual(['<div><!----></div>']);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: values[0],
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.any(window.Element),
          },
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          value: values[1],
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          },
          status: SLOT_STATUS_ATTACHED,
        }),
      ]);
      expect((slots[0]!.part.node as Element).namespaceURI).toBe(
        HTML_NAMESPACE_URI,
      );
    });

    it('renders an SVG element', () => {
      const template = new ElementTemplate('svg');
      const values = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PART_TYPE_CHILD_NODE,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      } as const;
      const updater = new TestUpdater();

      const { children, slots } = updater.startUpdate((session) => {
        return template.render(values, part, session);
      });

      expect(children.map(serializeNode)).toStrictEqual(['<svg><!----></svg>']);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: values[0],
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.any(window.Element),
          },
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          value: values[1],
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            anchorNode: null,
            namespaceURI: SVG_NAMESPACE_URI,
          },
          status: SLOT_STATUS_ATTACHED,
        }),
      ]);
      expect((slots[0]!.part.node as Element).namespaceURI).toBe(
        SVG_NAMESPACE_URI,
      );
    });
  });
});

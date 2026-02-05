import { describe, expect, it } from 'vitest';

import { createTreeWalker } from '@/hydration.js';
import { PartType } from '@/internal.js';
import { ElementTemplate } from '@/template/element.js';
import { HTML_NAMESPACE_URI, SVG_NAMESPACE_URI } from '@/template/template.js';
import { createElement, serializeNode } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

describe('ElementTemplate', () => {
  describe('arity', () => {
    it('returns the number of args', () => {
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
      const args = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement(
        'div',
        {},
        createElement('div', { class: 'foo' }, document.createComment('bar')),
      );
      const targetTree = createTreeWalker(container);
      const updater = new TestUpdater();

      const { children, slots } = updater.startUpdate((session) => {
        return template.hydrate(args, part, targetTree, session);
      });

      expect(children).toStrictEqual([container.firstChild]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: args[0],
          part: {
            type: PartType.Element,
            node: expect.exact(container.firstChild),
          },
          dirty: true,
          committed: false,
        }),
        expect.objectContaining({
          value: args[1],
          part: {
            type: PartType.ChildNode,
            node: expect.exact(container.firstChild!.firstChild),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          },
          dirty: true,
          committed: false,
        }),
      ]);
    });
  });

  describe('render()', () => {
    it('renders an HTML element', () => {
      const template = new ElementTemplate('div');
      const args = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const updater = new TestUpdater();

      const { children, slots } = updater.startUpdate((session) => {
        return template.render(args, part, session);
      });

      expect(children.map(serializeNode)).toStrictEqual(['<div><!----></div>']);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: args[0],
          part: {
            type: PartType.Element,
            node: expect.any(window.Element),
          },
          dirty: true,
          committed: false,
        }),
        expect.objectContaining({
          value: args[1],
          part: {
            type: PartType.ChildNode,
            node: expect.any(Comment),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          },
          dirty: true,
          committed: false,
        }),
      ]);
      expect((slots[0]!.part.node as Element).namespaceURI).toBe(
        HTML_NAMESPACE_URI,
      );
    });

    it('renders an SVG element', () => {
      const template = new ElementTemplate('svg');
      const args = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const updater = new TestUpdater();

      const { children, slots } = updater.startUpdate((session) => {
        return template.render(args, part, session);
      });

      expect(children.map(serializeNode)).toStrictEqual(['<svg><!----></svg>']);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: args[0],
          part: {
            type: PartType.Element,
            node: expect.any(window.Element),
          },
          dirty: true,
          committed: false,
        }),
        expect.objectContaining({
          value: args[1],
          part: {
            type: PartType.ChildNode,
            node: expect.any(Comment),
            anchorNode: null,
            namespaceURI: SVG_NAMESPACE_URI,
          },
          dirty: true,
          committed: false,
        }),
      ]);
      expect((slots[0]!.part.node as Element).namespaceURI).toBe(
        SVG_NAMESPACE_URI,
      );
    });
  });
});

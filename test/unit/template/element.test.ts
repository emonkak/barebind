import { describe, expect, it } from 'vitest';
import { createHydrationTarget } from '@/hydration.js';
import { PartType } from '@/internal.js';
import { Element, ElementTemplate } from '@/template/element.js';
import { HTML_NAMESPACE_URI, SVG_NAMESPACE_URI } from '@/template/template.js';
import {
  createElement,
  serializeNode,
  UpdateHelper,
} from '../../test-helpers.js';

describe('Element()', () => {
  it('returns a new DirectiveSpecifier with the element', () => {
    const props = { class: 'foo' };
    const children = 'bar';
    const bindable = Element('div', props, children);

    expect(bindable.type).toBeInstanceOf(ElementTemplate);
    expect((bindable.type as ElementTemplate).tagName).toBe('div');
    expect(bindable.value).toStrictEqual([props, children]);
  });
});

describe('ElementTemplate', () => {
  describe('arity', () => {
    it('returns the number of binds', () => {
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
      const binds = [{ class: 'foo' }, 'bar'] as const;
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
      const target = createHydrationTarget(container);
      const helper = new UpdateHelper();

      const { childNodes, slots } = helper.startUpdate((session) => {
        return template.hydrate(binds, part, target, session);
      });

      expect(childNodes).toStrictEqual([container.firstChild]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.Element,
            node: expect.exact(container.firstChild),
          },
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          value: binds[1],
          part: {
            type: PartType.ChildNode,
            node: expect.exact(container.firstChild!.firstChild),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          },
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });
  });

  describe('render()', () => {
    it('renders an HTML element', () => {
      const template = new ElementTemplate('div');
      const binds = [{ class: 'foo' }, 'bar'] as const;
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

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<div><!----></div>',
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.Element,
            node: expect.any(window.Element),
          },
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          value: binds[1],
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
      expect((slots[0]!.part.node as Element).namespaceURI).toBe(
        HTML_NAMESPACE_URI,
      );
    });

    it('renders an SVG element', () => {
      const template = new ElementTemplate('svg');
      const binds = [{ class: 'foo' }, 'bar'] as const;
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

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<svg><!----></svg>',
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          value: binds[0],
          part: {
            type: PartType.Element,
            node: expect.any(window.Element),
          },
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          value: binds[1],
          part: {
            type: PartType.ChildNode,
            node: expect.any(Comment),
            anchorNode: null,
            namespaceURI: SVG_NAMESPACE_URI,
          },
          isConnected: true,
          isCommitted: false,
        }),
      ]);
      expect((slots[0]!.part.node as Element).namespaceURI).toBe(
        SVG_NAMESPACE_URI,
      );
    });
  });
});

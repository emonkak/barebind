import { describe, expect, it } from 'vitest';
import { HydrationNodeScanner, PartType } from '@/core.js';
import { Runtime } from '@/runtime.js';
import { ElementTemplate, element } from '@/template/element.js';
import { HTML_NAMESPACE_URI, SVG_NAMESPACE_URI } from '@/template/template.js';
import { MockBackend } from '../../mocks.js';
import { createElement, serializeNode } from '../../test-utils.js';

describe('element()', () => {
  it('returns a new DirectiveSpecifier with the element', () => {
    const props = { class: 'foo' };
    const children = 'bar';
    const bindable = element('div', props, children);

    expect(bindable.type).toBeInstanceOf(ElementTemplate);
    expect((bindable.type as ElementTemplate)['_name']).toBe('div');
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
      const binds = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement(
        'div',
        {},
        createElement('div', { class: 'foo' }, document.createComment('bar')),
      );
      const nodeScanner = new HydrationNodeScanner(container);
      const runtime = new Runtime(new MockBackend());
      const template = new ElementTemplate('div');
      const { childNodes, slots } = template.hydrate(
        binds,
        part,
        nodeScanner,
        runtime,
      );

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
            childNode: null,
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
      const binds = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockBackend());
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
      const binds = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockBackend());
      const template = new ElementTemplate('svg');
      const { childNodes, slots } = template.render(binds, part, runtime);

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<svg><!----></svg>',
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

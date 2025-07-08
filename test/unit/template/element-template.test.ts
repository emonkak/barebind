import { describe, expect, it } from 'vitest';
import { HydrationTree } from '@/hydration.js';
import { PartType } from '@/part.js';
import { Runtime } from '@/runtime.js';
import {
  ElementTemplate,
  HTML_NAMESPACE,
  htmlElement,
  MATH_NAMESPACE,
  mathElement,
  SVG_NAMESPACE,
  svgElement,
} from '@/template/element-template.js';
import { MockRenderHost } from '../../mocks.js';
import { createElement, serializeNode } from '../../test-utils.js';

describe('htmlElement()', () => {
  it('returns a new DirectiveSpecifier with the HTML element', () => {
    const props = { class: 'foo' };
    const children = 'bar';
    const bindable = htmlElement('div', props, children);

    expect(bindable.type).toBeInstanceOf(ElementTemplate);
    expect((bindable.type as ElementTemplate)['_name']).toBe('div');
    expect((bindable.type as ElementTemplate)['_namespace']).toBe(
      HTML_NAMESPACE,
    );
    expect(bindable.value).toStrictEqual([props, children]);
  });
});

describe('mathElement()', () => {
  it('returns a new DirectiveSpecifier with the MathML element', () => {
    const props = { class: 'foo' };
    const children = 'bar';
    const bindable = mathElement('mi', props, children);

    expect(bindable.type).toBeInstanceOf(ElementTemplate);
    expect((bindable.type as ElementTemplate)['_name']).toBe('mi');
    expect((bindable.type as ElementTemplate)['_namespace']).toBe(
      MATH_NAMESPACE,
    );
    expect(bindable.value).toStrictEqual([props, children]);
  });
});

describe('svgElement()', () => {
  it('returns a new DirectiveSpecifier with the SVG element', () => {
    const props = { class: 'foo' };
    const children = 'bar';
    const bindable = svgElement('text', props, children);

    expect(bindable.type).toBeInstanceOf(ElementTemplate);
    expect((bindable.type as ElementTemplate)['_name']).toBe('text');
    expect((bindable.type as ElementTemplate)['_namespace']).toBe(
      SVG_NAMESPACE,
    );
    expect(bindable.value).toStrictEqual([props, children]);
  });
});

describe('ElementTemplate', () => {
  describe('displayName', () => {
    it('is a string that represents the template itself', () => {
      const template = new ElementTemplate('div', HTML_NAMESPACE);

      expect(template.displayName, 'ElementTemplate');
    });
  });

  describe('equals()', () => {
    it('returns true if the name and the namespace are the same', () => {
      const template = new ElementTemplate('div', HTML_NAMESPACE);

      expect(template.equals(template)).toBe(true);
      expect(template.equals(new ElementTemplate('div', HTML_NAMESPACE))).toBe(
        true,
      );
      expect(template.equals(new ElementTemplate('div', null))).toBe(false);
      expect(template.equals(new ElementTemplate('span', HTML_NAMESPACE))).toBe(
        false,
      );
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
      const template = new ElementTemplate('div', HTML_NAMESPACE);
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
    it('renders an HTML element', () => {
      const binds = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const runtime = new Runtime(new MockRenderHost());
      const template = new ElementTemplate('div', HTML_NAMESPACE);
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
      expect((slots[0]!.part.node as Element).namespaceURI).toBe(
        HTML_NAMESPACE,
      );
    });

    it('renders an SVG element', () => {
      const binds = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const runtime = new Runtime(new MockRenderHost());
      const template = new ElementTemplate('text', SVG_NAMESPACE);
      const { childNodes, slots } = template.render(binds, part, runtime);

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<text><!----></text>',
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
      expect((slots[0]!.part.node as Element).namespaceURI).toBe(SVG_NAMESPACE);
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
      const template = new ElementTemplate('div', HTML_NAMESPACE);
      const binding = template.resolveBinding(binds, part, runtime);

      expect(binding.type).toBe(template);
      expect(binding.value).toBe(binds);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not child part', () => {
      const binds = [{ class: 'foo' }, 'bar'] as const;
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const template = new ElementTemplate('div', HTML_NAMESPACE);
      const runtime = new Runtime(new MockRenderHost());

      expect(() => template.resolveBinding(binds, part, runtime)).toThrow(
        'ElementTemplate must be used in a child node part,',
      );
    });
  });
});

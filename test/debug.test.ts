import { describe, expect, it } from 'vitest';

import {
  inspectNode,
  inspectPart,
  inspectValue,
  markUsedValue,
} from '../src/debug.js';
import { PartType } from '../src/part.js';
import { createElement } from './testUtils.js';

const NODE_MAKRER = '[[NODE IN HERE!]]';

describe('inspectNode()', () => {
  it('reports where a text node', () => {
    const node = document.createTextNode('foo');

    expect(inspectNode(node, NODE_MAKRER)).toBe('[[NODE IN HERE!]]foo');

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(inspectNode(node, NODE_MAKRER)).toBe(
      '<div><span>foo</span><p>bar[[NODE IN HERE!]]foo<!----></p><span>qux</span></div>',
    );
  });

  it('reports where a comment node', () => {
    const node = document.createComment('foo');

    expect(inspectNode(node, NODE_MAKRER)).toBe('[[NODE IN HERE!]]<!--foo-->');

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(inspectNode(node, NODE_MAKRER)).toBe(
      '<div><span>foo</span><p>bar[[NODE IN HERE!]]<!--foo--><!----></p><span>qux</span></div>',
    );
  });

  it('reports where an element node', () => {
    const node = createElement('mark', {}, 'foo');

    expect(inspectNode(node, NODE_MAKRER)).toBe(
      '[[NODE IN HERE!]]<mark>foo</mark>',
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(inspectNode(node, NODE_MAKRER)).toBe(
      '<div><span>foo</span><p>bar[[NODE IN HERE!]]<mark>foo</mark><!----></p><span>qux</span></div>',
    );
  });
});

describe('inspectPart()', () => {
  it('reports where an AttributePart is inserted', () => {
    const part = {
      type: PartType.Attribute,
      name: 'class',
      node: createElement('input', { type: 'text' }),
    } as const;
    const value = 'my value';

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<input type="text" class=[["my value" IS USED IN HERE!]]>`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<div><span>foo</span><p>bar<input type="text" class=[["my value" IS USED IN HERE!]]><!----></p><span>qux</span></div>`,
    );
  });

  it('reports where an AttributePart is inserted in the document', () => {
    const part = {
      type: PartType.Attribute,
      name: 'class',
      node: createElement('input', { type: 'text' }),
    } as const;
    const value = 'my value';

    const myDocument = document.implementation.createHTMLDocument();
    myDocument.body.replaceChildren(
      createElement(
        'div',
        {},
        createElement('span', {}, 'foo'),
        createElement('p', {}, 'bar', part.node, document.createComment('')),
        createElement('span', {}, 'qux'),
      ),
    );

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<!DOCTYPE html><html><head></head><body><div><span>foo</span><p>bar<input type="text" class=[["my value" IS USED IN HERE!]]><!----></p><span>qux</span></div></body></html>`,
    );

    myDocument.body.replaceChildren(
      createElement(
        'div',
        { id: 'foo' },
        createElement('span', {}, 'foo'),
        createElement('p', {}, 'bar', part.node, document.createComment('')),
        createElement('span', {}, 'qux'),
      ),
    );

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<div id="foo"><span>foo</span><p>bar<input type="text" class=[["my value" IS USED IN HERE!]]><!----></p><span>qux</span></div>`,
    );
  });

  it('reports where a ChildNodePart is inserted', () => {
    const part = {
      type: PartType.ChildNode,
      name: 'click',
      node: document.createComment(''),
      childNode: null,
    } as const;
    const value = 'my value';

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `[["my value" IS USED IN HERE!]]<!---->`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<div><span>foo</span><p>bar[["my value" IS USED IN HERE!]]<!----><!----></p><span>qux</span></div>`,
    );
  });

  it('reports where an ElementPart is inserted', () => {
    const part = {
      type: PartType.Element,
      node: document.createElement('div'),
    } as const;
    const value = 'my value';

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<div [["my value" IS USED IN HERE!]]></div>`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<div><span>foo</span><p>bar<div [["my value" IS USED IN HERE!]]></div><!----></p><span>qux</span></div>`,
    );
  });

  it('reports where an EventPart is inserted', () => {
    const part = {
      type: PartType.Event,
      name: 'click',
      node: createElement('button', { type: 'button' }),
    } as const;
    const value = 'my value';

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<button type="button" @click=[["my value" IS USED IN HERE!]]></button>`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<div><span>foo</span><p>bar<button type="button" @click=[["my value" IS USED IN HERE!]]></button><!----></p><span>qux</span></div>`,
    );
  });

  it('reports where a LivePart is inserted', () => {
    const part = {
      type: PartType.Live,
      name: 'value',
      node: createElement('input', { type: 'text' }),
      defaultValue: '',
    } as const;
    const value = 'my value';

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<input type="text" $value=[["my value" IS USED IN HERE!]]>`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<div><span>foo</span><p>bar<input type="text" $value=[["my value" IS USED IN HERE!]]><!----></p><span>qux</span></div>`,
    );
  });

  it('reports where a PropertyPart is inserted', () => {
    const part = {
      type: PartType.Property,
      name: 'value',
      node: createElement('input', { type: 'text' }),
      defaultValue: '',
    } as const;
    const value = 'my value';

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<input type="text" .value=[["my value" IS USED IN HERE!]]>`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<div><span>foo</span><p>bar<input type="text" .value=[["my value" IS USED IN HERE!]]><!----></p><span>qux</span></div>`,
    );
  });

  it('reports where a TextPart is inserted', () => {
    const part = {
      type: PartType.Text,
      name: 'click',
      node: document.createTextNode('foo'),
      precedingText: '',
      followingText: '',
    } as const;
    const value = 'my value';

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `[["my value" IS USED IN HERE!]]`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, document.createTextNode('foo')),
      createElement(
        'p',
        {},
        document.createTextNode('bar'),
        part.node,
        document.createComment(''),
      ),
      createElement('span', {}, document.createTextNode('qux')),
    );

    expect(inspectPart(part, markUsedValue(value))).toBe(
      `<div><span>foo</span><p>bar[["my value" IS USED IN HERE!]]<!----></p><span>qux</span></div>`,
    );
  });
});

describe('inspectValue()', () => {
  it('returns a string representation of the value', () => {
    expect(inspectValue(null)).toBe('null');
    expect(inspectValue(undefined)).toBe('undefined');
    expect(inspectValue('foo')).toBe('"foo"');
    expect(inspectValue(123)).toBe('123');
    expect(inspectValue(true)).toBe('true');
    expect(inspectValue({})).toBe('{}');
    expect(inspectValue([])).toBe('[]');
    expect(inspectValue(new Date())).toBe('Date');
    expect(inspectValue(() => {})).toBe('Function');
    expect(inspectValue(function foo() {})).toBe('Function(foo)');
    expect(inspectValue(new Map())).toBe('Map');
    expect(
      inspectValue({ foo: 1, bar: [2], baz: { $qux: 3, 'foo-bar': 4 } }),
    ).toBe('{foo: 1, bar: [2], baz: {$qux: 3, "foo-bar": 4}}');
    expect(inspectValue([1, [2], { $qux: 3, 'foo-bar': 4 }])).toBe(
      '[1, [2], {$qux: 3, "foo-bar": 4}]',
    );
  });
});

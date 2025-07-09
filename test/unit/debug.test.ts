import { describe, expect, it } from 'vitest';

import {
  inspectNode,
  inspectPart,
  inspectValue,
  markUsedValue,
} from '@/debug.js';
import { PartType } from '@/part.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockBindable, MockDirective } from '../mocks.js';
import { createElement } from '../test-utils.js';

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
    };
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
    };
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
      namespaceURI: HTML_NAMESPACE_URI,
    };
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
    };
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
    };
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
    };
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
    };
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
    };
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
  const x = {};
  const circlerValue = { x: {} };
  circlerValue.x = circlerValue;

  it.each([
    [null, 'null'],
    [undefined, 'undefined'],
    [0, '0'],
    [-0, '-0'],
    [NaN, 'NaN'],
    [Infinity, 'Infinity'],
    [true, 'true'],
    [new Date(), 'Date'],
    [new Map(), 'Map'],
    [new Set(), 'Set'],
    [new (class Foo {})(), 'Foo'],
    [
      new MockBindable({ type: new MockDirective(), value: 'foo' }),
      'MockDirective("foo")',
    ],
    [function foo() {}, 'Function(foo)'],
    [() => {}, 'Function'],
    [[], '[]'],
    [[x, x], '[{}, {}]'],
    [
      [1, [2], { $qux: 3, 'foo-bar': 4 }],
      '[1, [2], { $qux: 3, "foo-bar": 4 }]',
    ],
    [{}, '{}'],
    [{ __proto__: null, foo: 1 }, '{ foo: 1 }'],
    [
      { foo: 1, bar: [2], baz: { $qux: 3, 'foo-bar': 4 } },
      '{ foo: 1, bar: [2], baz: { $qux: 3, "foo-bar": 4 } }',
    ],
    [
      { foo: { bar: { baz: { qux: 123 } } } },
      '{ foo: { bar: { baz: { qux: ... } } } }',
    ],
    [circlerValue, '{ x: [Circular] }'],
  ])(
    'returns a string representation of the value',
    (value, expectedString) => {
      expect(inspectValue(value)).toBe(expectedString);
    },
  );
});

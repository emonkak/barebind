import { describe, expect, it } from 'vitest';
import {
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
  PART_TYPE_TEXT,
} from '@/core.js';
import { debugPart, formatPart, undebugPart } from '@/debug/part.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockDirective, MockPrimitive } from '../../mocks.js';
import { createElement } from '../../test-helpers.js';

const MAKRER = '[[PART IS IN HERE!]]';

describe('debugPart()', () => {
  it('sets the debug information for the value in child node part', () => {
    const part = {
      type: PART_TYPE_CHILD_NODE,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI: HTML_NAMESPACE_URI,
    } as const;

    debugPart(part, new MockDirective(), 'foo');
    expect(part.node.data).toBe('/MockDirective("foo")');

    debugPart(part, new MockDirective(), 'bar');
    expect(part.node.data).toBe('/MockDirective("bar")');

    debugPart(part, new MockDirective(), 'baz');
    expect(part.node.data).toBe('/MockDirective("baz")');

    undebugPart(part, MockPrimitive);
    expect(part.node.data).toBe('/MockDirective("baz")');

    undebugPart(part, new MockDirective());
    expect(part.node.data).toBe('');
  });

  it('should do nothing if the part is not a child node part', () => {
    const part = {
      type: PART_TYPE_TEXT,
      node: document.createTextNode(''),
      precedingText: '',
      followingText: '',
    } as const;

    debugPart(part, new MockDirective('FirstDirective'), 'foo');

    expect(part.node.data).toBe('');

    undebugPart(part, new MockDirective('FirstDirective'));

    expect(part.node.data).toBe('');
  });
});

describe('formatPart()', () => {
  it('reports where an AttributePart is inserted', () => {
    const part = {
      type: PART_TYPE_ATTRIBUTE,
      name: 'class',
      node: createElement('input', { type: 'text' }),
    } as const;

    expect(formatPart(part, MAKRER)).toBe(
      `<input type="text" class=[[PART IS IN HERE!]]>`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(formatPart(part, MAKRER)).toBe(
      `
<div>
  <span>
    foo
  </span>
  <p>
    bar
    <input type="text" class=[[PART IS IN HERE!]]>
    <!---->
  </p>
  <span>
    qux
  </span>
</div>
`.trim(),
    );
  });

  it('reports where an AttributePart is inserted in the document', () => {
    const part = {
      type: PART_TYPE_ATTRIBUTE,
      name: 'class',
      node: createElement('input', { type: 'text' }),
    } as const;

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

    expect(formatPart(part, MAKRER)).toBe(
      `
<!DOCTYPE html>
<html>
  <head></head>
  <body>
    <div>
      <span>
        foo
      </span>
      <p>
        bar
        <input type="text" class=[[PART IS IN HERE!]]>
        <!---->
      </p>
      <span>
        qux
      </span>
    </div>
  </body>
</html>
`.trim(),
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

    expect(formatPart(part, MAKRER)).toBe(
      `
<div id="foo">
  <span>
    foo
  </span>
  <p>
    bar
    <input type="text" class=[[PART IS IN HERE!]]>
    <!---->
  </p>
  <span>
    qux
  </span>
</div>
`.trim(),
    );
  });

  it('reports where a ChildNodePart is inserted', () => {
    const part = {
      type: PART_TYPE_CHILD_NODE,
      name: 'click',
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI: HTML_NAMESPACE_URI,
    } as const;

    expect(formatPart(part, MAKRER)).toBe(`[[PART IS IN HERE!]]<!---->`);

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(formatPart(part, MAKRER)).toBe(
      `
<div>
  <span>
    foo
  </span>
  <p>
    bar
    [[PART IS IN HERE!]]<!---->
    <!---->
  </p>
  <span>
    qux
  </span>
</div>
`.trim(),
    );
  });

  it('reports where an ElementPart is inserted', () => {
    const part = {
      type: PART_TYPE_ELEMENT,
      node: document.createElement('div'),
    } as const;

    expect(formatPart(part, MAKRER)).toBe(`<div [[PART IS IN HERE!]]></div>`);

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(formatPart(part, MAKRER)).toBe(
      `
<div>
  <span>
    foo
  </span>
  <p>
    bar
    <div [[PART IS IN HERE!]]></div>
    <!---->
  </p>
  <span>
    qux
  </span>
</div>
`.trim(),
    );
  });

  it('reports where an EventPart is inserted', () => {
    const part = {
      type: PART_TYPE_EVENT,
      name: 'click',
      node: createElement('button', { type: 'button' }),
    } as const;

    expect(formatPart(part, MAKRER)).toBe(
      `<button type="button" @click=[[PART IS IN HERE!]]></button>`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(formatPart(part, MAKRER)).toBe(
      `
<div>
  <span>
    foo
  </span>
  <p>
    bar
    <button type="button" @click=[[PART IS IN HERE!]]></button>
    <!---->
  </p>
  <span>
    qux
  </span>
</div>
`.trim(),
    );
  });

  it('reports where a LivePart is inserted', () => {
    const part = {
      type: PART_TYPE_LIVE,
      name: 'value',
      node: createElement('input', { type: 'text' }),
      defaultValue: '',
    } as const;

    expect(formatPart(part, MAKRER)).toBe(
      `<input type="text" $value=[[PART IS IN HERE!]]>`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(formatPart(part, MAKRER)).toBe(
      `
<div>
  <span>
    foo
  </span>
  <p>
    bar
    <input type="text" $value=[[PART IS IN HERE!]]>
    <!---->
  </p>
  <span>
    qux
  </span>
</div>
`.trim(),
    );
  });

  it('reports where a PropertyPart is inserted', () => {
    const part = {
      type: PART_TYPE_PROPERTY,
      name: 'value',
      node: createElement('input', { type: 'text' }),
      defaultValue: '',
    } as const;

    expect(formatPart(part, MAKRER)).toBe(
      `<input type="text" .value=[[PART IS IN HERE!]]>`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(formatPart(part, MAKRER)).toBe(
      `
<div>
  <span>
    foo
  </span>
  <p>
    bar
    <input type="text" .value=[[PART IS IN HERE!]]>
    <!---->
  </p>
  <span>
    qux
  </span>
</div>
`.trim(),
    );
  });

  it('reports where a TextPart is inserted', () => {
    const part = {
      type: PART_TYPE_TEXT,
      name: 'click',
      node: document.createTextNode('foo'),
      precedingText: '',
      followingText: '',
    } as const;

    expect(formatPart(part, MAKRER)).toBe(`[[PART IS IN HERE!]]foo`);

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

    expect(formatPart(part, MAKRER)).toBe(
      `
<div>
  <span>
    foo
  </span>
  <p>
    bar
    [[PART IS IN HERE!]]foo
    <!---->
  </p>
  <span>
    qux
  </span>
</div>
`.trim(),
    );
  });
});

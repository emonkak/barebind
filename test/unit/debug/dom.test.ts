import { describe, expect, it } from 'vitest';

import {
  debugPart,
  emphasizeNode,
  formatPart,
  undebugPart,
} from '@/debug/dom.js';
import {
  createAttributePart,
  createChildNodePart,
  createElementPart,
  createEventPart,
  createLivePart,
  createPropertyPart,
  createTextPart,
  HTML_NAMESPACE_URI,
} from '@/part.js';
import { MockType } from '../../mocks.js';
import { createElement } from '../../test-helpers.js';

const MAKRER = '[[ERROR IN HERE!]]';

describe('debugPart()', () => {
  it('sets the debug information for the value in child node part', () => {
    const part = createChildNodePart(
      document.createComment(''),
      HTML_NAMESPACE_URI,
    );

    debugPart(part, new MockType('A'), 'foo');
    expect(part.sentinelNode.data).toBe('/A("foo")');

    debugPart(part, new MockType('A'), 'bar');
    expect(part.sentinelNode.data).toBe('/A("bar")');

    debugPart(part, new MockType('A'), 'baz');
    expect(part.sentinelNode.data).toBe('/A("baz")');

    undebugPart(part, new MockType('B'));
    expect(part.sentinelNode.data).toBe('/A("baz")');

    undebugPart(part, new MockType('A'));
    expect(part.sentinelNode.data).toBe('');
  });

  it('should do nothing if the part is not a child node part', () => {
    const part = createTextPart(document.createTextNode(''), '', '');

    debugPart(part, new MockType(), 'foo');

    expect(part.node.data).toBe('');

    undebugPart(part, new MockType());

    expect(part.node.data).toBe('');
  });
});

describe('emphasizeNode()', () => {
  it('reports where a text node', () => {
    const node = document.createTextNode('foo');

    expect(emphasizeNode(node, MAKRER)).toBe('[[ERROR IN HERE!]]foo');

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(emphasizeNode(node, MAKRER)).toBe(
      `
<div>
  <span>
    foo
  </span>
  <p>
    bar
    [[ERROR IN HERE!]]foo
    <!---->
  </p>
  <span>
    qux
  </span>
</div>
`.trim(),
    );
  });

  it('reports where a comment node', () => {
    const node = document.createComment('foo');

    expect(emphasizeNode(node, MAKRER)).toBe('[[ERROR IN HERE!]]<!--foo-->');

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(emphasizeNode(node, MAKRER)).toBe(
      `
<div>
  <span>
    foo
  </span>
  <p>
    bar
    [[ERROR IN HERE!]]<!--foo-->
    <!---->
  </p>
  <span>
    qux
  </span>
</div>
`.trim(),
    );
  });

  it('reports where an element node', () => {
    const node = createElement('mark', {}, 'foo');

    expect(emphasizeNode(node, MAKRER)).toBe(
      `
<mark [[ERROR IN HERE!]]>
  foo
</mark>
`.trim(),
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(emphasizeNode(node, MAKRER)).toBe(
      `
<div>
  <span>
    foo
  </span>
  <p>
    bar
    <mark [[ERROR IN HERE!]]>
      foo
    </mark>
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

describe('formatPart()', () => {
  it('reports where an AttributePart is inserted', () => {
    const part = createAttributePart(
      createElement('input', { type: 'text' }),
      'class',
    );

    expect(formatPart(part, MAKRER)).toBe(
      `<input type="text" class=[[ERROR IN HERE!]]>`,
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
    <input type="text" class=[[ERROR IN HERE!]]>
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
    const part = createAttributePart(
      createElement('input', { type: 'text' }),
      'class',
    );

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
        <input type="text" class=[[ERROR IN HERE!]]>
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
    <input type="text" class=[[ERROR IN HERE!]]>
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
    const part = createChildNodePart(
      document.createComment(''),
      HTML_NAMESPACE_URI,
    );

    expect(formatPart(part, MAKRER)).toBe(`[[ERROR IN HERE!]]<!---->`);

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
    [[ERROR IN HERE!]]<!---->
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
    const part = createElementPart(document.createElement('div'));

    expect(formatPart(part, MAKRER)).toBe(`<div [[ERROR IN HERE!]]></div>`);

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
    <div [[ERROR IN HERE!]]></div>
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
    const part = createEventPart(
      createElement('button', { type: 'button' }),
      'click',
    );

    expect(formatPart(part, MAKRER)).toBe(
      `<button type="button" @click=[[ERROR IN HERE!]]></button>`,
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
    <button type="button" @click=[[ERROR IN HERE!]]></button>
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
    const part = createLivePart(
      createElement('input', { type: 'text' }),
      'value',
    );

    expect(formatPart(part, MAKRER)).toBe(
      `<input type="text" $value=[[ERROR IN HERE!]]>`,
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
    <input type="text" $value=[[ERROR IN HERE!]]>
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
    const part = createPropertyPart(
      createElement('input', { type: 'text' }),
      'value',
    );

    expect(formatPart(part, MAKRER)).toBe(
      `<input type="text" .value=[[ERROR IN HERE!]]>`,
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
    <input type="text" .value=[[ERROR IN HERE!]]>
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
    const part = createTextPart(document.createTextNode('foo'), '', '');

    expect(formatPart(part, MAKRER)).toBe(`[[ERROR IN HERE!]]foo`);

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
    [[ERROR IN HERE!]]foo
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

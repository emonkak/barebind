import { describe, expect, it } from 'vitest';

import { debugPart, formatPart, undebugPart } from '@/debug/part.js';
import { PartType } from '@/internal.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockDirective } from '../../mocks.js';
import { createElement } from '../../test-helpers.js';

const MAKRER = '[[PART IS IN HERE!]]';

describe('debugPart()', () => {
  it('sets the debug information for the value in child node part', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI: HTML_NAMESPACE_URI,
    };

    debugPart(part, new MockDirective('FirstDirective'), 'foo');
    expect(part.node.data).toBe('/FirstDirective("foo")');

    debugPart(part, new MockDirective('FirstDirective'), 'bar');
    expect(part.node.data).toBe('/FirstDirective("bar")');

    debugPart(part, new MockDirective('SecondDirective'), 'baz');
    expect(part.node.data).toBe('/FirstDirective("bar")');

    undebugPart(part, new MockDirective('FirstDirective'));
    expect(part.node.data).toBe('');

    debugPart(part, new MockDirective('SecondDirective'), 'baz');
    expect(part.node.data).toBe('/SecondDirective("baz")');
  });

  it('should do nothing if the part is not a child node part', () => {
    const part = {
      type: PartType.Text,
      node: document.createTextNode(''),
      precedingText: '',
      followingText: '',
    };

    debugPart(part, new MockDirective('FirstDirective'), 'foo');

    expect(part.node.data).toBe('');

    undebugPart(part, new MockDirective('FirstDirective'));

    expect(part.node.data).toBe('');
  });
});

describe('formatPart()', () => {
  it('reports where an AttributePart is inserted', () => {
    const part = {
      type: PartType.Attribute,
      name: 'class',
      node: createElement('input', { type: 'text' }),
    };

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
      type: PartType.Attribute,
      name: 'class',
      node: createElement('input', { type: 'text' }),
    };

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
      type: PartType.ChildNode,
      name: 'click',
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI: HTML_NAMESPACE_URI,
    };

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
      type: PartType.Element,
      node: document.createElement('div'),
    };

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
      type: PartType.Event,
      name: 'click',
      node: createElement('button', { type: 'button' }),
    };

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
      type: PartType.Live,
      name: 'value',
      node: createElement('input', { type: 'text' }),
      defaultValue: '',
    };

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
      type: PartType.Property,
      name: 'value',
      node: createElement('input', { type: 'text' }),
      defaultValue: '',
    };

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
      type: PartType.Text,
      name: 'click',
      node: document.createTextNode('foo'),
      precedingText: '',
      followingText: '',
    };

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

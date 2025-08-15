import { describe, expect, it } from 'vitest';
import { debugPart } from '@/debug/part.js';
import { PartType } from '@/internal.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { createElement } from '../../test-utils.js';

const MAKRER = '[[PART IS IN HERE!]]';

describe('debugPart()', () => {
  it('reports where an AttributePart is inserted', () => {
    const part = {
      type: PartType.Attribute,
      name: 'class',
      node: createElement('input', { type: 'text' }),
    };

    expect(debugPart(part, MAKRER)).toBe(
      `<input type="text" class=[[PART IS IN HERE!]]>`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(debugPart(part, MAKRER)).toBe(
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

    expect(debugPart(part, MAKRER)).toBe(
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

    expect(debugPart(part, MAKRER)).toBe(
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

    expect(debugPart(part, MAKRER)).toBe(`[[PART IS IN HERE!]]<!---->`);

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(debugPart(part, MAKRER)).toBe(
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

    expect(debugPart(part, MAKRER)).toBe(`<div [[PART IS IN HERE!]]></div>`);

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(debugPart(part, MAKRER)).toBe(
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

    expect(debugPart(part, MAKRER)).toBe(
      `<button type="button" @click=[[PART IS IN HERE!]]></button>`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(debugPart(part, MAKRER)).toBe(
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

    expect(debugPart(part, MAKRER)).toBe(
      `<input type="text" $value=[[PART IS IN HERE!]]>`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(debugPart(part, MAKRER)).toBe(
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

    expect(debugPart(part, MAKRER)).toBe(
      `<input type="text" .value=[[PART IS IN HERE!]]>`,
    );

    createElement(
      'div',
      {},
      createElement('span', {}, 'foo'),
      createElement('p', {}, 'bar', part.node, document.createComment('')),
      createElement('span', {}, 'qux'),
    );

    expect(debugPart(part, MAKRER)).toBe(
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

    expect(debugPart(part, MAKRER)).toBe(`[[PART IS IN HERE!]]foo`);

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

    expect(debugPart(part, MAKRER)).toBe(
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

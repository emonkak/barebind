import { describe, expect, it } from 'vitest';

import { emphasizeNode } from '@/debug/node.js';
import { createElement } from '../../test-helpers.js';

const MAKRER = '[[NODE IS IN HERE!]]';

describe('emphasizeNode()', () => {
  it('reports where a text node', () => {
    const node = document.createTextNode('foo');

    expect(emphasizeNode(node, MAKRER)).toBe('[[NODE IS IN HERE!]]foo');

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
    [[NODE IS IN HERE!]]foo
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

    expect(emphasizeNode(node, MAKRER)).toBe('[[NODE IS IN HERE!]]<!--foo-->');

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
    [[NODE IS IN HERE!]]<!--foo-->
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
<mark [[NODE IS IN HERE!]]>
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
    <mark [[NODE IS IN HERE!]]>
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

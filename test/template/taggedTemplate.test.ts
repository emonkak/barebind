import { describe, expect, it } from 'vitest';
import { HydrationError, HydrationTree } from '../../src/hydration.js';
import { PartType } from '../../src/part.js';
import { TaggedTemplate } from '../../src/template/taggedTemplate.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import { MockRenderHost } from '../mocks.js';
import { createElement } from '../testUtils.js';

const TEMPLATE_PLACEHOLDER = '__test__';

describe('TaggedTemplate', () => {
  describe('name', () => {
    it('is a string that represents the template itself', () => {
      const { template } = html`<div>foo</div>`;
      expect(template.name, 'TaggedTemplate');
    });
  });

  describe('parse()', () => {
    it('should parse holes inside attributes', () => {
      const { template } = html`
        <dialog class="dialog" id=${0} $open=${2} .innerHTML=${1} @click=${3}></dialog>
      `;

      expect(template['_holes']).toStrictEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Live, name: 'open', index: 0 },
        { type: PartType.Property, name: 'innerHTML', index: 0 },
        { type: PartType.Event, name: 'click', index: 0 },
      ]);
      expect(template['_element'].innerHTML).toBe(
        '<dialog class="dialog"></dialog>',
      );
    });

    it('should parse holes inside double-quoted attributes', () => {
      const { template } = html`
        <dialog class="dialog" id="${0}" $open="${2}" .innerHTML="${1}" @click="${3}"></dialog>
      `;

      expect(template['_holes']).toStrictEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Live, name: 'open', index: 0 },
        { type: PartType.Property, name: 'innerHTML', index: 0 },
        { type: PartType.Event, name: 'click', index: 0 },
      ]);
      expect(template['_element'].innerHTML).toBe(
        '<dialog class="dialog"></dialog>',
      );
    });

    it('should parse holes inside single-quoted attributes', () => {
      const { template } = html`
        <dialog class="dialog" id='${0}' $open='${2}' .innerHTML='${1}' @click='${3}'></dialog>
      `;

      expect(template['_holes']).toStrictEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Live, name: 'open', index: 0 },
        { type: PartType.Property, name: 'innerHTML', index: 0 },
        { type: PartType.Event, name: 'click', index: 0 },
      ]);
      expect(template['_element'].innerHTML).toBe(
        '<dialog class="dialog"></dialog>',
      );
    });

    it('should parse holes inside attributes with whitespaces', () => {
      const { template } = html`
        <dialog class="dialog" id="${0}" $open= "${2}" .innerHTML ="${1}" @click = "${3}"></dialog>
      `;

      expect(template['_holes']).toStrictEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Live, name: 'open', index: 0 },
        { type: PartType.Property, name: 'innerHTML', index: 0 },
        { type: PartType.Event, name: 'click', index: 0 },
      ]);
      expect(template['_element'].innerHTML).toBe(
        '<dialog class="dialog"></dialog>',
      );
    });

    it('should parse a hole inside a tag name', () => {
      const { template } = html`
        <${0}>
        <${1} >
        <${2}/>
        <${3} />
      `;

      expect(template['_holes']).toStrictEqual([
        { type: PartType.ChildNode, index: 0 },
        { type: PartType.ChildNode, index: 2 },
        { type: PartType.ChildNode, index: 4 },
        { type: PartType.ChildNode, index: 6 },
      ]);
      expect(template['_element'].innerHTML).toBe(
        `
        <!---->
        <!---->
        <!---->
        <!---->
      `.trim(),
      );
    });

    it('should parse holes inside elements', () => {
      const { template } = html`
        <div id="foo" ${0}></div>
        <div ${1} id="foo"></div>
        <div id="foo" ${2} class="bar"></div>
      `;

      expect(template['_holes']).toStrictEqual([
        { type: PartType.Element, index: 0 },
        { type: PartType.Element, index: 2 },
        { type: PartType.Element, index: 4 },
      ]);
      expect(template['_element'].innerHTML).toBe(
        `
        <div id="foo"></div>
        <div id="foo"></div>
        <div id="foo" class="bar"></div>
      `.trim(),
      );
    });

    it('should parse holes inside descendants', () => {
      const { template } = html`
        <ul>
          <li>${1}</li>
          <li>${2}</li>
        </ul>
      `;

      expect(template['_holes']).toStrictEqual([
        { type: PartType.Text, index: 3 },
        { type: PartType.Text, index: 6 },
      ]);
      expect(template['_element'].innerHTML).toBe(
        `
        <ul>
          <li></li>
          <li></li>
        </ul>
      `.trim(),
      );
    });

    it('should parse holes inside children', () => {
      const { template } = html`
        <div>[${0}, ${1}]</div>
        <div>${0}, ${1}</div>
      `;

      expect(template['_holes']).toStrictEqual([
        { type: PartType.Text, index: 2 },
        { type: PartType.Text, index: 4 },
        { type: PartType.Text, index: 8 },
        { type: PartType.Text, index: 10 },
      ]);
      expect(template['_element'].innerHTML).toBe(
        `
        <div>[, ]</div>
        <div>, </div>
      `.trim(),
      );
    });

    it('should parse holes inside a comment as ChildNodeHole', () => {
      const { template } = html`
        <!---->
        <!--${0}-->
        <!--${1}/-->
        <!-- ${2} -->
        <!-- ${3} /-->
      `;

      expect(template['_holes']).toStrictEqual([
        { type: PartType.ChildNode, index: 2 },
        { type: PartType.ChildNode, index: 4 },
        { type: PartType.ChildNode, index: 6 },
        { type: PartType.ChildNode, index: 8 },
      ]);
      expect(template['_element'].innerHTML).toBe(
        `
        <!---->
        <!---->
        <!---->
        <!---->
        <!---->
      `.trim(),
      );
    });

    it('should parse holes inside a tag with leading spaces as TextHole', () => {
      const { template } = html`
        < ${0}>
        < ${0}/>
      `;
      expect(template['_holes']).toStrictEqual([
        { type: PartType.Text, index: 1 },
        { type: PartType.Text, index: 3 },
      ]);
      expect(template['_element'].innerHTML).toBe(
        `
        &lt; &gt;
        &lt; /&gt;
      `.trim(),
      );
    });

    it('should parse holes inside attributes as SVG fragment', () => {
      const { template } = svg`
        <circle fill="black" cx=${0} cy=${1} r=${2} />
      `;

      expect(template['_holes']).toStrictEqual([
        { type: PartType.Attribute, name: 'cx', index: 0 },
        { type: PartType.Attribute, name: 'cy', index: 0 },
        { type: PartType.Attribute, name: 'r', index: 0 },
      ]);
      expect(template['_element'].innerHTML).toBe(
        '<circle fill="black"></circle>',
      );
      expect(template['_element'].content.firstElementChild?.namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
    });

    it('should parse holes inside children as MathML fragment', () => {
      const { template } = math`<msup><mi>${0}</mi><mn>${1}</mn></msup>`;

      expect(template['_holes']).toStrictEqual([
        { type: PartType.Text, index: 2 },
        { type: PartType.Text, index: 4 },
      ]);
      expect(template['_element'].innerHTML).toBe(
        '<msup><mi></mi><mn></mn></msup>',
      );
      expect(template['_element'].content.firstElementChild?.namespaceURI).toBe(
        'http://www.w3.org/1998/Math/MathML',
      );
    });

    it('should throw an error if passed a placeholder in an invalid format', () => {
      expect(() => {
        TaggedTemplate.parse([], [], 'INVALID_MARKER', 'html');
      }).toThrow('The placeholder is in an invalid format.');
      expect(() => {
        TaggedTemplate.parse(
          [],
          [],
          TEMPLATE_PLACEHOLDER.toUpperCase(),
          'html',
        );
      }).toThrow('The placeholder is in an invalid format.');
    });

    it('should throw an error when there is a hole as an attribute name', () => {
      expect(() => {
        html`
          <div ${0}="foo"></div>
        `;
      }).toThrow('Expressions are not allowed as an attribute name:');
      expect(() => {
        html`
          <div x-${0}="foo"></div>
        `;
      }).toThrow('Expressions are not allowed as an attribute name:');
      expect(() => {
        html`
          <div ${0}-x="foo"></div>
        `;
      }).toThrow('Expressions are not allowed as an attribute name:');
    });

    it('should throw an error when there is a hole with extra strings inside an attribute value', () => {
      expect(() => {
        html`
          <div class=" ${0}"></div>
        `;
      }).toThrow(
        'Expressions inside an attribute must make up the entire attribute value:',
      );
      expect(() => {
        html`
          <div class="${0} "></div>
        `;
      }).toThrow(
        'Expressions inside an attribute must make up the entire attribute value:',
      );
    });

    it('should throw an error when there is a hole with extra strings inside a tag name', () => {
      expect(() => {
        html`
          <x-${0}>
        `;
      }).toThrow('Expressions are not allowed as a tag name:');
      expect(() => {
        html`
          <${0}-x>
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
      expect(() => {
        html`
          <${0}/ >
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
    });

    it('should throw an error when there is a hole with extra strings inside a comment', () => {
      expect(() => {
        html`
          <!-- x-${0} -->
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
      expect(() => {
        html`
          <!-- ${0}-x -->
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
      expect(() => {
        html`
          <!-- ${0}/ -->
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
    });

    it('should throw an error when there is a duplicated attribute', () => {
      expect(() => {
        html`
          <div class="foo" class=${0} id=${1}></div>
        `;
      }).toThrow(`The attribute name must be "id", but got "class".`);
    });

    it('should throw an error if the number of holes and values do not match', () => {
      expect(() => {
        html`
          <div class="foo" class=${'bar'}></div>
        `;
      }).toThrow('The number of holes must be 1, but got 0.');
      expect(() => {
        html`
          <div class=${'foo'} class=${'bar'}></div>
        `;
      }).toThrow('The number of holes must be 2, but got 1.');
    });
  });

  describe('hydrate()', () => {
    it('hydrates a HTML template element with multiple holes', () => {
      const { template, binds } = html`
        <div class=${'foo'}>
          <!-- ${'bar'} -->
          <input type="text" $value=${'baz'} .disabled=${false} @onchange=${() => {}} ${{ class: 'qux' }}><span>${'quux'}</span>
        </div>
      `;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const hydrationRoot = createElement(
        'div',
        {},
        fragment`
        <div class="foo">
          <!-- bar -->
          <input type="text" class="qux"><span>quux</span>
        </div>
      `,
      );
      const hydrationTree = new HydrationTree(hydrationRoot);
      const context = new UpdateEngine(new MockRenderHost());

      const { childNodes, slots } = template.hydrate(
        binds,
        part,
        hydrationTree,
        context,
      );

      expect(childNodes.map(toHTML)).toStrictEqual([
        `
        <div class="foo">
          <!---->
          <input type="text" class="qux"><span>quux</span>
        </div>`.trim(),
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PartType.Attribute,
            node: expect.exact(hydrationRoot.querySelector('div')),
            name: 'class',
          },
          value: binds[0],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.ChildNode,
            node: expect.any(Comment),
            childNode: null,
          },
          value: binds[1],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Live,
            node: expect.exact(hydrationRoot.querySelector('input')),
            name: 'value',
            defaultValue: '',
          },
          value: binds[2],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Property,
            node: expect.exact(hydrationRoot.querySelector('input')),
            name: 'disabled',
            defaultValue: false,
          },
          value: binds[3],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Event,
            node: expect.exact(hydrationRoot.querySelector('input')),
            name: 'onchange',
          },
          value: binds[4],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Element,
            node: expect.exact(hydrationRoot.querySelector('input')),
          },
          value: binds[5],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.exact(hydrationRoot.querySelector('span')?.firstChild),
          },
          value: binds[6],
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });

    it('hydrates a HTML template element without holes', () => {
      const { template, binds } = html`<div>foo</div>`;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const hydrationRoot = createElement(
        'div',
        {},
        createElement('div', {}, 'foo'),
      );
      const hydrationTree = new HydrationTree(hydrationRoot);
      const context = new UpdateEngine(new MockRenderHost());
      const { childNodes, slots } = template.hydrate(
        binds,
        part,
        hydrationTree,
        context,
      );

      expect(childNodes.map(toHTML)).toStrictEqual(['<div>foo</div>']);
      expect(slots).toStrictEqual([]);
    });

    it('hydrates a text template', () => {
      const { template, binds } = html`${'foo'}`;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const hydrationRoot = createElement('div', {}, 'foo');
      const hydrationTree = new HydrationTree(hydrationRoot);
      const context = new UpdateEngine(new MockRenderHost());
      const { childNodes, slots } = template.hydrate(
        binds,
        part,
        hydrationTree,
        context,
      );

      expect(childNodes.map(toHTML)).toStrictEqual(['foo']);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.exact(hydrationRoot.firstChild),
          },
          value: binds[0],
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });

    it('renders an empty template', () => {
      const { template, binds } = html``;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const hydrationRoot = createElement('div', {});
      const hydrationTree = new HydrationTree(hydrationRoot);
      const context = new UpdateEngine(new MockRenderHost());
      const { childNodes, slots } = template.hydrate(
        binds,
        part,
        hydrationTree,
        context,
      );

      expect(childNodes.map(toHTML)).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });

    it('should throw the error if the number of binds and holes do not match', () => {
      const { template } = html`<div>${'foo'}</div>`;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const hydrationRoot = createElement('div', {}, 'foo');
      const hydrationTree = new HydrationTree(hydrationRoot);
      const context = new UpdateEngine(new MockRenderHost());

      expect(() => {
        template.hydrate([] as any, part, hydrationTree, context);
      }).toThrow('There may be multiple holes indicating the same attribute.');
    });

    it.each([
      [html`<div></div>`, createElement('div', {})],
      [html`<div></div>`, createElement('div', {}, createElement('span'))],
      [
        html`<div></div>`,
        createElement('div', {}, document.createComment('foo')),
      ],
      [html`<div></div>`, createElement('div', {}, 'foo')],
      [html`<!-- foo -->`, createElement('div', {})],
      [html`<!-- foo -->`, createElement('div', {}, createElement('div'))],
      [html`<!-- foo -->`, createElement('div', {}, 'foo')],
      [html`foo`, createElement('div', {})],
      [html`foo`, createElement('div', {}, createElement('div'))],
      [html`foo`, createElement('div', {}, document.createComment('foo'))],
    ])(
      'should throw the error if there is a tree mismatch',
      ({ template }, hydrationRoot) => {
        const part = {
          type: PartType.ChildNode,
          node: document.createComment(''),
          childNode: null,
        };
        const hydrationTree = new HydrationTree(hydrationRoot);
        const context = new UpdateEngine(new MockRenderHost());

        expect(() => {
          template.hydrate([], part, hydrationTree, context);
        }).toThrow(HydrationError);
      },
    );
  });

  describe('render()', () => {
    it('renders a HTML template element with multiple holes', () => {
      const { template, binds } = html`
        <div class=${'foo'}>
          <!-- ${'bar'} -->
          <input type="text" $value=${'baz'} .disabled=${false} @onchange=${() => {}} ${{ class: 'qux' }}><span>${'quux'}</span>
        </div>
      `;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const context = new UpdateEngine(new MockRenderHost());
      const { childNodes, slots } = template.render(binds, part, context);

      expect(childNodes.map(toHTML)).toStrictEqual([
        `
        <div>
          <!---->
          <input type="text"><span></span>
        </div>`.trim(),
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PartType.Attribute,
            node: expect.any(HTMLDivElement),
            name: 'class',
          },
          value: binds[0],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.ChildNode,
            node: expect.any(Comment),
            childNode: null,
          },
          value: binds[1],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Live,
            node: expect.any(HTMLInputElement),
            name: 'value',
            defaultValue: '',
          },
          value: binds[2],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Property,
            node: expect.any(HTMLInputElement),
            name: 'disabled',
            defaultValue: false,
          },
          value: binds[3],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Event,
            node: expect.any(HTMLInputElement),
            name: 'onchange',
          },
          value: binds[4],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Element,
            node: expect.any(HTMLInputElement),
          },
          value: binds[5],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.any(Text),
          },
          value: binds[6],
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });

    it('renders a HTML template element without holes', () => {
      const { template, binds } = html`<div>foo</div>`;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const context = new UpdateEngine(new MockRenderHost());
      const { childNodes, slots } = template.render(binds, part, context);

      expect(childNodes.map(toHTML)).toStrictEqual(['<div>foo</div>']);
      expect(slots).toStrictEqual([]);
    });

    it('renders a text template', () => {
      const { template, binds } = html`${'foo'}`;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const context = new UpdateEngine(new MockRenderHost());
      const { childNodes, slots } = template.render(binds, part, context);

      expect(childNodes.map(toHTML)).toStrictEqual(['']);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.any(Text),
          },
          value: binds[0],
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });

    it('renders an empty template', () => {
      const { template, binds } = html``;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const context = new UpdateEngine(new MockRenderHost());
      const { childNodes, slots } = template.render(binds, part, context);

      expect(childNodes.map(toHTML)).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });

    it('should throw the error if the number of binds and holes do not match', () => {
      const { template } = html`<div>${'foo'}</div>`;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const context = new UpdateEngine(new MockRenderHost());

      expect(() => {
        template.render([] as any, part, context);
      }).toThrow('There may be multiple holes indicating the same attribute.');
    });

    it('should throw the error if the template is invalid', () => {
      const template: TaggedTemplate = new TaggedTemplate(
        document.createElement('template'),
        [
          {
            type: PartType.Text,
            index: 0,
          },
        ],
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      };
      const context = new UpdateEngine(new MockRenderHost());

      expect(() => {
        template.render(['foo'], part, context);
      }).toThrow('There is no node that the hole points.');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new TemplateBinding', () => {
      const { template, binds } = html`<div>${'foo'}</div>`;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const context = new UpdateEngine(new MockRenderHost());
      const binding = template.resolveBinding(binds, part, context);

      expect(binding.directive).toBe(template);
      expect(binding.value).toBe(binds);
      expect(binding.part).toBe(part);
    });

    it('throws the error if the part is not child part', () => {
      const { template, binds } = html`<div>${'foo'}</div>`;
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const context = new UpdateEngine(new MockRenderHost());

      expect(() => template.resolveBinding(binds, part, context)).toThrow(
        'TaggedTemplate must be used in a child node part,',
      );
    });
  });
});

function fragment(
  strings: TemplateStringsArray,
  ...values: string[]
): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = String.raw(strings, values).trim();
  return template.content;
}

function html<TBinds extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...binds: TBinds
): { template: TaggedTemplate<TBinds>; binds: TBinds } {
  return {
    template: TaggedTemplate.parse(
      strings,
      binds,
      TEMPLATE_PLACEHOLDER,
      'html',
    ),
    binds,
  };
}

function math<const TBinds extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...binds: TBinds
): { template: TaggedTemplate<TBinds>; binds: TBinds } {
  return {
    template: TaggedTemplate.parse(
      strings,
      binds,
      TEMPLATE_PLACEHOLDER,
      'math',
    ),
    binds,
  };
}

function svg<const TBinds extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...binds: TBinds
): { template: TaggedTemplate<TBinds>; binds: TBinds } {
  return {
    template: TaggedTemplate.parse(strings, binds, TEMPLATE_PLACEHOLDER, 'svg'),
    binds,
  };
}

function toHTML(node: Node): string {
  const wrapper = document.createElement('div');
  wrapper.appendChild(node.cloneNode(true));
  return wrapper.innerHTML;
}

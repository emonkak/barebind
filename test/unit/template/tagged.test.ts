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
import {
  createChildNodePart,
  createTreeWalker,
  HTML_NAMESPACE_URI,
  MATH_NAMESPACE_URI,
  SVG_NAMESPACE_URI,
} from '@/dom.js';
import { HydrationError } from '@/error.js';
import { TaggedTemplate } from '@/template/tagged.js';
import { createElement, serializeNode } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

const MARKER_IDENTIFIER = '__test__';

describe('TaggedTemplate', () => {
  describe('arity', () => {
    it('is the number of expressions', () => {
      expect(html``.template.arity).toBe(0);
      expect(html`${'foo'}`.template.arity).toBe(1);
      expect(html`${'foo'} ${'bar'}`.template.arity).toBe(2);
    });
  });

  describe('parse()', () => {
    it('should parse a HTML template with holes inside attributes', () => {
      const { template } = html`
        <dialog class="dialog" id=${0} $open=${2} .innerHTML=${1} @click=${3}></dialog>
      `;

      expect(template['_template'].innerHTML).toBe(
        '<dialog class="dialog"></dialog>',
      );
      expect(template['_holes']).toStrictEqual([
        { type: PART_TYPE_ATTRIBUTE, name: 'id', index: 0 },
        { type: PART_TYPE_LIVE, name: 'open', index: 0 },
        { type: PART_TYPE_PROPERTY, name: 'innerHTML', index: 0 },
        { type: PART_TYPE_EVENT, name: 'click', index: 0 },
      ]);
    });

    it('should parse a HTML template with holes inside double-quoted attributes', () => {
      const { template } = html`
        <dialog class="dialog" id="${0}" $open="${2}" .innerHTML="${1}" @click="${3}"></dialog>
      `;

      expect(template['_template'].innerHTML).toBe(
        '<dialog class="dialog"></dialog>',
      );
      expect(template['_holes']).toStrictEqual([
        { type: PART_TYPE_ATTRIBUTE, name: 'id', index: 0 },
        { type: PART_TYPE_LIVE, name: 'open', index: 0 },
        { type: PART_TYPE_PROPERTY, name: 'innerHTML', index: 0 },
        { type: PART_TYPE_EVENT, name: 'click', index: 0 },
      ]);
    });

    it('should parse a HTML template with holes inside single-quoted attributes', () => {
      const { template } = html`
        <dialog class="dialog" id='${0}' $open='${2}' .innerHTML='${1}' @click='${3}'></dialog>
      `;

      expect(template['_template'].innerHTML).toBe(
        '<dialog class="dialog"></dialog>',
      );
      expect(template['_holes']).toStrictEqual([
        { type: PART_TYPE_ATTRIBUTE, name: 'id', index: 0 },
        { type: PART_TYPE_LIVE, name: 'open', index: 0 },
        { type: PART_TYPE_PROPERTY, name: 'innerHTML', index: 0 },
        { type: PART_TYPE_EVENT, name: 'click', index: 0 },
      ]);
    });

    it('should parse a HTML template with holes inside attributes with whitespaces', () => {
      const { template } = html`
        <dialog class="dialog" id="${0}" $open= "${2}" .innerHTML ="${1}" @click = "${3}"></dialog>
      `;

      expect(template['_template'].innerHTML).toBe(
        '<dialog class="dialog"></dialog>',
      );
      expect(template['_holes']).toStrictEqual([
        { type: PART_TYPE_ATTRIBUTE, name: 'id', index: 0 },
        { type: PART_TYPE_LIVE, name: 'open', index: 0 },
        { type: PART_TYPE_PROPERTY, name: 'innerHTML', index: 0 },
        { type: PART_TYPE_EVENT, name: 'click', index: 0 },
      ]);
    });

    it('should parse a HTML template with holes inside tag names', () => {
      const { template } = html`
        <${0}>
        <${1} >
        <${2}/>
        <${3} />
      `;

      expect(template['_template'].innerHTML).toBe(
        '<!----><!----><!----><!---->',
      );
      expect(template['_holes']).toStrictEqual([
        { type: PART_TYPE_CHILD_NODE, index: 0 },
        { type: PART_TYPE_CHILD_NODE, index: 1 },
        { type: PART_TYPE_CHILD_NODE, index: 2 },
        { type: PART_TYPE_CHILD_NODE, index: 3 },
      ]);
    });

    it('should parse a HTML template with holes inside elements', () => {
      const { template } = html`
        <div id="foo" ${0}></div>
        <div ${1} id="foo"></div>
        <div id="foo" ${2} class="bar"></div>
      `;

      expect(template['_template'].innerHTML).toBe(
        '<div id="foo"></div><div id="foo"></div><div id="foo" class="bar"></div>',
      );
      expect(template['_holes']).toStrictEqual([
        { type: PART_TYPE_ELEMENT, index: 0 },
        { type: PART_TYPE_ELEMENT, index: 1 },
        { type: PART_TYPE_ELEMENT, index: 2 },
      ]);
    });

    it('should parse a HTML template with holes inside descendants', () => {
      const { template } = html`
        <ul>
          <li>${1}</li>
          <li>${2}</li>
        </ul>
      `;

      expect(template['_template'].innerHTML).toBe(
        '<ul><li></li><li></li></ul>',
      );
      expect(template['_holes']).toStrictEqual([
        {
          type: PART_TYPE_TEXT,
          index: 2,
          leadingSpan: 0,
          trailingSpan: 0,
        },
        {
          type: PART_TYPE_TEXT,
          index: 4,
          leadingSpan: 0,
          trailingSpan: 0,
        },
      ]);
    });

    it('should parse a HTML template with holes inside children', () => {
      const { template } = html`
        <div>  </div>
        <div> ${0} ${1} </div>
        <div>[${2} ${3}]</div>
        <div>${4} ${5}</div>
        <div>
          ${6}
          ${7}
        </div>
      `;

      expect(template['_template'].innerHTML).toBe(
        '<div>  </div><div>   </div><div>[ ]</div><div> </div><div></div>',
      );
      expect(template['_holes']).toStrictEqual([
        {
          type: PART_TYPE_TEXT,
          index: 3,
          leadingSpan: 1,
          trailingSpan: 0,
        },
        {
          type: PART_TYPE_TEXT,
          index: 3,
          leadingSpan: 1,
          trailingSpan: 1,
        },
        {
          type: PART_TYPE_TEXT,
          index: 5,
          leadingSpan: 1,
          trailingSpan: 0,
        },
        {
          type: PART_TYPE_TEXT,
          index: 5,
          leadingSpan: 1,
          trailingSpan: 1,
        },
        {
          type: PART_TYPE_TEXT,
          index: 7,
          leadingSpan: 0,
          trailingSpan: 0,
        },
        {
          type: PART_TYPE_TEXT,
          index: 7,
          leadingSpan: 1,
          trailingSpan: 0,
        },
        {
          type: PART_TYPE_TEXT,
          index: 9,
          leadingSpan: 0,
          trailingSpan: 0,
        },
        {
          type: PART_TYPE_TEXT,
          index: 9,
          leadingSpan: 0,
          trailingSpan: 0,
        },
      ]);
    });

    it('should parse a HTML template with holes inside comments', () => {
      const { template } = html`
        <!---->
        <!--${0}-->
        <!--${1}/-->
        <!-- ${2} -->
        <!-- ${3} /-->
      `;

      expect(template['_template'].innerHTML).toBe(
        '<!----><!----><!----><!----><!---->',
      );
      expect(template['_holes']).toStrictEqual([
        { type: PART_TYPE_CHILD_NODE, index: 1 },
        { type: PART_TYPE_CHILD_NODE, index: 2 },
        { type: PART_TYPE_CHILD_NODE, index: 3 },
        { type: PART_TYPE_CHILD_NODE, index: 4 },
      ]);
    });

    it('should parse a HTML template with holes inside tags with leading spaces', () => {
      const { template } = html` < ${0}>< ${1}/> `;

      expect(template['_template'].innerHTML).toBe(' &lt; &gt;&lt; /&gt; ');
      expect(template['_holes']).toStrictEqual([
        {
          type: PART_TYPE_TEXT,
          index: 0,
          leadingSpan: 3,
          trailingSpan: 0,
        },
        {
          type: PART_TYPE_TEXT,
          index: 0,
          leadingSpan: 3,
          trailingSpan: 3,
        },
      ]);
    });

    it('should parse a HTML template with holes on the root', () => {
      const { template } = html` ${0} ${1} `;

      expect(template['_template'].innerHTML).toBe('   ');
      expect(template['_holes']).toStrictEqual([
        {
          type: PART_TYPE_TEXT,
          index: 0,
          leadingSpan: 1,
          trailingSpan: 0,
        },
        {
          type: PART_TYPE_TEXT,
          index: 0,
          leadingSpan: 1,
          trailingSpan: 1,
        },
      ]);
    });

    it('should parse a HTML template without holes', () => {
      const { template } = html` foo `;

      expect(template['_template'].innerHTML).toBe(' foo ');
      expect(template['_holes']).toStrictEqual([]);
    });

    it('should parse a SVG template with holes inside attributes', () => {
      const { template } = svg`
        <circle fill="black" cx=${0} cy=${1} r=${2} />
      `;

      expect(template['_template'].innerHTML).toBe(
        '<circle fill="black"></circle>',
      );
      expect(
        template['_template'].content.firstElementChild?.namespaceURI,
      ).toBe(SVG_NAMESPACE_URI);
      expect(template['_holes']).toStrictEqual([
        { type: PART_TYPE_ATTRIBUTE, name: 'cx', index: 0 },
        { type: PART_TYPE_ATTRIBUTE, name: 'cy', index: 0 },
        { type: PART_TYPE_ATTRIBUTE, name: 'r', index: 0 },
      ]);
    });

    it('should parse a MathML template with holes inside children', () => {
      const { template } = math`
        <msup><mi>${0}</mi><mn>${1}</mn></msup>
      `;

      expect(template['_template'].innerHTML).toBe(
        '<msup><mi></mi><mn></mn></msup>',
      );
      expect(
        template['_template'].content.firstElementChild?.namespaceURI,
      ).toBe(MATH_NAMESPACE_URI);
      expect(template['_holes']).toStrictEqual([
        {
          type: PART_TYPE_TEXT,
          index: 2,
          leadingSpan: 0,
          trailingSpan: 0,
        },
        {
          type: PART_TYPE_TEXT,
          index: 4,
          leadingSpan: 0,
          trailingSpan: 0,
        },
      ]);
    });

    it('should parse a text template with holes inside children', () => {
      const { template } = text`
        <div><!--Hello-->, ${0}</div>
      `;

      expect(template['_template'].innerHTML).toBe(
        '&lt;div&gt;&lt;!--Hello--&gt;, &lt;/div&gt;',
      );
      expect(template['_holes']).toStrictEqual([
        {
          type: PART_TYPE_TEXT,
          index: 0,
          leadingSpan: 19,
          trailingSpan: 6,
        },
      ]);
    });

    it('throws errors when a invalid placeholder is passed', () => {
      expect(() => {
        TaggedTemplate.parse([], [], 'html', 'INVALID', document);
      }).toThrow('Placeholders must match pattern /^[0-9a-z_-]+$/');
      expect(() => {
        TaggedTemplate.parse(
          [],
          [],
          'html',
          MARKER_IDENTIFIER.toUpperCase(),
          document,
        );
      }).toThrow('Placeholders must match pattern /^[0-9a-z_-]+$/');
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

    it('should throw an error if the number of holes and expressions do not match', () => {
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
      const { template, exprs } = html`
        <div class=${'foo'}>
          <!-- ${'bar'} -->
          <label ${{ for: 'quux' }}>${'baz'}</label>
          <input type="text" $value=${'qux'} .disabled=${false} @onchange=${() => {}} ${{ id: 'quux' }}>
        </div>
        <!-- ${'corge'} -->
      `;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement(
        'div',
        {},
        createElement(
          'div',
          { class: 'foo' },
          document.createComment('bar'),
          createElement('label', { for: 'quux' }, 'baz'),
          createElement('input', { type: 'text', id: 'quux' }),
        ),
        document.createComment('corge'),
      );
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(exprs, part, hydrationTarget, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<div class="foo"><!----><label for="quux">baz</label><input type="text" id="quux"></div>',
        '<!---->',
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PART_TYPE_ATTRIBUTE,
            node: expect.exact(container.querySelector('div')),
            name: 'class',
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.exact(container.querySelector('label')),
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(container.querySelector('label')?.firstChild),
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_LIVE,
            node: expect.exact(container.querySelector('input')),
            name: 'value',
            defaultValue: '',
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_PROPERTY,
            node: expect.exact(container.querySelector('input')),
            name: 'disabled',
            defaultValue: false,
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_EVENT,
            node: expect.exact(container.querySelector('input')),
            name: 'onchange',
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.exact(container.querySelector('input')),
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
        }),
      ]);
    });

    it('hydrates a HTML template element without holes', () => {
      const { template, exprs } = html`<div>foo</div>`;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement(
        'div',
        {},
        createElement('div', {}, 'foo'),
      );
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(exprs, part, hydrationTarget, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div>foo</div>']);
      expect(slots).toStrictEqual([]);
    });

    it('hydrates templates that contain split text nodes', () => {
      const { template, exprs } =
        html`(${'A'}, ${'B'}, ${'C'})<div>[${'D'}, ${'E'}]</div>`;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement(
        'div',
        {},
        '(',
        document.createComment(''),
        'A', // A
        document.createComment(''),
        ', ',
        document.createComment(''),
        'B', // B
        document.createComment(''),
        ', ',
        document.createComment(''),
        'C', // C
        document.createComment(''),
        ')',
        createElement(
          'div',
          {},
          '[',
          document.createComment(''),
          'D', // D
          document.createComment(''),
          ', ',
          document.createComment(''),
          'E', // F
          document.createComment(''),
          ']',
        ),
      );
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(exprs, part, hydrationTarget, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        'A',
        'B',
        'C',
        '<div>[<!---->D<!---->, <!---->E<!---->]</div>',
      ]);
      expect(childNodes).toStrictEqual([
        expect.exact(slots[0]?.part.node),
        expect.exact(slots[1]?.part.node),
        expect.exact(slots[2]?.part.node),
        expect.exact(container.lastChild),
      ]);
      expect(slots).toHaveLength(5);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(container.childNodes[2]), // A
          },
          value: 'A',
        }),
      );
      expect(slots[1]).toStrictEqual(
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(container.childNodes[6]), // B
          },
          value: 'B',
        }),
      );
      expect(slots[2]).toStrictEqual(
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(container.childNodes[10]), // C
          },
          value: 'C',
        }),
      );
      expect(slots[3]).toStrictEqual(
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(container.lastChild!.childNodes[2]), // D
          },
          value: 'D',
        }),
      );
      expect(slots[4]).toStrictEqual(
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(container.lastChild!.childNodes[6]), // E
          },
          value: 'E',
        }),
      );
    });

    it('hydrates an empty template', () => {
      const { template, exprs } = html``;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement('div', {});
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(exprs, part, hydrationTarget, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });

    it('should throw the error if the template is invalid', () => {
      const template: TaggedTemplate = new TaggedTemplate(
        document.createElement('template'),
        [
          {
            type: PART_TYPE_ELEMENT,
            index: 0,
          },
        ],
        'html',
      );
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement('div', {}, 'foo');
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      expect(() => {
        updater.startUpdate((session) => {
          return template.hydrate(['foo'], part, hydrationTarget, session);
        });
      }).toThrow('There is no node that the hole indicates.');
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
    ])('should throw the error if there is a tree mismatch', ({
      template,
    }, container) => {
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const hydrationTarget = createTreeWalker(container);
      const updater = new TestUpdater();

      expect(() => {
        updater.startUpdate((session) => {
          return template.hydrate([], part, hydrationTarget, session);
        });
      }).toThrow(HydrationError);
    });
  });

  describe('render()', () => {
    it('renders a HTML template element with multiple holes', () => {
      const { template, exprs } = html`
        <div class=${'foo'}>
          <!-- ${'bar'} -->
          <label ${{ for: 'quux' }}>${'baz'}</label>
          <input type="text" $value=${'qux'} .disabled=${false} @onchange=${() => {}} ${{ id: 'quux' }}>
        </div>
        <!-- ${'corge'} -->
      `;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(exprs, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<div><!----><label></label><input type="text"></div>',
        '<!---->',
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PART_TYPE_ATTRIBUTE,
            node: expect.any(HTMLDivElement),
            name: 'class',
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.any(HTMLLabelElement),
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_LIVE,
            node: expect.any(HTMLInputElement),
            name: 'value',
            defaultValue: '',
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_PROPERTY,
            node: expect.any(HTMLInputElement),
            name: 'disabled',
            defaultValue: false,
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_EVENT,
            node: expect.any(HTMLInputElement),
            name: 'onchange',
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.any(HTMLInputElement),
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
        }),
      ]);
    });

    it('renders a HTML template element without holes', () => {
      const { template, exprs } = html`<div>foo</div>`;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(exprs, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div>foo</div>']);
      expect(slots).toStrictEqual([]);
    });

    it('renders templates that contain split text nodes', () => {
      const { template, exprs } =
        html`(${'A'}, ${'B'}, ${'C'})<div>[${'D'}, ${'E'}]</div>`;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(exprs, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '(',
        '', // A
        ', ',
        '', // B
        ', ',
        '', // C
        ')',
        '<div>[, ]</div>',
      ]);
      expect(childNodes).toStrictEqual([
        expect.any(Text),
        expect.exact(slots[0]?.part.node),
        expect.any(Text),
        expect.exact(slots[1]?.part.node),
        expect.any(Text),
        expect.exact(slots[2]?.part.node),
        expect.any(Text),
        expect.any(HTMLDivElement),
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
          },
        }),
      ]);
    });

    it('renders a template containing nodes in another namespace', () => {
      const { template, exprs } =
        html`<${'foo'}><math><${'bar'}></math><svg><${'baz'}></svg>`;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(exprs, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<!---->',
        '<math><!----></math>',
        '<svg><!----></svg>',
      ]);
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: MATH_NAMESPACE_URI,
          },
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: SVG_NAMESPACE_URI,
          },
        }),
      ]);
    });

    it('renders an empty template', () => {
      const { template, exprs } = html``;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(exprs, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });

    it('should throw the error if the template is invalid', () => {
      const template: TaggedTemplate = new TaggedTemplate(
        document.createElement('template'),
        [
          {
            type: PART_TYPE_ELEMENT,
            index: 0,
          },
        ],
        'html',
      );
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      expect(() => {
        updater.startUpdate((session) => {
          return template.render(['foo'], part, session);
        });
      }).toThrow('There is no node that the hole indicates.');
    });
  });
});

function html<TExprs extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...exprs: TExprs
): { template: TaggedTemplate<TExprs>; exprs: TExprs } {
  return {
    template: TaggedTemplate.parse(
      strings,
      exprs,
      'html',
      MARKER_IDENTIFIER,
      document,
    ),
    exprs,
  };
}

function math<const TExprs extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...exprs: TExprs
): { template: TaggedTemplate<TExprs>; exprs: TExprs } {
  return {
    template: TaggedTemplate.parse(
      strings,
      exprs,
      'math',
      MARKER_IDENTIFIER,
      document,
    ),
    exprs,
  };
}

function svg<const TExprs extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...exprs: TExprs
): { template: TaggedTemplate<TExprs>; exprs: TExprs } {
  return {
    template: TaggedTemplate.parse(
      strings,
      exprs,
      'svg',
      MARKER_IDENTIFIER,
      document,
    ),
    exprs,
  };
}

function text<const TExprs extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...exprs: TExprs
): { template: TaggedTemplate<TExprs>; exprs: TExprs } {
  return {
    template: TaggedTemplate.parse(
      strings,
      exprs,
      'textarea',
      MARKER_IDENTIFIER,
      document,
    ),
    exprs,
  };
}

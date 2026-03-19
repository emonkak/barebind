import { describe, expect, it } from 'vitest';
import {
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
  PART_TYPE_TEXT,
  SLOT_STATUS_ATTACHED,
} from '@/core.js';
import { createTreeWalker, HydrationError } from '@/hydration.js';
import {
  createChildNodePart,
  HTML_NAMESPACE_URI,
  MATH_NAMESPACE_URI,
  SVG_NAMESPACE_URI,
} from '@/part.js';
import { TaggedTemplate } from '@/template/tagged.js';
import { MockSlot } from '../../mocks.js';
import { createElement, serializeNode } from '../../test-helpers.js';
import { TestUpdater } from '../../test-updater.js';

const MARKER_IDENTIFIER = '__test__';

describe('TaggedTemplate', () => {
  describe('arity', () => {
    it('returns the number of values', () => {
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
          precedingText: '',
          followingText: '',
        },
        {
          type: PART_TYPE_TEXT,
          index: 4,
          precedingText: '',
          followingText: '',
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
        '<div>  </div><div></div><div></div><div></div><div></div>',
      );
      expect(template['_holes']).toStrictEqual([
        {
          type: PART_TYPE_TEXT,
          index: 3,
          precedingText: ' ',
          followingText: '',
        },
        {
          type: PART_TYPE_TEXT,
          index: 4,
          precedingText: ' ',
          followingText: ' ',
        },
        {
          type: PART_TYPE_TEXT,
          index: 6,
          precedingText: '[',
          followingText: '',
        },
        {
          type: PART_TYPE_TEXT,
          index: 7,
          precedingText: ' ',
          followingText: ']',
        },
        {
          type: PART_TYPE_TEXT,
          index: 9,
          precedingText: '',
          followingText: '',
        },
        {
          type: PART_TYPE_TEXT,
          index: 10,
          precedingText: ' ',
          followingText: '',
        },
        {
          type: PART_TYPE_TEXT,
          index: 12,
          precedingText: '',
          followingText: '',
        },
        {
          type: PART_TYPE_TEXT,
          index: 13,
          precedingText: '',
          followingText: '',
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

      expect(template['_template'].innerHTML).toBe('');
      expect(template['_holes']).toStrictEqual([
        {
          type: PART_TYPE_TEXT,
          index: 0,
          precedingText: ' < ',
          followingText: '',
        },
        {
          type: PART_TYPE_TEXT,
          index: 1,
          precedingText: '>< ',
          followingText: '/> ',
        },
      ]);
    });

    it('should parse a HTML template with holes on the root', () => {
      const { template } = html` ${0} ${1} `;

      expect(template['_template'].innerHTML).toBe('');
      expect(template['_holes']).toStrictEqual([
        {
          type: PART_TYPE_TEXT,
          index: 0,
          precedingText: ' ',
          followingText: '',
        },
        {
          type: PART_TYPE_TEXT,
          index: 1,
          precedingText: ' ',
          followingText: ' ',
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
          precedingText: '',
          followingText: '',
        },
        {
          type: PART_TYPE_TEXT,
          index: 4,
          precedingText: '',
          followingText: '',
        },
      ]);
    });

    it('should parse a text template with holes inside children', () => {
      const { template } = text`
        <div><!--Hello-->, ${0}</div>
      `;

      expect(template['_template'].innerHTML).toBe('');
      expect(template['_holes']).toStrictEqual([
        {
          type: PART_TYPE_TEXT,
          index: 0,
          precedingText: '<div><!--Hello-->, ',
          followingText: '</div>',
        },
      ]);
    });

    it('should throw an error if the passed marker identifier has an invalid format', () => {
      expect(() => {
        TaggedTemplate.parse([], [], 'INVALID_MARKER', 'html', document);
      }).toThrow('A marker identifier must match pattern /^[0-9a-z_-]+$/');
      expect(() => {
        TaggedTemplate.parse(
          [],
          [],
          MARKER_IDENTIFIER.toUpperCase(),
          'html',
          document,
        );
      }).toThrow('A marker identifier must match pattern /^[0-9a-z_-]+$/');
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
      const { template, values } = html`
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
      const target = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(values, part, target, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<div class="foo"><!----><label for="quux">baz</label><input type="text" id="quux"></div>',
        '<!---->',
      ]);
      expect(slots).toStrictEqual(values.map(() => expect.any(MockSlot)));
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PART_TYPE_ATTRIBUTE,
            node: expect.exact(container.querySelector('div')),
            name: 'class',
          },
          value: values[0],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
          value: values[1],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.exact(container.querySelector('label')),
          },
          value: values[2],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(container.querySelector('label')?.firstChild),
            followingText: '',
            precedingText: '',
          },
          value: values[3],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_LIVE,
            node: expect.exact(container.querySelector('input')),
            name: 'value',
            defaultValue: '',
          },
          value: values[4],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_PROPERTY,
            node: expect.exact(container.querySelector('input')),
            name: 'disabled',
            defaultValue: false,
          },
          value: values[5],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_EVENT,
            node: expect.exact(container.querySelector('input')),
            name: 'onchange',
          },
          value: values[6],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.exact(container.querySelector('input')),
          },
          value: values[7],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
          value: values[8],
          status: SLOT_STATUS_ATTACHED,
        }),
      ]);
    });

    it('hydrates a HTML template element without holes', () => {
      const { template, values } = html`<div>foo</div>`;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement(
        'div',
        {},
        createElement('div', {}, 'foo'),
      );
      const target = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(values, part, target, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div>foo</div>']);
      expect(slots).toStrictEqual([]);
    });

    it('hydrates a split text template', () => {
      const { template, values } =
        html`(${'foo'}, ${'bar'}, ${'baz'})<div>[${'qux'}, ${'quux'}]</div>`;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement(
        'div',
        {},
        '(foo, bar, baz)',
        createElement('div', {}, '[qux, quux]'),
      );
      const target = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(values, part, target, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '(foo, bar, baz)',
        '',
        '',
        '<div>[qux, quux]</div>',
      ]);
      expect(childNodes).toStrictEqual([
        expect.exact(slots[0]?.part.node),
        expect.exact(slots[1]?.part.node),
        expect.exact(slots[2]?.part.node),
        expect.exact(container.lastChild),
      ]);
      expect(slots).toStrictEqual(values.map(() => expect.any(MockSlot)));
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(container.firstChild),
            precedingText: '(',
            followingText: '',
          },
          value: values[0],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
            precedingText: ', ',
            followingText: '',
          },
          value: values[1],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
            precedingText: ', ',
            followingText: ')',
          },
          value: values[2],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(container.lastChild?.firstChild),
            precedingText: '[',
            followingText: '',
          },
          value: values[3],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
            precedingText: ', ',
            followingText: ']',
          },
          value: values[4],
          status: SLOT_STATUS_ATTACHED,
        }),
      ]);
    });

    it('hydrates an empty template', () => {
      const { template, values } = html``;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const container = createElement('div', {});
      const target = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(values, part, target, session);
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
      const target = createTreeWalker(container);
      const updater = new TestUpdater();

      expect(() => {
        updater.startUpdate((session) => {
          return template.hydrate(['foo'], part, target, session);
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
      const target = createTreeWalker(container);
      const updater = new TestUpdater();

      expect(() => {
        updater.startUpdate((session) => {
          return template.hydrate([], part, target, session);
        });
      }).toThrow(HydrationError);
    });
  });

  describe('render()', () => {
    it('renders a HTML template element with multiple holes', () => {
      const { template, values } = html`
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
        return template.render(values, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<div><!----><label></label><input type="text"></div>',
        '<!---->',
      ]);
      expect(slots).toStrictEqual(values.map(() => expect.any(MockSlot)));
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PART_TYPE_ATTRIBUTE,
            node: expect.any(HTMLDivElement),
            name: 'class',
          },
          value: values[0],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
          value: values[1],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.any(HTMLLabelElement),
          },
          value: values[2],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
            followingText: '',
            precedingText: '',
          },
          value: values[3],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_LIVE,
            node: expect.any(HTMLInputElement),
            name: 'value',
            defaultValue: '',
          },
          value: values[4],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_PROPERTY,
            node: expect.any(HTMLInputElement),
            name: 'disabled',
            defaultValue: false,
          },
          value: values[5],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_EVENT,
            node: expect.any(HTMLInputElement),
            name: 'onchange',
          },
          value: values[6],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.any(HTMLInputElement),
          },
          value: values[7],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
          value: values[8],
          status: SLOT_STATUS_ATTACHED,
        }),
      ]);
    });

    it('renders a HTML template element without holes', () => {
      const { template, values } = html`<div>foo</div>`;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(values, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div>foo</div>']);
      expect(slots).toStrictEqual([]);
    });

    it('renders a split text template', () => {
      const { template, values } =
        html`(${'foo'}, ${'bar'}, ${'baz'})<div>[${'qux'}, ${'quux'}]</div>`;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(values, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '',
        '',
        '',
        '<div></div>',
      ]);
      expect(childNodes).toStrictEqual([
        expect.exact(slots[0]?.part.node),
        expect.exact(slots[1]?.part.node),
        expect.exact(slots[2]?.part.node),
        expect.any(HTMLDivElement),
      ]);
      expect(slots).toStrictEqual(values.map(() => expect.any(MockSlot)));
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
            precedingText: '(',
            followingText: '',
          },
          value: values[0],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
            precedingText: ', ',
            followingText: '',
          },
          value: values[1],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
            precedingText: ', ',
            followingText: ')',
          },
          value: values[2],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
            precedingText: '[',
            followingText: '',
          },
          value: values[3],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_TEXT,
            node: expect.any(Text),
            precedingText: ', ',
            followingText: ']',
          },
          value: values[4],
          status: SLOT_STATUS_ATTACHED,
        }),
      ]);
    });

    it('renders a template containing nodes in another namespace', () => {
      const { template, values } =
        html`<${'foo'}><math><${'bar'}></math><svg><${'baz'}></svg>`;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(values, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<!---->',
        '<math><!----></math>',
        '<svg><!----></svg>',
      ]);
      expect(slots).toStrictEqual(values.map(() => expect.any(MockSlot)));
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: HTML_NAMESPACE_URI,
          },
          value: values[0],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: MATH_NAMESPACE_URI,
          },
          value: values[1],
          status: SLOT_STATUS_ATTACHED,
        }),
        expect.objectContaining({
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.any(Comment),
            sentinelNode: expect.any(Comment),
            namespaceURI: SVG_NAMESPACE_URI,
          },
          value: values[2],
          status: SLOT_STATUS_ATTACHED,
        }),
      ]);
    });

    it('renders an empty template', () => {
      const { template, values } = html``;
      const part = createChildNodePart(
        document.createComment(''),
        HTML_NAMESPACE_URI,
      );
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(values, part, session);
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

function html<TValues extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...values: TValues
): { template: TaggedTemplate<TValues>; values: TValues } {
  return {
    template: TaggedTemplate.parse(
      strings,
      values,
      MARKER_IDENTIFIER,
      'html',
      document,
    ),
    values,
  };
}

function math<const TValues extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...values: TValues
): { template: TaggedTemplate<TValues>; values: TValues } {
  return {
    template: TaggedTemplate.parse(
      strings,
      values,
      MARKER_IDENTIFIER,
      'math',
      document,
    ),
    values,
  };
}

function svg<const TValues extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...values: TValues
): { template: TaggedTemplate<TValues>; values: TValues } {
  return {
    template: TaggedTemplate.parse(
      strings,
      values,
      MARKER_IDENTIFIER,
      'svg',
      document,
    ),
    values,
  };
}

function text<const TValues extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...values: TValues
): { template: TaggedTemplate<TValues>; values: TValues } {
  return {
    template: TaggedTemplate.parse(
      strings,
      values,
      MARKER_IDENTIFIER,
      'textarea',
      document,
    ),
    values,
  };
}

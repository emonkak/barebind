import { describe, expect, it } from 'vitest';
import { createTreeWalker, HydrationError } from '@/hydration.js';
import { PartType } from '@/internal.js';
import { TaggedTemplate } from '@/template/tagged.js';
import {
  HTML_NAMESPACE_URI,
  MATH_NAMESPACE_URI,
  SVG_NAMESPACE_URI,
} from '@/template/template.js';
import { MockSlot } from '../../mocks.js';
import {
  createElement,
  serializeNode,
  TestUpdater,
} from '../../test-helpers.js';

const TEMPLATE_PLACEHOLDER = '__test__';

describe('TaggedTemplate', () => {
  describe('arity', () => {
    it('returns the number of binds', () => {
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
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Live, name: 'open', index: 0 },
        { type: PartType.Property, name: 'innerHTML', index: 0 },
        { type: PartType.Event, name: 'click', index: 0 },
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
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Live, name: 'open', index: 0 },
        { type: PartType.Property, name: 'innerHTML', index: 0 },
        { type: PartType.Event, name: 'click', index: 0 },
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
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Live, name: 'open', index: 0 },
        { type: PartType.Property, name: 'innerHTML', index: 0 },
        { type: PartType.Event, name: 'click', index: 0 },
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
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Live, name: 'open', index: 0 },
        { type: PartType.Property, name: 'innerHTML', index: 0 },
        { type: PartType.Event, name: 'click', index: 0 },
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
        { type: PartType.ChildNode, index: 0 },
        { type: PartType.ChildNode, index: 1 },
        { type: PartType.ChildNode, index: 2 },
        { type: PartType.ChildNode, index: 3 },
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
        { type: PartType.Element, index: 0 },
        { type: PartType.Element, index: 1 },
        { type: PartType.Element, index: 2 },
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
          type: PartType.Text,
          index: 2,
          precedingText: '',
          followingText: '',
        },
        {
          type: PartType.Text,
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
          type: PartType.Text,
          index: 3,
          precedingText: ' ',
          followingText: '',
        },
        {
          type: PartType.Text,
          index: 4,
          precedingText: ' ',
          followingText: ' ',
        },
        {
          type: PartType.Text,
          index: 6,
          precedingText: '[',
          followingText: '',
        },
        {
          type: PartType.Text,
          index: 7,
          precedingText: ' ',
          followingText: ']',
        },
        {
          type: PartType.Text,
          index: 9,
          precedingText: '',
          followingText: '',
        },
        {
          type: PartType.Text,
          index: 10,
          precedingText: ' ',
          followingText: '',
        },
        {
          type: PartType.Text,
          index: 12,
          precedingText: '',
          followingText: '',
        },
        {
          type: PartType.Text,
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
        { type: PartType.ChildNode, index: 1 },
        { type: PartType.ChildNode, index: 2 },
        { type: PartType.ChildNode, index: 3 },
        { type: PartType.ChildNode, index: 4 },
      ]);
    });

    it('should parse a HTML template with holes inside tags with leading spaces', () => {
      const { template } = html` < ${0}>< ${1}/> `;

      expect(template['_template'].innerHTML).toBe('');
      expect(template['_holes']).toStrictEqual([
        {
          type: PartType.Text,
          index: 0,
          precedingText: ' < ',
          followingText: '',
        },
        {
          type: PartType.Text,
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
          type: PartType.Text,
          index: 0,
          precedingText: ' ',
          followingText: '',
        },
        {
          type: PartType.Text,
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
        { type: PartType.Attribute, name: 'cx', index: 0 },
        { type: PartType.Attribute, name: 'cy', index: 0 },
        { type: PartType.Attribute, name: 'r', index: 0 },
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
          type: PartType.Text,
          index: 2,
          precedingText: '',
          followingText: '',
        },
        {
          type: PartType.Text,
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
          type: PartType.Text,
          index: 0,
          precedingText: '<div><!--Hello-->, ',
          followingText: '</div>',
        },
      ]);
    });

    it('should throw an error if passed a placeholder in an invalid format', () => {
      expect(() => {
        TaggedTemplate.parse([], [], 'INVALID_MARKER', 'html', document);
      }).toThrow('The placeholder is in an invalid format.');
      expect(() => {
        TaggedTemplate.parse(
          [],
          [],
          TEMPLATE_PLACEHOLDER.toUpperCase(),
          'html',
          document,
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
          <label ${{ for: 'quux' }}>${'baz'}</label>
          <input type="text" $value=${'qux'} .disabled=${false} @onchange=${() => {}} ${{ id: 'quux' }}>
        </div>
        <!-- ${'corge'} -->
      `;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
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
      const targetTree = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(binds, part, targetTree, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<div class="foo"><!----><label for="quux">baz</label><input type="text" id="quux"></div>',
        '<!---->',
      ]);
      expect(slots).toStrictEqual(binds.map(() => expect.any(MockSlot)));
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PartType.Attribute,
            node: expect.exact(container.querySelector('div')),
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
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          },
          value: binds[1],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Element,
            node: expect.exact(container.querySelector('label')),
          },
          value: binds[2],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.exact(container.querySelector('label')?.firstChild),
            followingText: '',
            precedingText: '',
          },
          value: binds[3],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Live,
            node: expect.exact(container.querySelector('input')),
            name: 'value',
            defaultValue: '',
          },
          value: binds[4],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Property,
            node: expect.exact(container.querySelector('input')),
            name: 'disabled',
            defaultValue: false,
          },
          value: binds[5],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Event,
            node: expect.exact(container.querySelector('input')),
            name: 'onchange',
          },
          value: binds[6],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Element,
            node: expect.exact(container.querySelector('input')),
          },
          value: binds[7],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.ChildNode,
            node: expect.any(Comment),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          },
          value: binds[8],
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
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement(
        'div',
        {},
        createElement('div', {}, 'foo'),
      );
      const targetTree = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(binds, part, targetTree, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div>foo</div>']);
      expect(slots).toStrictEqual([]);
    });

    it('hydrates a split text template', () => {
      const { template, binds } =
        html`(${'foo'}, ${'bar'}, ${'baz'})<div>[${'qux'}, ${'quux'}]</div>`;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement(
        'div',
        {},
        '(foo, bar, baz)',
        createElement('div', {}, '[qux, quux]'),
      );
      const targetTree = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(binds, part, targetTree, session);
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
      expect(slots).toStrictEqual(binds.map(() => expect.any(MockSlot)));
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.exact(container.firstChild),
            precedingText: '(',
            followingText: '',
          },
          value: binds[0],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.any(Text),
            precedingText: ', ',
            followingText: '',
          },
          value: binds[1],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.any(Text),
            precedingText: ', ',
            followingText: ')',
          },
          value: binds[2],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.exact(container.lastChild?.firstChild),
            precedingText: '[',
            followingText: '',
          },
          value: binds[3],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.any(Text),
            precedingText: ', ',
            followingText: ']',
          },
          value: binds[4],
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });

    it('hydrates an empty template', () => {
      const { template, binds } = html``;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement('div', {});
      const targetTree = createTreeWalker(container);
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.hydrate(binds, part, targetTree, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });

    it('should throw the error if the template is invalid', () => {
      const template: TaggedTemplate = new TaggedTemplate(
        document.createElement('template'),
        [
          {
            type: PartType.Element,
            index: 0,
          },
        ],
        'html',
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const container = createElement('div', {}, 'foo');
      const targetTree = createTreeWalker(container);
      const updater = new TestUpdater();

      expect(() => {
        updater.startUpdate((session) => {
          return template.hydrate(['foo'], part, targetTree, session);
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
    ])(
      'should throw the error if there is a tree mismatch',
      ({ template }, container) => {
        const part = {
          type: PartType.ChildNode,
          node: document.createComment(''),
          anchorNode: null,
          namespaceURI: HTML_NAMESPACE_URI,
        };
        const targetTree = createTreeWalker(container);
        const updater = new TestUpdater();

        expect(() => {
          updater.startUpdate((session) => {
            return template.hydrate([], part, targetTree, session);
          });
        }).toThrow(HydrationError);
      },
    );
  });

  describe('render()', () => {
    it('renders a HTML template element with multiple holes', () => {
      const { template, binds } = html`
        <div class=${'foo'}>
          <!-- ${'bar'} -->
          <label ${{ for: 'quux' }}>${'baz'}</label>
          <input type="text" $value=${'qux'} .disabled=${false} @onchange=${() => {}} ${{ id: 'quux' }}>
        </div>
        <!-- ${'corge'} -->
      `;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(binds, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<div><!----><label></label><input type="text"></div>',
        '<!---->',
      ]);
      expect(slots).toStrictEqual(binds.map(() => expect.any(MockSlot)));
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
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          },
          value: binds[1],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Element,
            node: expect.any(HTMLLabelElement),
          },
          value: binds[2],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.any(Text),
            followingText: '',
            precedingText: '',
          },
          value: binds[3],
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
          value: binds[4],
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
          value: binds[5],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Event,
            node: expect.any(HTMLInputElement),
            name: 'onchange',
          },
          value: binds[6],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Element,
            node: expect.any(HTMLInputElement),
          },
          value: binds[7],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.ChildNode,
            node: expect.any(Comment),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          },
          value: binds[8],
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
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(binds, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div>foo</div>']);
      expect(slots).toStrictEqual([]);
    });

    it('renders a split text template', () => {
      const { template, binds } =
        html`(${'foo'}, ${'bar'}, ${'baz'})<div>[${'qux'}, ${'quux'}]</div>`;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(binds, part, session);
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
      expect(slots).toStrictEqual(binds.map(() => expect.any(MockSlot)));
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.any(Text),
            precedingText: '(',
            followingText: '',
          },
          value: binds[0],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.any(Text),
            precedingText: ', ',
            followingText: '',
          },
          value: binds[1],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.any(Text),
            precedingText: ', ',
            followingText: ')',
          },
          value: binds[2],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.any(Text),
            precedingText: '[',
            followingText: '',
          },
          value: binds[3],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.Text,
            node: expect.any(Text),
            precedingText: ', ',
            followingText: ']',
          },
          value: binds[4],
          isConnected: true,
          isCommitted: false,
        }),
      ]);
    });

    it('renders a template containing nodes in another namespace', () => {
      const { template, binds } =
        html`<${'foo'}><math><${'bar'}></math><svg><${'baz'}></svg>`;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(binds, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<!---->',
        '<math><!----></math>',
        '<svg><!----></svg>',
      ]);
      expect(slots).toStrictEqual(binds.map(() => expect.any(MockSlot)));
      expect(slots).toStrictEqual([
        expect.objectContaining({
          part: {
            type: PartType.ChildNode,
            node: expect.any(Comment),
            anchorNode: null,
            namespaceURI: HTML_NAMESPACE_URI,
          },
          value: binds[0],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.ChildNode,
            node: expect.any(Comment),
            anchorNode: null,
            namespaceURI: MATH_NAMESPACE_URI,
          },
          value: binds[1],
          isConnected: true,
          isCommitted: false,
        }),
        expect.objectContaining({
          part: {
            type: PartType.ChildNode,
            node: expect.any(Comment),
            anchorNode: null,
            namespaceURI: SVG_NAMESPACE_URI,
          },
          value: binds[2],
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
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const updater = new TestUpdater();

      const { childNodes, slots } = updater.startUpdate((session) => {
        return template.render(binds, part, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });

    it('should throw the error if the template is invalid', () => {
      const template: TaggedTemplate = new TaggedTemplate(
        document.createElement('template'),
        [
          {
            type: PartType.Element,
            index: 0,
          },
        ],
        'html',
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const updater = new TestUpdater();

      expect(() => {
        updater.startUpdate((session) => {
          return template.render(['foo'], part, session);
        });
      }).toThrow('There is no node that the hole indicates.');
    });
  });
});

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
      document,
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
      document,
    ),
    binds,
  };
}

function svg<const TBinds extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...binds: TBinds
): { template: TaggedTemplate<TBinds>; binds: TBinds } {
  return {
    template: TaggedTemplate.parse(
      strings,
      binds,
      TEMPLATE_PLACEHOLDER,
      'svg',
      document,
    ),
    binds,
  };
}

function text<const TBinds extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...binds: TBinds
): { template: TaggedTemplate<TBinds>; binds: TBinds } {
  return {
    template: TaggedTemplate.parse(
      strings,
      binds,
      TEMPLATE_PLACEHOLDER,
      'textarea',
      document,
    ),
    binds,
  };
}

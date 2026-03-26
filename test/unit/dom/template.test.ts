import { afterEach, describe, expect, it } from 'vitest';
import { Scope } from '@/core.js';
import { ClientAdapter, HydrationAdapter } from '@/dom/adapter.js';
import {
  createChildNodePart,
  createElementPart,
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
  PART_TYPE_TEXT,
} from '@/dom/part.js';
import { DOMAttribute } from '@/dom/primitive/attribute.js';
import { DOMClass } from '@/dom/primitive/class.js';
import { DOMEvent } from '@/dom/primitive/event.js';
import { DOMLive } from '@/dom/primitive/live.js';
import { DOMNode } from '@/dom/primitive/node.js';
import { DOMProperty } from '@/dom/primitive/property.js';
import { DOMSpread } from '@/dom/primitive/spread.js';
import { DOMTemplate, DOMTemplateBinding } from '@/dom/template.js';
import { Runtime } from '@/runtime.js';
import { html } from '@/template.js';
import { createTestRuntime } from '../../adapter.js';
import {
  createElement,
  createElementNS,
  serializeNode,
} from '../../helpers.js';
import { SessionLauncher } from '../../session-launcher.js';

const TEMPLATE_PLACEHOLDER = '__test__';

const NAMESPACE_URI_MATHML = 'http://www.w3.org/1998/Math/MathML';
const NAMESPACE_URI_SVG = 'http://www.w3.org/2000/svg';
const NAMESPACE_URI_XHTML = 'http://www.w3.org/1999/xhtml';

describe('DOMTemplate', () => {
  const runtime = createTestRuntime();

  describe('static parse()', () => {
    it('parses HTML templates with holes in attributes', () => {
      const [template] = parseHTML`
        <div class="a" id=${0} $hidden=${1} .innerHTML=${2} @click=${3}></div>
      `;

      expect(template.element.innerHTML).toBe('<div class="a"></div>');
      expect(template.holes).toStrictEqual([
        { type: PART_TYPE_ATTRIBUTE, name: 'id', index: 0 },
        { type: PART_TYPE_LIVE, name: 'hidden', index: 0 },
        { type: PART_TYPE_PROPERTY, name: 'innerHTML', index: 0 },
        { type: PART_TYPE_EVENT, name: 'click', index: 0 },
      ]);
    });

    it('parses HTML templates with holes in double-quoted attributes', () => {
      const [template] = parseHTML`
        <div class="a" id="${0}" $hidden="${1}" .innerHTML="${2}" @click="${3}"></div>
      `;

      expect(template.element.innerHTML).toBe('<div class="a"></div>');
      expect(template.holes).toStrictEqual([
        { type: PART_TYPE_ATTRIBUTE, name: 'id', index: 0 },
        { type: PART_TYPE_LIVE, name: 'hidden', index: 0 },
        { type: PART_TYPE_PROPERTY, name: 'innerHTML', index: 0 },
        { type: PART_TYPE_EVENT, name: 'click', index: 0 },
      ]);
    });

    it('parses HTML templates with holes in single-quoted attributes', () => {
      const [template] = parseHTML`
        <div class="a" id='${0}' $hidden='${2}' .innerHTML='${1}' @click='${3}'></div>
      `;

      expect(template.element.innerHTML).toBe('<div class="a"></div>');
      expect(template.holes).toStrictEqual([
        { type: PART_TYPE_ATTRIBUTE, name: 'id', index: 0 },
        { type: PART_TYPE_LIVE, name: 'hidden', index: 0 },
        { type: PART_TYPE_PROPERTY, name: 'innerHTML', index: 0 },
        { type: PART_TYPE_EVENT, name: 'click', index: 0 },
      ]);
    });

    it('parses HTML template with holes in attributes with whitespaces', () => {
      const [template] = parseHTML`
        <div class="a" id="${0}" $hidden= "${1}" .innerHTML ="${2}" @click = "${3}"></div>
      `;

      expect(template.element.innerHTML).toBe('<div class="a"></div>');
      expect(template.holes).toStrictEqual([
        { type: PART_TYPE_ATTRIBUTE, name: 'id', index: 0 },
        { type: PART_TYPE_LIVE, name: 'hidden', index: 0 },
        { type: PART_TYPE_PROPERTY, name: 'innerHTML', index: 0 },
        { type: PART_TYPE_EVENT, name: 'click', index: 0 },
      ]);
    });

    it('parses HTML template with holes in tag names', () => {
      const [template] = parseHTML`
        <${0}>
        <${1} >
        <${2}/>
        <${3} />
      `;

      expect(template.element.innerHTML).toBe('<!----><!----><!----><!---->');
      expect(template.holes).toStrictEqual([
        { type: PART_TYPE_CHILD_NODE, index: 0 },
        { type: PART_TYPE_CHILD_NODE, index: 1 },
        { type: PART_TYPE_CHILD_NODE, index: 2 },
        { type: PART_TYPE_CHILD_NODE, index: 3 },
      ]);
    });

    it('parses HTML templates with holes inside tag', () => {
      const [template] = parseHTML`
        <div id="a" ${0}></div>
        <div ${1} id="b"></div>
        <div id="c" ${2} class="d"></div>
      `;

      expect(template.element.innerHTML).toBe(
        '<div id="a"></div><div id="b"></div><div id="c" class="d"></div>',
      );
      expect(template.holes).toStrictEqual([
        { type: PART_TYPE_ELEMENT, index: 0 },
        { type: PART_TYPE_ELEMENT, index: 1 },
        { type: PART_TYPE_ELEMENT, index: 2 },
      ]);
    });

    it('parses HTML templates with holes in child nodes', () => {
      const [template] = parseHTML`
        <ul>
          <li>${1}</li>
          <li>${2}</li>
        </ul>
      `;

      expect(template.element.innerHTML).toBe('<ul><li></li><li></li></ul>');
      expect(template.holes).toStrictEqual([
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

    it('parses HTML templates with multiple holes in child nodes', () => {
      const [template] = parseHTML`
        <div>  </div>
        <div> ${0} ${1} </div>
        <div>[${2} ${3}]</div>
        <div>${4} ${5}</div>
        <div>
          ${6}
          ${7}
        </div>
      `;

      expect(template.element.innerHTML).toBe(
        '<div>  </div><div>   </div><div>[ ]</div><div> </div><div></div>',
      );
      expect(template.holes).toStrictEqual([
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

    it('parses HTML templates with holes inside comments', () => {
      const [template] = parseHTML`
        <!---->
        <!--${0}-->
        <!--${1}/-->
        <!-- ${2} -->
        <!-- ${3} /-->
      `;

      expect(template.element.innerHTML).toBe(
        '<!----><!----><!----><!----><!---->',
      );
      expect(template.holes).toStrictEqual([
        { type: PART_TYPE_CHILD_NODE, index: 1 },
        { type: PART_TYPE_CHILD_NODE, index: 2 },
        { type: PART_TYPE_CHILD_NODE, index: 3 },
        { type: PART_TYPE_CHILD_NODE, index: 4 },
      ]);
    });

    it('parses HTML template with holes in tag names with leading spaces', () => {
      const [template] = parseHTML` < ${0}>< ${1}/> `;

      expect(template.element.innerHTML).toBe(' &lt; &gt;&lt; /&gt; ');
      expect(template.holes).toStrictEqual([
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

    it('parses HTML templates with holes at the root', () => {
      const [template] = parseHTML` ${0} ${1} `;

      expect(template.element.innerHTML).toBe('   ');
      expect(template.holes).toStrictEqual([
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

    it('parses HTML templates without holes', () => {
      const [template] = parseHTML` a `;

      expect(template.element.innerHTML).toBe(' a ');
      expect(template.holes).toStrictEqual([]);
    });

    it('parses SVG templates with holes in attributes', () => {
      const [template] = parseSVG`
        <circle fill="black" cx=${0} cy=${1} r=${2} />
      `;

      expect(template.element.innerHTML).toBe('<circle fill="black"></circle>');
      expect(template.element.content.firstElementChild?.namespaceURI).toBe(
        NAMESPACE_URI_SVG,
      );
      expect(template.holes).toStrictEqual([
        { type: PART_TYPE_ATTRIBUTE, name: 'cx', index: 0 },
        { type: PART_TYPE_ATTRIBUTE, name: 'cy', index: 0 },
        { type: PART_TYPE_ATTRIBUTE, name: 'r', index: 0 },
      ]);
    });

    it('parses MathML templates with holes in child nodes', () => {
      const [template] = parseMathML`
        <msup><mi>${0}</mi><mn>${1}</mn></msup>
      `;

      expect(template.element.innerHTML).toBe(
        '<msup><mi></mi><mn></mn></msup>',
      );
      expect(template.element.content.firstElementChild?.namespaceURI).toBe(
        NAMESPACE_URI_MATHML,
      );
      expect(template.holes).toStrictEqual([
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

    it('parses text templates with holes in child ndoes', () => {
      const [template] = parseText`
        <div><!--a-->, ${0}</div>
      `;

      expect(template.element.innerHTML).toBe(
        '&lt;div&gt;&lt;!--a--&gt;, &lt;/div&gt;',
      );
      expect(template.holes).toStrictEqual([
        {
          type: PART_TYPE_TEXT,
          index: 0,
          leadingSpan: 15,
          trailingSpan: 6,
        },
      ]);
    });

    it('throws an error when the placeholder is invalid', () => {
      expect(() => {
        DOMTemplate.parse([], [], 'html', 'INVALID', document);
      }).toThrow('Placeholders must match pattern /^[0-9a-z_-]+$/');
      expect(() => {
        DOMTemplate.parse(
          [],
          [],
          'html',
          TEMPLATE_PLACEHOLDER.toUpperCase(),
          document,
        );
      }).toThrow('Placeholders must match pattern /^[0-9a-z_-]+$/');
    });

    it('throws an error when there is a hole in the attribute name', () => {
      expect(() => {
        parseHTML`
          <div ${'a'}="b"></div>
        `;
      }).toThrow('Expressions are not allowed as an attribute name:');
      expect(() => {
        parseHTML`
          <div x-${'a'}="b"></div>
        `;
      }).toThrow('Expressions are not allowed as an attribute name:');
      expect(() => {
        parseHTML`
          <div ${'a'}-x="b"></div>
        `;
      }).toThrow('Expressions are not allowed as an attribute name:');
    });

    it('throws an error when there are extra characters around the attribute', () => {
      expect(() => {
        parseHTML`
          <div class=" ${0}"></div>
        `;
      }).toThrow(
        'Expressions inside an attribute must make up the entire attribute value:',
      );
      expect(() => {
        parseHTML`
          <div class="${0} "></div>
        `;
      }).toThrow(
        'Expressions inside an attribute must make up the entire attribute value:',
      );
    });

    it('throws an error when there are extra characters around the tag name', () => {
      expect(() => {
        parseHTML`
          <x-${0}>
        `;
      }).toThrow('Expressions are not allowed as a tag name:');
      expect(() => {
        parseHTML`
          <${0}-x>
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
      expect(() => {
        parseHTML`
          <${0}/ >
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
    });

    it('should throw an error when there are extra characters around the comment', () => {
      expect(() => {
        parseHTML`
          <!-- x-${0} -->
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
      expect(() => {
        parseHTML`
          <!-- ${0}-x -->
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
      expect(() => {
        parseHTML`
          <!-- ${0}/ -->
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
    });

    it('throws an error when there are duplicated attributes', () => {
      expect(() => {
        parseHTML`
          <div class="a" class=${'b'} id=${'c'}></div>
        `;
      }).toThrow(`The attribute name must be "id", but got "class".`);
    });

    it('throws an error when holes and expressions length mismatch', () => {
      expect(() => {
        parseHTML`
          <div class="a" class=${'b'}></div>
        `;
      }).toThrow('The number of holes must be 1, but got 0.');
      expect(() => {
        parseHTML`
          <div class=${'a'} class=${'b'}></div>
        `;
      }).toThrow('The number of holes must be 2, but got 1.');
    });
  });

  describe('name', () => {
    it('returns own class name', () => {
      expect(parseHTML``[0].name).toBe(DOMTemplate.name);
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new binding with DOMTemplate type', () => {
      const [template, exprs] = parseHTML`<div>${'a'}</div>`;
      const part = createChildNodePart(document.createComment(''), null);
      const binding = template.resolveBinding(exprs, part, runtime);

      expect(binding.type).toBe(template);
      expect(binding.value).toBe(exprs);
      expect(binding.part).toBe(part);
    });

    it('throws an error when the part is not ChildNodePart', () => {
      const [template, exprs] = parseHTML`<div>${'a'}</div>`;
      const part = createElementPart(document.createElement('div')) as any;

      expect(() => template.resolveBinding(exprs, part, runtime)).toThrow(
        'DOMTemplate must be used in ChildNodePart.',
      );
    });
  });
});

describe('DOMTemplateBinding', () => {
  const container = document.createElement('div');
  const adapter = new ClientAdapter(container);
  const runtime = new Runtime(adapter);
  const launcher = new SessionLauncher(runtime);

  describe('shouldUpdate()', () => {
    it('returns true when there is no current expressions', () => {
      const [template, exprs] = parseHTML`<div>${'a'}</div>`;
      const part = createChildNodePart(document.createComment(''), null);
      const binding = new DOMTemplateBinding(template, exprs, part);

      expect(binding.shouldUpdate(exprs)).toBe(true);
      expect(binding.shouldUpdate(['a'])).toBe(true);
      expect(binding.shouldUpdate(['b'])).toBe(true);
    });

    it('returns true when the expressions differs from the current one', () => {
      const [template, exprs] = parseHTML`<div>${'a'}</div>`;
      const part = createChildNodePart(document.createComment(''), null);
      const binding = new DOMTemplateBinding(template, exprs, part);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(binding.shouldUpdate(exprs)).toBe(false);
      expect(binding.shouldUpdate(['a'])).toBe(true);
      expect(binding.shouldUpdate(['b'])).toBe(true);
    });
  });

  describe('commit()', () => {
    it('inserts the single child node into the part', () => {
      const [template, exprs] =
        parseHTML`<div id="a" class=${'b'}><${'c'}>${'d'}</div>`;
      const part = createChildNodePart(document.createComment(''), null);
      const binding = new DOMTemplateBinding(template, exprs, part);
      const container = createElement('div', {}, part.node);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node).toBeInstanceOf(HTMLDivElement);
      expect(container.innerHTML).toBe(
        '<div id="a" class="b"><!--c-->d</div><!---->',
      );
    });

    it('inserts multiple single child nodes into the part', () => {
      const [template, exprs] = parseHTML`
        <div id="${'a'}"></div>
        <${'b'}>
        ${'c'}
      `;
      const part = createChildNodePart(document.createComment(''), null);
      const binding = new DOMTemplateBinding(template, exprs, part);
      const container = createElement('div', {}, part.node);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      expect(part.node).toBeInstanceOf(HTMLDivElement);
      expect(container.innerHTML).toBe('<div id="a"></div><!--b-->c<!---->');
    });

    it('updates rendered slots with new expressions', () => {
      const [template, exprs] =
        parseHTML`<div id="a" class=${'b'}><${'c'}>${'d'}</div>`;
      const part = createChildNodePart(document.createComment(''), null);
      const binding = new DOMTemplateBinding(template, exprs, part);
      const container = createElement('div', {}, part.node);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.value = ['B', 'C', 'D'];
        binding.attach(session);
        binding.commit();
      });

      expect(part.node).toBeInstanceOf(HTMLDivElement);
      expect(container.innerHTML).toBe(
        '<div id="a" class="B"><!--C-->D</div><!---->',
      );
    });
  });

  describe('rollback()', () => {
    it('removes the single child node from the part', () => {
      const [template, exprs] =
        parseHTML`<div id="a" class=${'b'}><${'c'}>${'d'}</div>`;
      const part = createChildNodePart(document.createComment(''), null);
      const binding = new DOMTemplateBinding(template, exprs, part);
      const container = createElement('div', {}, part.node);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(part.node).toBe(part.sentinelNode);
      expect(container.innerHTML).toBe('<!---->');
    });

    it('removes multiple single child nodes into the part', () => {
      const [template, exprs] = parseHTML`
        <div id="${'a'}"></div>
        <${'b'}>
        ${'c'}
      `;
      const part = createChildNodePart(document.createComment(''), null);
      const binding = new DOMTemplateBinding(template, exprs, part);
      const container = createElement('div', {}, part.node);

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });

      expect(part.node).toBe(part.sentinelNode);
      expect(container.innerHTML).toBe('<!---->');
    });
  });
});

describe('ClientRenderer', () => {
  const container = document.createElement('div');
  const adapter = new ClientAdapter(container);
  const runtime = new Runtime(adapter);
  const launcher = new SessionLauncher(runtime);

  describe('container', () => {
    it('returns the container element', () => {
      expect(adapter.requestRenderer(Scope.Root()).container).toBe(container);
    });
  });

  describe('renderTemplate()', () => {
    it('renders HTML templates with AttributeHole', () => {
      const [template, exprs] = parseHTML`
        <div id="a" class="${'b'}" :class=${{ c: true }}></div>
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div id="a">']);
      expect(slots).toHaveLength(2);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMAttribute,
          value: 'b',
          part: {
            type: PART_TYPE_ATTRIBUTE,
            node: expect.exact(childNodes[0]),
            name: 'class',
          },
        }),
      );
      expect(slots[1]).toStrictEqual(
        expect.objectContaining({
          type: DOMClass,
          value: { c: true },
          part: {
            type: PART_TYPE_ATTRIBUTE,
            node: expect.exact(childNodes[0]),
            name: ':class',
          },
        }),
      );
    });

    it('renders HTML templates with ChildNodeHole', () => {
      const [template, exprs] = parseHTML`
        <${html`<div>${'a'}</div>`}><${html`<div>${'b'}</div>`}>
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<!---->',
        '<!---->',
      ]);
      expect(slots).toHaveLength(2);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: expect.any(DOMTemplate),
          value: ['a'],
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.exact(childNodes[0]),
            sentinelNode: expect.exact(childNodes[0]),
            namespaceURI: NAMESPACE_URI_XHTML,
          },
        }),
      );
      expect(slots[1]).toStrictEqual(
        expect.objectContaining({
          type: expect.any(DOMTemplate),
          value: ['b'],
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.exact(childNodes[1]),
            sentinelNode: expect.exact(childNodes[1]),
            namespaceURI: NAMESPACE_URI_XHTML,
          },
        }),
      );
    });

    it('renders HTML templates with ChildNodeHole in MathMLElement', () => {
      const [template, exprs] = parseHTML`<math><${'a'}></math>`;

      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        ['<math>', ['<!---->']],
      ]);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMNode,
          value: 'a',
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.exact(childNodes[0]?.firstChild),
            sentinelNode: expect.exact(childNodes[0]?.firstChild),
            namespaceURI: NAMESPACE_URI_MATHML,
          },
        }),
      );
    });

    it('renders HTML templates with ChildNodeHole in SVGElement', () => {
      const [template, exprs] = parseHTML`<svg><${'a'}></svg>`;

      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        ['<svg>', ['<!---->']],
      ]);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMNode,
          value: 'a',
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.exact(childNodes[0]?.firstChild),
            sentinelNode: expect.exact(childNodes[0]?.firstChild),
            namespaceURI: NAMESPACE_URI_SVG,
          },
        }),
      );
    });

    it('renders HTML templates with ElementHole', () => {
      const [template, exprs] = parseHTML`
        <div id="a" ${{ class: 'b' }}></div>
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div id="a">']);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMSpread,
          value: { class: 'b' },
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.exact(childNodes[0]),
          },
        }),
      );
    });

    it('renders HTML templates with EventHole', () => {
      const [template, exprs] = parseHTML`
        <div id="a" @click=${() => {}}></div>
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div id="a">']);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMEvent,
          value: exprs[0],
          part: {
            type: PART_TYPE_EVENT,
            node: expect.exact(childNodes[0]),
            name: 'click',
          },
        }),
      );
    });

    it('renders HTML templates with LiveHole', () => {
      const [template, exprs] = parseHTML`
        <div class="a" $className="${'b'}"></div>
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div class="a">']);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMLive,
          value: 'b',
          part: {
            type: PART_TYPE_LIVE,
            node: expect.exact(childNodes[0]),
            name: 'className',
            defaultValue: 'a',
          },
        }),
      );
    });

    it('renders HTML templates with PropertyHole', () => {
      const [template, exprs] = parseHTML`
        <div class="a" .className="${'b'}"></div>
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div class="a">']);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMProperty,
          value: 'b',
          part: {
            type: PART_TYPE_PROPERTY,
            node: expect.exact(childNodes[0]),
            name: 'className',
            defaultValue: 'a',
          },
        }),
      );
    });

    it('renders HTML templates with TextHole', () => {
      const [template, exprs] = parseHTML`
        [${'a'}, ${'b'}, ${'c'}]
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '[',
        '', // a
        ', ',
        '', // b
        ', ',
        '', // c
        ']',
      ]);
      expect(slots).toHaveLength(3);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMNode,
          value: 'a',
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(childNodes[1]),
          },
        }),
      );
      expect(slots[1]).toStrictEqual(
        expect.objectContaining({
          type: DOMNode,
          value: 'b',
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(childNodes[3]),
          },
        }),
      );
      expect(slots[2]).toStrictEqual(
        expect.objectContaining({
          type: DOMNode,
          value: 'c',
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(childNodes[5]),
          },
        }),
      );
    });

    it('renders HTML templates with no hole', () => {
      const [template, exprs] = parseHTML`<div>a</div>`;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([['<div>', ['a']]]);
      expect(slots).toStrictEqual([]);
    });

    it('renders an empty template', () => {
      const [template, exprs] = parseHTML``;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });

    it('throws an error when the template is invalid', () => {
      const template = new DOMTemplate(
        document.createElement('template'),
        [
          {
            type: PART_TYPE_ELEMENT,
            index: 0,
          },
        ],
        'html',
      );

      expect(() => {
        launcher.launchSession((session) => {
          session.renderer.renderTemplate(template, ['a'], session);
        });
      }).toThrow('There is no node that the hole indicates.');
    });
  });

  describe('renderChildNodePart()', () => {
    it('renders child node parts with namespace URI', () => {
      const part = launcher.launchSession((session) => {
        return session.renderer.renderChildNodePart(NAMESPACE_URI_XHTML);
      });

      expect(part.namespaceURI).toBe(NAMESPACE_URI_XHTML);
    });
  });
});

describe('HydrationRenderer', () => {
  const container = document.createElement('div');
  const adapter = new HydrationAdapter(container);
  const runtime = new Runtime(adapter);
  const launcher = new SessionLauncher(runtime);

  afterEach(() => {
    container.replaceChildren();
  });

  describe('container', () => {
    it('returns the container element', () => {
      expect(adapter.requestRenderer(Scope.Root()).container).toBe(container);
    });
  });

  describe('renderTemplate()', () => {
    it('hydrates HTML templates with AttributeHole', () => {
      container.append(createElement('div', { id: 'a', class: 'b c' }));

      const [template, exprs] = parseHTML`
        <div id="a" class="${'b'}" :class=${{ c: true }}></div>
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<div id="a" class="b c">',
      ]);
      expect(slots).toHaveLength(2);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMAttribute,
          value: 'b',
          part: {
            type: PART_TYPE_ATTRIBUTE,
            node: expect.exact(childNodes[0]),
            name: 'class',
          },
        }),
      );
      expect(slots[1]).toStrictEqual(
        expect.objectContaining({
          type: DOMClass,
          value: { c: true },
          part: {
            type: PART_TYPE_ATTRIBUTE,
            node: expect.exact(childNodes[0]),
            name: ':class',
          },
        }),
      );
    });

    it('hydrates HTML templates with ChildNodeHole', () => {
      container.append(
        document.createComment(''),
        createElement('div', {}, 'a'),
        document.createComment(''),
        createElement('div', {}, 'b'),
      );

      const [template, exprs] = parseHTML`
        <${html`<div>${'a'}</div>`}><${html`<div>${'b'}</div>`}>
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '<!---->',
        '<!---->',
      ]);
      expect(slots).toHaveLength(2);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: expect.any(DOMTemplate),
          value: ['a'],
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.exact(childNodes[0]),
            sentinelNode: expect.exact(childNodes[0]),
            namespaceURI: NAMESPACE_URI_XHTML,
          },
        }),
      );
      expect(slots[1]).toStrictEqual(
        expect.objectContaining({
          type: expect.any(DOMTemplate),
          value: ['b'],
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.exact(childNodes[1]),
            sentinelNode: expect.exact(childNodes[1]),
            namespaceURI: NAMESPACE_URI_XHTML,
          },
        }),
      );
    });

    it('hydrates HTML templates with ChildNodeHole in MathMLElement', () => {
      container.append(
        createElementNS(
          NAMESPACE_URI_MATHML,
          'math',
          {},
          document.createComment(''),
        ),
      );

      const [template, exprs] = parseHTML`<math><${'a'}></math>`;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        ['<math>', ['<!---->']],
      ]);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMNode,
          value: 'a',
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.exact(childNodes[0]?.firstChild),
            sentinelNode: expect.exact(childNodes[0]?.firstChild),
            namespaceURI: NAMESPACE_URI_MATHML,
          },
        }),
      );
    });

    it('hydrates HTML templates with ChildNodeHole in SVGElement', () => {
      container.append(
        createElementNS(
          NAMESPACE_URI_SVG,
          'svg',
          {},
          document.createComment(''),
        ),
      );

      const [template, exprs] = parseHTML`<svg><${'a'}></svg>`;

      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        ['<svg>', ['<!---->']],
      ]);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMNode,
          value: 'a',
          part: {
            type: PART_TYPE_CHILD_NODE,
            node: expect.exact(childNodes[0]?.firstChild),
            sentinelNode: expect.exact(childNodes[0]?.firstChild),
            namespaceURI: NAMESPACE_URI_SVG,
          },
        }),
      );
    });

    it('hydrates HTML templates with ElementHole', () => {
      container.append(createElement('div', { id: 'a' }));

      const [template, exprs] = parseHTML`
        <div id="a" ${{ class: 'b' }}></div>
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div id="a">']);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMSpread,
          value: { class: 'b' },
          part: {
            type: PART_TYPE_ELEMENT,
            node: expect.exact(childNodes[0]),
          },
        }),
      );
    });

    it('renders HTML templates with EventHole', () => {
      container.append(createElement('div', { id: 'a' }));

      const [template, exprs] = parseHTML`
        <div id="a" @click=${() => {}}></div>
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div id="a">']);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMEvent,
          value: exprs[0],
          part: {
            type: PART_TYPE_EVENT,
            node: expect.exact(childNodes[0]),
            name: 'click',
          },
        }),
      );
    });

    it('hydrates HTML templates with LiveHole', () => {
      container.append(createElement('div', { class: 'a' }));

      const [template, exprs] = parseHTML`
        <div class="a" $className="${'b'}"></div>
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div class="a">']);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMLive,
          value: 'b',
          part: {
            type: PART_TYPE_LIVE,
            node: expect.exact(childNodes[0]),
            name: 'className',
            defaultValue: 'a',
          },
        }),
      );
    });

    it('hydrates HTML templates with PropertyHole', () => {
      container.append(createElement('div', { class: 'a' }));

      const [template, exprs] = parseHTML`
        <div class="a" .className="${'b'}"></div>
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual(['<div class="a">']);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMProperty,
          value: 'b',
          part: {
            type: PART_TYPE_PROPERTY,
            node: expect.exact(childNodes[0]),
            name: 'className',
            defaultValue: 'a',
          },
        }),
      );
    });

    it('hydrates HTML templates with TextHole', () => {
      container.append(
        document.createTextNode('['),
        document.createComment(''),
        document.createTextNode('a'),
        document.createComment(''),
        document.createTextNode(', '),
        document.createComment(''),
        document.createTextNode('b'),
        document.createComment(''),
        document.createTextNode(', '),
        document.createComment(''),
        document.createTextNode('c'),
        document.createComment(''),
        document.createTextNode(']'),
      );

      const [template, exprs] = parseHTML`
        [${'a'}, ${'b'}, ${'c'}]
      `;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([
        '[',
        'a',
        ', ',
        'b',
        ', ',
        'c',
        ']',
      ]);
      expect(slots).toHaveLength(3);
      expect(slots[0]).toStrictEqual(
        expect.objectContaining({
          type: DOMNode,
          value: 'a',
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(childNodes[1]),
          },
        }),
      );
      expect(slots[1]).toStrictEqual(
        expect.objectContaining({
          type: DOMNode,
          value: 'b',
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(childNodes[3]),
          },
        }),
      );
      expect(slots[2]).toStrictEqual(
        expect.objectContaining({
          type: DOMNode,
          value: 'c',
          part: {
            type: PART_TYPE_TEXT,
            node: expect.exact(childNodes[5]),
          },
        }),
      );
    });

    it.todo('hydrates HTML templates with no hole', () => {
      container.append(createElement('div', {}, 'a'));

      const [template, exprs] = parseHTML`<div>a</div>`;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes.map(serializeNode)).toStrictEqual([['<div>', ['a']]]);
      expect(slots).toStrictEqual([]);
    });

    it('hydrates an empty template', () => {
      const [template, exprs] = parseHTML``;
      const { childNodes, slots } = launcher.launchSession((session) => {
        return session.renderer.renderTemplate(template, exprs, session);
      });

      expect(childNodes).toStrictEqual([]);
      expect(slots).toStrictEqual([]);
    });

    it('throws an error when the template is invalid', () => {
      const template = new DOMTemplate(
        document.createElement('template'),
        [
          {
            type: PART_TYPE_ELEMENT,
            index: 0,
          },
        ],
        'html',
      );

      expect(() => {
        launcher.launchSession((session) => {
          session.renderer.renderTemplate(template, ['a'], session);
        });
      }).toThrow('There is no node that the hole indicates.');
    });

    it('throws an error when the template is invalid', () => {
      const template = new DOMTemplate(
        document.createElement('template'),
        [
          {
            type: PART_TYPE_ELEMENT,
            index: 0,
          },
        ],
        'html',
      );

      expect(() => {
        launcher.launchSession((session) => {
          session.renderer.renderTemplate(template, ['a'], session);
        });
      }).toThrow('There is no node that the hole indicates.');
    });

    it('throws on mismatch with the template nodes', () => {
      const [template, exprs] = parseHTML`<div></div>`;

      expect(() => {
        launcher.launchSession((session) => {
          session.renderer.renderTemplate(template, exprs, session);
        });
      }).toThrow('Hydration failed because the node name mismatches.');
    });

    // it.each([
    //   [html`<div></div>`, createElement('div', {})],
    //   [html`<div></div>`, createElement('div', {}, createElement('span'))],
    //   [
    //     html`<div></div>`,
    //     createElement('div', {}, document.createComment('foo')),
    //   ],
    //   [html`<div></div>`, createElement('div', {}, 'foo')],
    //   [html`<!-- foo -->`, createElement('div', {})],
    //   [html`<!-- foo -->`, createElement('div', {}, createElement('div'))],
    //   [html`<!-- foo -->`, createElement('div', {}, 'foo')],
    //   [html`foo`, createElement('div', {})],
    //   [html`foo`, createElement('div', {}, createElement('div'))],
    //   [html`foo`, createElement('div', {}, document.createComment('foo'))],
    // ])('should throw the error if there is a tree mismatch', ({
    //   template,
    // }, container) => {
    //   const part = createChildNodePart(
    //     document.createComment(''),
    //     NAMESPACE_URI_MAP.html,
    //   );
    //   const hydrationTarget = createTreeWalker(container);
    //   const launcher = new SessionLauncher();
    //
    //   expect(() => {
    //     launcher.launchSession((session) => {
    //       return template.hydrate([], part, hydrationTarget, session);
    //     });
    //   }).toThrow(HydrationError);
    // });
  });

  describe('renderChildNodePart()', () => {
    it('hydrates child node parts with namespace URI', () => {
      container.append(document.createComment(''));

      const part = launcher.launchSession((session) => {
        return session.renderer.renderChildNodePart(NAMESPACE_URI_XHTML);
      });

      expect(part.namespaceURI).toBe(NAMESPACE_URI_XHTML);
    });
  });
});

function parseHTML<TExprs extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...exprs: TExprs
): [template: DOMTemplate<TExprs>, exprs: TExprs] {
  return [
    DOMTemplate.parse(strings, exprs, 'html', TEMPLATE_PLACEHOLDER, document),
    exprs,
  ];
}

function parseMathML<const TExprs extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...exprs: TExprs
): [template: DOMTemplate<TExprs>, exprs: TExprs] {
  return [
    DOMTemplate.parse(strings, exprs, 'math', TEMPLATE_PLACEHOLDER, document),
    exprs,
  ];
}

function parseSVG<const TExprs extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...exprs: TExprs
): [template: DOMTemplate<TExprs>, exprs: TExprs] {
  return [
    DOMTemplate.parse(strings, exprs, 'svg', TEMPLATE_PLACEHOLDER, document),
    exprs,
  ];
}

function parseText<const TExprs extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...exprs: TExprs
): [template: DOMTemplate<TExprs>, exprs: TExprs] {
  return [
    DOMTemplate.parse(
      strings,
      exprs,
      'textarea',
      TEMPLATE_PLACEHOLDER,
      document,
    ),
    exprs,
  ];
}

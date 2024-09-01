import { describe, expect, it, vi } from 'vitest';

import {
  type Part,
  PartType,
  UpdateContext,
  directiveTag,
} from '../../src/baseTypes.js';
import { AttributeBinding } from '../../src/bindings/attribute.js';
import { ElementBinding } from '../../src/bindings/element.js';
import { EventBinding } from '../../src/bindings/event.js';
import { NodeBinding } from '../../src/bindings/node.js';
import { PropertyBinding } from '../../src/bindings/property.js';
import {
  TaggedTemplate,
  TaggedTemplateView,
  getMarker,
  isValidMarker,
} from '../../src/templates/taggedTemplate.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockRenderHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

const MARKER = getMarker('__test__');

describe('TaggedTemplate', () => {
  describe('.parseHTML()', () => {
    it('should parse holes inside attributes', () => {
      const { template } = html`
        <div class="container" id=${0} .innerHTML=${1} @click=${2}></div>
      `;
      expect(template.holes).toStrictEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Property, name: 'innerHTML', index: 0 },
        { type: PartType.Event, name: 'click', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<div class="container"></div>');
    });

    it('should parse holes inside double-quoted attributes', () => {
      const { template } = html`
        <div class="container" id="${0}" .innerHTML="${1}" @click="${2}"></div>
      `;
      expect(template.holes).toStrictEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Property, name: 'innerHTML', index: 0 },
        { type: PartType.Event, name: 'click', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<div class="container"></div>');
    });

    it('should parse holes inside single-quoted attributes', () => {
      const { template } = html`
        <div class="container" id='${0}' .innerHTML='${1}' @click='${2}'></div>
      `;
      expect(template.holes).toStrictEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Property, name: 'innerHTML', index: 0 },
        { type: PartType.Event, name: 'click', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<div class="container"></div>');
    });

    it('should parse holes inside attributes with whitespaces', () => {
      const { template } = html`
        <div class="container" id= "${0}" .innerHTML ="${1}" @click = "${2}"></div>
      `;
      expect(template.holes).toStrictEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Property, name: 'innerHTML', index: 0 },
        { type: PartType.Event, name: 'click', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<div class="container"></div>');
    });

    it('should parse a hole inside a tag name', () => {
      const { template } = html`
        <${0}>
        <${1} >
        <${2}/>
        <${3} />
      `;
      expect(template.holes).toStrictEqual([
        { type: PartType.ChildNode, index: 0 },
        { type: PartType.ChildNode, index: 2 },
        { type: PartType.ChildNode, index: 4 },
        { type: PartType.ChildNode, index: 6 },
      ]);
      expect(template.element.innerHTML).toBe(
        `
        <!--0-->
        <!--1-->
        <!--2-->
        <!--3-->
      `.trim(),
      );
    });

    it('should parse holes inside elements', () => {
      const { template } = html`
        <div id="foo" ${0}></div>
        <div ${1} id="foo"></div>
        <div id="foo" ${2} class="bar"></div>
      `;
      expect(template.holes).toStrictEqual([
        { type: PartType.Element, index: 0 },
        { type: PartType.Element, index: 2 },
        { type: PartType.Element, index: 4 },
      ]);
      expect(template.element.innerHTML).toBe(
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
      expect(template.holes).toStrictEqual([
        { type: PartType.Node, index: 3 },
        { type: PartType.Node, index: 6 },
      ]);
      expect(template.element.innerHTML).toBe(
        `
        <ul>
          <li></li>
          <li></li>
        </ul>
      `.trim(),
      );
    });

    it('should parse multiple holes inside a child', () => {
      const { template } = html`
        <div>[${0}, ${1}]</div>
        <div>${0}, ${1}</div>
      `;
      expect(template.holes).toStrictEqual([
        { type: PartType.Node, index: 2 },
        { type: PartType.Node, index: 4 },
        { type: PartType.Node, index: 8 },
        { type: PartType.Node, index: 10 },
      ]);
      expect(template.element.innerHTML).toBe(
        `
        <div>[, ]</div>
        <div>, </div>
      `.trim(),
      );
    });

    it('should parse a hole inside a comment as ChildNodeHole', () => {
      const { template } = html`
        <!--${0}-->
        <!--${1}/-->
        <!-- ${2} -->
        <!-- ${3} /-->
      `;
      expect(template.holes).toStrictEqual([
        { type: PartType.ChildNode, index: 0 },
        { type: PartType.ChildNode, index: 2 },
        { type: PartType.ChildNode, index: 4 },
        { type: PartType.ChildNode, index: 6 },
      ]);
      expect(template.element.innerHTML).toBe(
        `
        <!--0-->
        <!--1-->
        <!--2-->
        <!--3-->
      `.trim(),
      );
    });

    it('should parse a hole inside a tag with leading spaces as NodeHole', () => {
      const { template } = html`
        < ${0}>
        < ${0}/>
      `;
      expect(template.holes).toStrictEqual([
        { type: PartType.Node, index: 1 },
        { type: PartType.Node, index: 3 },
      ]);
      expect(template.element.innerHTML).toBe(
        `
        &lt; &gt;
        &lt; /&gt;
      `.trim(),
      );
    });

    it('should throw an error if passed a marker in an invalid format', () => {
      expect(() => {
        TaggedTemplate.parseHTML([], [], 'INVALID_MARKER');
      }).toThrow('The marker is in an invalid format:');
      expect(() => {
        TaggedTemplate.parseHTML([], [], MARKER.toUpperCase());
      }).toThrow('The marker is in an invalid format:');
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
  });

  describe('.parseSVG()', () => {
    it('should parse holes inside attributes', () => {
      const { template } = svg`
        <circle fill="black" cx=${0} cy=${1} r=${2} />
      `;
      expect(template.holes).toStrictEqual([
        { type: PartType.Attribute, name: 'cx', index: 0 },
        { type: PartType.Attribute, name: 'cy', index: 0 },
        { type: PartType.Attribute, name: 'r', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<circle fill="black"></circle>');
      expect(template.element.content.firstElementChild?.namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
    });

    it('should throw an error when it is passed a marker in an invalid format', () => {
      expect(() => {
        TaggedTemplate.parseSVG([], [], 'INVALID_MARKER');
      }).toThrow('The marker is in an invalid format:');
      expect(() => {
        TaggedTemplate.parseSVG([], [], MARKER.toUpperCase());
      }).toThrow('The marker is in an invalid format:');
    });
  });

  describe('.render()', () => {
    it('should create a new TaggedTemplateView', () => {
      const { template, data } = html`
        <div class=${'foo'}>
          <!-- ${'bar'} -->
          <input type="text" .value=${'baz'} @onchange=${() => {}} ${{ class: 'qux' }}><span>${new TextDirective()}</span>
        </div>
      `;
      const host = new MockRenderHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());
      const view = template.render(data, context);

      expect(context.isPending()).toBe(false);
      expect(view).toBeInstanceOf(TaggedTemplateView);
      expect(view.bindings).toHaveLength(data.length);
      expect(view.bindings.map((binding) => binding.value)).toStrictEqual(data);
      expect(view.bindings[0]).toBeInstanceOf(AttributeBinding);
      expect(view.bindings[0]?.part).toMatchObject({
        type: PartType.Attribute,
        name: 'class',
      });
      expect(view.bindings[1]).toBeInstanceOf(NodeBinding);
      expect(view.bindings[1]?.part).toMatchObject({
        type: PartType.ChildNode,
      });
      expect(view.bindings[2]).toBeInstanceOf(PropertyBinding);
      expect(view.bindings[2]?.part).toMatchObject({
        type: PartType.Property,
        name: 'value',
      });
      expect(view.bindings[3]).toBeInstanceOf(EventBinding);
      expect(view.bindings[3]?.part).toMatchObject({
        type: PartType.Event,
        name: 'onchange',
      });
      expect(view.bindings[4]).toBeInstanceOf(ElementBinding);
      expect(view.bindings[4]?.part).toMatchObject({
        type: PartType.Element,
      });
      expect(view.bindings[5]).toBeInstanceOf(TextBinding);
      expect(view.bindings[5]?.part).toMatchObject({
        type: PartType.Node,
      });
      expect(view.childNodes.map(toHTML)).toStrictEqual([
        `
        <div>
          <!--"bar"-->
          <input type="text"><span></span>
        </div>`.trim(),
      ]);
      expect(view.startNode).toBe(view.childNodes[0]);
      expect(view.endNode).toBe(view.childNodes[0]);

      view.connect(context);
      context.flushUpdate();

      expect(view.childNodes.map(toHTML)).toStrictEqual([
        `
        <div class="foo">
          <!--bar-->
          <input type="text" class="qux"><span></span>
        </div>`.trim(),
      ]);
    });

    it('should create a TaggedTemplateView without bindings', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const { template } = html`<div></div>`;
      const view = template.render([], context);

      expect(view).toBeInstanceOf(TaggedTemplateView);
      expect(view.bindings).toHaveLength(0);
      expect(view.childNodes.map(toHTML)).toStrictEqual(['<div></div>']);
      expect(view.startNode).toBe(view.childNodes[0]);
      expect(view.endNode).toBe(view.childNodes[0]);
    });

    it('should create a TaggedTemplateView with a empty template', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const { template } = html``;
      const view = template.render([], context);

      expect(view).toBeInstanceOf(TaggedTemplateView);
      expect(view.bindings).toHaveLength(0);
      expect(view.childNodes).toHaveLength(0);
      expect(view.startNode).toBeNull();
      expect(view.endNode).toBeNull();
    });

    it('should create a TaggedTemplateView with a single value', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const { template, data } = html`${new TextDirective('foo')}`;
      const view = template.render(data, context);

      container.appendChild(part.node);
      view.connect(context);
      view.mount(part);
      context.flushUpdate();

      expect(view).toBeInstanceOf(TaggedTemplateView);
      expect(view.bindings).toHaveLength(1);
      expect(view.bindings[0]).toBeInstanceOf(TextBinding);
      expect(view.bindings[0]!.value).toBe(data[0]);
      expect(view.childNodes).toStrictEqual([view.bindings[0]!.part.node]);
      expect(view.startNode).toBeInstanceOf(Text);
      expect(view.startNode!.nodeValue).toBe('foo');
      expect(view.endNode).toBe(view.bindings[0]!.part.node);
    });

    it('should throw an error if the number of holes and values do not match', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const { template, data } = html`
        <div class=${'foo'} class=${'bar'}></div>
      `;

      expect(() => {
        template.render(data, context);
      }).toThrow('There may be multiple holes indicating the same attribute.');
    });
  });
});

describe('TaggedTemplateView', () => {
  describe('.connect()', () => {
    it('should connect bindings in the view', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const { template, data } = html`
        <div class=${'foo'}>
          <!-- ${'bar'} -->
          <input type="text" .value=${'baz'} @onchange=${() => {}} ${{ class: 'qux' }}><span>${new TextDirective()}</span>
        </div>
      `;
      const view = template.render(data, context);

      view.connect(context);
      context.flushUpdate();

      expect(view.childNodes.map(toHTML)).toStrictEqual([
        `
        <div class="foo">
          <!--bar-->
          <input type="text" class="qux"><span></span>
        </div>`.trim(),
      ]);
    });
  });

  describe('.bind()', () => {
    it('should bind values corresponding to bindings in the view', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const { template, data } = html`
        <div class="${'foo'}">${'bar'}</div><!--${'baz'}-->
      `;
      const view = template.render(data, context);

      view.connect(context);
      context.flushUpdate();

      expect(view.childNodes.map(toHTML)).toStrictEqual([
        '<div class="foo">bar</div>',
        '<!--baz-->',
      ]);

      view.bind(['bar', 'baz', 'qux'], context);
      context.flushUpdate();

      expect(view.childNodes.map(toHTML)).toStrictEqual([
        '<div class="bar">baz</div>',
        '<!--qux-->',
      ]);
    });
  });

  describe('.unbind()', () => {
    it('should unbind top-level bindings in the view and other bindings are disconnected', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const { template, data } = html`
        ${'foo'}<div class=${'bar'}>${'baz'}</div><!--${'qux'}-->
      `;
      const view = template.render(data, context);

      container.appendChild(part.node);
      view.connect(context);
      context.flushUpdate();

      view.mount(part);

      expect(view.childNodes.map(toHTML)).toStrictEqual([
        'foo',
        '<div class="bar">baz</div>',
        '<!--qux-->',
      ]);
      expect(container.innerHTML).toBe(
        'foo<div class="bar">baz</div><!--qux--><!---->',
      );

      const unbindSpies = view.bindings.map((binding) =>
        vi.spyOn(binding, 'unbind'),
      );
      const disconnectSpies = view.bindings.map((binding) =>
        vi.spyOn(binding, 'disconnect'),
      );

      view.unbind(context);
      context.flushUpdate();

      expect(view.childNodes.map(toHTML)).toStrictEqual([
        '',
        '<div class="bar">baz</div>',
        '<!---->',
      ]);
      expect(container.innerHTML).toBe(
        '<div class="bar">baz</div><!----><!---->',
      );
      expect(unbindSpies.map((spy) => spy.mock.calls.length)).toStrictEqual([
        1, 0, 0, 1,
      ]);
      expect(disconnectSpies.map((spy) => spy.mock.calls.length)).toStrictEqual(
        [0, 1, 1, 0],
      );
    });

    it('should only unbind top-level bindings in the view', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const { template, data } = html`
        ${'foo'}<div></div><!--${'baz'}-->
      `;
      const view = template.render(data, context);

      container.appendChild(part.node);
      view.connect(context);
      context.flushUpdate();

      view.mount(part);

      expect(view.childNodes.map(toHTML)).toStrictEqual([
        'foo',
        '<div></div>',
        '<!--baz-->',
      ]);
      expect(container.innerHTML).toBe('foo<div></div><!--baz--><!---->');

      const unbindSpies = view.bindings.map((binding) =>
        vi.spyOn(binding, 'unbind'),
      );
      const disconnectSpies = view.bindings.map((binding) =>
        vi.spyOn(binding, 'disconnect'),
      );

      view.unbind(context);
      context.flushUpdate();

      expect(view.childNodes.map(toHTML)).toStrictEqual([
        '',
        '<div></div>',
        '<!---->',
      ]);
      expect(container.innerHTML).toBe('<div></div><!----><!---->');
      expect(unbindSpies.map((spy) => spy.mock.calls.length)).toStrictEqual([
        1, 1,
      ]);
      expect(disconnectSpies.map((spy) => spy.mock.calls.length)).toStrictEqual(
        [0, 0],
      );
    });

    it('should throw an error if the number of binding and values do not match', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const { template, data } = html`
        <p>Count: ${0}</p>
      `;
      const view = template.render(data, context);

      expect(() => {
        view.bind([] as any, context);
      }).toThrow('The number of new data must be 1, but got 0.');
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect bindings in the view', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = new TextDirective();
      const { template, data } = html`
        <div>${value}</div>
      `;
      let disconnects = 0;
      vi.spyOn(value, directiveTag).mockImplementation(function (
        this: TextDirective,
        part: Part,
      ) {
        const binding = new TextBinding(value, part);
        vi.spyOn(binding, 'disconnect').mockImplementation(() => {
          disconnects++;
        });
        return binding;
      });
      const view = template.render(data, context);

      expect(disconnects).toBe(0);

      view.disconnect(context);

      expect(disconnects).toBe(1);
    });
  });

  describe('.mount()', () => {
    it('should mount child nodes before the part node', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const { template, data } = html`
        <p>Hello, ${'World'}!</p>
      `;
      const view = template.render(data, context);

      container.appendChild(part.node);
      view.connect(context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('<!---->');

      view.mount(part);

      expect(container.innerHTML).toBe('<p>Hello, World!</p><!---->');

      view.unmount(part);

      expect(container.innerHTML).toBe('<!---->');
    });
  });
});

describe('getMarker()', () => {
  it('returns a valid marker string', () => {
    expect(isValidMarker(getMarker('__test__'))).toBe(true);

    // force randomUUID() polyfill.
    const originalRandomUUID = crypto.randomUUID;
    try {
      (crypto as any).randomUUID = null;
      expect(isValidMarker(getMarker('__test__'))).toBe(true);
    } finally {
      crypto.randomUUID = originalRandomUUID;
    }
  });
});

function html<TData extends readonly any[]>(
  tokens: TemplateStringsArray,
  ...data: TData
): { template: TaggedTemplate<TData>; data: TData } {
  return { template: TaggedTemplate.parseHTML(tokens, data, MARKER), data };
}

function svg<const TData extends readonly any[]>(
  tokens: TemplateStringsArray,
  ...data: TData
): { template: TaggedTemplate<TData>; data: TData } {
  return { template: TaggedTemplate.parseSVG(tokens, data, MARKER), data };
}

function toHTML(node: Node): string {
  const wrapper = document.createElement('div');
  wrapper.appendChild(node.cloneNode(true));
  return wrapper.innerHTML;
}

import { describe, expect, it, vi } from 'vitest';

import {
  type Part,
  PartType,
  type Template,
  UpdateContext,
  directiveTag,
} from '../../src/baseTypes.js';
import {
  AttributeBinding,
  ElementBinding,
  EventBinding,
  NodeBinding,
  PropertyBinding,
} from '../../src/binding.js';
import {
  TaggedTemplate,
  TaggedTemplateFragment,
  getMarker,
  isValidMarker,
} from '../../src/template/taggedTemplate.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockUpdateHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

const MARKER = getMarker('__test__');

describe('TaggedTemplate', () => {
  describe('.parseHTML()', () => {
    it('should parse holes inside attributes', () => {
      const [template] = html`
        <input type="checkbox" id=${0} .value=${1} @change=${2}>
      `;
      expect(template.holes).toEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Property, name: 'value', index: 0 },
        { type: PartType.Event, name: 'change', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<input type="checkbox">');
    });

    it('should parse holes inside double-quoted attributes', () => {
      const [template] = html`
        <input type="checkbox" id="${0}" .value="${1}" @change="${2}">
      `;
      expect(template.holes).toEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Property, name: 'value', index: 0 },
        { type: PartType.Event, name: 'change', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<input type="checkbox">');
    });

    it('should parse holes inside single-quoted attributes', () => {
      const [template] = html`
        <input type="checkbox" id='${0}' .value='${1}' @change='${2}'>
      `;
      expect(template.holes).toEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Property, name: 'value', index: 0 },
        { type: PartType.Event, name: 'change', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<input type="checkbox">');
    });

    it('should parse a hole inside a tag name', () => {
      const [template] = html`
        <${0}>
        <${1} >
        <${2}/>
        <${3} />
      `;
      expect(template.holes).toEqual([
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
      const [template] = html`
        <div id="foo" ${0}></div>
        <div ${1} id="foo"></div>
        <div id="foo" ${2} class="bar"></div>
      `;
      expect(template.holes).toEqual([
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
      const [template] = html`
        <ul>
          <li>${1}</li>
          <li>${2}</li>
        </ul>
      `;
      expect(template.holes).toEqual([
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
      const [template] = html`
        <div>[${0}, ${1}]</div>
        <div>${0}, ${1}</div>
      `;
      expect(template.holes).toEqual([
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
      const [template] = html`
        <!--${0}-->
        <!--${1}/-->
        <!-- ${2} -->
        <!-- ${3} /-->
      `;
      expect(template.holes).toEqual([
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
      const [template] = html`
        < ${0}>
        < ${0}/>
      `;
      expect(template.holes).toEqual([
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
  });

  describe('.parseSVG()', () => {
    it('should parse holes inside attributes', () => {
      const [template] = svg`
        <circle fill="black" cx=${0} cy=${1} r=${2} />
      `;
      expect(template.holes).toEqual([
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
    it('should return a new TaggedTemplateFragment', () => {
      const [template, values] = html`
        <div class=${'foo'}>
          <!-- ${'bar'} -->
          <input type="text" .value=${'baz'} @onchange=${() => {}} ${{ class: 'qux' }}><span>${new TextDirective()}</span>
        </div>
      `;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());
      const fragment = template.render(values, context);

      expect(context.isPending()).toBe(false);
      expect(fragment).toBeInstanceOf(TaggedTemplateFragment);
      expect(fragment.bindings).toHaveLength(values.length);
      expect(fragment.bindings.map((binding) => binding.value)).toEqual(values);
      expect(fragment.bindings[0]).toBeInstanceOf(AttributeBinding);
      expect(fragment.bindings[0]?.part).toMatchObject({
        type: PartType.Attribute,
        name: 'class',
      });
      expect(fragment.bindings[1]).toBeInstanceOf(NodeBinding);
      expect(fragment.bindings[1]?.part).toMatchObject({
        type: PartType.ChildNode,
      });
      expect(fragment.bindings[2]).toBeInstanceOf(PropertyBinding);
      expect(fragment.bindings[2]?.part).toMatchObject({
        type: PartType.Property,
        name: 'value',
      });
      expect(fragment.bindings[3]).toBeInstanceOf(EventBinding);
      expect(fragment.bindings[3]?.part).toMatchObject({
        type: PartType.Event,
        name: 'onchange',
      });
      expect(fragment.bindings[4]).toBeInstanceOf(ElementBinding);
      expect(fragment.bindings[4]?.part).toMatchObject({
        type: PartType.Element,
      });
      expect(fragment.bindings[5]).toBeInstanceOf(TextBinding);
      expect(fragment.bindings[5]?.part).toMatchObject({
        type: PartType.Node,
      });
      expect(fragment.childNodes.map(toHTML)).toEqual([
        `
        <div>
          <!--"bar"-->
          <input type="text"><span></span>
        </div>`.trim(),
      ]);
      expect(fragment.startNode).toBe(fragment.childNodes[0]);
      expect(fragment.endNode).toBe(fragment.childNodes[0]);

      fragment.connect(context);
      context.flushUpdate();

      expect(fragment.childNodes.map(toHTML)).toEqual([
        `
        <div class="foo">
          <!--bar-->
          <input type="text" class="qux"><span></span>
        </div>`.trim(),
      ]);
    });

    it('should return a TaggedTemplateFragment without bindings', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());
      const [template] = html`<div></div>`;
      const fragment = template.render([], context);

      expect(fragment).toBeInstanceOf(TaggedTemplateFragment);
      expect(fragment.bindings).toHaveLength(0);
      expect(fragment.childNodes.map(toHTML)).toEqual(['<div></div>']);
      expect(fragment.startNode).toBe(fragment.childNodes[0]);
      expect(fragment.endNode).toBe(fragment.childNodes[0]);
    });

    it('should return a TaggedTemplateFragment with a empty template', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());
      const [template] = html``;
      const fragment = template.render([], context);

      expect(fragment).toBeInstanceOf(TaggedTemplateFragment);
      expect(fragment.bindings).toHaveLength(0);
      expect(fragment.childNodes).toHaveLength(0);
      expect(fragment.startNode).toBeNull();
      expect(fragment.endNode).toBeNull();
    });

    it('should throw an error if the number of holes and values do not match', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());
      const [template, values] = html`
        <div class=${'foo'} class=${'bar'}></div>
      `;

      expect(() => {
        template.render(values, context);
      }).toThrow('There may be multiple holes indicating the same attribute.');
    });
  });

  describe('.isSameTemplate()', () => {
    it('should return whether the template is the same as the other template', () => {
      const [template1] = html`
        <div></div>
      `;
      const [template2] = html`
        <div></div>
      `;

      expect(template1.isSameTemplate(template1)).toBe(true);
      expect(template1.isSameTemplate(template2)).toBe(false);
      expect(template1.isSameTemplate({} as Template<unknown, unknown>)).toBe(
        false,
      );
    });
  });
});

describe('TaggedTemplateFragment', () => {
  describe('.connect()', () => {
    it('should connect bindings in the fragment', () => {
      const [template, values] = html`
        <div class=${'foo'}>
          <!-- ${'bar'} -->
          <input type="text" .value=${'baz'} @onchange=${() => {}} ${{ class: 'qux' }}><span>${new TextDirective()}</span>
        </div>
      `;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());
      const fragment = template.render(values, context);

      fragment.connect(context);
      context.flushUpdate();

      expect(fragment.childNodes.map(toHTML)).toEqual([
        `
        <div class="foo">
          <!--bar-->
          <input type="text" class="qux"><span></span>
        </div>`.trim(),
      ]);
    });
  });

  describe('.bind()', () => {
    it('should bind values corresponding to bindings in the fragment', () => {
      const [template, values] = html`
        <div class="${'foo'}">${'bar'}</div><!--${'baz'}-->
      `;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());
      const fragment = template.render(values, context);

      fragment.connect(context);
      context.flushUpdate();

      expect(fragment.childNodes.map(toHTML)).toEqual([
        '<div class="foo">bar</div>',
        '<!--baz-->',
      ]);

      fragment.bind(['bar', 'baz', 'qux'], context);
      context.flushUpdate();

      expect(fragment.childNodes.map(toHTML)).toEqual([
        '<div class="bar">baz</div>',
        '<!--qux-->',
      ]);
    });
  });

  describe('.unbind()', () => {
    it('should unbind top-level bindings in the fragment and other bindings are disconnected', () => {
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const [template, values] = html`
        ${'foo'}<div class=${'bar'}>${'baz'}</div><!--${'qux'}-->
      `;
      const fragment = template.render(values, context);

      container.appendChild(part.node);
      fragment.connect(context);
      context.flushUpdate();

      fragment.mount(part);

      expect(fragment.childNodes.map(toHTML)).toEqual([
        'foo',
        '<div class="bar">baz</div>',
        '<!--qux-->',
      ]);
      expect(container.innerHTML).toBe(
        'foo<div class="bar">baz</div><!--qux--><!---->',
      );

      const unbindSpies = fragment.bindings.map((binding) =>
        vi.spyOn(binding, 'unbind'),
      );
      const disconnectSpies = fragment.bindings.map((binding) =>
        vi.spyOn(binding, 'disconnect'),
      );

      fragment.unbind(context);
      context.flushUpdate();

      expect(fragment.childNodes.map(toHTML)).toEqual([
        '',
        '<div class="bar">baz</div>',
        '<!---->',
      ]);
      expect(container.innerHTML).toBe(
        '<div class="bar">baz</div><!----><!---->',
      );
      expect(unbindSpies.map((spy) => spy.mock.calls.length)).toEqual([
        1, 0, 0, 1,
      ]);
      expect(disconnectSpies.map((spy) => spy.mock.calls.length)).toEqual([
        0, 1, 1, 0,
      ]);
    });

    it('should only unbind top-level bindings in the fragment', () => {
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const [template, values] = html`
        ${'foo'}<div></div><!--${'baz'}-->
      `;
      const fragment = template.render(values, context);

      container.appendChild(part.node);
      fragment.connect(context);
      context.flushUpdate();

      fragment.mount(part);

      expect(fragment.childNodes.map(toHTML)).toEqual([
        'foo',
        '<div></div>',
        '<!--baz-->',
      ]);
      expect(container.innerHTML).toBe('foo<div></div><!--baz--><!---->');

      const unbindSpies = fragment.bindings.map((binding) =>
        vi.spyOn(binding, 'unbind'),
      );
      const disconnectSpies = fragment.bindings.map((binding) =>
        vi.spyOn(binding, 'disconnect'),
      );

      fragment.unbind(context);
      context.flushUpdate();

      expect(fragment.childNodes.map(toHTML)).toEqual([
        '',
        '<div></div>',
        '<!---->',
      ]);
      expect(container.innerHTML).toBe('<div></div><!----><!---->');
      expect(unbindSpies.map((spy) => spy.mock.calls.length)).toEqual([1, 1]);
      expect(disconnectSpies.map((spy) => spy.mock.calls.length)).toEqual([
        0, 0,
      ]);
    });

    it('should throw an error if the number of binding and values do not match', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());
      const [template, values] = html`
        <p>Count: ${0}</p>
      `;
      const fragment = template.render(values, context);

      expect(() => {
        fragment.bind([] as any, context);
      }).toThrow('The number of new data must be 1, but got 0.');
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect bindings in the fragment', () => {
      const value = new TextDirective();
      const [template, values] = html`
        <div>${value}</div>
      `;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());
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
      const fragment = template.render(values, context);

      expect(disconnects).toBe(0);

      fragment.disconnect();

      expect(disconnects).toBe(1);
    });
  });

  describe('.mount()', () => {
    it('should mount child nodes before the part node', () => {
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const [template, values] = html`
        <p>Hello, ${'World'}!</p>
      `;
      const fragment = template.render(values, context);

      container.appendChild(part.node);
      fragment.connect(context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('<!---->');

      fragment.mount(part);

      expect(container.innerHTML).toBe('<p>Hello, World!</p><!---->');

      fragment.unmount(part);

      expect(container.innerHTML).toBe('<!---->');
    });
  });

  describe('.unmount()', () => {
    it('should not remove child nodes if a different part is given', () => {
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const [template, values] = html`
        <p>Hello, ${'World'}!</p>
      `;
      const fragment = template.render(values, context);

      container.appendChild(part.node);
      fragment.connect(context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('<!---->');

      fragment.mount(part);

      expect(container.innerHTML).toBe('<p>Hello, World!</p><!---->');

      fragment.unmount({
        type: PartType.ChildNode,
        node: document.createComment(''),
      });

      expect(container.innerHTML).toBe('<p>Hello, World!</p><!---->');
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
  ...values: TData
): [TaggedTemplate<TData>, TData] {
  return [TaggedTemplate.parseHTML(tokens, values, MARKER), values];
}

function svg<const TData extends readonly any[]>(
  tokens: TemplateStringsArray,
  ...values: TData
): [TaggedTemplate<TData>, TData] {
  return [TaggedTemplate.parseSVG(tokens, values, MARKER), values];
}

function toHTML(node: Node): string {
  const wrapper = document.createElement('div');
  wrapper.appendChild(node.cloneNode(true));
  return wrapper.innerHTML;
}

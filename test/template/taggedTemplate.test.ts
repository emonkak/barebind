import { describe, expect, it, vi } from 'vitest';

import {
  AttributeBinding,
  ElementBinding,
  EventBinding,
  NodeBinding,
  PropertyBinding,
  directiveTag,
} from '../../src/binding.js';
import {
  TaggedTemplate,
  TaggedTemplateFragment,
  getMarker,
  isValidMarker,
} from '../../src/template/taggedTemplate.js';
import { type Part, PartType, type Template } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBinding, MockDirective, MockRenderingEngine } from '../mocks.js';

const MARKER = getMarker();

describe('TaggedTemplate', () => {
  describe('.parseHTML()', () => {
    it('should parse holes inside attributes', () => {
      const template = html`
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
      const template = html`
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
      const template = html`
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
      const template = html`
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
        <!---->
        <!---->
        <!---->
        <!---->
      `.trim(),
      );
    });

    it('should parse holes inside elements', () => {
      const template = html`
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
      const template = html`
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
      const template = html`
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
      const template = html`
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
        <!---->
        <!---->
        <!---->
        <!---->
      `.trim(),
      );
    });

    it('should parse a hole inside a tag with leading spaces as NodeHole', () => {
      const template = html`
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
        TaggedTemplate.parseHTML([], 'INVALID_MARKER');
      }).toThrow('The marker is in an invalid format:');
      expect(() => {
        TaggedTemplate.parseHTML([], MARKER.toUpperCase());
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
      const template = svg`
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
        TaggedTemplate.parseSVG([], 'INVALID_MARKER');
      }).toThrow('The marker is in an invalid format:');
      expect(() => {
        TaggedTemplate.parseSVG([], MARKER.toUpperCase());
      }).toThrow('The marker is in an invalid format:');
    });
  });

  describe('.hydrate()', () => {
    it('should hydrate a TaggedTemplateFragment', () => {
      const template = html`
        <div class=${0}>
          <!-- ${1} -->
          <input type="text" .value=${2} @onchange=${3} ${4}><span>${5}</span>
        </div>
      `;
      const values = [
        'foo',
        'bar',
        'baz',
        () => {},
        { class: 'qux' },
        new MockDirective(),
      ];
      const updater = new SyncUpdater(new MockRenderingEngine());
      const fragment = template.hydrate(values, updater);

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
      expect(fragment.bindings[5]).toBeInstanceOf(MockBinding);
      expect(fragment.bindings[5]?.part).toMatchObject({
        type: PartType.Node,
      });
      expect(fragment.childNodes.map(nodeToString)).toEqual([
        `
        <div>
          <!---->
          <input type="text"><span></span>
        </div>`.trim(),
      ]);
      expect(fragment.startNode).toBe(fragment.childNodes[0]);
      expect(fragment.endNode).toBe(fragment.childNodes[0]);

      updater.flush();

      expect(fragment.childNodes.map(nodeToString)).toEqual([
        `
        <div class="foo">
          <!--bar-->
          <input type="text" class="qux"><span></span>
        </div>`.trim(),
      ]);
    });

    it('should hydrate a TaggedTemplateFragment without bindings', () => {
      const template = html`<div></div>`;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const fragment = template.hydrate([], updater);

      expect(fragment).toBeInstanceOf(TaggedTemplateFragment);
      expect(fragment.bindings).toHaveLength(0);
      expect(fragment.childNodes.map(nodeToString)).toEqual(['<div></div>']);
      expect(fragment.startNode).toBe(fragment.childNodes[0]);
      expect(fragment.endNode).toBe(fragment.childNodes[0]);
    });

    it('should hydrate a TaggedTemplateFragment with empty template', () => {
      const template = html``;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const fragment = template.hydrate([], updater);

      expect(fragment).toBeInstanceOf(TaggedTemplateFragment);
      expect(fragment.bindings).toHaveLength(0);
      expect(fragment.childNodes).toHaveLength(0);
      expect(fragment.startNode).toBeNull();
      expect(fragment.endNode).toBeNull();
    });

    it('should throw an error if the number of holes and values do not match', () => {
      const template = html`
        <div class=${0} class=${1}></div>
      `;
      const values = ['foo', 'bar'];
      const updater = new SyncUpdater(new MockRenderingEngine());

      expect(() => {
        template.hydrate(values, updater);
      }).toThrow('There may be multiple holes indicating the same attribute.');
    });
  });

  describe('.isSameTemplate()', () => {
    it('should return whether the template is the same as other template', () => {
      const template1 = html`
        <div></div>
      `;
      const template2 = html`
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
  describe('.attach()', () => {
    it('should bind values corresponding to bindings in the fragment', () => {
      const template = html`
        <div class="${0}">${1} ${2}</div>
      `;
      const values = ['foo', 'bar', 'baz'];
      const updater = new SyncUpdater(new MockRenderingEngine());
      const fragment = template.hydrate(values, updater);

      updater.flush();

      expect(fragment.childNodes.map(nodeToString)).toEqual([
        '<div class="foo">bar baz</div>',
      ]);

      fragment.attach(['bar', 'baz', 'qux'], updater);
      updater.flush();

      expect(fragment.childNodes.map(nodeToString)).toEqual([
        '<div class="bar">baz qux</div>',
      ]);
    });
  });

  describe('.detach()', () => {
    it('should unbind bindings in the fragment', () => {
      const template = html`
        ${0}<div class=${2}>${3}</div><!--${4}-->
      `;
      const values = ['foo', 'bar', 'baz', 'qux'];
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const fragment = template.hydrate(values, updater);

      container.appendChild(part.node);
      fragment.mount(part);
      updater.flush();

      expect(fragment.childNodes.map(nodeToString)).toEqual([
        'foo',
        '<div class="bar">baz</div>',
        'qux',
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

      fragment.detach(updater);
      updater.flush();

      expect(fragment.childNodes.map(nodeToString)).toEqual([
        '',
        '<div class="bar">baz</div>',
        '',
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

    it('should throw an error if the number of binding and values do not match', () => {
      const template = html`
        <p>Count: ${0}</p>
      `;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const fragment = template.hydrate([0], updater);

      expect(() => {
        fragment.attach([], updater);
      }).toThrow('The number of new data must be 1, but got 0.');
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect bindings in the fragment', () => {
      let disconnects = 0;
      const template = html`
        <p>Count: ${0}</p>
      `;
      const directive = new MockDirective();
      vi.spyOn(directive, directiveTag).mockImplementation(function (
        this: MockDirective,
        part: Part,
      ) {
        const binding = new MockBinding(directive, part);
        vi.spyOn(binding, 'disconnect').mockImplementation(() => {
          disconnects++;
        });
        return binding;
      });
      const values = [directive];
      const updater = new SyncUpdater(new MockRenderingEngine());
      const fragment = template.hydrate(values, updater);

      expect(disconnects).toBe(0);

      fragment.disconnect();

      expect(disconnects).toBe(1);
    });
  });

  describe('.mount()', () => {
    it('should mount child nodes at the part', () => {
      const template = html`
        <p>Hello, ${0}!</p>
      `;
      const values = ['World'];
      const updater = new SyncUpdater(new MockRenderingEngine());
      const fragment = template.hydrate(values, updater);

      updater.flush();

      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;

      container.appendChild(part.node);
      fragment.mount(part);

      expect(container.innerHTML).toBe('<p>Hello, World!</p><!---->');

      fragment.unmount(part);

      expect(container.innerHTML).toBe('<!---->');
    });

    it('should not mount child nodes if the part is not mounted', () => {
      const template = html`
        <p>Hello, ${0}!</p>
      `;
      const values = ['World'];
      const updater = new SyncUpdater(new MockRenderingEngine());
      const fragment = template.hydrate(values, updater);

      updater.flush();

      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;

      fragment.mount(part);

      expect(container.innerHTML).toBe('');

      fragment.unmount(part);

      expect(container.innerHTML).toBe('');
    });
  });
});

describe('getMarker()', () => {
  it('returns a valid marker string', () => {
    expect(isValidMarker(getMarker())).toBe(true);

    // force randomUUID() polyfill.
    const originalRandomUUID = crypto.randomUUID;
    try {
      (crypto as any).randomUUID = null;
      expect(isValidMarker(getMarker())).toBe(true);
    } finally {
      crypto.randomUUID = originalRandomUUID;
    }
  });
});

function html(
  tokens: TemplateStringsArray,
  ..._values: unknown[]
): TaggedTemplate {
  return TaggedTemplate.parseHTML(tokens, MARKER);
}

function svg(
  tokens: TemplateStringsArray,
  ..._values: unknown[]
): TaggedTemplate {
  return TaggedTemplate.parseSVG(tokens, MARKER);
}

function nodeToString(node: Node): string {
  return node.nodeType === Node.ELEMENT_NODE
    ? (node as Element).outerHTML
    : node.nodeValue ?? '';
}

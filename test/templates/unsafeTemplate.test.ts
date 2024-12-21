import { describe, expect, it } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import { LazyTemplateResult } from '../../src/directives/templateResult.js';
import {
  UnsafeTemplate,
  UnsafeTemplateView,
} from '../../src/templates/unsafeTemplate.js';
import { SyncUpdater } from '../../src/updaters/syncUpdater.js';
import { MockBlock, MockRenderHost, MockTemplate } from '../mocks.js';

describe('UnsafeTemplate', () => {
  describe('.constructor()', () => {
    it('should constuct a new UnsafeHTMLTemplate', () => {
      const content = '<em>foo</em>bar<strong>baz</strong>';
      const mode = 'html';
      const template = new UnsafeTemplate(content, mode);
      expect(template.content).toBe(content);
      expect(template.mode).toBe(mode);
    });
  });

  describe('.render()', () => {
    it('should render a new template view as a HTML fragment', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new UnsafeTemplate(
        '<em>foo</em>bar<strong>baz</strong>',
        'html',
      );
      const view = template.render([], context);

      expect(view.startNode).toBe(view.childNodes[0]);
      expect(view.endNode).toBe(view.childNodes.at(-1));
      expect(view.childNodes.map(toHTML)).toStrictEqual([
        '<em>foo</em>',
        'bar',
        '<strong>baz</strong>',
      ]);
    });

    it('should render a new template view as a MathML fragment', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new UnsafeTemplate(
        '<mi>x</mi><mo>x</mo><mn>2</mn>',
        'math',
      );
      const view = template.render([], context);

      expect(view.startNode).toBe(view.childNodes[0]);
      expect(view.endNode).toBe(view.childNodes.at(-1));
      expect(
        view.childNodes.map((node) => (node as Element).namespaceURI),
      ).toStrictEqual([
        'http://www.w3.org/1998/Math/MathML',
        'http://www.w3.org/1998/Math/MathML',
        'http://www.w3.org/1998/Math/MathML',
      ]);
      expect(view.childNodes.map(toHTML)).toStrictEqual([
        '<mi>x</mi>',
        '<mo>x</mo>',
        '<mn>2</mn>',
      ]);
    });

    it('should render a new template view as a SVG fragment', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new UnsafeTemplate(
        '<circle r="10" /><text>foo</text><rect witdh="10" height="10" />',
        'svg',
      );
      const view = template.render([], context);

      expect(view.startNode).toBe(view.childNodes[0]);
      expect(view.endNode).toBe(view.childNodes.at(-1));
      expect(
        view.childNodes.map((node) => (node as Element).namespaceURI),
      ).toStrictEqual([
        'http://www.w3.org/2000/svg',
        'http://www.w3.org/2000/svg',
        'http://www.w3.org/2000/svg',
      ]);
      expect(view.childNodes.map(toHTML)).toStrictEqual([
        '<circle r="10"></circle>',
        '<text>foo</text>',
        '<rect witdh="10" height="10"></rect>',
      ]);
    });

    it('should render a new template view with no child', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new UnsafeTemplate('', 'html');
      const view = template.render([], context);

      expect(view.startNode).toBe(null);
      expect(view.endNode).toBe(null);
      expect(view.childNodes.map(toHTML)).toStrictEqual([]);
    });
  });

  describe('.isSameTemplate()', () => {
    it('should return true if the content is the same as this one', () => {
      const template = new UnsafeTemplate('foo', 'html');

      expect(template.isSameTemplate(new UnsafeTemplate('foo', 'html'))).toBe(
        true,
      );
      expect(template.isSameTemplate(new UnsafeTemplate('foo', 'math'))).toBe(
        false,
      );
      expect(template.isSameTemplate(new UnsafeTemplate('foo', 'svg'))).toBe(
        false,
      );
      expect(template.isSameTemplate(new MockTemplate())).toBe(false);
    });
  });

  describe('.wrapInResult()', () => {
    it('should wrap this template in LazyTemplateResult', () => {
      const template = new UnsafeTemplate('foo', 'html');
      const values = [] as const;
      const result = template.wrapInResult(values);

      expect(result).toBeInstanceOf(LazyTemplateResult);
      expect(result.template).toBe(template);
      expect(result.values).toBe(values);
    });
  });
});

describe('UnsafeTemplateView', () => {
  describe('.bind()', () => {
    it('should do no nothing', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const view = new UnsafeTemplateView([]);

      view.connect(context);
      view.bind([], context);

      expect(context.isPending()).toBe(false);
    });
  });

  describe('.unbind()', () => {
    it('should do no nothing', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const view = new UnsafeTemplateView([]);

      view.connect(context);
      view.unbind(context);

      expect(context.isPending()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const view = new UnsafeTemplateView([]);

      view.disconnect(context);

      expect(context.isPending()).toBe(false);
    });
  });

  describe('.mount()', () => {
    it('should mount child nodes', () => {
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
      const template = new UnsafeTemplate(
        '<em>foo</em>bar<strong>baz</strong>',
        'html',
      );
      const view = template.render([], context);

      container.appendChild(part.node);
      view.mount(part);
      expect(container.innerHTML).toStrictEqual(template.content + '<!---->');

      view.unmount(part);
      expect(container.innerHTML).toStrictEqual('<!---->');
    });
  });
});

function toHTML(node: Node): string {
  const wrapper = document.createElement('div');
  wrapper.appendChild(node.cloneNode(true));
  return wrapper.innerHTML;
}

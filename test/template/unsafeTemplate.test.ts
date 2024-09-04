import { describe, expect, it } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import { LazyTemplateResult } from '../../src/directives/templateResult.js';
import {
  UnsafeHTMLTemplate,
  UnsafeSVGTemplate,
  UnsafeTemplateView,
} from '../../src/template/unsafeTemplate.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockRenderHost, MockTemplate } from '../mocks.js';

describe('UnsafeHTMLTemplate', () => {
  describe('.constructor()', () => {
    it('should constuct a new UnsafeHTMLTemplate', () => {
      const content = '<em>foo</em>bar<strong>baz</strong>';
      const template = new UnsafeHTMLTemplate(content);
      expect(template.content).toBe(content);
    });
  });

  describe('.render()', () => {
    it('should render a new template view', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new UnsafeHTMLTemplate(
        '<em>foo</em>bar<strong>baz</strong>',
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

    it('should render a new template view with no child', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new UnsafeHTMLTemplate('');
      const view = template.render([], context);

      expect(view.startNode).toBe(null);
      expect(view.endNode).toBe(null);
      expect(view.childNodes.map(toHTML)).toStrictEqual([]);
    });
  });

  describe('.isSameTemplate()', () => {
    it('should return true if the content is the same as this one', () => {
      const template = new UnsafeHTMLTemplate('foo');

      expect(template.isSameTemplate(new UnsafeHTMLTemplate('foo'))).toBe(true);
      expect(template.isSameTemplate(new UnsafeSVGTemplate('foo'))).toBe(false);
      expect(template.isSameTemplate(new MockTemplate())).toBe(false);
    });
  });

  describe('.wrapInResult()', () => {
    it('should wrap this template in LazyTemplateResult', () => {
      const template = new UnsafeHTMLTemplate('foo');
      const data = [] as const;
      const result = template.wrapInResult(data);

      expect(result).toBeInstanceOf(LazyTemplateResult);
      expect(result.template).toBe(template);
      expect(result.data).toBe(data);
    });
  });
});

describe('UnsafeSVGTemplate', () => {
  describe('.constructor()', () => {
    it('should constuct a new UnsafeHTMLTemplate', () => {
      const content =
        '<circle r="10" /><text>foo</text><rect witdh="10" height="10" />';
      const template = new UnsafeSVGTemplate(content);
      expect(template.content).toBe(content);
    });
  });

  describe('.render()', () => {
    it('should create a new UnsafeHTMLTemplateView', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const template = new UnsafeSVGTemplate(
        '<circle r="10" /><text>foo</text><rect witdh="10" height="10" />',
      );
      const view = template.render([], context);

      expect(view.startNode).toBe(view.childNodes[0]);
      expect(view.endNode).toBe(view.childNodes.at(-1));
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

      const template = new UnsafeSVGTemplate('');
      const view = template.render([], context);

      expect(view.startNode).toBe(null);
      expect(view.endNode).toBe(null);
      expect(view.childNodes.map(toHTML)).toStrictEqual([]);
    });
  });

  describe('.isSameTemplate()', () => {
    it('should return true if the content is the same as this one', () => {
      const template = new UnsafeSVGTemplate('foo');

      expect(template.isSameTemplate(new UnsafeSVGTemplate('foo'))).toBe(true);
      expect(template.isSameTemplate(new UnsafeHTMLTemplate('foo'))).toBe(
        false,
      );
      expect(template.isSameTemplate(new MockTemplate())).toBe(false);
    });
  });

  describe('.wrapInResult()', () => {
    it('should wrap this template in LazyTemplateResult', () => {
      const template = new UnsafeSVGTemplate('foo');
      const data = [] as const;
      const result = template.wrapInResult(data);

      expect(result).toBeInstanceOf(LazyTemplateResult);
      expect(result.template).toBe(template);
      expect(result.data).toBe(data);
    });
  });
});

describe('UnsafeContentTemplateView', () => {
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
      const template = new UnsafeHTMLTemplate(
        '<em>foo</em>bar<strong>baz</strong>',
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

import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext, directiveTag } from '../../src/baseTypes.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost } from '../mocks.js';

import { UnsafeSVGBinding, unsafeSVG } from '../../src/directives/unsafeSVG.js';

describe('unsafeSVG()', () => {
  it('should construct a new UnsafeSVG directive', () => {
    const content = '<circle cx="0" cy="0" r="10" />';
    const value = unsafeSVG(content);

    expect(value.content).toBe(content);
  });
});

describe('UnsafeSVG', () => {
  describe('[directiveTag]()', () => {
    it('should return a new UnsafeSVG', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = unsafeSVG('<circle cx="0" cy="0" r="10" />');
      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part is not a ChildNodePart', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = unsafeSVG('<circle cx="0" cy="0" r="10" />');

      expect(() => value[directiveTag](part, context)).toThrow(
        'UnsafeSVG directive must be used in a child node,',
      );
    });
  });
});

describe('UnsafeSVGBinding', () => {
  describe('.connect()', () => {
    it('should insert the single node parsed from an unsafe SVG content before the part', () => {
      const container = document.createElement('svg');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = unsafeSVG(
        '<g><circle cx="0" cy="0" r="10" /><text x="15" y="5">foo</text></g>',
      );
      const binding = new UnsafeSVGBinding(value, part);

      container.appendChild(part.node);
      binding.connect(context);
      context.flushUpdate();

      expect(binding.startNode).toBeInstanceOf(SVGElement);
      expect((binding.startNode as SVGElement).outerHTML).toBe(
        '<g><circle cx="0" cy="0" r="10"></circle><text x="15" y="5">foo</text></g>',
      );
      expect((binding.startNode as SVGElement).namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
      expect(binding.endNode).toBe(part.node);
      expect(container.innerHTML).toBe(
        '<g><circle cx="0" cy="0" r="10"></circle><text x="15" y="5">foo</text></g><!---->',
      );
    });

    it('should insert the multiple nodes parsed from an unsafe SVG content before the part', () => {
      const container = document.createElement('svg');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = unsafeSVG(
        '<circle cx="0" cy="0" r="10" /><text x="15" y="5">foo</text>',
      );
      const binding = new UnsafeSVGBinding(value, part);

      container.appendChild(part.node);
      binding.connect(context);
      context.flushUpdate();

      expect(binding.startNode).toBeInstanceOf(SVGElement);
      expect((binding.startNode as SVGElement).outerHTML).toBe(
        '<circle cx="0" cy="0" r="10"></circle>',
      );
      expect((binding.startNode as SVGElement).namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
      expect(binding.endNode).toBe(part.node);
      expect(container.innerHTML).toBe(
        '<circle cx="0" cy="0" r="10"></circle><text x="15" y="5">foo</text><!---->',
      );
    });

    it('should not insert any nodese if the unsafe SVG content is empty', () => {
      const container = document.createElement('svg');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = unsafeSVG('');
      const binding = new UnsafeSVGBinding(value, part);

      container.appendChild(part.node);
      binding.connect(context);
      context.flushUpdate();

      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(container.innerHTML).toBe('<!---->');
    });

    it('should do nothing if the update is already scheduled', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = unsafeSVG('<circle cx="0" cy="0" r="10" />');
      const binding = new UnsafeSVGBinding(value, part);

      const enqueueMutationEffectSpy = vi.spyOn(
        context,
        'enqueueMutationEffect',
      );

      binding.connect(context);
      binding.connect(context);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should replace the old nodes with the nodes parsed from a new unsafe SVG content', () => {
      const container = document.createElement('svg');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value1 = unsafeSVG(
        '<circle cx="0" cy="0" r="10" /><text x="15" y="5">foo</text>',
      );
      const value2 = unsafeSVG(
        '<rect x="0" y="0" width="10" height="10" /><text x="15" y="5">bar</text>',
      );
      const binding = new UnsafeSVGBinding(value1, part);

      container.appendChild(part.node);
      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(binding.startNode).toBeInstanceOf(SVGElement);
      expect((binding.startNode as SVGElement).outerHTML).toBe(
        '<rect x="0" y="0" width="10" height="10"></rect>',
      );
      expect((binding.startNode as SVGElement).namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
      expect(binding.endNode).toBe(part.node);
      expect(container.innerHTML).toBe(
        '<rect x="0" y="0" width="10" height="10"></rect><text x="15" y="5">bar</text><!---->',
      );
    });

    it('should skip an update if the styles are the same as the previous one', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value1 = unsafeSVG('<circle cx="0" cy="0" r="10" />');
      const value2 = unsafeSVG(value1.content);
      const binding = new UnsafeSVGBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(context.isPending()).toBe(false);
    });

    it('should throw an error if the new value is not UnsafeSVG directive', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = unsafeSVG('<circle x="0" y="0" r="10" />');
      const binding = new UnsafeSVGBinding(value, part);

      expect(() => binding.bind(null as any, context)).toThrow(
        'A value must be a instance of UnsafeSVG directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should remove all nodes parsed from the current unsafe SVG content', () => {
      const container = document.createElement('svg');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = unsafeSVG(
        '<circle cx="0" cy="0" r="10" /><text x="15" y="5">foo</text>',
      );
      const binding = new UnsafeSVGBinding(value, part);

      container.appendChild(part.node);
      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(binding.value).toBe(value);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(container.innerHTML).toBe('<!---->');
    });

    it('should skip an update if the current unsafe SVG content is empty', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = unsafeSVG('');
      const binding = new UnsafeSVGBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);

      expect(binding.value).toBe(value);
      expect(context.isPending()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const value = unsafeSVG('Hello, <strong>World!</strong>');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeSVGBinding(value, part);

      binding.disconnect();
    });
  });
});

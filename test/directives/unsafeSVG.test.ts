import { describe, expect, it, vi } from 'vitest';

import { directiveTag } from '../../src/binding.js';
import { PartType } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockRenderingEngine } from '../mocks.js';

import { UnsafeSVGBinding, unsafeSVG } from '../../src/directives/unsafeSVG.js';

describe('unsafeSVG()', () => {
  it('should construct a new UnsafeSVGDirective', () => {
    const unsafeContent = '<circle cx="0" cy="0" r="10" />';
    const directive = unsafeSVG(unsafeContent);

    expect(directive.unsafeContent).toBe(unsafeContent);
  });
});

describe('UnsafeSVGDirective', () => {
  describe('[directiveTag]()', () => {
    it('should return a new instance of ClassMapBinding', () => {
      const directive = unsafeSVG('<circle cx="0" cy="0" r="10" />');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = directive[directiveTag](part, updater);

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part is not a ChildNodePart', () => {
      const directive = unsafeSVG('<circle cx="0" cy="0" r="10" />');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());

      expect(() => directive[directiveTag](part, updater)).toThrow(
        'UnsafeSVGDirective must be used in ChildNodePart.',
      );
    });
  });
});

describe('UnsafeSVGBinding', () => {
  describe('.connect()', () => {
    it('should insert the single node parsed from an unsafe SVG content before the part', () => {
      const directive = unsafeSVG(
        '<g><circle cx="0" cy="0" r="10" /><text x="15" y="5">foo</text></g>',
      );
      const container = document.createElement('svg');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeSVGBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      container.appendChild(part.node);
      binding.connect(updater);
      updater.flush();

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
      const directive = unsafeSVG(
        '<circle cx="0" cy="0" r="10" /><text x="15" y="5">foo</text>',
      );
      const container = document.createElement('svg');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeSVGBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      container.appendChild(part.node);
      binding.connect(updater);
      updater.flush();

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
      const directive = unsafeSVG('');
      const container = document.createElement('svg');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeSVGBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      container.appendChild(part.node);
      binding.connect(updater);
      updater.flush();

      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(container.innerHTML).toBe('<!---->');
    });

    it('should do nothing if the update is already scheduled', () => {
      const directive = unsafeSVG('<circle cx="0" cy="0" r="10" />');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeSVGBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.connect(updater);
      binding.connect(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should replace the old nodes with the nodes parsed from a new unsafe SVG content', () => {
      const directive1 = unsafeSVG(
        '<circle cx="0" cy="0" r="10" /><text x="15" y="5">foo</text>',
      );
      const directive2 = unsafeSVG(
        '<rect x="0" y="0" width="10" height="10" /><text x="15" y="5">bar</text>',
      );
      const container = document.createElement('svg');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeSVGBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      container.appendChild(part.node);
      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);
      updater.flush();

      expect(binding.value).toBe(directive2);
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
      const directive1 = unsafeSVG('<circle cx="0" cy="0" r="10" />');
      const directive2 = unsafeSVG(directive1.unsafeContent);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeSVGBinding(directive1, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive2, updater);

      expect(binding.value).toBe(directive1);
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should throw an error if the new value is not UnsafeSVGDirective', () => {
      const directive = unsafeSVG('<circle x="0" y="0" r="10" />');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeSVGBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      expect(() => binding.bind(null as any, updater)).toThrow(
        'A value must be a instance of "UnsafeSVGDirective", but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should remove all nodes parsed from the current unsafe SVG content', () => {
      const directive = unsafeSVG(
        '<circle cx="0" cy="0" r="10" /><text x="15" y="5">foo</text>',
      );
      const container = document.createElement('svg');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeSVGBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      container.appendChild(part.node);
      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(container.innerHTML).toBe('<!---->');
    });

    it('should skip an update if the current unsafe SVG content is empty', () => {
      const directive = unsafeSVG('');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeSVGBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const directive = unsafeSVG('Hello, <strong>World!</strong>');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeSVGBinding(directive, part);

      binding.disconnect();
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import { NodeBinding } from '../../src/binding.js';
import {
  ChildNodeTemplate,
  SingleTemplateView,
  TextTemplate,
} from '../../src/template/singleTemplate.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockUpdateHost } from '../mocks.js';

describe('ChildNodeTemplate', () => {
  describe('.constructor()', () => {
    it('should throw an error from being called directly', () => {
      expect(() => new (ChildNodeTemplate as any)()).toThrow(
        'ChildNodeTemplate constructor cannot be called directly.',
      );
    });
  });

  describe('.render()', () => {
    it('should return a new SingleTemplateView', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const view = ChildNodeTemplate.instance.render('foo', context);

      context.flushUpdate();

      expect(view.binding).toBeInstanceOf(NodeBinding);
      expect(view.binding.part).toMatchObject({
        type: PartType.ChildNode,
        node: expect.any(Comment),
      });
      expect(view.binding.part.node.nodeValue).toBe('"foo"');
      expect(view.startNode).toBe(view.binding.startNode);
      expect(view.endNode).toBe(view.binding.endNode);
    });
  });

  describe('.isSameTemplate()', () => {
    it('should return true always since the instance is a singleton', () => {
      expect(
        ChildNodeTemplate.instance.isSameTemplate(ChildNodeTemplate.instance),
      ).toBe(true);
    });
  });
});

describe('TextTemplate', () => {
  describe('.constructor()', () => {
    it('should throw an error from being called directly', () => {
      expect(() => new (TextTemplate as any)()).toThrow(
        'TextTemplate constructor cannot be called directly.',
      );
    });
  });

  describe('.render()', () => {
    it('should return SingleTemplateView', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const view = TextTemplate.instance.render('foo', context);

      expect(view.binding).toBeInstanceOf(NodeBinding);
      expect(view.binding.value).toBe('foo');
      expect(view.binding.part).toMatchObject({
        type: PartType.Node,
        node: expect.any(Text),
      });
      expect(view.startNode).toBe(view.binding.startNode);
      expect(view.endNode).toBe(view.binding.endNode);
    });
  });

  describe('.isSameTemplate', () => {
    it('should return true always since the instance is a singleton', () => {
      expect(TextTemplate.instance.isSameTemplate(TextTemplate.instance)).toBe(
        true,
      );
    });
  });
});

describe('SingleTemplateView', () => {
  describe('.connect()', () => {
    it('should connect the binding', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const binding = new NodeBinding('foo', part);
      const view = new SingleTemplateView(binding);

      view.connect(context);
      context.flushUpdate();

      expect(part.node.nodeValue).toBe('foo');

      view.bind('bar', context);
      context.flushUpdate();

      expect(part.node.nodeValue).toBe('bar');

      view.unbind(context);
      context.flushUpdate();

      expect(part.node.nodeValue).toBe('');
    });
  });

  describe('.mount()', () => {
    it('should mount the node before the part node', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const container = document.createElement('div');
      const containerPart = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const viewPart = {
        type: PartType.Node,
        node: document.createTextNode('foo'),
      } as const;
      const binding = new NodeBinding('foo', viewPart);
      const view = new SingleTemplateView(binding);

      container.appendChild(containerPart.node);
      view.connect(context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('<!---->');

      view.mount(containerPart);

      expect(container.innerHTML).toBe('foo<!---->');

      view.unmount(containerPart);

      expect(container.innerHTML).toBe('<!---->');
    });
  });

  describe('.unmount()', () => {
    it('should not remove the node if a different part is given', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const container = document.createElement('div');
      const containerPart = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const viewPart = {
        type: PartType.Node,
        node: document.createTextNode('foo'),
      } as const;
      const binding = new NodeBinding('foo', viewPart);
      const view = new SingleTemplateView(binding);

      container.appendChild(containerPart.node);

      expect(container.innerHTML).toBe('<!---->');

      view.mount(containerPart);
      context.flushUpdate();

      expect(container.innerHTML).toBe('foo<!---->');

      view.unmount({
        type: PartType.ChildNode,
        node: document.createComment(''),
      });

      expect(container.innerHTML).toBe('foo<!---->');
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the binding', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new NodeBinding('foo', part);
      const view = new SingleTemplateView(binding);

      const disconnectSpy = vi.spyOn(view.binding, 'disconnect');

      view.disconnect();

      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import { NodeBinding } from '../../src/bindings/node.js';
import {
  ChildTemplate,
  PartTemplateView,
  TextTemplate,
} from '../../src/templates/partTemplate.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockRenderHost,
  MockTemplate,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('ChildTemplate', () => {
  describe('.render()', () => {
    it('should create a new PartTemplateView', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data = [new TextDirective('foo')] as const;
      const view = new ChildTemplate().render(data, context);

      context.flushUpdate();

      expect(view.binding).toBeInstanceOf(TextBinding);
      expect(view.binding.value).toBe(data[0]);
      expect(view.binding.part).toMatchObject({
        type: PartType.ChildNode,
        node: expect.any(Comment),
      });
      expect(view.binding.part.node.nodeValue).toBe('TextDirective');
      expect(view.startNode).toBe(view.binding.startNode);
      expect(view.endNode).toBe(view.binding.endNode);
    });
  });

  describe('.isSameTemplate()', () => {
    it('should return true if the instance is the same as this one', () => {
      const template = new ChildTemplate();
      expect(template.isSameTemplate(template)).toBe(true);
      expect(template.isSameTemplate(new MockTemplate())).toBe(false);
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
    it('should return PartTemplateView', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data = ['foo'] as const;
      const view = TextTemplate.instance.render(data, context);

      expect(view).toBeInstanceOf(PartTemplateView);
      expect(view.binding).toBeInstanceOf(NodeBinding);
      expect(view.binding.value).toBe(data[0]);
      expect(view.binding.part).toMatchObject({
        type: PartType.Node,
        node: expect.any(Text),
      });
      expect(view.startNode).toBe(view.binding.startNode);
      expect(view.endNode).toBe(view.binding.endNode);
    });
  });

  describe('.isSameTemplate()', () => {
    it('should return true if the instance is the same as this one', () => {
      const template = TextTemplate.instance;
      expect(template.isSameTemplate(template)).toBe(true);
      expect(template.isSameTemplate(new MockTemplate())).toBe(false);
    });
  });
});

describe('PartTemplateView', () => {
  describe('.connect()', () => {
    it('should connect the binding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = 'foo';
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new NodeBinding(value, part);
      const view = new PartTemplateView(binding);

      const connectSpy = vi.spyOn(binding, 'connect');

      view.connect(context);
      context.flushUpdate();

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it('should bind a new string to NodeBinding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data1 = ['foo'] as [string];
      const data2 = ['bar'] as [string];
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new NodeBinding(data1[0], part);
      const view = new PartTemplateView(binding);

      const bindSpy = vi.spyOn(binding, 'bind');

      view.bind(data2, context);

      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(data2[0], context);
    });

    it('should bind a new TextDirective to TextBinding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data1 = [new TextDirective('foo')] as const;
      const data2 = [new TextDirective('bar')] as const;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TextBinding(data1[0], part);
      const view = new PartTemplateView(binding);

      const bindSpy = vi.spyOn(binding, 'bind');

      view.bind(data2, context);

      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(data2[0], context);
    });
  });

  describe('.unbind()', () => {
    it('should unbind a value from the binding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = new TextDirective('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TextBinding(value, part);
      const view = new PartTemplateView(binding);

      const unbindSpy = vi.spyOn(binding, 'unbind');

      view.unbind(context);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the binding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = new TextDirective('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TextBinding(value, part);
      const view = new PartTemplateView(binding);

      const disconnectSpy = vi.spyOn(view.binding, 'disconnect');

      view.disconnect(context);

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.mount()', () => {
    it('should mount the node before the part node', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const container = document.createElement('div');
      const containerPart = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const value = new TextDirective('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TextBinding(value, part);
      const view = new PartTemplateView(binding);

      container.appendChild(containerPart.node);
      view.mount(containerPart);
      view.connect(context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('foo<!----><!---->');

      view.unbind(context);
      context.flushUpdate();
      view.unmount(containerPart);

      expect(container.innerHTML).toBe('<!---->');
    });
  });
});

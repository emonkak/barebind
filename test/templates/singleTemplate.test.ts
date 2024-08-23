import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import { NodeBinding } from '../../src/bindings/node.js';
import {
  SingleTemplateView,
  TextTemplate,
  ValueTemplate,
} from '../../src/templates/singleTemplate.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockUpdateHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('ValueTemplate', () => {
  describe('.constructor()', () => {
    it('should throw an error from being called directly', () => {
      expect(() => new (ValueTemplate as any)()).toThrow(
        'ValueTemplate constructor cannot be called directly.',
      );
    });
  });

  describe('.render()', () => {
    it('should create a new SingleTemplateView', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data = new TextDirective('foo');
      const view = ValueTemplate.instance.render(data, context);

      context.flushUpdate();

      expect(view.binding).toBeInstanceOf(TextBinding);
      expect(view.binding.value).toBe(data);
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
    it('should return true always since the instance is a singleton', () => {
      expect(
        ValueTemplate.instance.isSameTemplate(ValueTemplate.instance),
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
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const data = 'foo';
      const view = TextTemplate.instance.render(data, context);

      expect(view).toBeInstanceOf(SingleTemplateView);
      expect(view.binding).toBeInstanceOf(NodeBinding);
      expect(view.binding.value).toBe(data);
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
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = 'foo';
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new NodeBinding(value, part);
      const view = new SingleTemplateView(binding);

      const connectSpy = vi.spyOn(binding, 'connect');

      view.connect(context);
      context.flushUpdate();

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it('should bind a new value to the binding', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = new TextDirective('foo');
      const value2 = new TextDirective('bar');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TextBinding(value1, part);
      const view = new SingleTemplateView(binding);

      const bindSpy = vi.spyOn(binding, 'bind');

      view.bind(value2, context);

      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value2, context);
    });
  });

  describe('.unbind()', () => {
    it('should unbind a value from the binding', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = new TextDirective('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TextBinding(value, part);
      const view = new SingleTemplateView(binding);

      const unbindSpy = vi.spyOn(binding, 'unbind');

      view.unbind(context);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the binding', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = new TextDirective('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TextBinding(value, part);
      const view = new SingleTemplateView(binding);

      const disconnectSpy = vi.spyOn(view.binding, 'disconnect');

      view.disconnect(context);

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.mount()', () => {
    it('should mount the node before the part node', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
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
      const view = new SingleTemplateView(binding);

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

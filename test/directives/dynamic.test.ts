import { describe, expect, it, vi } from 'vitest';

import {
  PartType,
  UpdateContext,
  directiveTag,
  nameTag,
} from '../../src/baseTypes.js';
import { NodeBinding } from '../../src/bindings/node.js';
import { DynamicBinding, dynamic } from '../../src/directives/dynamic.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockUpdateHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('dynamic()', () => {
  it('should construct a new Dynamic directive', () => {
    const value = dynamic('foo');

    expect(value.value).toBe('foo');
  });
});

describe('Dynamic', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      expect(dynamic('foo')[nameTag]).toBe('Dynamic("foo")');
      expect(dynamic(new TextDirective())[nameTag]).toBe(
        'Dynamic(TextDirective)',
      );
    });
  });

  describe('[directiveTag]()', () => {
    it('should create a new DynamicBinding from the non-directive value', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = dynamic('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = value[directiveTag](part, context);

      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });

    it('should create a new DynamicBinding from the directive value', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = dynamic(new TextDirective());
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = value[directiveTag](part, context);

      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('DynamicBinding', () => {
  describe('.connect()', () => {
    it('should connect the current binding', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = dynamic('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new DynamicBinding(value, part, context);

      const connectSpy = vi.spyOn(binding.binding, 'connect');

      binding.connect(context);

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it('should bind a new value to the current binding if old and new values are non-directive', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = dynamic('foo');
      const value2 = dynamic('bar');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new DynamicBinding(value1, part, context);

      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(part.node.nodeValue).toBe(value2.value);
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).not.toHaveBeenCalled();
    });

    it('should bind a new value to the current binding if old and new values are the same directive', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = dynamic(new TextDirective());
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new DynamicBinding(value, part, context);

      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value, context);
      context.flushUpdate();

      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value.value, context);
      expect(unbindSpy).not.toHaveBeenCalled();
    });

    it('should unbind the old binding and connect a new binding if old and new values are directive and non-directive', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = dynamic(new TextDirective());
      const value2 = dynamic('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new DynamicBinding(value1, part, context);

      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(part.node.nodeValue).toBe(value2.value);
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalled();
    });

    it('should unbind the old binding and connect a new binding if old and new values are non-directive and directive', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = dynamic('foo');
      const value2 = dynamic(new TextDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new DynamicBinding(value1, part, context);
      const textBinding = new TextBinding(value2.value as TextDirective, part);

      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');
      const connectSpy = vi.spyOn(textBinding, 'connect');
      vi.spyOn(value2.value as TextDirective, directiveTag).mockReturnValue(
        textBinding,
      );

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.binding).toBe(textBinding);
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.unbind()', () => {
    it('should unbind the current binding', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = dynamic('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new DynamicBinding(value, part, context);

      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.unbind(context);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the current binding', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = dynamic('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new DynamicBinding(value, part, context);
      const disconnectSpy = vi.spyOn(binding.binding, 'disconnect');

      binding.disconnect(context);

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
    });
  });
});

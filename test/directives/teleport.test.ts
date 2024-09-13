import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext, directiveTag } from '../../src/baseTypes.js';
import { TeleportBinding, teleport } from '../../src/directives/teleport.js';
import { SyncUpdater } from '../../src/updaters/syncUpdater.js';
import {
  MockBlock,
  MockRenderHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('teleport()', () => {
  it('should construct a new Teleport directive', () => {
    const value = new TextDirective('foo');
    const container = document.createElement('div');
    const teleportValue = teleport(value, container);

    expect(teleportValue.value).toBe(value);
    expect(teleportValue.container).toBe(container);
  });
});

describe('Teleport', () => {
  describe('[directiveTag]()', () => {
    it('should create a new TeleportBinding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = teleport(
        new TextDirective('foo'),
        document.createElement('div'),
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(binding.binding.startNode);
      expect(binding.endNode).toBe(binding.binding.endNode);
      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(binding.binding.value).toBe(value.value);
      expect(binding.binding.part.node).not.toBe(part.node);
      expect(binding.binding.part.type).toBe(PartType.ChildNode);
    });
  });
});

describe('TeloportBinding', () => {
  describe('.bind()', () => {
    it('should mount the binding in the container', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const container = document.createElement('div');
      const value1 = teleport(new TextDirective('foo'), container);
      const value2 = teleport(new TextDirective('bar'), container);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TeleportBinding(value1, part, context);

      const connectSpy = vi.spyOn(binding, 'connect');
      const bindSpy = vi.spyOn(binding, 'bind');

      binding.connect(context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('foo<!---->');
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).not.toHaveBeenCalled();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('bar<!---->');
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value2, context);
    });

    it('should move the binding when the container is changed', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      const value1 = teleport(new TextDirective('foo'), container1);
      const value2 = teleport(new TextDirective('bar'), container2);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TeleportBinding(value1, part, context);

      const connectSpy = vi.spyOn(binding, 'connect');
      const bindSpy = vi.spyOn(binding, 'bind');

      binding.connect(context);
      context.flushUpdate();

      expect(container1.innerHTML).toBe('foo<!---->');
      expect(container2.innerHTML).toBe('');
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).not.toHaveBeenCalled();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(container1.innerHTML).toBe('');
      expect(container2.innerHTML).toBe('bar<!---->');
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value2, context);
    });

    it('should update the pending value if the update is already scheduled', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const container = document.createElement('div');
      const value1 = teleport(new TextDirective('foo'), container);
      const value2 = teleport(new TextDirective('bar'), container);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TeleportBinding(value1, part, context);

      const connectSpy = vi.spyOn(binding, 'connect');
      const bindSpy = vi.spyOn(binding, 'bind');

      binding.connect(context);
      binding.bind(value2, context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('bar<!---->');
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value2, context);
    });

    it('should throw an error if the new value is not Teleport directive', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = teleport(
        new TextDirective('foo'),
        document.createElement('div'),
      );
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TeleportBinding(value, part, context);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'A value must be a instance of Teleport directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should mount the binding from the container', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const container = document.createElement('div');
      const value = teleport(new TextDirective('foo'), container);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TeleportBinding(value, part, context);

      const connectSpy = vi.spyOn(binding, 'connect');
      const unbindSpy = vi.spyOn(binding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('');
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should cancel the pending update', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const container = document.createElement('div');
      const value = teleport(new TextDirective('foo'), container);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TeleportBinding(value, part, context);

      const connectSpy = vi.spyOn(binding, 'connect');
      const unbindSpy = vi.spyOn(binding, 'unbind');

      binding.connect(context);
      binding.unbind(context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('');
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should mount the binding from the container', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const container = document.createElement('div');
      const value = teleport(new TextDirective('foo'), container);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TeleportBinding(value, part, context);

      const connectSpy = vi.spyOn(binding, 'connect');
      const disconnectSpy = vi.spyOn(binding, 'disconnect');

      binding.connect(context);
      context.flushUpdate();

      binding.disconnect(context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('');
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
    });

    it('should cancel the pending update', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const container = document.createElement('div');
      const value = teleport(new TextDirective('foo'), container);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TeleportBinding(value, part, context);

      const connectSpy = vi.spyOn(binding, 'connect');
      const disconnectSpy = vi.spyOn(binding, 'disconnect');

      binding.connect(context);
      binding.disconnect(context);
      context.flushUpdate();

      expect(container.innerHTML).toBe('');
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
    });
  });
});

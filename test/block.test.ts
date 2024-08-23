import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext } from '../src/baseTypes.js';
import { BlockBinding } from '../src/block.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockUpdateHost,
  TextBinding,
  TextDirective,
} from './mocks.js';

describe('RootBinding', () => {
  describe('.constructor()', () => {
    it('should construct a RootBinding', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      expect(rootBinding.value).toBe(value);
      expect(rootBinding.part).toBe(part);
      expect(rootBinding.startNode).toBe(part.node);
      expect(rootBinding.endNode).toBe(part.node);
      expect(rootBinding.parent).toBe(context.block);
      expect(rootBinding.priority).toBe('user-blocking');
      expect(rootBinding.isConnected).toBe(false);
      expect(rootBinding.isUpdating).toBe(false);
      expect(rootBinding.binding).toBeInstanceOf(TextBinding);
      expect(rootBinding.binding.value).toBe(value);
    });
  });
  describe('.shouldUpdate()', () => {
    it('should return false after the binding is initialized', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      expect(rootBinding.shouldUpdate()).toBe(false);
    });

    it('should return true after the binding is connected', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      rootBinding.connect(context);

      expect(rootBinding.shouldUpdate()).toBe(true);
    });

    it('should return true after an update is requested', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      rootBinding.connect(context);
      context.flushUpdate();

      rootBinding.requestUpdate('user-blocking', context);

      expect(rootBinding.shouldUpdate()).toBe(true);
    });

    it('should return false after the binding is unbound', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      rootBinding.connect(context);
      rootBinding.unbind(context);

      expect(rootBinding.shouldUpdate()).toBe(false);
    });

    it('should return false if there is a parent binding is updating', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      vi.spyOn(context.block, 'isUpdating', 'get').mockReturnValue(true);

      rootBinding.connect(context);

      expect(rootBinding.shouldUpdate()).toBe(false);
    });
  });

  describe('.cancelUpdate()', () => {
    it('should cancel the update if it is scheduled', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      rootBinding.connect(context);
      rootBinding.cancelUpdate();

      expect(rootBinding.isUpdating).toBe(false);
    });
  });

  describe('.requestUpdate()', () => {
    it('should schedule an update with the user-specified priority', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      rootBinding.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context.updater, 'scheduleUpdate');

      rootBinding.requestUpdate('background', context);

      expect(rootBinding.isUpdating).toBe(true);
      expect(rootBinding.priority).toBe('background');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(rootBinding);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should reschedule an update a higer priority', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      rootBinding.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      rootBinding.requestUpdate('background', context);
      rootBinding.requestUpdate('user-visible', context);

      expect(rootBinding.isUpdating).toBe(true);
      expect(rootBinding.priority).toBe('user-visible');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(2);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(rootBinding);
      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(2);
    });

    it('should not schedule an update with a lower or equal priority', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      rootBinding.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      rootBinding.requestUpdate('user-blocking', context);
      rootBinding.requestUpdate('user-visible', context);

      expect(rootBinding.isUpdating).toBe(true);
      expect(rootBinding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(1);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(rootBinding);
      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it('should not schedule an update if the binding is not connected', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      rootBinding.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      rootBinding.requestUpdate('background', context);
      rootBinding.requestUpdate('background', context);

      expect(rootBinding.isUpdating).toBe(true);
      expect(rootBinding.priority).toBe('background');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(rootBinding);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should not schedule an update if the binding is already updating', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      rootBinding.requestUpdate('background', context);

      expect(rootBinding.isUpdating).toBe(false);
      expect(rootBinding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).not.toHaveBeenCalled();
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
    });
  });

  describe('.connect()', () => {
    it('should enqueue the binding as a block for update with "user-blocking" priority', () => {
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
      const rootBinding = new BlockBinding(binding, { block: null });

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      rootBinding.connect(context);

      expect(rootBinding.isConnected).toBe(false);
      expect(rootBinding.isUpdating).toBe(true);
      expect(rootBinding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(rootBinding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      context.flushUpdate();

      expect(rootBinding.isConnected).toBe(true);
      expect(rootBinding.isUpdating).toBe(false);
      expect(rootBinding.priority).toBe('user-blocking');
    });

    it('should enqueue the binding for update with the parent block priority', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      const getPrioritySpy = vi
        .spyOn(context.block, 'priority', 'get')
        .mockReturnValue('background');
      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      rootBinding.connect(context);

      expect(rootBinding.isConnected).toBe(false);
      expect(rootBinding.isUpdating).toBe(true);
      expect(rootBinding.priority).toBe('background');
      expect(getPrioritySpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(rootBinding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      context.flushUpdate();

      expect(rootBinding.isConnected).toBe(true);
      expect(rootBinding.isUpdating).toBe(false);
      expect(rootBinding.priority).toBe('background');
    });

    it('should re-enqueue the binding as a block with "user-blocking" priority', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      rootBinding.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      rootBinding.requestUpdate('background', context);
      rootBinding.connect(context);

      expect(rootBinding.isConnected).toBe(true);
      expect(rootBinding.isUpdating).toBe(true);
      expect(rootBinding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(2);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(rootBinding);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();

      context.flushUpdate();

      expect(rootBinding.isConnected).toBe(true);
      expect(rootBinding.isUpdating).toBe(false);
      expect(rootBinding.priority).toBe('user-blocking');
    });

    it('should not enqueue the binding as a block if it is already enqueueing', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      rootBinding.connect(context);
      rootBinding.connect(context);

      expect(rootBinding.isConnected).toBe(false);
      expect(rootBinding.isUpdating).toBe(true);
      expect(rootBinding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(rootBinding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
    });

    it('should connect the binding on update', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      const connectSpy = vi.spyOn(binding, 'connect');

      rootBinding.connect(context);
      expect(connectSpy).not.toHaveBeenCalled();

      context.flushUpdate();
      expect(connectSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.bind()', () => {
    it('should enqueue the binding as a block for update', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      rootBinding.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      rootBinding.bind(value2, context);

      expect(rootBinding.value).toBe(value2);
      expect(rootBinding.isConnected).toBe(true);
      expect(rootBinding.isUpdating).toBe(true);
      expect(rootBinding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(rootBinding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      context.flushUpdate();

      expect(rootBinding.isConnected).toBe(true);
      expect(rootBinding.isUpdating).toBe(false);
      expect(rootBinding.priority).toBe('user-blocking');
    });

    it('should enqueue the binding as a block for update with the parent block priority', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      rootBinding.connect(context);
      context.flushUpdate();

      const getPrioritySpy = vi
        .spyOn(context.block, 'priority', 'get')
        .mockReturnValue('background');
      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      rootBinding.bind(value2, context);

      expect(rootBinding.value).toBe(value2);
      expect(rootBinding.isConnected).toBe(true);
      expect(rootBinding.isUpdating).toBe(true);
      expect(rootBinding.priority).toBe('background');
      expect(getPrioritySpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(rootBinding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      context.flushUpdate();

      expect(rootBinding.isConnected).toBe(true);
      expect(rootBinding.isUpdating).toBe(false);
      expect(rootBinding.priority).toBe('background');
    });

    it('should bind the new value to the binding on update', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      rootBinding.connect(context);
      context.flushUpdate();

      const bindSpy = vi.spyOn(binding, 'bind');

      rootBinding.bind(value2, context);
      expect(bindSpy).not.toHaveBeenCalled();

      context.flushUpdate();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(
        value2,
        expect.objectContaining({
          host: context.host,
          updater: context.updater,
          block: rootBinding,
          queue: context.queue,
        }),
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind the binding', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      const unbindSpy = vi.spyOn(binding, 'unbind');

      rootBinding.connect(context);
      context.flushUpdate();

      expect(rootBinding.isConnected).toBe(true);
      expect(rootBinding.isUpdating).toBe(false);

      rootBinding.unbind(context);

      expect(rootBinding.isConnected).toBe(false);
      expect(rootBinding.isUpdating).toBe(false);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should cancel the update in progress', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      const unbindSpy = vi.spyOn(binding, 'unbind');

      rootBinding.connect(context);

      expect(rootBinding.isConnected).toBe(false);
      expect(rootBinding.isUpdating).toBe(true);

      rootBinding.unbind(context);

      expect(rootBinding.isConnected).toBe(false);
      expect(rootBinding.isUpdating).toBe(false);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should unbind the binding', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      const disconnectSpy = vi.spyOn(binding, 'disconnect');

      rootBinding.connect(context);
      context.flushUpdate();

      expect(rootBinding.isConnected).toBe(true);
      expect(rootBinding.isUpdating).toBe(false);

      rootBinding.disconnect(context);

      expect(context.isPending()).toBe(false);
      expect(rootBinding.isConnected).toBe(false);
      expect(rootBinding.isUpdating).toBe(false);
      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
    });

    it('should cancel the update in progress', () => {
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
      const rootBinding = new BlockBinding(binding, context);

      const unbindSpy = vi.spyOn(binding, 'unbind');

      rootBinding.connect(context);

      expect(rootBinding.isConnected).toBe(false);
      expect(rootBinding.isUpdating).toBe(true);

      rootBinding.unbind(context);

      expect(rootBinding.isConnected).toBe(false);
      expect(rootBinding.isUpdating).toBe(false);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });
});

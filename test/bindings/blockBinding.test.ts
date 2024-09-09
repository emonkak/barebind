import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import { BlockBinding } from '../../src/bindings/blockBinding.js';
import { SyncUpdater } from '../../src/updaters/syncUpdater.js';
import {
  MockBlock,
  MockRenderHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('BlockBinding', () => {
  describe('.ofRoot()', () => {
    it('should construct a BlockBinding without parent', () => {
      const value = new TextDirective('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TextBinding(value, part);
      const block = BlockBinding.ofRoot(binding);

      expect(block).toBe(BlockBinding.ofRoot(block));
      expect(block.value).toBe(value);
      expect(block.part).toBe(part);
      expect(block.startNode).toBe(part.node);
      expect(block.endNode).toBe(part.node);
      expect(block.parent).toBe(null);
      expect(block.priority).toBe('user-blocking');
      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(block.binding).toBeInstanceOf(TextBinding);
      expect(block.binding.value).toBe(value);
    });
  });

  describe('.constructor()', () => {
    it('should construct a BlockBinding', () => {
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
      const block = new BlockBinding(binding, context.block);

      expect(block.value).toBe(value);
      expect(block.part).toBe(part);
      expect(block.startNode).toBe(part.node);
      expect(block.endNode).toBe(part.node);
      expect(block.parent).toBe(context.block);
      expect(block.priority).toBe('user-blocking');
      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(block.binding).toBeInstanceOf(TextBinding);
      expect(block.binding.value).toBe(value);
    });
  });

  describe('.shouldUpdate()', () => {
    it('should return false after the binding is initialized', () => {
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
      const block = new BlockBinding(binding, context.block);

      expect(block.shouldUpdate()).toBe(false);
    });

    it('should return true after the binding is connected', () => {
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
      const block = new BlockBinding(binding, context.block);

      block.connect(context);

      expect(block.shouldUpdate()).toBe(true);
    });

    it('should return true after an update is requested', () => {
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
      const block = new BlockBinding(binding, context.block);

      block.connect(context);
      context.flushUpdate();

      block.requestUpdate('user-blocking', context);

      expect(block.shouldUpdate()).toBe(true);
    });

    it('should return false after the binding is unbound', () => {
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
      const block = new BlockBinding(binding, context.block);

      block.connect(context);
      block.unbind(context);

      expect(block.shouldUpdate()).toBe(false);
    });

    it('should return false if there is a parent binding is updating', () => {
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
      const block = new BlockBinding(binding, context.block);

      vi.spyOn(context.block, 'isUpdating', 'get').mockReturnValue(true);

      block.connect(context);

      expect(block.shouldUpdate()).toBe(false);
    });
  });

  describe('.cancelUpdate()', () => {
    it('should cancel the update if it is scheduled', () => {
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
      const block = new BlockBinding(binding, context.block);

      block.connect(context);
      block.cancelUpdate();

      expect(block.isUpdating).toBe(false);
    });
  });

  describe('.requestUpdate()', () => {
    it('should schedule an update with the user-specified priority', () => {
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
      const block = new BlockBinding(binding, context.block);

      block.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context.updater, 'scheduleUpdate');

      block.requestUpdate('background', context);

      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('background');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should reschedule an update a higer priority', () => {
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
      const block = new BlockBinding(binding, context.block);

      block.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      block.requestUpdate('background', context);
      block.requestUpdate('user-visible', context);

      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('user-visible');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(2);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(2);
    });

    it('should not schedule an update with a lower or equal priority', () => {
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
      const block = new BlockBinding(binding, context.block);

      block.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      block.requestUpdate('user-blocking', context);
      block.requestUpdate('user-visible', context);

      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(1);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it('should not schedule an update if the binding is not connected', () => {
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
      const block = new BlockBinding(binding, context.block);

      block.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      block.requestUpdate('background', context);
      block.requestUpdate('background', context);

      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('background');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should not schedule an update if the binding is already updating', () => {
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
      const block = new BlockBinding(binding, context.block);

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      block.requestUpdate('background', context);

      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).not.toHaveBeenCalled();
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
    });
  });

  describe('.connect()', () => {
    it('should enqueue the binding as a block for update with "user-blocking" priority', () => {
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
      const block = new BlockBinding(binding, null);

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      block.connect(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      context.flushUpdate();

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('user-blocking');
    });

    it('should enqueue the binding for update with the parent block priority', () => {
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
      const block = new BlockBinding(binding, context.block);

      const getPrioritySpy = vi
        .spyOn(context.block, 'priority', 'get')
        .mockReturnValue('background');
      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      block.connect(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('background');
      expect(getPrioritySpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      context.flushUpdate();

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('background');
    });

    it('should re-enqueue the binding as a block with "user-blocking" priority', () => {
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
      const block = new BlockBinding(binding, context.block);

      block.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      block.requestUpdate('background', context);
      block.connect(context);

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(2);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();

      context.flushUpdate();

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('user-blocking');
    });

    it('should not enqueue the binding as a block if it is already enqueueing', () => {
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
      const block = new BlockBinding(binding, context.block);

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      block.connect(context);
      block.connect(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
    });

    it('should connect the binding on update', () => {
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
      const block = new BlockBinding(binding, context.block);

      const connectSpy = vi.spyOn(binding, 'connect');

      block.connect(context);
      expect(connectSpy).not.toHaveBeenCalled();

      context.flushUpdate();
      expect(connectSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.bind()', () => {
    it('should update the binding as a block', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
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
      const block = new BlockBinding(binding, context.block);

      block.connect(context);
      context.flushUpdate();

      const bindSpy = vi.spyOn(binding, 'bind');
      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      block.bind(value2, context);

      expect(block.value).toBe(value2);
      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('user-blocking');

      context.flushUpdate();

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('user-blocking');
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(
        value2,
        expect.objectContaining({
          host: context.host,
          updater: context.updater,
          block,
        }),
      );
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
    });

    it('should update the binding as a block with the parent block priority', () => {
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
      const block = new BlockBinding(binding, context.block);

      block.connect(context);
      context.flushUpdate();

      block.unbind(context);
      context.flushUpdate();

      const connectSpy = vi.spyOn(binding, 'connect');
      const getPrioritySpy = vi
        .spyOn(context.block, 'priority', 'get')
        .mockReturnValue('background');
      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      block.bind(value, context);

      expect(block.value).toBe(value);
      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('background');

      context.flushUpdate();

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('background');
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          host: context.host,
          updater: context.updater,
          block,
        }),
      );
      expect(getPrioritySpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
    });

    it('should not update the binding as a block if the new value is the same as the old value', () => {
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
      const block = new BlockBinding(binding, context.block);

      block.connect(context);
      context.flushUpdate();

      block.bind(value, context);

      expect(block.value).toBe(value);
      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('user-blocking');
      expect(context.isPending()).toBe(false);
    });

    it('should bind the new value to the binding on update', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
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
      const block = new BlockBinding(binding, context.block);

      block.connect(context);
      context.flushUpdate();

      const bindSpy = vi.spyOn(binding, 'bind');

      block.bind(value2, context);
      expect(bindSpy).not.toHaveBeenCalled();

      context.flushUpdate();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(
        value2,
        expect.objectContaining({
          host: context.host,
          updater: context.updater,
          block,
        }),
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind the binding', () => {
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
      const block = new BlockBinding(binding, context.block);

      const unbindSpy = vi.spyOn(binding, 'unbind');

      block.connect(context);
      context.flushUpdate();

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);

      block.unbind(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should cancel the update in progress', () => {
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
      const block = new BlockBinding(binding, context.block);

      const unbindSpy = vi.spyOn(binding, 'unbind');

      block.connect(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(true);

      block.unbind(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should unbind the binding', () => {
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
      const block = new BlockBinding(binding, context.block);

      const disconnectSpy = vi.spyOn(binding, 'disconnect');

      block.connect(context);
      context.flushUpdate();

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);

      block.disconnect(context);

      expect(context.isPending()).toBe(false);
      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
    });

    it('should cancel the update in progress', () => {
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
      const block = new BlockBinding(binding, context.block);

      const unbindSpy = vi.spyOn(binding, 'unbind');

      block.connect(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(true);

      block.unbind(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });
});

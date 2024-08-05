import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext } from '../src/baseTypes.js';
import { Root } from '../src/root.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockUpdateHost,
  TextBinding,
  TextDirective,
} from './mocks.js';

describe('Root', () => {
  describe('.constructor()', () => {
    it('should construct a Root', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const parent = new MockBlock();
      const context = new UpdateContext(host, updater, parent);

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

      expect(block.value).toBe(value);
      expect(block.part).toBe(part);
      expect(block.startNode).toBe(part.node);
      expect(block.endNode).toBe(part.node);
      expect(block.parent).toBe(parent);
      expect(block.priority).toBe('user-blocking');
      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(block.binding).toBeInstanceOf(TextBinding);
      expect(block.binding.value).toBe(value);
    });
  });
  describe('.shouldUpdate()', () => {
    it('should return false after the block is initialized', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

      expect(block.shouldUpdate()).toBe(false);
    });

    it('should return true after the block is connected', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

      block.connect(context);

      expect(block.shouldUpdate()).toBe(true);
    });

    it('should return true after an update is requested', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

      block.connect(context);
      context.flushUpdate();

      block.requestUpdate('user-blocking', context);

      expect(block.shouldUpdate()).toBe(true);
    });

    it('should return false after the block is unbound', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

      block.connect(context);
      block.unbind(context);

      expect(block.shouldUpdate()).toBe(false);
    });

    it('should return false if there is a parent block is updating', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const parent = new MockBlock();
      const context = new UpdateContext(host, updater, parent);

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

      vi.spyOn(parent, 'isUpdating', 'get').mockReturnValue(true);

      block.connect(context);

      expect(block.shouldUpdate()).toBe(false);
    });
  });

  describe('.cancelUpdate()', () => {
    it('should cancel the update if it is scheduled', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

      block.connect(context);
      block.cancelUpdate();

      expect(block.isUpdating).toBe(false);
    });
  });

  describe('.requestUpdate()', () => {
    it('should schedule an update with the user-specified priority', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

      block.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      block.requestUpdate('background', context);

      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('background');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should reschedule an update a higer priority', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

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
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

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

    it('should not schedule an update if the block is not connected', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

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

    it('should not schedule an update if the block is already updating', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

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
    it('should enqueue the block for update with "user-blocking" priority', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, { block: null });

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

    it('should enqueue the block for update with the parent block priority', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const parent = new MockBlock();
      const context = new UpdateContext(host, updater, parent);

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

      const getPrioritySpy = vi
        .spyOn(parent, 'priority', 'get')
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

    it('should re-enqueue the block with "user-blocking" priority', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

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

    it('should not enqueue a block if it is already enqueueing', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

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
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

      const connectSpy = vi.spyOn(binding, 'connect');

      block.connect(context);
      expect(connectSpy).not.toHaveBeenCalled();

      context.flushUpdate();
      expect(connectSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.bind()', () => {
    it('should enqueue the block for update', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value1 = new TextDirective('foo');
      const value2 = new TextDirective('bar');
      const binding = new TextBinding(value1, part);
      const block = new Root(binding, context);

      block.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      block.bind(value2, context);

      expect(block.value).toBe(value2);
      expect(block.isConnected).toBe(true);
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

    it('should enqueue the block for update with the parent block priority', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const parent = new MockBlock();
      const context = new UpdateContext(host, updater, parent);

      const value1 = new TextDirective('foo');
      const value2 = new TextDirective('bar');
      const binding = new TextBinding(value1, part);
      const block = new Root(binding, context);

      block.connect(context);
      context.flushUpdate();

      const getPrioritySpy = vi
        .spyOn(parent, 'priority', 'get')
        .mockReturnValue('background');
      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      block.bind(value2, context);

      expect(block.value).toBe(value2);
      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('background');
      expect(getPrioritySpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      context.flushUpdate();

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('background');
    });

    it('should bind the new value to the binding on update', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value1 = new TextDirective('foo');
      const value2 = new TextDirective('bar');
      const binding = new TextBinding(value1, part);
      const block = new Root(binding, context);

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
          host,
          updater,
          block: block,
          pipeline: context.pipeline,
        }),
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind the binding', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

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
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

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
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

      const disconnectSpy = vi.spyOn(binding, 'disconnect');

      block.connect(context);
      context.flushUpdate();

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);

      block.disconnect();

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(disconnectSpy).toHaveBeenCalledOnce();
    });

    it('should cancel the update in progress', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater, new MockBlock());

      const value = new TextDirective('foo');
      const binding = new TextBinding(value, part);
      const block = new Root(binding, context);

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

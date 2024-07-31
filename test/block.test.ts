import { describe, expect, it, vi } from 'vitest';

import { BlockBinding } from '../src/block.js';
import { PartType, createUpdateContext } from '../src/types.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockUpdateHost,
  TextBinding,
  TextDirective,
} from './mocks.js';

describe('BlockBinding', () => {
  describe('.constructor', () => {
    it('should construct a new BlockBinding', () => {
      const value = new TextDirective('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TextBinding(value, part);
      const parent = new MockBlock();
      const block = new BlockBinding(binding, parent);

      expect(block.value).toBe(value);
      expect(block.part).toBe(part);
      expect(block.startNode).toBe(part.node);
      expect(block.endNode).toBe(part.node);
      expect(block.parent).toBe(parent);
      expect(block.priority).toBe('user-blocking');
      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(block.binding).toBe(binding);
    });
  });

  describe('.shouldUpdate()', () => {
    it('should return false after the block is initialized', () => {
      const value = new TextDirective('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new TextBinding(value, part);
      const parent = new MockBlock();
      const block = new BlockBinding(binding, parent);

      expect(block.shouldUpdate()).toBe(false);
    });

    it('should return true after the block is connected', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      block.connect(context);

      expect(block.shouldUpdate()).toBe(true);
    });

    it('should return true after an update is requested', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      block.connect(context);
      updater.flushUpdate(host);

      block.requestUpdate('user-blocking', host, updater);

      expect(block.shouldUpdate()).toBe(true);
    });

    it('should return false after the block is unbound', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      block.connect(context);
      block.unbind(context);

      expect(block.shouldUpdate()).toBe(false);
    });

    it('should return false if there is a parent is updating', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const parent = new MockBlock();
      const block = new BlockBinding(binding, parent);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater, parent);

      vi.spyOn(parent, 'isUpdating', 'get').mockReturnValue(true);

      block.connect(context);

      expect(block.shouldUpdate()).toBe(false);
    });
  });

  describe('.cancelUpdate()', () => {
    it('should cancel the update if it is scheduled', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      block.connect(context);
      block.cancelUpdate();

      expect(block.isUpdating).toBe(false);
    });
  });

  describe('.requestUpdate()', () => {
    it('should schedule an update with the user-specified priority', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      block.connect(context);
      updater.flushUpdate(host);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      block.requestUpdate('background', host, updater);

      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('background');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should reschedule an update a higer priority', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      block.connect(context);
      updater.flushUpdate(host);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      block.requestUpdate('background', host, updater);
      block.requestUpdate('user-visible', host, updater);

      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('user-visible');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(2);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(2);
    });

    it('should not schedule an update with a lower or equal priority', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      block.connect(context);
      updater.flushUpdate(host);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      block.requestUpdate('user-blocking', host, updater);
      block.requestUpdate('user-visible', host, updater);

      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(1);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it('should not schedule an update if the block is not connected', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      block.connect(context);
      updater.flushUpdate(host);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      block.requestUpdate('background', host, updater);
      block.requestUpdate('background', host, updater);

      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('background');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should not schedule a update if the block is already updating', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      block.requestUpdate('background', host, updater);

      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).not.toHaveBeenCalled();
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
    });
  });

  describe('.connect()', () => {
    it('should enqueue the block for update with "user-blocking" priority', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      block.connect(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      updater.flushUpdate(host);

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('user-blocking');
    });

    it('should enqueue the block for update with the parent priority', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const parent = new MockBlock();
      const block = new BlockBinding(binding, parent);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater, parent);

      const getPrioritySpy = vi
        .spyOn(parent, 'priority', 'get')
        .mockReturnValue('background');
      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      block.connect(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('background');
      expect(getPrioritySpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      updater.flushUpdate(host);

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('background');
    });

    it('should re-enqueue the block with "user-blocking" priority', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const parent = new MockBlock();
      const block = new BlockBinding(binding, parent);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater, parent);

      block.connect(context);
      updater.flushUpdate(host);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      block.requestUpdate('background', host, updater);
      block.connect(context);

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(2);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();

      updater.flushUpdate(host);

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('user-blocking');
    });

    it('should not enqueue a block if it is already enqueueing', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

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
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const parent = new MockBlock();
      const block = new BlockBinding(binding, parent);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater, parent);

      const connectSpy = vi.spyOn(binding, 'connect');

      block.connect(context);
      expect(connectSpy).not.toHaveBeenCalled();

      updater.flushUpdate(host);
      expect(connectSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.bind()', () => {
    it('should enqueue the block for update', () => {
      const value1 = new TextDirective('foo');
      const value2 = new TextDirective('bar');
      const binding = new TextBinding(value1, {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      block.connect(context);
      updater.flushUpdate(host);

      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      block.bind(value2, context);

      expect(block.value).toBe(value2);
      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(true);
      expect(block.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(block);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      updater.flushUpdate(host);

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('user-blocking');
    });

    it('should enqueue the block for update with the parent priority', () => {
      const value1 = new TextDirective('foo');
      const value2 = new TextDirective('bar');
      const binding = new TextBinding(value1, {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const parent = new MockBlock();
      const block = new BlockBinding(binding, parent);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater, parent);

      block.connect(context);
      updater.flushUpdate(host);

      const getPrioritySpy = vi
        .spyOn(parent, 'priority', 'get')
        .mockReturnValue('background');
      const enqueueBlockSpy = vi.spyOn(updater, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

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

      updater.flushUpdate(host);

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);
      expect(block.priority).toBe('background');
    });

    it('should bind the new value to the binding on update', () => {
      const value1 = new TextDirective('foo');
      const value2 = new TextDirective('bar');
      const binding = new TextBinding(value1, {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      block.connect(context);
      updater.flushUpdate(host);

      const bindSpy = vi.spyOn(binding, 'bind');

      block.bind(value2, context);
      expect(bindSpy).not.toHaveBeenCalled();

      updater.flushUpdate(host);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value2, {
        host,
        updater,
        currentBlock: block,
      });
    });
  });

  describe('.unbind()', () => {
    it('should unbind the binding', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const unbindSpy = vi.spyOn(binding, 'unbind');

      block.connect(context);
      updater.flushUpdate(host);

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);

      block.unbind(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith({
        host,
        updater,
        currentBlock: block,
      });
    });

    it('should cancel the update in progress', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const unbindSpy = vi.spyOn(binding, 'unbind');

      block.connect(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(true);

      block.unbind(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith({
        host,
        updater,
        currentBlock: block,
      });
    });
  });

  describe('.disconnect()', () => {
    it('should unbind the binding', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const disconnectSpy = vi.spyOn(binding, 'disconnect');

      block.connect(context);
      updater.flushUpdate(host);

      expect(block.isConnected).toBe(true);
      expect(block.isUpdating).toBe(false);

      block.disconnect();

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(disconnectSpy).toHaveBeenCalledOnce();
    });

    it('should cancel the update in progress', () => {
      const binding = new TextBinding(new TextDirective('foo'), {
        type: PartType.ChildNode,
        node: document.createComment(''),
      });
      const block = new BlockBinding(binding, null);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const unbindSpy = vi.spyOn(binding, 'unbind');

      block.connect(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(true);

      block.unbind(context);

      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith({
        host,
        updater,
        currentBlock: block,
      });
    });
  });
});

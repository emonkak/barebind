import { describe, expect, it, vi } from 'vitest';

import {
  PartType,
  UpdateContext,
  directiveTag,
  nameTag,
} from '../../src/baseTypes.js';
import { RootBinding, root } from '../../src/directives/root.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockUpdateHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('root()', () => {
  it('should construct a new Root directive', () => {
    const innerValue = new TextDirective('foo');
    const value = root(innerValue);

    expect(value.value).toBe(innerValue);
    expect(value.valueOf()).toBe(innerValue);
  });
});

describe('Root', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      expect(root('foo')[nameTag]).toBe('Root("foo")');
      expect(root(new TextDirective('foo'))[nameTag]).toBe(
        'Root(TextDirective)',
      );
    });
  });

  describe('[directiveTag]()', () => {
    it('should return a new RootBinding', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const parent = new MockBlock();
      const context = new UpdateContext(host, updater, parent);

      const value = root(new TextDirective('foo'));
      const block = value[directiveTag](part, context);

      expect(block.value).toBe(value);
      expect(block.part).toBe(part);
      expect(block.startNode).toBe(part.node);
      expect(block.endNode).toBe(part.node);
      expect(block.parent).toBe(parent);
      expect(block.priority).toBe('user-blocking');
      expect(block.isConnected).toBe(false);
      expect(block.isUpdating).toBe(false);
      expect(block.binding).toBeInstanceOf(TextBinding);
      expect(block.binding.value).toBe(value.value);
    });
  });
});

describe('RootBinding', () => {
  describe('.shouldUpdate()', () => {
    it('should return false after the block is initialized', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = root(new TextDirective('foo'));
      const binding = new RootBinding(value, part, context);

      expect(binding.shouldUpdate()).toBe(false);
    });

    it('should return true after the block is connected', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = root(new TextDirective('foo'));
      const binding = new RootBinding(value, part, context);

      binding.connect(context);

      expect(binding.shouldUpdate()).toBe(true);
    });

    it('should return true after an update is requested', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = root(new TextDirective('foo'));
      const binding = new RootBinding(value, part, context);

      binding.connect(context);
      context.flushUpdate();

      binding.requestUpdate('user-blocking', context);

      expect(binding.shouldUpdate()).toBe(true);
    });

    it('should return false after the block is unbound', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = root(new TextDirective('foo'));
      const binding = new RootBinding(value, part, context);

      binding.connect(context);
      binding.unbind(context);

      expect(binding.shouldUpdate()).toBe(false);
    });

    it('should return false if there is a parent is updating', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const parent = new MockBlock();
      const context = new UpdateContext(host, updater, parent);

      const value = root(new TextDirective('foo'));
      const binding = new RootBinding(value, part, context);

      vi.spyOn(parent, 'isUpdating', 'get').mockReturnValue(true);

      binding.connect(context);

      expect(binding.shouldUpdate()).toBe(false);
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
      const context = new UpdateContext(host, updater);

      const value = root(new TextDirective('foo'));
      const binding = new RootBinding(value, part, context);

      binding.connect(context);
      binding.cancelUpdate();

      expect(binding.isUpdating).toBe(false);
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
      const context = new UpdateContext(host, updater);

      const value = root(new TextDirective('foo'));
      const binding = new RootBinding(value, part, context);

      binding.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      binding.requestUpdate('background', context);

      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('background');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should reschedule an update a higer priority', () => {
      const value = root(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new RootBinding(value, part, context);

      binding.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      binding.requestUpdate('background', context);
      binding.requestUpdate('user-visible', context);

      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-visible');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(2);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(2);
    });

    it('should not schedule an update with a lower or equal priority', () => {
      const value = root(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new RootBinding(value, part, context);

      binding.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      binding.requestUpdate('user-blocking', context);
      binding.requestUpdate('user-visible', context);

      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(1);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it('should not schedule an update if the block is not connected', () => {
      const value = root(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new RootBinding(value, part, context);

      binding.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      binding.requestUpdate('background', context);
      binding.requestUpdate('background', context);

      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('background');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should not schedule an update if the block is already updating', () => {
      const value = root(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new RootBinding(value, part, context);

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      binding.requestUpdate('background', context);

      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).not.toHaveBeenCalled();
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
    });
  });

  describe('.connect()', () => {
    it('should enqueue the block for update with "user-blocking" priority', () => {
      const value = root(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new RootBinding(value, part, context);

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      binding.connect(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      context.flushUpdate();

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('user-blocking');
    });

    it('should enqueue the block for update with the parent priority', () => {
      const value = root(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const parent = new MockBlock();
      const context = new UpdateContext(host, updater, parent);
      const binding = new RootBinding(value, part, context);

      const getPrioritySpy = vi
        .spyOn(parent, 'priority', 'get')
        .mockReturnValue('background');
      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      binding.connect(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('background');
      expect(getPrioritySpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      context.flushUpdate();

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('background');
    });

    it('should re-enqueue the block with "user-blocking" priority', () => {
      const value = root(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new RootBinding(value, part, context);

      binding.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      binding.requestUpdate('background', context);
      binding.connect(context);

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledTimes(2);
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();

      context.flushUpdate();

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('user-blocking');
    });

    it('should not enqueue a block if it is already enqueueing', () => {
      const value = root(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new RootBinding(value, part, context);

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      binding.connect(context);
      binding.connect(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
    });

    it('should connect the binding on update', () => {
      const value = root(new TextDirective('foo'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new RootBinding(value, part, context);

      const connectSpy = vi.spyOn(binding.binding, 'connect');

      binding.connect(context);
      expect(connectSpy).not.toHaveBeenCalled();

      context.flushUpdate();
      expect(connectSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.bind()', () => {
    it('should enqueue the block for update', () => {
      const value1 = root(new TextDirective('foo'));
      const value2 = root(new TextDirective('bar'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new RootBinding(value1, part, context);

      binding.connect(context);
      context.flushUpdate();

      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('user-blocking');
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      context.flushUpdate();

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('user-blocking');
    });

    it('should enqueue the block for update with the parent priority', () => {
      const value1 = root(new TextDirective('foo'));
      const value2 = root(new TextDirective('bar'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const parent = new MockBlock();
      const context = new UpdateContext(host, updater, parent);
      const binding = new RootBinding(value1, part, context);

      binding.connect(context);
      context.flushUpdate();

      const getPrioritySpy = vi
        .spyOn(parent, 'priority', 'get')
        .mockReturnValue('background');
      const enqueueBlockSpy = vi.spyOn(context, 'enqueueBlock');
      const scheduleUpdateSpy = vi.spyOn(context, 'scheduleUpdate');

      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(true);
      expect(binding.priority).toBe('background');
      expect(getPrioritySpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledOnce();
      expect(enqueueBlockSpy).toHaveBeenCalledWith(binding);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      context.flushUpdate();

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);
      expect(binding.priority).toBe('background');
    });

    it('should bind the new value to the binding on update', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value1 = root(new TextDirective('foo'));
      const value2 = root(new TextDirective('bar'));
      const binding = new RootBinding(value1, part, context);

      binding.connect(context);
      context.flushUpdate();

      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.bind(value2, context);
      expect(bindSpy).not.toHaveBeenCalled();

      context.flushUpdate();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(
        value2.value,
        expect.objectContaining({
          host,
          updater,
          block: binding,
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
      const context = new UpdateContext(host, updater);

      const value = root(new TextDirective('foo'));
      const binding = new RootBinding(value, part, context);

      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);

      binding.unbind(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(false);
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
      const context = new UpdateContext(host, updater);

      const value = root(new TextDirective('foo'));
      const binding = new RootBinding(value, part, context);

      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(true);

      binding.unbind(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(false);
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
      const context = new UpdateContext(host, updater);

      const value = root(new TextDirective('foo'));
      const binding = new RootBinding(value, part, context);

      const disconnectSpy = vi.spyOn(binding, 'disconnect');

      binding.connect(context);
      context.flushUpdate();

      expect(binding.isConnected).toBe(true);
      expect(binding.isUpdating).toBe(false);

      binding.disconnect();

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(false);
      expect(disconnectSpy).toHaveBeenCalledOnce();
    });

    it('should cancel the update in progress', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);

      const value = root(new TextDirective('foo'));
      const binding = new RootBinding(value, part, context);

      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(true);

      binding.unbind(context);

      expect(binding.isConnected).toBe(false);
      expect(binding.isUpdating).toBe(false);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });
});
